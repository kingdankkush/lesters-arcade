import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { rollDrop, isPickupPlacementSafe, DROP_TABLES, validateDropTables } from '../apps/portal/src/drop-tables.mjs';

describe('drop-tables', () => {
  it('rollDrop returns a valid drop id at 100% drop chance', () => {
    const pick = rollDrop({ seed: 42, tier: 'grunt', dropChance: 1.0 });
    assert.ok(pick);
    assert.ok(DROP_TABLES.grunt.some((e) => e.id === pick));
  });

  it('rollDrop returns null when drop chance is 0', () => {
    const pick = rollDrop({ seed: 42, tier: 'grunt', dropChance: 0.0 });
    assert.equal(pick, null);
  });

  it('rollDrop is deterministic for the same seed', () => {
    const a = rollDrop({ seed: 7, tier: 'elite', dropChance: 1.0 });
    const b = rollDrop({ seed: 7, tier: 'elite', dropChance: 1.0 });
    assert.equal(a, b);
  });

  it('rollDrop different seeds can produce different picks', () => {
    const picks = new Set();
    for (let s = 0; s < 50; s += 1) {
      picks.add(rollDrop({ seed: s, tier: 'grunt', dropChance: 1.0 }));
    }
    assert.ok(picks.size > 1, 'should produce variety across seeds');
  });

  it('boss table includes rare drops', () => {
    const bossPick = rollDrop({ seed: 100, tier: 'boss', dropChance: 1.0 });
    assert.ok(bossPick);
    assert.ok(DROP_TABLES.boss.some((e) => e.id === bossPick));
  });

  it('luck > 1 shifts toward rarer drops', () => {
    // With high luck, boss table should favor rarer entries more often.
    let rareCount = 0;
    for (let s = 0; s < 100; s += 1) {
      const lowLuck = rollDrop({ seed: s, tier: 'boss', dropChance: 1.0, luck: 0.5 });
      const highLuck = rollDrop({ seed: s, tier: 'boss', dropChance: 1.0, luck: 3.0 });
      const isRare = (id) => ['nuke-liquidation', 'berserk-candle', 'time-dilation'].includes(id);
      if (isRare(highLuck) && !isRare(lowLuck)) rareCount += 1;
    }
    assert.ok(rareCount > 0, 'high luck should produce more rare drops than low luck');
  });

  it('isPickupPlacementSafe returns ok for safe positions', () => {
    const result = isPickupPlacementSafe({ x: 50, y: 50, radius: 8, collisionRects: [{ x: 0, y: 0, w: 10, h: 10 }], deathMarkers: [] });
    assert.ok(result.ok);
    assert.equal(result.reason, null);
  });

  it('isPickupPlacementSafe rejects positions inside collision rects', () => {
    const result = isPickupPlacementSafe({ x: 5, y: 5, radius: 8, collisionRects: [{ x: 0, y: 0, w: 10, h: 10 }], deathMarkers: [] });
    assert.ok(!result.ok);
    assert.equal(result.reason, 'collision');
  });

  it('isPickupPlacementSafe rejects positions on death markers', () => {
    const result = isPickupPlacementSafe({ x: 10, y: 10, radius: 8, collisionRects: [], deathMarkers: [{ x: 10, y: 10, radius: 16 }] });
    assert.ok(!result.ok);
    assert.equal(result.reason, 'death-clutter');
  });

  it('validateDropTables passes all invariants', () => {
    const result = validateDropTables();
    assert.ok(result.ok, result.errors.join(', '));
  });
});
