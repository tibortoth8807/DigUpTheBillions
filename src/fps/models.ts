import * as THREE from 'three';
import { Rng } from '../game/rng';

/**
 * Low-poly models built from primitives in code (no external 3D files).
 * Flat-shaded Lambert materials: cheap on mobile GPUs and give the "hand-made" look.
 */

const materialCache = new Map<string, THREE.MeshLambertMaterial>();

export function mat(color: string | number, options: { emissive?: number; emissiveIntensity?: number } = {}): THREE.MeshLambertMaterial {
  const key = `${color}|${options.emissive ?? ''}|${options.emissiveIntensity ?? ''}`;
  let material = materialCache.get(key);
  if (!material) {
    material = new THREE.MeshLambertMaterial({ color, flatShading: true, ...options });
    materialCache.set(key, material);
  }
  return material;
}

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

const GREENS = ['#2f5d2a', '#3b7a33', '#4c9440', '#356b2d'];

export function createTree(rng: Rng): THREE.Group {
  const group = new THREE.Group();
  group.add(mesh(new THREE.CylinderGeometry(0.16, 0.24, 1.8, 6), mat('#6b4423'), 0, 0.9, 0));
  const blobs = 3 + Math.floor(rng() * 2);
  for (let i = 0; i < blobs; i++) {
    const r = 0.8 + rng() * 0.5;
    const angle = (i / blobs) * Math.PI * 2 + rng();
    group.add(
      mesh(
        new THREE.IcosahedronGeometry(r, 0),
        mat(GREENS[i % GREENS.length]),
        Math.cos(angle) * 0.5,
        2.3 + rng() * 0.6,
        Math.sin(angle) * 0.5,
      ),
    );
  }
  group.add(mesh(new THREE.IcosahedronGeometry(0.9, 0), mat('#4c9440'), 0, 3.1, 0));
  const s = 0.9 + rng() * 0.35;
  group.scale.setScalar(s);
  group.rotation.y = rng() * Math.PI * 2;
  return group;
}

export function createPine(rng: Rng): THREE.Group {
  const group = new THREE.Group();
  group.add(mesh(new THREE.CylinderGeometry(0.14, 0.2, 1.2, 6), mat('#5a3a1e'), 0, 0.6, 0));
  const layers: [number, number, number, string][] = [
    [1.35, 2.0, 1.9, '#1b4332'],
    [1.05, 1.7, 2.9, '#245a42'],
    [0.7, 1.4, 3.8, '#2d6a4f'],
  ];
  for (const [r, h, y, color] of layers) {
    group.add(mesh(new THREE.ConeGeometry(r, h, 7), mat(color), 0, y, 0));
  }
  group.scale.setScalar(0.9 + rng() * 0.45);
  group.rotation.y = rng() * Math.PI * 2;
  return group;
}

export function createRock(rng: Rng): THREE.Group {
  const group = new THREE.Group();
  const rock = mesh(new THREE.DodecahedronGeometry(0.6, 0), mat('#7c8580'), 0, 0.28, 0);
  rock.scale.set(1.3, 0.7, 1.0);
  rock.rotation.y = rng() * Math.PI;
  group.add(rock);
  return group;
}

export function createHuntingStand(): THREE.Group {
  const group = new THREE.Group();
  const wood = mat('#7a4f27');
  const dark = mat('#4a2f17');
  for (const [x, z] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]] as const) {
    const leg = mesh(new THREE.BoxGeometry(0.14, 3.2, 0.14), dark, x * 1.05, 1.6, z * 1.05);
    leg.rotation.set(z * 0.06, 0, -x * 0.06);
    group.add(leg);
  }
  group.add(mesh(new THREE.BoxGeometry(1.8, 0.14, 1.8), wood, 0, 3.05, 0));
  group.add(mesh(new THREE.BoxGeometry(1.6, 1.0, 1.6), mat('#8b5a2b'), 0, 3.62, 0));
  group.add(mesh(new THREE.BoxGeometry(1.0, 0.3, 0.05), mat('#1b120a'), 0, 3.75, 0.81)); // window slit
  const roof = mesh(new THREE.ConeGeometry(1.45, 0.8, 4), dark, 0, 4.5, 0);
  roof.rotation.y = Math.PI / 4;
  group.add(roof);
  // ladder
  for (const x of [-0.3, 0.3]) {
    const rail = mesh(new THREE.BoxGeometry(0.08, 3.4, 0.08), wood, x, 1.6, 1.25);
    rail.rotation.x = -0.32;
    group.add(rail);
  }
  for (let i = 0; i < 7; i++) {
    const y = 0.3 + i * 0.42;
    group.add(mesh(new THREE.BoxGeometry(0.6, 0.06, 0.06), wood, 0, y, 1.25 + Math.tan(0.32) * (1.6 - y)));
  }
  return group;
}

export function createLog(): THREE.Group {
  const group = new THREE.Group();
  const log = mesh(new THREE.CylinderGeometry(0.45, 0.5, 4.6, 9), mat('#7a5230'), 0, 0.45, 0);
  log.rotation.z = Math.PI / 2;
  group.add(log);
  const cap = mesh(new THREE.CircleGeometry(0.46, 9), mat('#c49a6c'), 2.31, 0.45, 0);
  cap.rotation.y = Math.PI / 2;
  group.add(cap);
  const rings = mesh(new THREE.RingGeometry(0.15, 0.2, 9), mat('#8a6440'), 2.32, 0.45, 0);
  rings.rotation.y = Math.PI / 2;
  group.add(rings);
  for (const x of [-1.2, -0.7, 0.6]) {
    group.add(mesh(new THREE.IcosahedronGeometry(0.22, 0), mat('#6aa84f'), x, 0.85, 0.1));
  }
  // broken stump
  group.add(mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.7, 8), mat('#6b4423'), -2.6, 0.35, 0.2));
  group.rotation.y = 0.35;
  return group;
}

export function createBigStone(): THREE.Group {
  const group = new THREE.Group();
  const stone = mesh(new THREE.DodecahedronGeometry(1.35, 1), mat('#6b7470'), 0, 0.95, 0);
  stone.scale.set(1.25, 0.95, 1.05);
  group.add(stone);
  group.add(mesh(new THREE.DodecahedronGeometry(0.6, 0), mat('#7d8682'), 1.3, 0.35, 0.6));
  for (const [x, y, z] of [[0.3, 1.85, 0.2], [-0.4, 1.7, -0.3], [0.7, 1.5, -0.5]] as const) {
    group.add(mesh(new THREE.IcosahedronGeometry(0.28, 0), mat('#5d9c42'), x, y, z));
  }
  return group;
}

export function createOak(): THREE.Group {
  const group = new THREE.Group();
  group.add(mesh(new THREE.CylinderGeometry(0.42, 0.7, 3.2, 8), mat('#5a3b20'), 0, 1.6, 0));
  for (const [x, z, a] of [[0.9, 0.2, 0.7], [-0.8, -0.4, -0.8]] as const) {
    const branch = mesh(new THREE.CylinderGeometry(0.12, 0.2, 1.8, 6), mat('#5a3b20'), x * 0.6, 3.1, z * 0.6);
    branch.rotation.z = -a;
    group.add(branch);
  }
  const canopy: [number, number, number, number, string][] = [
    [0, 4.6, 0, 2.2, '#264d1f'],
    [1.5, 4.1, 0.6, 1.6, '#2f6b28'],
    [-1.4, 4.2, -0.5, 1.7, '#2f6b28'],
    [0.4, 5.4, -0.9, 1.4, '#3f8a34'],
    [-0.5, 4.0, 1.3, 1.5, '#264d1f'],
  ];
  for (const [x, y, z, r, color] of canopy) {
    group.add(mesh(new THREE.IcosahedronGeometry(r, 1), mat(color), x, y, z));
  }
  return group;
}

/** Floating parchment label above landmarks, always facing the camera. */
export function createLabel(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.font = '600 56px "Segoe UI", system-ui, sans-serif';
  const width = Math.min(500, ctx.measureText(text).width + 60);
  ctx.fillStyle = 'rgba(243, 230, 196, 0.95)';
  ctx.beginPath();
  ctx.roundRect((512 - width) / 2, 24, width, 80, 40);
  ctx.fill();
  ctx.fillStyle = '#3b2a14';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 66);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set(3.2, 0.8, 1);
  return sprite;
}

export function createHole(rng: Rng): THREE.Group {
  const group = new THREE.Group();
  const pit = new THREE.Mesh(new THREE.CircleGeometry(0.85, 12), mat('#1e1209'));
  pit.rotation.x = -Math.PI / 2;
  pit.position.y = 0.03;
  group.add(pit);
  const rim = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.15, 12), mat('#4a3019'));
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.025;
  group.add(rim);
  const mound = mesh(new THREE.IcosahedronGeometry(0.55, 0), mat('#6b4a2b'), 0.9 + rng() * 0.2, 0.12, -0.5);
  mound.scale.set(1.2, 0.45, 0.9);
  group.add(mound);
  return group;
}

export function createCan(): THREE.Group {
  const group = new THREE.Group();
  group.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.26, 10), mat('#9aa0a6'), 0, 0.13, 0));
  group.add(mesh(new THREE.CylinderGeometry(0.121, 0.121, 0.09, 10), mat('#b4532a'), 0, 0.15, 0));
  group.rotation.z = 1.2;
  return group;
}

export interface Chest {
  group: THREE.Group;
  lid: THREE.Group;
  light: THREE.PointLight;
}

export function createChest(): Chest {
  const group = new THREE.Group();
  const wood = mat('#7b4a1e');
  const gold = mat('#d4a017', { emissive: 0x6b4a00, emissiveIntensity: 0.4 });
  group.add(mesh(new THREE.BoxGeometry(1.1, 0.55, 0.7), wood, 0, 0.275, 0));
  group.add(mesh(new THREE.BoxGeometry(1.12, 0.08, 0.72), gold, 0, 0.35, 0));
  group.add(mesh(new THREE.BoxGeometry(0.1, 0.56, 0.72), gold, 0, 0.28, 0));
  // banknote stacks
  for (let i = 0; i < 6; i++) {
    const bill = mesh(new THREE.BoxGeometry(0.3, 0.12, 0.18), mat(i % 2 ? '#3f9d55' : '#55b86b'), -0.35 + (i % 3) * 0.35, 0.6, i < 3 ? -0.15 : 0.15);
    group.add(bill);
  }
  const lid = new THREE.Group();
  lid.position.set(0, 0.55, -0.35);
  const lidMesh = mesh(new THREE.BoxGeometry(1.1, 0.22, 0.7), mat('#8f5826'), 0, 0.11, 0.35);
  lid.add(lidMesh);
  lid.add(mesh(new THREE.BoxGeometry(0.1, 0.23, 0.72), gold, 0, 0.11, 0.35));
  group.add(lid);

  const light = new THREE.PointLight(0xffd25a, 0, 8, 1.6);
  light.position.set(0, 1.2, 0);
  group.add(light);
  return { group, lid, light };
}

export interface Dog {
  group: THREE.Group;
  legs: THREE.Mesh[];
  tail: THREE.Mesh;
  bubble: THREE.Sprite;
}

export function createDog(): Dog {
  const group = new THREE.Group();
  const fur = mat('#a86f38');
  const darkFur = mat('#6e4420');
  const body = mesh(new THREE.CapsuleGeometry(0.2, 0.55, 4, 8), fur, 0, 0.5, 0);
  body.rotation.z = Math.PI / 2;
  group.add(body);
  const head = mesh(new THREE.IcosahedronGeometry(0.2, 1), mat('#b97c41'), 0.45, 0.72, 0);
  group.add(head);
  group.add(mesh(new THREE.BoxGeometry(0.16, 0.1, 0.12), mat('#b97c41'), 0.62, 0.68, 0));
  group.add(mesh(new THREE.IcosahedronGeometry(0.045, 0), mat('#1a1a1a'), 0.71, 0.7, 0));
  for (const z of [-0.12, 0.12]) {
    const ear = mesh(new THREE.BoxGeometry(0.08, 0.18, 0.05), darkFur, 0.4, 0.85, z);
    ear.rotation.x = z > 0 ? -0.4 : 0.4;
    group.add(ear);
    group.add(mesh(new THREE.IcosahedronGeometry(0.03, 0), mat('#111111'), 0.6, 0.78, z * 0.6));
  }
  const legs: THREE.Mesh[] = [];
  for (const [x, z] of [[-0.25, -0.12], [-0.25, 0.12], [0.22, -0.12], [0.22, 0.12]] as const) {
    const leg = mesh(new THREE.BoxGeometry(0.08, 0.36, 0.08), fur, x, 0.18, z);
    legs.push(leg);
    group.add(leg);
  }
  const tail = mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.35, 5), darkFur, -0.5, 0.65, 0);
  tail.rotation.z = 0.9;
  group.add(tail);

  const bubble = createLabel('!');
  bubble.scale.set(1.2, 0.3, 1);
  bubble.position.set(0.3, 1.3, 0);
  bubble.visible = false;
  group.add(bubble);
  return { group, legs, tail, bubble };
}

export interface Jeep {
  group: THREE.Group;
  beaconRed: THREE.Mesh;
  beaconBlue: THREE.Mesh;
}

export function createJeep(): Jeep {
  const group = new THREE.Group();
  group.add(mesh(new THREE.BoxGeometry(2.0, 0.8, 4.2), mat('#2d3b2a'), 0, 0.9, 0));
  group.add(mesh(new THREE.BoxGeometry(1.8, 0.75, 2.2), mat('#3a4a36'), 0, 1.65, -0.3));
  group.add(mesh(new THREE.BoxGeometry(1.7, 0.5, 0.05), mat('#9fc6d6', { emissive: 0x223344 }), 0, 1.7, 0.82));
  for (const [x, z] of [[-1, -1.4], [1, -1.4], [-1, 1.4], [1, 1.4]] as const) {
    const wheel = mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.35, 12), mat('#1a1a1a'), x, 0.45, z);
    wheel.rotation.z = Math.PI / 2;
    group.add(wheel);
  }
  for (const x of [-0.65, 0.65]) {
    group.add(mesh(new THREE.BoxGeometry(0.35, 0.22, 0.06), mat('#fff6c8', { emissive: 0xfff2a8, emissiveIntensity: 1 }), x, 1.0, 2.12));
  }
  const beaconRed = mesh(new THREE.BoxGeometry(0.35, 0.18, 0.3), mat('#ff3030', { emissive: 0xff0000, emissiveIntensity: 0 }), -0.25, 2.12, -0.3);
  const beaconBlue = mesh(new THREE.BoxGeometry(0.35, 0.18, 0.3), mat('#3060ff', { emissive: 0x0030ff, emissiveIntensity: 0 }), 0.25, 2.12, -0.3);
  group.add(beaconRed, beaconBlue);

  const headlight = new THREE.SpotLight(0xfff2c0, 40, 30, 0.5, 0.5, 1.5);
  headlight.position.set(0, 1.1, 2.2);
  headlight.target.position.set(0, 0, 10);
  group.add(headlight, headlight.target);
  return { group, beaconRed, beaconBlue };
}

/** First-person shovel held in the lower right of the view. */
export function createHeldShovel(): THREE.Group {
  const group = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.0, 6), mat('#8b5a2b'));
  handle.position.y = 0.2;
  group.add(handle);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.04), mat('#5a3a1e'));
  grip.position.y = 0.7;
  group.add(grip);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.02), mat('#c0c6cc'));
  blade.position.y = -0.38;
  group.add(blade);
  return group;
}

/** First-person metal detector: stick, coil and a small display with an LED. */
export function createHeldDetector(): { group: THREE.Group; led: THREE.Mesh } {
  const group = new THREE.Group();
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.0, 6), mat('#333a40'));
  stick.position.y = 0.1;
  group.add(stick);
  const coil = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.025, 6, 16), mat('#2a2f35'));
  coil.position.y = -0.42;
  coil.rotation.x = Math.PI / 2;
  group.add(coil);
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.1), mat('#f2c14e'));
  box.position.y = 0.42;
  group.add(box);
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.04), mat('#333333', { emissive: 0x000000 }).clone());
  led.position.set(0, 0.47, 0.03);
  group.add(led);
  return { group, led };
}
