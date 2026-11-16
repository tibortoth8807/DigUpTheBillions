import { Forest, Point, generateForest, grassTiles, isDiggable, manhattan } from './forest';
import { Puzzle, generatePuzzle } from './puzzle';
import { Rng, mulberry32, pick } from './rng';

export type Tool = 'dig' | 'detector' | 'dog';
export type Status = 'playing' | 'won' | 'lost';
export type LossReason = 'time' | 'digs';

/** 3 = forró, 2 = meleg, 1 = langyos, 0 = hideg */
export type Warmth = 0 | 1 | 2 | 3;

export const WARMTH_TEXT: Record<Warmth, string> = { 3: 'Forró!', 2: 'Meleg', 1: 'Langyos', 0: 'Hideg' };

export const CONFIG = {
  digs: 6,
  detectors: 3,
  dogs: 1,
  timeMs: 75_000,
  digPenaltyMs: 3_000,
  detectorPenaltyMs: 1_000,
  junkChance: 0.35,
} as const;

/** Things the minister also buried. All fictional. */
export const JUNK = [
  'egy rozsdás konzervdobozt',
  'egy félig megevett zsíros kenyeret',
  'egy 312 oldalas „tanulmányt” – mind a 312 oldal üres',
  'egy aranyozott golflabdát',
  'egy üres pezsgősüveget',
  'egy plakettet: „Az év erdőjáró minisztere”',
  'egy borítékot „tanácsadói díj” felirattal – sajnos csak a borítékot',
  'egy wellness-szálló kulcskártyáját',
  'egy kutyafüles társasági szerződést',
  'egy horgászbotot, címkéje szerint „kiküldetés”',
] as const;

export type DigKind = 'treasure' | 'junk' | 'empty';

export interface DigRecord extends Point {
  kind: DigKind;
  item?: string;
}

export interface Detection extends Point {
  warmth: Warmth;
}

export type ActionResult<T> = { ok: true; value: T } | { ok: false; reason: string };

export function warmthFor(distance: number): Warmth {
  if (distance <= 1) return 3;
  if (distance === 2) return 2;
  if (distance <= 4) return 1;
  return 0;
}

export class Game {
  readonly forest: Forest;
  readonly puzzle: Puzzle;

  digsLeft: number = CONFIG.digs;
  detectorsLeft: number = CONFIG.detectors;
  dogsLeft: number = CONFIG.dogs;
  timeLeftMs: number = CONFIG.timeMs;
  status: Status = 'playing';
  lossReason: LossReason | null = null;

  readonly digs: DigRecord[] = [];
  readonly detections: Detection[] = [];
  dogMark: Point | null = null;

  private readonly rng: Rng;

  constructor(readonly seed: number) {
    // Separate streams: the map depends only on the seed, luck (junk, dog) on a second stream.
    const mapRng = mulberry32(seed);
    let forest = generateForest(mapRng);
    let puzzle = generatePuzzle(mapRng, forest);
    while (!puzzle) {
      forest = generateForest(mapRng);
      puzzle = generatePuzzle(mapRng, forest);
    }

    this.forest = forest;
    this.puzzle = puzzle;
    this.rng = mulberry32(seed ^ 0x9e3779b9);
  }

  get treasure(): Point {
    return this.puzzle.treasure;
  }

  isDug(x: number, y: number): boolean {
    return this.digs.some((d) => d.x === x && d.y === y);
  }

  dig(x: number, y: number): ActionResult<DigRecord> {
    if (this.status !== 'playing') return { ok: false, reason: 'A játéknak vége.' };
    if (!isDiggable(this.forest, x, y)) return { ok: false, reason: 'Ide nem lehet ásni.' };
    if (this.isDug(x, y)) return { ok: false, reason: 'Itt már ástál.' };

    let record: DigRecord;
    if (x === this.treasure.x && y === this.treasure.y) {
      record = { x, y, kind: 'treasure' };
      this.status = 'won';
    } else {
      this.digsLeft--;
      this.timeLeftMs = Math.max(0, this.timeLeftMs - CONFIG.digPenaltyMs);
      record = this.rng() < CONFIG.junkChance ? { x, y, kind: 'junk', item: pick(this.rng, JUNK) } : { x, y, kind: 'empty' };
      if (this.digsLeft <= 0) {
        this.lose('digs');
      } else if (this.timeLeftMs <= 0) {
        this.lose('time');
      }
    }

    this.digs.push(record);
    return { ok: true, value: record };
  }

  detect(x: number, y: number): ActionResult<Detection> {
    if (this.status !== 'playing') return { ok: false, reason: 'A játéknak vége.' };
    if (this.detectorsLeft <= 0) return { ok: false, reason: 'Lemerült a fémkereső.' };
    if (!isDiggable(this.forest, x, y)) return { ok: false, reason: 'Itt nem tudsz mérni.' };

    const detection: Detection = { x, y, warmth: warmthFor(manhattan({ x, y }, this.treasure)) };
    this.detectorsLeft--;
    this.timeLeftMs = Math.max(0, this.timeLeftMs - CONFIG.detectorPenaltyMs);
    this.detections.push(detection);
    if (this.timeLeftMs <= 0) {
      this.lose('time');
    }
    return { ok: true, value: detection };
  }

  /** The dog sits down on a tile 1-2 steps from the treasure - close, but not on it. */
  useDog(): ActionResult<Point> {
    if (this.status !== 'playing') return { ok: false, reason: 'A játéknak vége.' };
    if (this.dogsLeft <= 0) return { ok: false, reason: 'Morzsi már elfáradt.' };

    const spots = grassTiles(this.forest).filter((p) => {
      const distance = manhattan(p, this.treasure);
      return distance >= 1 && distance <= 2 && !this.isDug(p.x, p.y);
    });
    const spot = spots.length > 0 ? pick(this.rng, spots) : this.treasure;

    this.dogsLeft--;
    this.dogMark = spot;
    return { ok: true, value: spot };
  }

  tick(deltaMs: number): void {
    if (this.status !== 'playing') return;
    this.timeLeftMs = Math.max(0, this.timeLeftMs - deltaMs);
    if (this.timeLeftMs <= 0) {
      this.lose('time');
    }
  }

  /** 0 when lost. Unused tools and time are worth points. */
  score(): number {
    if (this.status !== 'won') return 0;
    return 1000 + this.digsLeft * 150 + this.detectorsLeft * 60 + this.dogsLeft * 100 + Math.floor(this.timeLeftMs / 1000) * 5;
  }

  /** Found "milliárdok" grows with the score - pure flavor. */
  billions(): number {
    return Math.round((2 + this.score() / 400) * 10) / 10;
  }

  rating(): string {
    const score = this.score();
    if (this.status !== 'won') return this.lossReason === 'time' ? 'Lekésted – a Különítmény ért oda előbb' : 'Kifogytál az ásásból';
    if (score >= 2400) return 'Erdészeti zseni';
    if (score >= 2000) return 'Profi kincsvadász';
    if (score >= 1600) return 'Lelkes amatőr';
    return 'Szerencsés ásó';
  }

  private lose(reason: LossReason): void {
    this.status = 'lost';
    this.lossReason = reason;
  }
}
