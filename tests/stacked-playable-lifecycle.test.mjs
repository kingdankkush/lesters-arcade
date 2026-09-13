import test from 'node:test';
import assert from 'node:assert/strict';
import { createStackedPlaySession } from '../apps/stacked/src/play-session.mjs';
import { buildStackedRunSummary } from '../apps/stacked/src/run-summary.mjs';
import { validateStackedRunSummary } from '../sdk/stacked-run-summary-schema.mjs';
import { createStackedPortalLifecycle } from '../apps/portal/src/stacked-portal-lifecycle.mjs';
const completed = () => {
  const run = createStackedPlaySession({ seed: 44, mode: 'ranked' });
  while (!run.result) run.step(run.snapshot.tick % 2 ? 0 : 8);
  return run;
};
test('actual terminal snapshots produce valid summary wire data', () => {
  const run = completed();
  assert.equal(validateStackedRunSummary(buildStackedRunSummary(run.snapshot, 'ranked')), '');
});
test('Free verification never calls Ranked persistence', async () => {
  const run = completed(); let writes = 0;
  const lifecycle = createStackedPortalLifecycle({ session: { seed: 44, buildHash: 'stacked-local', seasonId: 'stacked-season-preview-1', leaderboardEligible: false }, persistRanked: () => writes++ });
  assert.equal((await lifecycle.finish(run.evidence(), run.result)).ok, true);
  assert.equal(writes, 0);
  assert.equal((await lifecycle.finish(run.evidence(), run.result)).ok, false);
});
test('mismatched and cross-session claims fail before any write', async () => {
  const run = completed(); let writes = 0;
  for (const seed of [44, 45]) {
    const lifecycle = createStackedPortalLifecycle({ session: { seed, buildHash: 'stacked-local', seasonId: 'stacked-season-preview-1', leaderboardEligible: true }, persistRanked: () => writes++ });
    assert.equal((await lifecycle.finish(run.evidence(), { ...run.result, score: 999 })).ok, false);
  }
  assert.equal(writes, 0);
});
test('concurrent valid results can persist only once', async () => {
  const run = completed(); let writes = 0;
  const lifecycle = createStackedPortalLifecycle({ session: { seed: 44, buildHash: 'stacked-local', seasonId: 'stacked-season-preview-1', leaderboardEligible: true }, persistRanked: () => writes++ });
  const results = await Promise.all([lifecycle.finish(run.evidence(), run.result), lifecycle.finish(run.evidence(), run.result)]);
  assert.equal(results.filter(r => r.ok).length, 1); assert.equal(writes, 1);
});
test('closing the cabinet while verification is pending prevents every Ranked write', async () => {
  const run = completed(); let writes = 0, release;
  const lifecycle = createStackedPortalLifecycle({
    session: { seed: 44, leaderboardEligible: true },
    verify: () => new Promise(resolve => { release = resolve; }),
    persistRanked: () => writes++,
  });
  const result = lifecycle.finish(run.evidence(), run.result);
  lifecycle.cancel(); release(run.result);
  assert.equal((await result).ok, false); assert.equal(writes, 0);
  assert.equal((await lifecycle.finish(run.evidence(), run.result)).ok, false);
});
