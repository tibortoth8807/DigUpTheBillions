import * as THREE from 'three';
import { Forest, LandmarkId, Point } from '../game/forest';
import { mulberry32 } from '../game/rng';
import {
  createBigStone,
  createHuntingStand,
  createLabel,
  createLog,
  createOak,
  createPine,
  createRock,
  createTree,
  mat,
} from './models';

/** One map tile ("lépés") is 3 × 3 metres in the 3D world. North is -Z. */
export const TILE_SIZE = 3;

export interface Collider {
  x: number;
  z: number;
  r: number;
}

export interface World {
  scene: THREE.Scene;
  colliders: Collider[];
  /** Playable area half sizes (inside the fence). */
  halfW: number;
  halfD: number;
  sun: THREE.DirectionalLight;
}

export function tileCenter(forest: Forest, p: Point): THREE.Vector3 {
  return new THREE.Vector3(
    (p.x + 0.5) * TILE_SIZE - (forest.cols * TILE_SIZE) / 2,
    0,
    (p.y + 0.5) * TILE_SIZE - (forest.rows * TILE_SIZE) / 2,
  );
}

export function worldToTile(forest: Forest, x: number, z: number): Point | null {
  const tx = Math.floor((x + (forest.cols * TILE_SIZE) / 2) / TILE_SIZE);
  const ty = Math.floor((z + (forest.rows * TILE_SIZE) / 2) / TILE_SIZE);
  if (tx < 0 || ty < 0 || tx >= forest.cols || ty >= forest.rows) return null;
  return { x: tx, y: ty };
}

const LANDMARK_HEIGHT: Record<LandmarkId, number> = { stand: 5.4, log: 2.0, stone: 3.0, oak: 7.2 };

export function buildWorld(forest: Forest, seed: number): World {
  const rng = mulberry32(seed ^ 0x27d4eb2d);
  const scene = new THREE.Scene();
  const sky = new THREE.Color('#9cc6d8');
  scene.background = sky;
  scene.fog = new THREE.Fog('#a9c9b8', 18, 75);

  const halfW = (forest.cols * TILE_SIZE) / 2;
  const halfD = (forest.rows * TILE_SIZE) / 2;
  const colliders: Collider[] = [];

  // ------------------------------------------------------------ light: late afternoon sun
  scene.add(new THREE.HemisphereLight('#cfe8ff', '#3d5a2a', 1.6));
  const sun = new THREE.DirectionalLight('#ffe2b0', 2.4);
  sun.position.set(-25, 35, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -halfW - 8;
  sc.right = halfW + 8;
  sc.top = halfD + 8;
  sc.bottom = -halfD - 8;
  sc.near = 1;
  sc.far = 120;
  sun.shadow.bias = -0.0008;
  scene.add(sun);

  // ------------------------------------------------------------ ground with vertex-color noise
  const groundGeometry = new THREE.PlaneGeometry(180, 180, 90, 90);
  groundGeometry.rotateX(-Math.PI / 2);
  const positions = groundGeometry.attributes.position;
  const colors: number[] = [];
  const base = new THREE.Color('#4f7f3a');
  const dark = new THREE.Color('#3f6a2e');
  const light = new THREE.Color('#62914a');
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const outside = Math.abs(x) > halfW + 2 || Math.abs(z) > halfD + 2;
    if (outside) {
      positions.setY(i, Math.sin(x * 0.15) * Math.cos(z * 0.12) * 0.6 + rng() * 0.25);
    }
    const c = base.clone().lerp(rng() < 0.5 ? dark : light, rng() * 0.8);
    colors.push(c.r, c.g, c.b);
  }
  groundGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  groundGeometry.computeVertexNormals();
  const ground = new THREE.Mesh(groundGeometry, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  ground.receiveShadow = true;
  scene.add(ground);

  // faint tile grid, so "lépés" can be counted
  const gridPoints: number[] = [];
  for (let x = 0; x <= forest.cols; x++) {
    const wx = x * TILE_SIZE - halfW;
    gridPoints.push(wx, 0.02, -halfD, wx, 0.02, halfD);
  }
  for (let y = 0; y <= forest.rows; y++) {
    const wz = y * TILE_SIZE - halfD;
    gridPoints.push(-halfW, 0.02, wz, halfW, 0.02, wz);
  }
  const gridGeometry = new THREE.BufferGeometry();
  gridGeometry.setAttribute('position', new THREE.Float32BufferAttribute(gridPoints, 3));
  scene.add(new THREE.LineSegments(gridGeometry, new THREE.LineBasicMaterial({ color: '#e8f5d0', transparent: true, opacity: 0.16 })));

  // ------------------------------------------------------------ grass tufts & flowers (instanced = cheap)
  const tuftGeometry = new THREE.ConeGeometry(0.08, 0.35, 3);
  tuftGeometry.translate(0, 0.17, 0);
  const tufts = new THREE.InstancedMesh(tuftGeometry, mat('#6f9f45'), 1600);
  // small flower heads on thin stems (kept tiny so they don't look like gems/treasure)
  const flowerGeometry = new THREE.IcosahedronGeometry(0.04, 0);
  const flowers = new THREE.InstancedMesh(flowerGeometry, mat('#ffffff'), 260);
  const stemGeometry = new THREE.CylinderGeometry(0.008, 0.008, 0.2, 3);
  stemGeometry.translate(0, 0.1, 0);
  const stems = new THREE.InstancedMesh(stemGeometry, mat('#4f7f3a'), 260);
  const dummy = new THREE.Object3D();
  const flowerColors = ['#fff7e6', '#ffd54a', '#c39bd3', '#ff9aa2'].map((c) => new THREE.Color(c));
  for (let i = 0; i < tufts.count; i++) {
    dummy.position.set((rng() - 0.5) * 2 * (halfW + 14), 0, (rng() - 0.5) * 2 * (halfD + 14));
    dummy.rotation.set((rng() - 0.5) * 0.4, rng() * Math.PI, (rng() - 0.5) * 0.4);
    dummy.scale.setScalar(0.6 + rng() * 0.9);
    dummy.updateMatrix();
    tufts.setMatrixAt(i, dummy.matrix);
  }
  for (let i = 0; i < flowers.count; i++) {
    const fx0 = (rng() - 0.5) * 2 * halfW;
    const fz0 = (rng() - 0.5) * 2 * halfD;
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1);
    dummy.position.set(fx0, 0, fz0);
    dummy.updateMatrix();
    stems.setMatrixAt(i, dummy.matrix);
    dummy.position.set(fx0, 0.2, fz0);
    dummy.scale.setScalar(0.8 + rng() * 0.5);
    dummy.updateMatrix();
    flowers.setMatrixAt(i, dummy.matrix);
    flowers.setColorAt(i, flowerColors[Math.floor(rng() * flowerColors.length)]);
  }
  scene.add(tufts, flowers, stems);

  // ------------------------------------------------------------ map objects
  for (let y = 0; y < forest.rows; y++) {
    for (let x = 0; x < forest.cols; x++) {
      const kind = forest.tiles[y][x];
      if (kind === 'grass' || kind === 'landmark') continue;
      const center = tileCenter(forest, { x, y });
      const jitterX = (rng() - 0.5) * 0.8;
      const jitterZ = (rng() - 0.5) * 0.8;
      const object = kind === 'tree' ? createTree(rng) : kind === 'pine' ? createPine(rng) : createRock(rng);
      object.position.set(center.x + jitterX, 0, center.z + jitterZ);
      scene.add(object);
      colliders.push({ x: center.x + jitterX, z: center.z + jitterZ, r: kind === 'rock' ? 0.8 : 0.55 });
    }
  }

  for (const landmark of forest.landmarks) {
    const center = tileCenter(forest, landmark);
    const object =
      landmark.id === 'stand' ? createHuntingStand()
      : landmark.id === 'log' ? createLog()
      : landmark.id === 'stone' ? createBigStone()
      : createOak();
    object.position.copy(center);
    scene.add(object);

    const label = createLabel(landmark.name);
    label.position.set(center.x, LANDMARK_HEIGHT[landmark.id], center.z);
    scene.add(label);

    if (landmark.id === 'log') {
      // the log is long: three colliders along its axis (rotated by 0.35 rad)
      for (const offset of [-1.8, 0, 1.8]) {
        colliders.push({ x: center.x + Math.cos(0.35) * offset, z: center.z - Math.sin(0.35) * offset, r: 0.6 });
      }
    } else {
      colliders.push({ x: center.x, z: center.z, r: landmark.id === 'stone' ? 1.7 : landmark.id === 'oak' ? 0.9 : 1.2 });
    }
  }

  // ------------------------------------------------------------ fence around the plot
  const fenceWood = mat('#7a5a3a');
  const postGeometry = new THREE.BoxGeometry(0.15, 1.2, 0.15);
  const addRail = (x1: number, z1: number, x2: number, z2: number) => {
    const length = Math.hypot(x2 - x1, z2 - z1);
    for (const h of [0.45, 0.95]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(length, 0.08, 0.06), fenceWood);
      rail.position.set((x1 + x2) / 2, h, (z1 + z2) / 2);
      rail.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
      rail.castShadow = true;
      scene.add(rail);
    }
  };
  const fx = halfW + 1.5;
  const fz = halfD + 1.5;
  for (let x = -fx; x <= fx + 0.01; x += 3) {
    for (const z of [-fz, fz]) {
      const post = new THREE.Mesh(postGeometry, fenceWood);
      post.position.set(x, 0.6, z);
      post.castShadow = true;
      scene.add(post);
    }
  }
  for (let z = -fz; z <= fz + 0.01; z += 3) {
    for (const x of [-fx, fx]) {
      const post = new THREE.Mesh(postGeometry, fenceWood);
      post.position.set(x, 0.6, z);
      post.castShadow = true;
      scene.add(post);
    }
  }
  addRail(-fx, -fz, fx, -fz);
  addRail(-fx, fz, fx, fz);
  addRail(-fx, -fz, -fx, fz);
  addRail(fx, -fz, fx, fz);

  // ------------------------------------------------------------ dense forest outside the fence
  for (let i = 0; i < 170; i++) {
    const angle = rng() * Math.PI * 2;
    const distance = 4 + rng() * 34;
    const x = Math.cos(angle) * (fx + distance);
    const z = Math.sin(angle) * (fz + distance);
    if (Math.abs(x) < fx + 2.5 && Math.abs(z) < fz + 2.5) continue;
    const tree = rng() < 0.55 ? createPine(rng) : createTree(rng);
    tree.position.set(x, 0, z);
    tree.scale.multiplyScalar(1.1 + rng() * 0.5);
    tree.traverse((o) => {
      o.castShadow = false;
    });
    scene.add(tree);
  }

  return { scene, colliders, halfW, halfD, sun };
}
