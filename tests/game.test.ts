import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isDiggable, manhattan } from '../src/game/forest';
import { CONFIG, Game, warmthFor } from '../src/game/game';
import { MAX_CANDIDATES, MIN_CANDIDATES } from '../src/game/puzzle';
import { hashString } from '../src/game/rng';
import { buildShareText } from '../src/game/share';

const seeds = Array.from({ length: 500 }, (_, i) => hashString(`seed-${i}`));

describe('puzzle generation', () => {
  it('is deterministic for a seed', () => {
    const a = new Game(42);
    const b = new Game(42);
    assert.deepEqual(a.treasure, b.treasure);
    assert.deepEqual(a.forest.tiles, b.forest.tiles);
    assert.deepEqual(a.puzzle.clues.map((c) => c.text), b.puzzle.clues.map((c) => c.text));
  });

  it('always hides the treasure on a diggable tile that satisfies every clue', () => {
    for (const seed of seeds) {
      const game = new Game(seed);
      assert.ok(isDiggable(game.forest, game.treasure.x, game.treasure.y), `seed ${seed}: treasure not on grass`);
      for (const clue of game.puzzle.clues) {
        assert.ok(clue.test(game.treasure), `seed ${seed}: clue "${clue.text}" is false for the treasure`);
      }
    }
  });

  it('narrows the forest down to a fair number of candidates', () => {
    for (const seed of seeds) {
      const { candidates, treasure } = new Game(seed).puzzle;
      assert.ok(candidates.length >= MIN_CANDIDATES && candidates.length <= MAX_CANDIDATES, `seed ${seed}: ${candidates.length}`);
      assert.ok(candidates.some((c) => c.x === treasure.x && c.y === treasure.y));
      assert.ok(candidates.length <= CONFIG.digs + CONFIG.detectors, 'must be solvable with the tools');
    }
  });

  it('places four distinct landmarks', () => {
    for (const seed of seeds.slice(0, 50)) {
      const ids = new Game(seed).forest.landmarks.map((l) => l.id).sort();
      assert.deepEqual(ids, ['log', 'oak', 'stand', 'stone']);
    }
  });
});

describe('game rules', () => {
  it('wins when digging the treasure tile', () => {
    const game = new Game(7);
    const result = game.dig(game.treasure.x, game.treasure.y);
    assert.ok(result.ok);
    assert.equal(game.status, 'won');
    assert.ok(game.score() >= 1000);
  });

  it('loses after running out of digs', () => {
    const game = new Game(7);
    const misses = game.puzzle.candidates.length > 0
      ? allGrass(game).filter((p) => p.x !== game.treasure.x || p.y !== game.treasure.y)
      : [];
    for (const p of misses.slice(0, CONFIG.digs)) {
      game.dig(p.x, p.y);
    }
    assert.equal(game.status, 'lost');
    assert.equal(game.lossReason, 'digs');
    assert.equal(game.score(), 0);
  });

  it('rejects digging twice on the same tile or on a tree', () => {
    const game = new Game(11);
    const miss = allGrass(game).find((p) => manhattan(p, game.treasure) > 3)!;
    assert.ok(game.dig(miss.x, miss.y).ok);
    assert.equal(game.dig(miss.x, miss.y).ok, false);

    const landmark = game.forest.landmarks[0];
    assert.equal(game.dig(landmark.x, landmark.y).ok, false);
  });

  it('runs out of time', () => {
    const game = new Game(3);
    game.tick(CONFIG.timeMs + 1);
    assert.equal(game.status, 'lost');
    assert.equal(game.lossReason, 'time');
  });

  it('detector reports warmth by distance', () => {
    assert.equal(warmthFor(0), 3);
    assert.equal(warmthFor(1), 3);
    assert.equal(warmthFor(2), 2);
    assert.equal(warmthFor(4), 1);
    assert.equal(warmthFor(5), 0);

    const game = new Game(5);
    for (let i = 0; i < CONFIG.detectors; i++) {
      assert.ok(game.detect(game.treasure.x, game.treasure.y).ok);
    }
    assert.equal(game.detect(game.treasure.x, game.treasure.y).ok, false, 'battery is empty');
  });

  it('dog sits 1-2 steps from the treasure, only once', () => {
    for (const seed of seeds.slice(0, 100)) {
      const game = new Game(seed);
      const result = game.useDog();
      assert.ok(result.ok);
      const distance = manhattan(result.value, game.treasure);
      assert.ok(distance >= 1 && distance <= 2, `seed ${seed}: dog at distance ${distance}`);
      assert.equal(game.useDog().ok, false);
    }
  });

  it('share text has no coordinates', () => {
    const game = new Game(9);
    game.dig(game.treasure.x, game.treasure.y);
    const text = buildShareText(game, 'napi térkép', 'https://example.org');
    assert.match(text, /Megvan!/);
    assert.match(text, /💰/);
  });
});

function allGrass(game: Game) {
  const result = [];
  for (let y = 0; y < game.forest.rows; y++) {
    for (let x = 0; x < game.forest.cols; x++) {
      if (isDiggable(game.forest, x, y)) result.push({ x, y });
    }
  }
  return result;
}
