import test from 'node:test';
import assert from 'node:assert/strict';

import { CHIKUN_BOT_PROFILES, mulberry32, profileHash, viewportRightEdge } from '../scripts/lib/chikun-bots.mjs';
import { playBotRun, harnessSeed, percentile, summarizeProfile } from '../scripts/chikun-difficulty-harness.mjs';

test('bot profiles are the fixed D11 table and bots are seeded, never Math.random', () => {
  assert.deepEqual(CHIKUN_BOT_PROFILES.map((p) => [p.name, p.reactionDelayTicks, p.jitterSigmaTicks, p.lookAheadPx, p.viewport.orientation]), [
    ['novice', 24, 5, 260, 'portrait'],
    ['intermediate', 18, 3.5, 360, 'portrait'],
    ['expert', 12, 2, 520, 'landscape'],
    ['hardcore', 8, 1.2, 700, 'landscape'],
    ['exceptional', 5, 0.8, 1000, 'landscape'],
  ]);
  assert.ok(Math.abs(viewportRightEdge({ orientation: 'portrait', width: 390, height: 844 }) - 527) < 1, 'portrait sees world x up to about 527');
  const a = mulberry32(7 ^ profileHash('novice')), b = mulberry32(7 ^ profileHash('novice'));
  for (let i = 0; i < 5; i += 1) assert.equal(a(), b());
  const original = Math.random;
  Math.random = () => { throw new Error('bots must not call Math.random'); };
  try {
    const first = playBotRun({ profileName: 'novice', seed: harnessSeed(0), maxTicks: 2400, courseKey: 'v5' });
    const second = playBotRun({ profileName: 'novice', seed: harnessSeed(0), maxTicks: 2400, courseKey: 'v5' });
    assert.deepEqual(first, second);
  } finally {
    Math.random = original;
  }
  assert.equal(percentile([1, 2, 3, 4], 0.5), 2.5);
  const summary = summarizeProfile([{ minutes: 1, terminalReason: 'storm', flaps: 60, stats: { score: 5 } }, { minutes: 2, terminalReason: 'tree', flaps: 100, stats: { score: 9 } }]);
  assert.deepEqual(summary.deathCauses, { storm: 1, tree: 1 });
  assert.equal(summary.flapsPerMinute.p50, 55);
});
