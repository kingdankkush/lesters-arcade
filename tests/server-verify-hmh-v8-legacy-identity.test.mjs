// Adding schema 8 and the ten-area context moves no legacy verdict: every
// stored HMH run this repository holds (the 248 real-child summaries of 1.8.3,
// 1.8.4 and 1.9.0, the committed Ranked fixtures and the 75 scripted honest
// model runs), verified through every public entry it reaches, hashes to the
// digest taken on the 2.0.0 base (f044868ff) before schema 8 existed
// (scripts/hmh-ranked-v8/legacy-verify-digest.mjs). The schema 1-8 validator
// answers every legacy summary exactly as the schema 1-7 one.
import assert from 'node:assert/strict';
import test from 'node:test';
import { legacyVerifyDigest, legacyVerifyRecords } from '../scripts/hmh-ranked-v8/legacy-verify-digest.mjs';
import { validateRunSummaryPayload as validateUpTo7 } from '../sdk/hmh-run-summary-schema-v7.mjs';
import { validateRunSummaryPayload as validateUpTo8 } from '../sdk/hmh-run-summary-schema-v8.mjs';
import { readdirSync, readFileSync } from 'node:fs';

const BASE_DIGEST = '0a7eec5efe23b5fdf7d9cc132b2d957efd619ebcb66d859f4a8bac9102da4895';

test('every legacy verdict, context and verified result is byte-identical to the 2.0.0 base', async () => {
  const { count, digest } = await legacyVerifyDigest();
  assert.equal(count, 329);
  assert.equal(digest, BASE_DIGEST);
  const records = await legacyVerifyRecords();
  assert.ok(records.every((record) => record.context === null || record.context.mapId === 'forked-frontier'));
});

test('the schema 1-8 validator answers every legacy summary as the schema 1-7 one', () => {
  const directory = new URL('./fixtures/hmh-honest-corpus/', import.meta.url);
  const summaries = [];
  for (const name of readdirSync(directory).filter((file) => /^real-child-\d+\.\d+\.\d+\.json$/.test(file))) {
    summaries.push(...JSON.parse(readFileSync(new URL(name, directory), 'utf8')).runs.map((run) => run.runSummary));
  }
  const fixtures = new URL('./fixtures/ranked/', import.meta.url);
  for (const name of readdirSync(fixtures).filter((file) => /^hmh-.*\.json$/.test(file))) summaries.push(JSON.parse(readFileSync(new URL(name, fixtures), 'utf8')).body.evidence.runSummary);
  assert.equal(summaries.length, 254);
  for (const summary of summaries) {
    assert.equal(validateUpTo8(summary), validateUpTo7(summary));
    for (const schemaVersion of [5, 6, 7, 9]) assert.equal(validateUpTo8({ ...summary, schemaVersion }), validateUpTo7({ ...summary, schemaVersion }));
  }
});
