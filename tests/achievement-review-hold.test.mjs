// Owner-approved hardening (HMH-RANKED-V8-TEN-AREA review): an HMH run whose
// plausibility carries a soft near-ceiling flag earns no HMH NFT trophy; those
// ids are pending review instead (recorded with the stored plausibility by
// settle-core). Ordinary achievements, unflagged runs and the other cabinets
// are unchanged.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  HMH_REVIEW_HOLD_FLAG,
  achievementReviewFlags,
  catalogFor,
  deriveEarnedAchievements,
  emptyHistory,
  nftAchievementIds,
  pendingReviewAchievements,
} from '../apps/portal/src/achievements/index.mjs';
import { statsFromHmhRunSummary } from '../apps/portal/src/achievements/stats.mjs';
import { readV8Corpus } from './fixtures/ranked/hmh-v8-bodies.mjs';

const WALLET = '0x70997970c51812dc3a010c7d01b50e0d17dc79c8';
const corpus = readV8Corpus();
const baron = corpus.runs.find((run) => run.runSummary.bosses.some((row) => row.bossId === 'rug-pull-baron' && row.defeatedTick > 0));

// A run with every boss in killsByRole (Full Roster Run) and a long history
// (the run-count mythics), so every HMH NFT entry is a candidate.
function rosterRun(flags) {
  const stats = statsFromHmhRunSummary(baron.runSummary);
  for (const role of ['rug-pull-baron', 'lockkeeper', 'fifty-one-percent-foreman', 'liquidator']) stats.killsByRole[role] = 1;
  stats.bossKills = 1;
  return { gameId: 'lester-blaster', wallet: WALLET, score: stats.score, stats, plausibility: flags === null ? undefined : { verdict: flags.length ? 'flagged' : 'ok', flags } };
}
const history = () => ({ ...emptyHistory(WALLET, 'lester-blaster'), runs: 499, sums: { ...emptyHistory(WALLET, 'lester-blaster').sums, bossKills: 49 } });
const flag = (id) => ({ id, severity: 'flag', value: 1, limit: 1 });
const ids = (entries) => entries.map((entry) => entry.id);
const HMH_NFT = nftAchievementIds('lester-blaster');

test('the hold flags: near-ceiling, above-selected-upgrades and kills-near-capacity, soft only', () => {
  for (const id of ['xp-near-ceiling', 'score-near-ceiling', 'kills-near-capacity', 'xp-above-selected-upgrades', 'score-above-selected-upgrades']) assert.ok(HMH_REVIEW_HOLD_FLAG.test(id), id);
  for (const id of ['combo-exceeds-kills', 'upgrade-rank-above-max', 'node-level-inconsistent', 'kills-above-capacity']) assert.ok(!HMH_REVIEW_HOLD_FLAG.test(id), id);
  assert.deepEqual(achievementReviewFlags('lester-blaster', rosterRun([flag('score-near-ceiling'), flag('combo-exceeds-kills')])), ['score-near-ceiling']);
  assert.deepEqual(achievementReviewFlags('chikun', rosterRun([flag('score-near-ceiling')])), [], 'other cabinets are never held');
  assert.deepEqual(achievementReviewFlags('lester-blaster', rosterRun(null)), []);
});

test('a flagged run earns no HMH NFT trophy; they are pending review, and every other achievement is unchanged', () => {
  const clean = deriveEarnedAchievements('lester-blaster', rosterRun([]), history());
  for (const id of ['boss-rush-fifty', 'arcade-legend-500']) assert.ok(ids(clean).includes(id), `${id} on a clean run`);
  // Full Roster Run is held for review on every run, flagged or not (review finding: soft flags can be avoided).
  assert.ok(!ids(clean).includes('full-roster-run'), 'Full Roster Run is never earned outright');
  assert.deepEqual(ids(pendingReviewAchievements('lester-blaster', rosterRun([]), history())), ['full-roster-run']);
  assert.deepEqual(ids(pendingReviewAchievements('lester-blaster', rosterRun(null), history())), ['full-roster-run']);
  for (const holdFlag of ['xp-near-ceiling', 'score-near-ceiling', 'kills-near-capacity', 'xp-above-selected-upgrades', 'score-above-selected-upgrades']) {
    const run = rosterRun([flag(holdFlag)]);
    const earned = ids(deriveEarnedAchievements('lester-blaster', run, history()));
    const pending = ids(pendingReviewAchievements('lester-blaster', run, history()));
    assert.ok(!earned.some((id) => HMH_NFT.includes(id)), `${holdFlag}: no NFT trophy earned`);
    assert.deepEqual([...pending].sort(), ['full-roster-run', ...ids(clean).filter((id) => HMH_NFT.includes(id))].sort(), `${holdFlag}: the held ids`);
    assert.deepEqual(earned, ids(clean).filter((id) => !HMH_NFT.includes(id)), `${holdFlag}: ordinary achievements unchanged`);
  }
  // A non-hold soft flag holds nothing; a run without plausibility (the browser) holds nothing.
  assert.deepEqual(ids(deriveEarnedAchievements('lester-blaster', rosterRun([flag('combo-exceeds-kills')]), history())), ids(clean));
  assert.deepEqual(ids(deriveEarnedAchievements('lester-blaster', rosterRun(null), history())), ids(clean));
  assert.ok(catalogFor('lester-blaster').filter((entry) => entry.nft).every((entry) => HMH_NFT.includes(entry.id)));
});

test('settle-core records the held ids with the stored plausibility, and the registry exports the seam', () => {
  const core = readFileSync(new URL('../server/settle/settle-core.mjs', import.meta.url), 'utf8');
  assert.match(core, /deps\.catalog\.pendingReviewAchievements\(gameId, run, history\)/);
  assert.match(core, /pendingReviewAchievementIds: pendingReview/);
  assert.match(core, /'deriveEarnedAchievements', 'pendingReviewAchievements', 'historyFieldsFor'/);
});
