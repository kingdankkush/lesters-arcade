import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawStackedPieces, createStackedRuntime } from '../apps/portal/src/stacked-sim.mjs';

test('every consecutive bag window is a permutation and drought is at most 12', () => {
  const draw = drawStackedPieces(123456, 10000);
  for (let i = 0; i + 7 <= draw.pieces.length; i += 7) assert.equal(new Set(draw.pieces.slice(i, i + 7)).size, 7);
  for (const kind of 'IJLOSTZ') {
    let previous = -1;
    draw.pieces.forEach((piece, index) => { if (piece === kind) { if (previous >= 0) assert.ok(index - previous - 1 <= 12); previous = index; } });
  }
});

test('256 seeds produce at least 250 first-bag orderings', () => {
  const orders = new Set(Array.from({ length: 256 }, (_, seed) => drawStackedPieces(seed + 130, 7).pieces.join('')));
  assert.ok(orders.size >= 250, `${orders.size} distinct bags`);
});

test('contract-winning refill timing and draw accounting are exact', () => {
  for (const pieces of [0, 1, 6, 7, 8, 13, 14, 40]) {
    const draw = drawStackedPieces(99, pieces);
    assert.equal(draw.bagRefills, 2 + Math.floor(pieces / 7));
    assert.ok(draw.bagDraws >= 6 * draw.bagRefills);
  }
});

test('first forty pieces are pinned for seed 20260906', () => {
  assert.equal(drawStackedPieces(20260906, 40).pieces.join(''), 'ZISJOTLOZLITSJJILZSOTOZJLTISSZLTJIOZJOTL');
});

test('same seed/masks repeat byte-identically; different seed diverges; batching is irrelevant', () => {
  const masks = Array.from({ length: 500 }, (_, i) => i % 23 === 0 ? 8 : i % 11 === 0 ? 16 : 0);
  const run = (seed) => { const r = createStackedRuntime({ seed, maxTicks: 500, config: { startLevel: 1 } }); const chain=[]; for (const mask of masks) { if (r.terminal) break; r.step(mask); chain.push(JSON.stringify(r.snapshot())); } return { chain, hash: r.stateHash() }; };
  const a = run(77), b = run(77), c = run(78);
  assert.deepEqual(a, b); assert.notEqual(a.hash, c.hash);
  const batched = createStackedRuntime({ seed: 77, maxTicks: 500, config: { startLevel: 1 } });
  for (let i = 0; i < masks.length; i += 4) for (const mask of masks.slice(i, i + 4)) if (!batched.terminal) batched.step(mask);
  assert.equal(batched.stateHash(), a.hash);
});

test('a freshly imported module instance repeats the same snapshot chain', async () => {
  const first = createStackedRuntime({ seed: 404, maxTicks: 20, config: { startLevel: 1 } });
  const freshModule = await import(`../apps/portal/src/stacked-sim.mjs?fresh=${Date.now()}`);
  const second = freshModule.createStackedRuntime({ seed: 404, maxTicks: 20, config: { startLevel: 1 } });
  const masks = [0,16,0,1,0,8,8,8];
  for (const mask of masks) { first.step(mask); second.step(mask); assert.deepEqual(first.snapshot(), second.snapshot()); }
});
