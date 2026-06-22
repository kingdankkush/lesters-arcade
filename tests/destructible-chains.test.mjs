import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeChainDetonation, validateChainDetonation } from '../apps/portal/src/destructible-chains.mjs';

describe('destructible-chains', () => {
  it('chains to nearby explosive barrels but not distant ones', () => {
    const props = [
      { id: 'a', x: 0, y: 0, w: 20, h: 20, explosive: true, hp: 0 },
      { id: 'b', x: 50, y: 0, w: 20, h: 20, explosive: true, hp: 0 },
      { id: 'c', x: 500, y: 500, w: 20, h: 20, explosive: true, hp: 0 },
    ];
    const result = computeChainDetonation({ props, triggerId: 'a', chainRadius: 70 });
    assert.ok(result.detonated.includes('b'));
    assert.ok(!result.detonated.includes('c'));
    assert.ok(!result.detonated.includes('a'));
    assert.ok(result.damageZones.length >= 2);
  });

  it('does not chain to non-explosive props', () => {
    const props = [
      { id: 'a', x: 0, y: 0, w: 20, h: 20, explosive: true, hp: 0 },
      { id: 'wall', x: 30, y: 0, w: 20, h: 20, explosive: false, hp: 0 },
    ];
    const result = computeChainDetonation({ props, triggerId: 'a', chainRadius: 70 });
    assert.ok(!result.detonated.includes('wall'));
    assert.equal(result.detonated.length, 0);
  });

  it('returns empty for null trigger', () => {
    const result = computeChainDetonation({ props: [], triggerId: null });
    assert.deepEqual(result.detonated, []);
    assert.deepEqual(result.damageZones, []);
  });

  it('handles multi-hop chains (a -> b -> d)', () => {
    const props = [
      { id: 'a', x: 0, y: 0, w: 20, h: 20, explosive: true, hp: 0 },
      { id: 'b', x: 40, y: 0, w: 20, h: 20, explosive: true, hp: 0 },
      { id: 'd', x: 80, y: 0, w: 20, h: 20, explosive: true, hp: 0 },
      { id: 'far', x: 800, y: 0, w: 20, h: 20, explosive: true, hp: 0 },
    ];
    const result = computeChainDetonation({ props, triggerId: 'a', chainRadius: 70 });
    assert.ok(result.detonated.includes('b'));
    assert.ok(result.detonated.includes('d'));
    assert.ok(!result.detonated.includes('far'));
  });

  it('validateChainDetonation passes all invariants', () => {
    const result = validateChainDetonation();
    assert.ok(result.ok, result.errors.join(', '));
  });
});
