import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSplatDecal, spawnGib, computeGoreDampening, GORE_LIMITS, validateGoreSystem } from '../apps/portal/src/gore-system.mjs';

describe('gore-system', () => {
  it('spawnSplatDecal adds a decal and returns it', () => {
    const result = spawnSplatDecal({ decals: [], x: 10, y: 20, angle: 0.5, size: 12 });
    assert.ok(result.decal);
    assert.equal(result.decal.x, 10);
    assert.equal(result.decal.y, 20);
    assert.equal(result.decals.length, 1);
  });

  it('spawnSplatDecal caps at maxDecals via FIFO eviction', () => {
    let decals = [];
    for (let i = 0; i < GORE_LIMITS.maxDecals + 10; i += 1) {
      const r = spawnSplatDecal({ decals, x: i, y: i });
      decals = r.decals;
    }
    assert.ok(decals.length <= GORE_LIMITS.maxDecals);
  });

  it('spawnGib adds a gib with physics impulse', () => {
    const result = spawnGib({ gibs: [], x: 5, y: 5, vx: 3, vy: -2, spin: 0.1, chunk: 'arm' });
    assert.ok(result.gib);
    assert.equal(result.gib.vx, 3);
    assert.equal(result.gib.vy, -2);
    assert.equal(result.gib.chunk, 'arm');
    assert.equal(result.gibs.length, 1);
  });

  it('spawnGib caps at maxGibs', () => {
    let gibs = [];
    for (let i = 0; i < GORE_LIMITS.maxGibs + 10; i += 1) {
      const r = spawnGib({ gibs, x: i, y: i });
      gibs = r.gibs;
    }
    assert.ok(gibs.length <= GORE_LIMITS.maxGibs);
  });

  it('computeGoreDampening returns 1 (full FX) at low threat count', () => {
    assert.equal(computeGoreDampening({ threatCount: 10, goreEnabled: true }), 1);
  });

  it('computeGoreDampening returns near-zero at high threat count', () => {
    const d = computeGoreDampening({ threatCount: 80, goreEnabled: true });
    assert.ok(d <= 0.2 && d > 0);
  });

  it('computeGoreDampening returns 0 when gore is disabled', () => {
    assert.equal(computeGoreDampening({ threatCount: 10, goreEnabled: false }), 0);
  });

  it('computeGoreDampening ramps linearly between thresholds', () => {
    const mid = computeGoreDampening({ threatCount: 60, goreEnabled: true });
    assert.ok(mid > 0.15 && mid < 1);
  });

  it('validateGoreSystem passes all invariants', () => {
    const result = validateGoreSystem();
    assert.ok(result.ok, result.errors.join(', '));
  });
});
