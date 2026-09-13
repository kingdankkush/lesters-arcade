import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../apps/portal/src/stacked-sim.mjs';
import { STACKED_MAX_TICKS } from '../apps/portal/src/stacked-contracts.mjs';
function varintLength(value) { let bytes = 1; while (value >= 128) { value = Math.floor(value / 128); bytes += 1; } return bytes; }
// Structural codec fixtures, not claims of reachable, unattended game states.
for (const gap of [1, 16, 17, 128, 129, 16384, 16385, STACKED_MAX_TICKS]) {
  for (const mask of [1, 3]) {
    test(`sim predictor agrees with the actual SIC1 bytes at gap=${gap}, mask=${mask}`, () => {
      assert.equal(typeof sim.sic1TransitionByteLength, 'function');
      const encoded = sim.encodeSic1({ seed: 1, totalTicks: gap, transitions: [{ tick: gap, mask }] });
      const bodyBytes = encoded.byteLength - 24 - 1 - varintLength(gap);
      assert.equal(sim.sic1TransitionByteLength(0, mask, gap), bodyBytes);
      assert.equal(sim.decodeSic1(encoded).transitions[0].tick, gap);
    });
  }
}
test('sim predictor does not charge repeated identical input', () => {
  assert.equal(typeof sim.sic1TransitionByteLength, 'function');
  assert.equal(sim.sic1TransitionByteLength(7, 7, 200), 0);
});
test('sim predictor rejects inputs outside the bounded byte/tick format', () => {
  assert.equal(typeof sim.sic1TransitionByteLength, 'function');
  for (const args of [[-1,1,1],[0,256,1],[0,1,0],[0,1,1.5],[0,1,STACKED_MAX_TICKS+1]]) assert.throws(() => sim.sic1TransitionByteLength(...args));
});
