import { Forest, Landmark, Point, grassTiles, manhattan } from './forest';
import { Rng, pick, shuffle } from './rng';

export interface Clue {
  text: string;
  test: (p: Point) => boolean;
}

export interface Puzzle {
  treasure: Point;
  clues: Clue[];
  /** Tiles that satisfy every clue - the treasure is one of them. */
  candidates: Point[];
}

/** The puzzle is fair when the clues narrow the forest down to a handful of tiles. */
export const MIN_CANDIDATES = 3;
export const MAX_CANDIDATES = 7;

const DIRECTION_WORDS: Record<string, string> = {
  '0,-1': 'északra',
  '0,1': 'délre',
  '1,0': 'keletre',
  '-1,0': 'nyugatra',
  '1,-1': 'északkeletre',
  '-1,-1': 'északnyugatra',
  '1,1': 'délkeletre',
  '-1,1': 'délnyugatra',
};

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * "A vadászlestől északkeletre." - half-planes: north = smaller y, east = bigger x.
 * Compound directions must satisfy both.
 */
export function directionClue(landmark: Landmark, target: Point): Clue {
  const sx = Math.sign(target.x - landmark.x);
  const sy = Math.sign(target.y - landmark.y);
  return {
    text: `${capitalize(landmark.from)} ${DIRECTION_WORDS[`${sx},${sy}`]}.`,
    test: (p) =>
      (sx === 0 || Math.sign(p.x - landmark.x) === sx) && (sy === 0 || Math.sign(p.y - landmark.y) === sy),
  };
}

/** "Legfeljebb 3 lépésre a nagy kőtől." or "Pontosan 4 lépésre a kidőlt fától." (1 lépés = one tile, no diagonals). */
export function distanceClue(landmark: Landmark, target: Point, exact: boolean): Clue {
  const distance = manhattan(landmark, target);
  return exact
    ? { text: `Pontosan ${distance} lépésre ${landmark.from}.`, test: (p) => manhattan(p, landmark) === distance }
    : { text: `Legfeljebb ${distance} lépésre ${landmark.from}.`, test: (p) => manhattan(p, landmark) <= distance };
}

export function generatePuzzle(rng: Rng, forest: Forest): Puzzle | null {
  const grass = grassTiles(forest);

  for (let attempt = 0; attempt < 300; attempt++) {
    const treasure = pick(rng, grass);
    const [first, second, third] = shuffle(rng, forest.landmarks);

    const clues: Clue[] = [directionClue(first, treasure), distanceClue(second, treasure, rng() < 0.4)];
    let candidates = grass.filter((p) => clues.every((c) => c.test(p)));

    // Too vague? A third clue usually fixes it.
    if (candidates.length > MAX_CANDIDATES && third) {
      clues.push(directionClue(third, treasure));
      candidates = grass.filter((p) => clues.every((c) => c.test(p)));
    }

    if (candidates.length >= MIN_CANDIDATES && candidates.length <= MAX_CANDIDATES) {
      return { treasure, clues, candidates };
    }
  }

  return null;
}
