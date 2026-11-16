import * as THREE from 'three';
import { Sounds } from '../audio';
import { Point, isDiggable } from '../game/forest';
import { Game, Tool, WARMTH_TEXT, Warmth } from '../game/game';
import { mulberry32 } from '../game/rng';
import {
  Chest,
  Dog,
  Jeep,
  createCan,
  createChest,
  createDog,
  createHeldDetector,
  createHeldShovel,
  createHole,
  createJeep,
  mat,
} from './models';
import { World, buildWorld, tileCenter, worldToTile } from './world';

export interface FpsUi {
  toast(text: string, durationMs?: number): void;
  refreshHud(): void;
  /** Player pressed "Menü" in the pause screen. */
  exitToMenu(): void;
}

type DigKind = 'treasure' | 'junk' | 'empty';

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
  life: number;
  drag: number;
  gravity: number;
}

const EYE_HEIGHT = 1.7;
const PLAYER_RADIUS = 0.35;
const WALK_SPEED = 4.5;
const RUN_SPEED = 7.5;
const REACH = 5.5;
const WARMTH_COLORS: Record<Warmth, number> = { 3: 0xef4444, 2: 0xf97316, 1: 0xfacc15, 0: 0x60a5fa };

/**
 * First-person 3D view of the same Game: same forest, same clues, same rules.
 * Only presentation and input live here; every rule is enforced by Game.
 */
export class FpsMode {
  tool: Tool = 'dig';

  private readonly renderer: THREE.WebGLRenderer;
  private readonly camera = new THREE.PerspectiveCamera(70, 1, 0.05, 200);
  private world: World | null = null;
  private game: Game | null = null;

  private yaw = 0;
  private pitch = 0;
  private readonly keys = new Set<string>();
  private readonly stick = { x: 0, y: 0 };
  private walkPhase = 0;
  private locked = false;
  private pauseVisible = false;
  /** 'lock' = classic FPS mouse (pointer lock); 'drag' = fallback when the browser refuses pointer lock. */
  private lookMode: 'lock' | 'drag' = 'lock';
  private dragging = false;
  /** Cursor position over the canvas (0..1), used for edge-turning in free-look mode. */
  private pointerX = 0.5;
  private pointerInside = false;
  private dragDistance = 0;
  private readonly touch = matchMedia('(pointer: coarse)').matches;

  private readonly marker: THREE.LineLoop;
  private target: Point | null = null;

  private readonly shovel = createHeldShovel();
  private readonly detector = createHeldDetector();
  private swingStart = -1;
  private readonly pendingDigs: { at: number; point: Point; kind: DigKind; done: boolean }[] = [];

  private particles: Particle[] = [];
  private chest: Chest | null = null;
  private chestStart = 0;
  private beam: THREE.Mesh | null = null;
  private dog: Dog | null = null;
  private dogTarget: THREE.Vector3 | null = null;
  private jeep: Jeep | null = null;
  private jeepTarget: THREE.Vector3 | null = null;
  private endHandled = false;
  private lastSiren = 0;

  private readonly listeners: [EventTarget, string, EventListener][] = [];

  constructor(
    private readonly root: HTMLElement,
    private readonly sounds: Sounds,
    private readonly ui: FpsUi,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.className = 'fps-canvas';
    root.querySelector('#fps-canvas-host')!.appendChild(this.renderer.domElement);

    this.camera.rotation.order = 'YXZ';

    const square = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-1.35, 0.05, -1.35),
      new THREE.Vector3(1.35, 0.05, -1.35),
      new THREE.Vector3(1.35, 0.05, 1.35),
      new THREE.Vector3(-1.35, 0.05, 1.35),
    ]);
    this.marker = new THREE.LineLoop(square, new THREE.LineBasicMaterial({ color: 0xfff8e1, transparent: true, opacity: 0.9 }));

    // held tools sit in front of the camera
    this.shovel.position.set(0.42, -0.42, -0.75);
    this.shovel.rotation.set(-0.35, 0.25, -0.35);
    this.detector.group.position.set(0.38, -0.38, -0.75);
    this.detector.group.rotation.set(-0.6, 0.2, -0.2);
    this.camera.add(this.shovel, this.detector.group);
    this.camera.add(new THREE.PointLight(0xffffff, 0.6, 3)); // lights the held tools

    this.buildCompass();
    this.bindInput();
    this.resize();
  }

  /** The game clock stops while the desktop player is in the pause screen (pointer not locked). */
  get paused(): boolean {
    return this.pauseVisible || (!this.touch && this.lookMode === 'lock' && !this.locked);
  }

  start(game: Game): void {
    this.game = game;
    this.world = buildWorld(game.forest, game.seed);
    const scene = this.world.scene;
    scene.add(this.camera, this.marker);

    // reset state
    this.particles = [];
    this.pendingDigs.length = 0;
    this.chest = null;
    this.beam = null;
    this.dog = null;
    this.dogTarget = null;
    this.jeep = null;
    this.jeepTarget = null;
    this.endHandled = false;
    this.swingStart = -1;
    this.keys.clear();

    // start at the south fence, looking north - in front of the free (grass) column closest to the middle
    const lastRow = game.forest.rows - 1;
    const columns = Array.from({ length: game.forest.cols }, (_, x) => x)
      .filter((x) => isDiggable(game.forest, x, lastRow))
      .sort((a, b) => Math.abs(a - (game.forest.cols - 1) / 2) - Math.abs(b - (game.forest.cols - 1) / 2));
    const startX = columns.length > 0 ? tileCenter(game.forest, { x: columns[0], y: lastRow }).x : 0;
    this.camera.position.set(startX, EYE_HEIGHT, this.world.halfD + 0.5);
    this.yaw = 0;
    this.pitch = -0.12;

    const clues = this.root.querySelector('#fps-clues ol')!;
    clues.replaceChildren(
      ...game.puzzle.clues.map((c) => {
        const li = document.createElement('li');
        li.textContent = c.text;
        return li;
      }),
    );

    this.setTool('dig');
    this.root.classList.remove('hidden');
    this.root.classList.toggle('touch', this.touch);
    this.resize();
    this.showPause(true);
  }

  stop(): void {
    if (document.pointerLockElement) document.exitPointerLock();
    this.root.classList.add('hidden');
    this.world = null;
    this.game = null;
  }

  setTool(tool: Tool): void {
    if (tool === 'dog') {
      this.useDog();
      return;
    }
    this.tool = tool;
    this.shovel.visible = tool === 'dig';
    this.detector.group.visible = tool === 'detector';
    this.root.querySelectorAll<HTMLElement>('.fps-tool').forEach((el) => el.classList.toggle('active', el.dataset.tool === tool));
  }

  // ------------------------------------------------------------------ frame

  update(now: number, dtMs: number): void {
    if (!this.world || !this.game) return;
    const dt = Math.min(0.05, dtMs / 1000);

    if (!this.paused && this.game.status === 'playing') {
      this.move(dt);
      this.turn(dt);
    }
    this.camera.rotation.set(this.pitch, this.yaw, 0);

    this.updateTarget();
    this.animateTools(now);
    this.processPendingDigs(now);
    this.animateParticles(dt);
    this.animateChest(now);
    this.animateDog(now, dt);
    this.animateJeep(now, dt);
    this.updateCompass();
    this.handleEnd(now);

    // hurry: siren pings in the last 15 seconds
    if (this.game.status === 'playing' && this.game.timeLeftMs < 15_000 && now - this.lastSiren > 1600 && !this.paused) {
      this.lastSiren = now;
      this.sounds.play('siren');
    }

    this.renderer.render(this.world.scene, this.camera);
  }

  resize(): void {
    const width = this.root.clientWidth || window.innerWidth;
    const height = this.root.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------------ movement

  private move(dt: number): void {
    const world = this.world!;
    let forward = 0;
    let strafe = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) forward += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) forward -= 1;
    if (this.keys.has('KeyD')) strafe += 1;
    if (this.keys.has('KeyA')) strafe -= 1;
    forward += -this.stick.y;
    strafe += this.stick.x;

    const length = Math.hypot(forward, strafe);
    if (length > 0.01) {
      const speed = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? RUN_SPEED : WALK_SPEED;
      const f = forward / Math.max(1, length);
      const s = strafe / Math.max(1, length);
      const sin = Math.sin(this.yaw);
      const cos = Math.cos(this.yaw);
      const p = this.camera.position;
      p.x += (-sin * f + cos * s) * speed * dt;
      p.z += (-cos * f - sin * s) * speed * dt;
      this.walkPhase += dt * speed * 2.2;
    }

    // collisions: push the player out of trees, rocks and landmarks
    const p = this.camera.position;
    for (const c of world.colliders) {
      const dx = p.x - c.x;
      const dz = p.z - c.z;
      const distance = Math.hypot(dx, dz);
      const min = c.r + PLAYER_RADIUS;
      if (distance < min && distance > 0.0001) {
        p.x = c.x + (dx / distance) * min;
        p.z = c.z + (dz / distance) * min;
      }
    }
    p.x = THREE.MathUtils.clamp(p.x, -world.halfW - 0.9, world.halfW + 0.9);
    p.z = THREE.MathUtils.clamp(p.z, -world.halfD - 0.9, world.halfD + 0.9);
    p.y = EYE_HEIGHT + Math.sin(this.walkPhase) * 0.045;
  }

  /** Arrow keys turn; in free-look mode holding the cursor near the left/right edge keeps turning. */
  private turn(dt: number): void {
    let rate = 0;
    if (this.keys.has('ArrowLeft')) rate += 1;
    if (this.keys.has('ArrowRight')) rate -= 1;
    if (this.lookMode === 'drag' && this.pointerInside && !this.dragging) {
      const edge = 0.14;
      if (this.pointerX < edge) rate += (edge - this.pointerX) / edge;
      else if (this.pointerX > 1 - edge) rate -= (this.pointerX - (1 - edge)) / edge;
    }
    this.yaw += rate * 2.2 * dt;
  }

  /** The tile under the crosshair (within reach), else the tile the player stands on. */
  private updateTarget(): void {
    const game = this.game!;
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);
    let target: Point | null = null;

    if (direction.y < -0.05) {
      const t = -this.camera.position.y / direction.y;
      const hit = this.camera.position.clone().addScaledVector(direction, t);
      const reach = Math.hypot(hit.x - this.camera.position.x, hit.z - this.camera.position.z);
      if (reach <= REACH) target = worldToTile(game.forest, hit.x, hit.z);
    }
    if (!target) target = worldToTile(game.forest, this.camera.position.x, this.camera.position.z);

    this.target = target;
    const prompt = this.root.querySelector<HTMLElement>('#fps-prompt')!;

    if (!target || game.status !== 'playing') {
      this.marker.visible = false;
      prompt.textContent = '';
      return;
    }

    const ok = isDiggable(game.forest, target.x, target.y) && (this.tool !== 'dig' || !game.isDug(target.x, target.y));
    const center = tileCenter(game.forest, target);
    this.marker.position.set(center.x, 0, center.z);
    this.marker.visible = true;
    (this.marker.material as THREE.LineBasicMaterial).color.set(ok ? 0xfff8e1 : 0xef4444);

    const action = this.touch ? 'Koppints: ÁS' : 'Klikk / E';
    prompt.textContent = !ok
      ? game.isDug(target.x, target.y) ? 'Itt már ástál' : 'Ide nem lehet'
      : this.tool === 'dig' ? `${action} – ásás ide` : `${action} – mérés itt`;
  }

  // ------------------------------------------------------------------ actions

  private act(): void {
    const game = this.game;
    if (!game || game.status !== 'playing' || !this.target) return;
    const now = performance.now();

    if (this.tool === 'detector') {
      const result = game.detect(this.target.x, this.target.y);
      if (!result.ok) {
        this.ui.toast(result.reason);
        return;
      }
      this.addDetectionRing(this.target, result.value.warmth);
      this.flashLed(result.value.warmth);
      this.sounds.play('beep', result.value.warmth);
      this.ui.toast(`📡 ${WARMTH_TEXT[result.value.warmth]}`);
      if (game.detectorsLeft === 0) this.setTool('dig');
    } else {
      if (this.swingStart > 0 && now - this.swingStart < 550) return; // still swinging
      const result = game.dig(this.target.x, this.target.y);
      if (!result.ok) {
        this.ui.toast(result.reason);
        return;
      }
      this.swingStart = now;
      this.sounds.play('swing');
      const dig = result.value;
      this.pendingDigs.push({ at: now + 320, point: { x: dig.x, y: dig.y }, kind: dig.kind, done: false });
      if (dig.kind === 'junk') {
        window.setTimeout(() => this.ui.toast(`Találtál ${dig.item}. Pénz az nincs.`), 350);
      } else if (dig.kind === 'empty') {
        window.setTimeout(() => this.ui.toast('Csak föld. (−3 mp)'), 350);
      } else {
        window.setTimeout(() => this.ui.toast('💰 MEGVAN!'), 400);
      }
    }
    this.ui.refreshHud();
  }

  private useDog(): void {
    const game = this.game;
    if (!game || !this.world) return;
    const result = game.useDog();
    if (!result.ok) {
      this.ui.toast(result.reason);
      return;
    }
    const dog = createDog();
    const start = this.camera.position.clone();
    dog.group.position.set(start.x + 0.8, 0, start.z + 0.3);
    this.world.scene.add(dog.group);
    this.dog = dog;
    this.dogTarget = tileCenter(game.forest, result.value);
    this.sounds.play('bark');
    this.ui.toast('🐕 Morzsi szimatol… kövesd!');
    this.ui.refreshHud();
  }

  private processPendingDigs(now: number): void {
    const game = this.game!;
    for (const dig of this.pendingDigs) {
      if (dig.done || now < dig.at) continue;
      dig.done = true;
      const center = tileCenter(game.forest, dig.point);
      const hole = createHole(mulberry32(dig.point.x * 31 + dig.point.y));
      hole.position.copy(center);
      this.world!.scene.add(hole);
      this.burst(center, 'dirt', 26);
      this.sounds.play(dig.kind === 'junk' ? 'junk' : 'dig');

      if (dig.kind === 'junk') {
        const can = createCan();
        can.position.set(center.x + 0.2, 0.05, center.z + 0.1);
        this.world!.scene.add(can);
      } else if (dig.kind === 'treasure') {
        this.raiseChest(dig.point, now + 200, false);
        window.setTimeout(() => this.sounds.play('win'), 300);
      }
    }
  }

  private raiseChest(point: Point, start: number, reveal: boolean): void {
    if (this.chest) return;
    const center = tileCenter(this.game!.forest, point);
    const chest = createChest();
    chest.group.position.set(center.x, -0.8, center.z);
    chest.group.rotation.y = Math.atan2(this.camera.position.x - center.x, this.camera.position.z - center.z);
    this.world!.scene.add(chest.group);
    this.chest = chest;
    this.chestStart = start;

    if (reveal) {
      // a column of light shows where it was
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.6, 0.9, 40, 16, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xffd25a, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide }),
      );
      beam.position.set(center.x, 20, center.z);
      this.world!.scene.add(beam);
      this.beam = beam;
    }
  }

  private addDetectionRing(point: Point, warmth: Warmth): void {
    const center = tileCenter(this.game!.forest, point);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.95, 1.2, 32),
      new THREE.MeshBasicMaterial({ color: WARMTH_COLORS[warmth], transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(center.x, 0.04, center.z);
    const fill = new THREE.Mesh(
      new THREE.CircleGeometry(0.95, 32),
      new THREE.MeshBasicMaterial({ color: WARMTH_COLORS[warmth], transparent: true, opacity: 0.18, depthWrite: false }),
    );
    fill.rotation.x = -Math.PI / 2;
    fill.position.set(center.x, 0.035, center.z);
    this.world!.scene.add(ring, fill);
  }

  private flashLed(warmth: Warmth): void {
    const material = this.detector.led.material as THREE.MeshLambertMaterial;
    material.emissive.setHex(WARMTH_COLORS[warmth]);
    window.setTimeout(() => material.emissive.setHex(0x000000), 1500);
  }

  // ------------------------------------------------------------------ animations

  private animateTools(now: number): void {
    const bob = Math.sin(this.walkPhase) * 0.02;
    const idle = Math.sin(now / 600) * 0.01;
    this.shovel.position.y = -0.42 + bob + idle;
    this.detector.group.position.y = -0.38 + bob + idle;
    this.detector.group.rotation.z = -0.2 + Math.sin(now / 300) * 0.05;

    if (this.swingStart > 0) {
      const t = (now - this.swingStart) / 550;
      if (t >= 1) {
        this.swingStart = -1;
        this.shovel.rotation.x = -0.35;
        this.shovel.position.z = -0.75;
      } else {
        const swing = Math.sin(t * Math.PI);
        this.shovel.rotation.x = -0.35 - swing * 1.1;
        this.shovel.position.z = -0.75 - swing * 0.25;
      }
    }
  }

  private burst(center: THREE.Vector3, kind: 'dirt' | 'bill' | 'spark', count: number): void {
    const scene = this.world!.scene;
    const geometry =
      kind === 'bill' ? new THREE.PlaneGeometry(0.32, 0.16) : kind === 'spark' ? new THREE.OctahedronGeometry(0.05) : new THREE.BoxGeometry(0.12, 0.12, 0.12);
    for (let i = 0; i < count; i++) {
      const material =
        kind === 'bill'
          ? new THREE.MeshLambertMaterial({ color: Math.random() < 0.5 ? 0x3f9d55 : 0x6cc57f, side: THREE.DoubleSide })
          : kind === 'spark'
            ? new THREE.MeshBasicMaterial({ color: 0xffe08a })
            : mat(Math.random() < 0.5 ? '#5a3a1e' : '#7a5532');
      const m = new THREE.Mesh(geometry, material);
      m.position.set(center.x + (Math.random() - 0.5) * 0.6, 0.3, center.z + (Math.random() - 0.5) * 0.6);
      const angle = Math.random() * Math.PI * 2;
      const speed = kind === 'dirt' ? 1.5 + Math.random() * 2 : 1 + Math.random() * 2.5;
      scene.add(m);
      this.particles.push({
        mesh: m,
        velocity: new THREE.Vector3(Math.cos(angle) * speed, kind === 'dirt' ? 3 + Math.random() * 2.5 : 5 + Math.random() * 4, Math.sin(angle) * speed),
        spin: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8),
        life: kind === 'bill' ? 3.5 + Math.random() * 1.5 : 0.9 + Math.random() * 0.5,
        drag: kind === 'bill' ? 0.96 : 0.995,
        gravity: kind === 'bill' ? 2.2 : 12,
      });
    }
  }

  private animateParticles(dt: number): void {
    const scene = this.world!.scene;
    this.particles = this.particles.filter((p) => {
      p.life -= dt;
      if (p.life <= 0) {
        scene.remove(p.mesh);
        return false;
      }
      p.velocity.y -= p.gravity * dt;
      p.velocity.multiplyScalar(p.drag);
      p.mesh.position.addScaledVector(p.velocity, dt);
      if (p.mesh.position.y < 0.03) {
        p.mesh.position.y = 0.03;
        p.velocity.set(0, 0, 0);
        p.spin.set(0, 0, 0);
      }
      p.mesh.rotation.x += p.spin.x * dt;
      p.mesh.rotation.y += p.spin.y * dt;
      p.mesh.rotation.z += p.spin.z * dt;
      return true;
    });
  }

  private animateChest(now: number): void {
    if (!this.chest || now < this.chestStart) return;
    const t = (now - this.chestStart) / 1000;
    const rise = Math.min(1, t / 1.0);
    this.chest.group.position.y = -0.8 + 0.8 * (1 - (1 - rise) ** 3);
    const open = THREE.MathUtils.clamp((t - 0.9) / 0.6, 0, 1);
    this.chest.lid.rotation.x = -open * 1.9;
    this.chest.light.intensity = open * 6 * (0.85 + Math.sin(now / 150) * 0.15);
    if (open > 0 && !this.chest.group.userData.burst && this.game?.status === 'won') {
      this.chest.group.userData.burst = true;
      const center = this.chest.group.position.clone();
      this.burst(center, 'bill', 60);
      this.burst(center, 'spark', 30);
    }
    if (this.beam) {
      (this.beam.material as THREE.MeshBasicMaterial).opacity = 0.18 + Math.sin(now / 200) * 0.08;
    }
  }

  private animateDog(now: number, dt: number): void {
    if (!this.dog || !this.dogTarget) return;
    const g = this.dog.group;
    const to = new THREE.Vector3(this.dogTarget.x - g.position.x, 0, this.dogTarget.z - g.position.z);
    const distance = to.length();
    if (distance > 0.15) {
      const step = Math.min(distance, 6.5 * dt);
      to.normalize();
      g.position.addScaledVector(to, step);
      g.rotation.y = Math.atan2(-to.z, to.x);
      const gallop = Math.sin(now / 55);
      this.dog.legs.forEach((leg, i) => (leg.rotation.z = (i % 2 ? 1 : -1) * gallop * 0.7));
      g.position.y = Math.abs(gallop) * 0.08;
    } else {
      // sit, wag, show "!"
      g.position.y = 0;
      this.dog.legs.forEach((leg, i) => (leg.rotation.z = i < 2 ? 0.9 : 0));
      g.rotation.z = 0.25;
      this.dog.bubble.visible = true;
      if (!g.userData.barked) {
        g.userData.barked = true;
        this.sounds.play('bark');
      }
    }
    this.dog.tail.rotation.x = Math.sin(now / 80) * 0.6;
  }

  private animateJeep(now: number, dt: number): void {
    if (!this.jeep || !this.jeepTarget) return;
    const g = this.jeep.group;
    const to = new THREE.Vector3(this.jeepTarget.x - g.position.x, 0, this.jeepTarget.z - g.position.z);
    const distance = to.length();
    if (distance > 0.2) {
      to.normalize();
      g.position.addScaledVector(to, Math.min(distance, 9 * dt));
      g.rotation.y = Math.atan2(to.x, to.z);
    }
    const flash = Math.floor(now / 250) % 2 === 0;
    (this.jeep.beaconRed.material as THREE.MeshLambertMaterial).emissiveIntensity = flash ? 2 : 0;
    (this.jeep.beaconBlue.material as THREE.MeshLambertMaterial).emissiveIntensity = flash ? 0 : 2;
  }

  /** Lost: show where the treasure was; if time ran out, the squad's jeep rolls in. */
  private handleEnd(now: number): void {
    const game = this.game!;
    if (game.status === 'playing' || this.endHandled) return;
    this.endHandled = true;
    if (document.pointerLockElement) document.exitPointerLock();
    this.marker.visible = false;

    if (game.status === 'lost') {
      this.raiseChest(game.treasure, now + 300, true);
      this.sounds.play('lose');
      if (game.lossReason === 'time') {
        const jeep = createJeep();
        const p = this.camera.position;
        const from = new THREE.Vector3(p.x > 0 ? -this.world!.halfW - 1 : this.world!.halfW + 1, 0, p.z - 8);
        jeep.group.position.copy(from);
        this.world!.scene.add(jeep.group);
        this.jeep = jeep;
        // stops 5 m before the player
        this.jeepTarget = new THREE.Vector3(p.x - Math.sign(p.x - from.x) * 5, 0, p.z - 2);
        // look towards the jeep
        this.yaw = Math.atan2(-(from.x - p.x), -(from.z - p.z));
      }
    }
  }

  // ------------------------------------------------------------------ HUD

  private buildCompass(): void {
    const strip = this.root.querySelector<HTMLElement>('#compass-strip')!;
    const labels: [number, string][] = [
      [0, 'É'], [45, 'ÉK'], [90, 'K'], [135, 'DK'], [180, 'D'], [225, 'DNy'], [270, 'Ny'], [315, 'ÉNy'],
    ];
    const parts: string[] = [];
    for (let copy = -1; copy <= 1; copy++) {
      for (let deg = 0; deg < 360; deg += 15) {
        const left = (copy * 360 + deg) * 4;
        const label = labels.find(([d]) => d === deg);
        parts.push(
          label
            ? `<span class="compass-label${deg === 0 ? ' north' : ''}" style="left:${left}px">${label[1]}</span>`
            : `<span class="compass-tick" style="left:${left}px"></span>`,
        );
      }
    }
    strip.innerHTML = parts.join('');
  }

  private updateCompass(): void {
    // yaw 0 = looking north (-Z); turning right (east) decreases yaw.
    const heading = ((-this.yaw * 180) / Math.PI + 360 * 10) % 360;
    const strip = this.root.querySelector<HTMLElement>('#compass-strip')!;
    strip.style.transform = `translateX(${-heading * 4}px)`;
  }

  private showPause(show: boolean): void {
    this.pauseVisible = show;
    this.root.querySelector('#fps-pause')!.classList.toggle('hidden', !show);
  }

  // ------------------------------------------------------------------ input

  private on(target: EventTarget, type: string, handler: EventListener): void {
    target.addEventListener(type, handler);
    this.listeners.push([target, type, handler]);
  }

  private bindInput(): void {
    const canvas = this.renderer.domElement;

    this.on(this.root.querySelector('#fps-resume')!, 'click', () => {
      this.sounds.unlock();
      if (this.touch || this.lookMode === 'drag') {
        this.showPause(false);
      } else {
        this.requestLock();
      }
    });
    this.on(this.root.querySelector('#fps-menu')!, 'click', () => this.ui.exitToMenu());

    this.on(document, 'pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (this.lookMode === 'lock' && this.game && this.game.status === 'playing') this.showPause(!this.locked);
    });
    this.on(document, 'pointerlockerror', () => this.useDragLook());

    this.on(canvas, 'mousedown', (e) => {
      const m = e as MouseEvent;
      if (this.lookMode === 'drag') {
        if (m.button === 0) {
          this.dragging = true;
          this.dragDistance = 0;
        }
        return;
      }
      if (!this.locked) {
        if (!this.touch && this.game?.status === 'playing') this.requestLock();
        return;
      }
      if (m.button === 0) this.act();
    });

    this.on(window, 'mouseup', () => {
      if (this.lookMode !== 'drag' || !this.dragging) return;
      this.dragging = false;
      // a click without dragging digs, a drag only looks around
      if (this.dragDistance < 6 && !this.pauseVisible) this.act();
    });

    this.on(document, 'mousemove', (e) => {
      const m = e as MouseEvent;
      if (this.locked) {
        this.look(m.movementX * 0.0022, m.movementY * 0.0022);
      } else if (this.lookMode === 'drag' && !this.pauseVisible) {
        // free look: the view follows the mouse in real time (no button needed)
        // clamp: when the cursor (re)enters the window, browsers report one huge jump
        const dx = THREE.MathUtils.clamp(m.movementX, -60, 60);
        const dy = THREE.MathUtils.clamp(m.movementY, -60, 60);
        if (this.dragging) this.dragDistance += Math.abs(dx) + Math.abs(dy);
        this.look(dx * 0.005, dy * 0.005);
      }
    });

    this.on(canvas, 'mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.pointerX = ((e as MouseEvent).clientX - rect.left) / rect.width;
      this.pointerInside = true;
    });
    this.on(canvas, 'mouseleave', () => {
      this.pointerInside = false;
    });

    this.on(window, 'keydown', (e) => {
      if (this.root.classList.contains('hidden')) return;
      const k = e as KeyboardEvent;
      this.keys.add(k.code);
      if (k.code === 'KeyE' || k.code === 'Space') {
        k.preventDefault();
        this.act();
      }
      if (k.code === 'Escape' && this.lookMode === 'drag' && this.game?.status === 'playing') {
        this.showPause(!this.pauseVisible);
      }
      if (k.code === 'KeyM' || k.code === 'Tab') {
        k.preventDefault();
        this.root.querySelector('#fps-clues')!.classList.toggle('expanded');
      }
    });
    this.on(window, 'keyup', (e) => this.keys.delete((e as KeyboardEvent).code));
    this.on(window, 'blur', () => this.keys.clear());
    this.on(window, 'resize', () => this.resize());

    this.root.querySelectorAll<HTMLElement>('.fps-tool').forEach((button) =>
      this.on(button, 'click', () => {
        this.sounds.play('click');
        this.setTool(button.dataset.tool as Tool);
        this.ui.refreshHud();
      }),
    );

    // ---- touch: left stick moves, dragging elsewhere looks around, big button digs
    const stick = this.root.querySelector<HTMLElement>('#touch-stick')!;
    const knob = stick.querySelector<HTMLElement>('.knob')!;
    let stickId: number | null = null;
    let lookId: number | null = null;
    let lookX = 0;
    let lookY = 0;
    let originX = 0;
    let originY = 0;

    this.on(stick, 'touchstart', (e) => {
      const t = (e as TouchEvent).changedTouches[0];
      stickId = t.identifier;
      const rect = stick.getBoundingClientRect();
      originX = rect.left + rect.width / 2;
      originY = rect.top + rect.height / 2;
      e.preventDefault();
    });
    this.on(canvas, 'touchstart', (e) => {
      const t = (e as TouchEvent).changedTouches[0];
      lookId = t.identifier;
      lookX = t.clientX;
      lookY = t.clientY;
      this.sounds.unlock();
    });
    this.on(window, 'touchmove', (e) => {
      for (const t of Array.from((e as TouchEvent).changedTouches)) {
        if (t.identifier === stickId) {
          const dx = THREE.MathUtils.clamp(t.clientX - originX, -45, 45);
          const dy = THREE.MathUtils.clamp(t.clientY - originY, -45, 45);
          this.stick.x = dx / 45;
          this.stick.y = dy / 45;
          knob.style.transform = `translate(${dx}px, ${dy}px)`;
        } else if (t.identifier === lookId) {
          this.look((t.clientX - lookX) * 0.005, (t.clientY - lookY) * 0.005);
          lookX = t.clientX;
          lookY = t.clientY;
        }
      }
    });
    this.on(window, 'touchend', (e) => {
      for (const t of Array.from((e as TouchEvent).changedTouches)) {
        if (t.identifier === stickId) {
          stickId = null;
          this.stick.x = 0;
          this.stick.y = 0;
          knob.style.transform = '';
        }
        if (t.identifier === lookId) lookId = null;
      }
    });
    this.on(this.root.querySelector('#touch-act')!, 'touchstart', (e) => {
      e.preventDefault();
      this.act();
    });
    this.on(this.root.querySelector('#touch-act')!, 'click', () => this.act());
    this.on(this.root.querySelector('#fps-clues')!, 'click', () => this.root.querySelector('#fps-clues')!.classList.toggle('expanded'));
  }

  /**
   * Pointer lock is refused in some places (sandboxed iframes, some browser settings), sometimes silently.
   * If it hasn't kicked in shortly after the click, switch to drag-to-look instead of leaving the player stuck.
   */
  private requestLock(): void {
    const canvas = this.renderer.domElement;
    if (!canvas.requestPointerLock) {
      this.useDragLook();
      return;
    }
    try {
      const result = canvas.requestPointerLock() as unknown;
      if (result instanceof Promise) result.catch(() => this.useDragLook());
    } catch {
      this.useDragLook();
      return;
    }
    window.setTimeout(() => {
      if (!this.locked && this.lookMode === 'lock' && this.pauseVisible) this.useDragLook();
    }, 400);
  }

  private useDragLook(): void {
    if (this.lookMode === 'drag') return;
    this.lookMode = 'drag';
    this.root.classList.add('drag-look');
    this.showPause(false);
    this.ui.toast('🖱️ Az egérrel nézel körül (a képernyő szélén tovább fordul) · kattintás: ásás · ←→ fordulás · Esc: szünet', 6000);
  }

  private look(dx: number, dy: number): void {
    this.yaw -= dx;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy, -1.35, 1.2);
  }
}

