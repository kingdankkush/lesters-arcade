// The real-child honest corpus against the v6 plausibility path: run summaries
// the unmodified HMH child emitted over hmh-bridge/v1 while the headless
// harness (scripts/hmh-honest-corpus) drove it with honest gamepad pilots.
// Unlike tests/fixtures/ranked/hmh-honest-corpus.mjs, which is a scripted MODEL
// of honest play, every summary here came out of the child's own simulation,
// accumulator and progression. No run may be rejected; the flags an honest run
// may carry are listed run by run, so a new rule that starts to bite real play
// fails here first.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import {
  HMH_V6_CONSISTENCY_REJECTS,
  hmhV6LevelEntry,
  validateRebootRunPlausibility,
} from '../server/verify/hmh-plausibility.mjs';
import { HMH_RUN_SUMMARY_SCHEMA_VERSION } from '../server/verify/hmh.mjs';
import { validateRunSummaryPayload } from '../sdk/hmh-run-summary-schema.mjs';
import { statsFromHmhRunSummary } from '../apps/portal/src/achievements/stats.mjs';

const CORPUS_DIR = new URL('./fixtures/hmh-honest-corpus/', import.meta.url);
const CORPUS_SCHEMA = 'hmh-real-child-corpus-v1';
const BUILD_HASH = /^site-\d+\.\d+\.\d+:game-(\d+\.\d+\.\d+):cabinet-\d+\.\d+\.\d+$/;

// Pinned per child release: the run count and the SHA-256 of the summaries in
// file order. Adding runs to a file re-pins it; nothing else may move it.
const PINNED = Object.freeze({
  '1.8.3': { runs: 68, digest: 'ecd897f5e48857ecaaa4dcbebc17fa77e686199c5db870b3b24bff3e07d3c697' },
  '1.8.4': { runs: 12, digest: 'c4bdc7c9cd80de3e45e7fe45ccdf0cea8288d83c4253de2642c77b5740e4be3f' },
});

// Every flag an honest run in the corpus carries today, by release/label. A
// run absent here must verify clean. Soft near-ceiling flags on skilled honest
// runs are expected; a consistency reject never is.
const EXPECTED_FLAGS = Object.freeze({
  '1.8.3/r08-brawler-relay-3000': ['kills-near-capacity'],
  '1.8.3/r62-grenadier-yard-110000': ['score-near-ceiling'],
});

const corpora = readdirSync(CORPUS_DIR)
  .filter((name) => /^real-child-\d+\.\d+\.\d+\.json$/.test(name))
  .sort()
  .map((name) => ({ name, ...JSON.parse(readFileSync(new URL(name, CORPUS_DIR), 'utf8')) }));
const digestOf = (runs) => createHash('sha256').update(JSON.stringify(runs.map((run) => run.runSummary))).digest('hex');

test('the real-child corpus holds one pinned file per child release, each run a valid schema-6 summary of that child', () => {
  assert.deepEqual(corpora.map((corpus) => corpus.child.release), Object.keys(PINNED));
  for (const corpus of corpora) {
    assert.equal(corpus.schema, CORPUS_SCHEMA, corpus.name);
    const pin = PINNED[corpus.child.release];
    assert.equal(corpus.runs.length, pin.runs, corpus.name);
    assert.equal(digestOf(corpus.runs), pin.digest, corpus.name);
    assert.equal(BUILD_HASH.exec(corpus.child.buildHash)?.[1], corpus.child.release, corpus.name);
    assert.equal(new Set(corpus.runs.map((run) => run.label)).size, corpus.runs.length, `${corpus.name}: labels are unique`);
    for (const run of corpus.runs) {
      const { runSummary: summary } = run;
      const name = `${corpus.child.release}/${run.label}`;
      assert.equal(validateRunSummaryPayload(summary), '', name);
      assert.equal(summary.schemaVersion, HMH_RUN_SUMMARY_SCHEMA_VERSION, name);
      // The child stamped the identity the harness gave it, as the portal would.
      assert.equal(summary.identity.buildHash, corpus.child.buildHash, name);
      assert.equal(summary.identity.mode, 'ranked', name);
      assert.equal(summary.identity.terminalReason, 'defeated', name);
      assert.equal(summary.identity.seed, run.seed, name);
      assert.equal(summary.identity.heroId, run.heroId, name);
      assert.equal(summary.identity.endTick, run.finalTick, name);
      assert.equal(summary.totals.survivalTicks, run.finalTick, name);
      assert.equal(hmhV6LevelEntry(run.seed).id, run.entry, name);
      assert.doesNotThrow(() => statsFromHmhRunSummary(summary), name);
    }
  }
});

test('no real honest run is rejected, and each carries exactly the flags listed for it', (t) => {
  const verdicts = {};
  const seen = new Set();
  for (const corpus of corpora) {
    for (const run of corpus.runs) {
      const name = `${corpus.child.release}/${run.label}`;
      const result = validateRebootRunPlausibility(run.runSummary);
      assert.notEqual(result.verdict, 'rejected', `${name}: ${JSON.stringify(result.flags)}`);
      assert.deepEqual(result.flags.filter((flag) => HMH_V6_CONSISTENCY_REJECTS.includes(flag.id)), [], name);
      assert.deepEqual(result.flags.map((flag) => flag.id), EXPECTED_FLAGS[name] ?? [], `${name}: ${JSON.stringify(result.flags)}`);
      seen.add(name);
      verdicts[result.verdict] = (verdicts[result.verdict] ?? 0) + 1;
    }
  }
  for (const name of Object.keys(EXPECTED_FLAGS)) assert.ok(seen.has(name), `${name} is in the corpus`);
  t.diagnostic(`verdicts ${JSON.stringify(verdicts)}`);
});

test('the corpus covers every level entry, both heroes and every pilot style, and ends by death', (t) => {
  const runs = corpora.flatMap((corpus) => corpus.runs);
  const entries = new Set(runs.map((run) => run.entry));
  const heroes = new Set(runs.map((run) => run.heroId));
  const styles = new Set(runs.map((run) => run.style));
  assert.equal(entries.size, 5, [...entries].join(','));
  assert.deepEqual([...heroes].sort(), ['lit-commando', 'lit-valkyrie']);
  assert.ok(styles.size >= 10, [...styles].join(','));
  for (const run of runs) assert.ok(['death', 'death-after-surrender'].includes(run.endedBy), run.label);
  const ticks = runs.reduce((sum, run) => sum + run.finalTick, 0);
  assert.ok(ticks >= 1_000_000, `ticks in the corpus: ${ticks}`);
  t.diagnostic(`${runs.length} runs, ${ticks} ticks, styles ${[...styles].sort().join(' ')}`);
});
