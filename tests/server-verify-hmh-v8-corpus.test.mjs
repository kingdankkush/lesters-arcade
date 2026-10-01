// The ten-area real-child honest corpus (run summary schema 8): runs of the
// 2.1.0 child on its ten-area Level 1, played by the honest pilots of
// scripts/hmh-honest-corpus/pilot-ten-area.mjs under Ranked identities, and
// condensed into tests/fixtures/hmh-honest-corpus/real-child-2.1.0-ten-area.json.
// Every summary came out of the child's own simulation, accumulator and
// progression. No run may be rejected, every run verifies through
// verifyRankedRun exactly as Ranked receives it, and the flags an honest run
// may carry are listed run by run. docs/2.0/slices/HMH-RANKED-V8-TEN-AREA.md.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { verifyRankedRun } from '../server/verify/index.mjs';
import { resolveHmhMapContext } from '../server/verify/hmh-map-context.mjs';
import { HMH_RUN_SUMMARY_CATALOGS_V8 as C8, validateRunSummaryPayload } from '../sdk/hmh-run-summary-schema-v8.mjs';
import { isHmhV8Build } from '../sdk/hmh-run-contract-v8.mjs';
import { TEN_AREA_HEROES, TEN_AREA_PLAN } from '../scripts/hmh-honest-corpus/plan-ten-area.mjs';
import { rankedBodyFor, readV8Corpus } from './fixtures/ranked/hmh-v8-bodies.mjs';

const corpus = readV8Corpus();
const digestOf = (runs) => createHash('sha256').update(JSON.stringify(runs.map((run) => run.runSummary))).digest('hex');

// Pinned: the run count and the SHA-256 of the summaries in file order.
const PINNED = Object.freeze({ release: '2.1.0', runs: 43, digest: 'e4474f1cfecf0482b28fe846c1735031d1ecb0c756307eec76d54d127245a8e1' });
// Every flag an honest run carries today. A run absent here must verify clean.
// Soft near-capacity flags on point-blank honest play, as in the legacy corpora.
const EXPECTED_FLAGS = Object.freeze({
  't00-suicide-0': ['kills-near-capacity'],
  't01-suicide-0': ['kills-near-capacity'],
  't04-brawler-3000': ['kills-near-capacity'],
  't19-turtle-110000': ['kills-near-capacity'],
});

test('the ten-area corpus is one pinned file of the 2.1.0 child, every run a schema-8 summary of its plan row', () => {
  assert.equal(corpus.schema, 'hmh-real-child-corpus-v1');
  assert.equal(corpus.child.release, PINNED.release);
  assert.equal(corpus.child.buildHash, 'site-2.1.0:game-2.1.0:cabinet-0.6.0');
  assert.ok(isHmhV8Build(corpus.child.buildHash));
  assert.equal(corpus.runs.length, PINNED.runs);
  assert.equal(digestOf(corpus.runs), PINNED.digest);
  assert.deepEqual(corpus.runs.map((run) => run.label), TEN_AREA_PLAN.map((run) => run.label));
  for (const run of corpus.runs) {
    const plan = TEN_AREA_PLAN.find((row) => row.label === run.label);
    assert.equal(run.heroId, plan.heroId, run.label);
    assert.equal(run.style, plan.style, run.label);
    assert.equal(run.childErrors, 0, run.label);
    assert.equal(run.runSummary.schemaVersion, 8, run.label);
    assert.equal(run.runSummary.identity.mode, 'ranked', run.label);
    assert.equal(run.runSummary.identity.heroId, plan.heroId, run.label);
    assert.equal(run.runSummary.identity.buildHash, corpus.child.buildHash, run.label);
    assert.equal(run.runSummary.identity.terminalReason, 'defeated', run.label);
  }
});

test('every run passes the schema and the v8 plausibility path with only its listed flags', () => {
  for (const run of corpus.runs) {
    const summary = run.runSummary;
    assert.equal(validateRunSummaryPayload(summary), '', run.label);
    const context = resolveHmhMapContext({ identity: { gameId: 'lester-blaster', buildHash: summary.identity.buildHash }, schemaVersion: summary.schemaVersion });
    assert.deepEqual([context.mapId, context.mapVersion, context.schemaVersion], ['ten-area-frontier', 2, 8], run.label);
    const verdict = context.validatePlausibility(summary);
    assert.notEqual(verdict.verdict, 'rejected', `${run.label}: ${JSON.stringify(verdict.flags)}`);
    assert.deepEqual(verdict.flags.map((flag) => flag.id).sort(), [...(EXPECTED_FLAGS[run.label] ?? [])].sort(), run.label);
    assert.ok(verdict.flags.every((flag) => flag.severity === 'flag'), run.label);
  }
});

test('every run verifies through verifyRankedRun with its plan identity, as Ranked receives it', async () => {
  for (const run of corpus.runs) {
    const { body, options } = await rankedBodyFor(run);
    const verified = await verifyRankedRun(body, options);
    assert.equal(verified.ok, true, `${run.label}: ${JSON.stringify(verified)}`);
    assert.equal(verified.score, run.runSummary.totals.score, run.label);
    assert.equal(verified.contract.kills, run.runSummary.kills.total, run.label);
  }
});

test('the corpus exercises the ten-area contract: every hero, every area, the travel graph, the 2.0 enemies, a district boss, cover and ledges', () => {
  const summaries = corpus.runs.map((run) => run.runSummary);
  assert.ok(corpus.runs.length >= 32);
  assert.deepEqual([...new Set(corpus.runs.map((run) => run.heroId))].sort(), [...TEN_AREA_HEROES].sort());
  const areas = summaries.reduce((mask, summary) => mask | summary.exploration.visitedDistrictMask, 0);
  assert.equal(areas, (2 ** C8.districts.length) - 1, 'all ten areas visited across the corpus');
  assert.ok(summaries.some((summary) => [...summary.exploration.visitedDistrictMask.toString(2)].filter((digit) => digit === '1').length >= 9));
  const roles = new Set(summaries.flatMap((summary) => summary.kills.byEnemyRole.filter((row) => row.count > 0).map((row) => row.enemyRoleId)));
  for (const role of ['rug-puller', 'hodl-revenant', 'bagholder-rusher', 'forkrunner', 'liquidator-agent']) assert.ok(roles.has(role), role);
  assert.ok(roles.size >= 8, [...roles].join(','));
  const initiated = new Set(summaries.flatMap((summary) => summary.bosses.filter((row) => row.initiations > 0).map((row) => row.bossId)));
  assert.deepEqual([...initiated].sort(), [...C8.bosses].sort(), 'every boss is started by an honest pilot');
  assert.ok(summaries.some((summary) => summary.bosses.some((row) => row.bossId !== 'liquidator' && row.defeatedTick > 0)), 'an honest district boss defeat');
  assert.ok(summaries.some((summary) => summary.movement.coverEnters > 0 && summary.movement.coverKills > 0));
  assert.ok(summaries.some((summary) => summary.movement.mantles > 0 && summary.movement.drops > 0));
  assert.ok(summaries.some((summary) => summary.objectives.some((row) => row.completed === 1)));
  assert.ok(summaries.every((summary) => summary.movement.rulesVersion === 'cover-v1+traversal-v1'));
});
