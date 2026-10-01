// The legacy (schema 6 and 7) verification identity: every stored HMH run this
// repository holds (the real-child corpora, the committed Ranked fixtures and
// the scripted honest model), verified through every public verifier entry it
// reaches, hashed into one digest. The digest was taken on the 2.0.0 base
// (f044868ff) before schema 8 existed; tests/server-verify-hmh-v8-legacy-identity.test.mjs
// pins it, so adding the ten-area contract cannot move one byte of a legacy
// verdict.
//   node scripts/hmh-ranked-v8/legacy-verify-digest.mjs   -> prints the digest and counts
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { validateRunSummaryPayload } from '../../sdk/hmh-run-summary-schema-v7.mjs';
import { validateRunSummaryPayload as validateBase } from '../../sdk/hmh-run-summary-schema.mjs';
import { validateRebootRunPlausibility } from '../../server/verify/hmh-plausibility.mjs';
import { resolveHmhMapContext } from '../../server/verify/hmh-map-context.mjs';
import { verifyRankedRun } from '../../server/verify/index.mjs';
import { fixtureVerifyOptions } from '../../tests/fixtures/ranked/build-fixtures.mjs';
import { buildHmhHonestCorpus } from '../../tests/fixtures/ranked/hmh-honest-corpus.mjs';

const ROOT = new URL('../../', import.meta.url);
const plain = (value) => JSON.parse(JSON.stringify(value ?? null));

function summaryVerdicts(summary, buildHash) {
  const schemaVersion = summary?.schemaVersion;
  const context = resolveHmhMapContext({ identity: { gameId: 'lester-blaster', buildHash }, schemaVersion });
  return {
    schema: validateRunSummaryPayload(summary),
    base: validateBase(summary),
    reboot: plain(validateRebootRunPlausibility(summary)),
    context: context ? { mapId: context.mapId, mapVersion: context.mapVersion, schemaVersion: context.schemaVersion, verdict: plain(context.validatePlausibility(summary)) } : null,
  };
}

export async function legacyVerifyRecords() {
  const records = [];
  const corpusDir = new URL('tests/fixtures/hmh-honest-corpus/', ROOT);
  for (const name of readdirSync(corpusDir).filter((file) => /^real-child-\d+\.\d+\.\d+\.json$/.test(file)).sort()) {
    const corpus = JSON.parse(readFileSync(new URL(name, corpusDir), 'utf8'));
    for (const run of corpus.runs) records.push({ source: `${name}/${run.label}`, ...summaryVerdicts(run.runSummary, corpus.child.buildHash) });
  }
  const fixtureDir = new URL('tests/fixtures/ranked/', ROOT);
  for (const name of readdirSync(fixtureDir).filter((file) => /^hmh-.*\.json$/.test(file)).sort()) {
    const fixture = JSON.parse(readFileSync(new URL(name, fixtureDir), 'utf8'));
    const run = await verifyRankedRun(fixture.body, fixtureVerifyOptions({ nowMs: fixture.verifyAtMs }));
    records.push({ source: name, run: plain(run), ...summaryVerdicts(fixture.body.evidence.runSummary, fixture.body.identity.buildHash) });
  }
  const model = buildHmhHonestCorpus();
  for (const [index, entry] of model.entries()) {
    const summary = entry.runSummary ?? entry.summary ?? entry;
    records.push({ source: `model/${index}`, ...summaryVerdicts(summary, summary.identity?.buildHash) });
  }
  return records;
}

export async function legacyVerifyDigest() {
  const records = await legacyVerifyRecords();
  return { count: records.length, digest: createHash('sha256').update(JSON.stringify(records)).digest('hex') };
}

if (process.argv[1]?.endsWith('legacy-verify-digest.mjs')) {
  const { count, digest } = await legacyVerifyDigest();
  process.stdout.write(`${JSON.stringify({ count, digest })}
`);
}
