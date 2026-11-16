import { Rng, pick, randInt } from './rng';

export const COLS = 12;
export const ROWS = 9;

export type TileKind = 'grass' | 'tree' | 'pine' | 'rock' | 'landmark';
export type LandmarkId = 'stand' | 'log' | 'stone' | 'oak';
export type DecorKind = 'flower' | 'mushroom' | 'leaves' | 'tuft';

export interface Point {
  x: number;
  y: number;
}

export interface Landmark extends Point {
  id: LandmarkId;
  /** Shown on the map: "vadászles". */
  name: string;
  /** Hungarian ablative for the clues: "a vadászlestől". */
  from: string;
}

export interface Decor extends Point {
  kind: DecorKind;
  /** Offset inside the tile, 0..1. */
  ox: number;
  oy: number;
  variant: number;
}

export interface Forest {
  cols: number;
  rows: number;
  /** tiles[y][x] */
  tiles: TileKind[][];
  landmarks: Landmark[];
  decor: Decor[];
}

export const LANDMARKS: Record<LandmarkId, { name: string; from: string }> = {
  stand: { name: 'vadászles', from: 'a vadászlestől' },
  log: { name: 'kidőlt fa', from: 'a kidőlt fától' },
  stone: { name: 'nagy kő', from: 'a nagy kőtől' },
  oak: { name: 'öreg tölgy', from: 'az öreg tölgytől' },
};

export const manhattan = (a: Point, b: Point): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

export function isDiggable(forest: Forest, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < forest.cols && y < forest.rows && forest.tiles[y][x] === 'grass';
}

export function grassTiles(forest: Forest): Point[] {
  const result: Point[] = [];
  for (let y = 0; y < forest.rows; y++) {
    for (let x = 0; x < forest.cols; x++) {
      if (forest.tiles[y][x] === 'grass') {
        result.push({ x, y });
      }
    }
  }
  return result;
}

export function generateForest(rng: Rng): Forest {
  for (;;) {
    const forest = tryGenerate(rng);
    if (forest) {
      return forest;
    }
  }
}

function tryGenerate(rng: Rng): Forest | null {
  const tiles: TileKind[][] = Array.from({ length: ROWS }, () => Array<TileKind>(COLS).fill('grass'));

  // Landmarks: not on the edge, at least 3 tiles apart from each other.
  const landmarks: Landmark[] = [];
  for (const id of Object.keys(LANDMARKS) as LandmarkId[]) {
    let placed = false;
    for (let attempt = 0; attempt < 100 && !placed; attempt++) {
      const x = randInt(rng, 1, COLS - 2);
      const y = randInt(rng, 1, ROWS - 2);
      if (landmarks.every((l) => Math.max(Math.abs(l.x - x), Math.abs(l.y - y)) >= 3)) {
        landmarks.push({ id, x, y, ...LANDMARKS[id] });
        tiles[y][x] = 'landmark';
        placed = true;
      }
    }
    if (!placed) {
      return null;
    }
  }

  // Trees and rocks.
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (tiles[y][x] !== 'grass') {
        continue;
      }
      const roll = rng();
      if (roll < 0.11) {
        tiles[y][x] = 'tree';
      } else if (roll < 0.21) {
        tiles[y][x] = 'pine';
      } else if (roll < 0.25) {
        tiles[y][x] = 'rock';
      }
    }
  }

  const forest: Forest = { cols: COLS, rows: ROWS, tiles, landmarks, decor: [] };
  const grass = grassTiles(forest);
  if (grass.length < COLS * ROWS * 0.6) {
    return null;
  }

  for (const tile of grass) {
    if (rng() < 0.4) {
      forest.decor.push({
        ...tile,
        kind: pick(rng, ['flower', 'flower', 'mushroom', 'leaves', 'tuft', 'tuft'] as const),
        ox: 0.15 + rng() * 0.7,
        oy: 0.15 + rng() * 0.7,
        variant: randInt(rng, 0, 2),
      });
    }
  }

  return forest;
}
