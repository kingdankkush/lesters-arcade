import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { verifyHmhRun } from '../server/verify/hmh.mjs';
import { verifyRankedRun, reverifyStoredRun } from '../server/verify/index.mjs';
import { validateRebootRunPlausibility } from '../server/verify/hmh-plausibility.mjs';
import { validateRunSummaryPayload } from '../sdk/hmh-run-summary-schema-v7.mjs';
import { FIXTURE_VERIFY_AT_MS, fixtureVerifyOptions, readFixture } from './fixtures/ranked/build-fixtures.mjs';

// Keep baseline behavior cases runnable while the new dispatch module is absent.
// Only this exact absent module is tolerated for the genuine first RED.
let contextModule;
try { contextModule = await import('../server/verify/hmh-map-context.mjs'); }
catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND' || error.url !== new URL('../server/verify/hmh-map-context.mjs', import.meta.url).href) throw error;
}
function resolve(identity, schemaVersion, extras = {}) {
  assert.equal(typeof contextModule?.resolveHmhMapContext, 'function', 'legacy map context resolver is required');
  return contextModule.resolveHmhMapContext({ identity, schemaVersion, ...extras });
}
const identity = buildHash => ({ gameId: 'lester-blaster', buildHash });
const build = version => `site-${version}:game-${version}`;
const valid = readFixture('hmh-valid');
const v7 = readFixture('hmh-v7-liquidator');
const call = evidence => verifyHmhRun({ identity: valid.body.evidence.sessionEnvelope.identity, evidence, nowMs: FIXTURE_VERIFY_AT_MS });
const changed = mutate => { const evidence = structuredClone(valid.body.evidence); mutate(evidence.runSummary, evidence); return evidence; };

test('legacy contexts describe the old map separately for schema 6 and schema 7', () => {
  const six = resolve(identity(build('1.8.4')), 6);
  const seven = resolve(identity(build('1.9.0')), 7);
  for (const [context, schemaVersion] of [[six, 6], [seven, 7]]) {
    assert.deepEqual(Object.keys(context).sort(), ['mapId', 'mapVersion', 'schemaVersion', 'validatePlausibility']);
    assert.equal(context.mapId, 'forked-frontier');
    assert.equal(context.mapVersion, 1);
    assert.equal(context.schemaVersion, schemaVersion);
    assert.equal(typeof context.validatePlausibility, 'function');
  }
  assert.notEqual(six, seven);
});

test('cached schema-6 children retain legacy rules under every previously valid build shape', () => {
  const expected = validateRebootRunPlausibility(valid.body.evidence.runSummary);
  for (const hash of [build('1.7.0'), build('1.8.4'), build('1.9.0'), `${build('1.9.0')}:cabinet-0.6.0`, build('1.10.0'), build('2.0.0'), 'site-01.09.00:game-01.09.00', 'site-1.0.0:game-12345678901234567890.0.0']) {
    const context = resolve(identity(hash), 6);
    assert.equal(context?.schemaVersion, 6, hash);
    assert.equal(context.mapVersion, 1, hash);
    assert.deepEqual(context.validatePlausibility(valid.body.evidence.runSummary), expected, hash);
  }
});

test('schema-7 selection keeps numeric minimum semantics and never selects a future map', () => {
  for (const version of ['1.9.0', '1.9.4', '1.10.0', '2.0.0']) {
    for (const suffix of ['', ':cabinet-0.6.0']) {
      const context = resolve(identity(build(version) + suffix), 7);
      assert.equal(context?.mapVersion, 1, version + suffix);
      assert.equal(context.schemaVersion, 7, version + suffix);
      assert.deepEqual(context.validatePlausibility(v7.body.evidence.runSummary), v7.expected.plausibility);
    }
  }
  for (const version of ['1.8.9', '1.8.999', '0.99.99']) assert.equal(resolve(identity(build(version)), 7), null);
});

test('unknown schemas cannot fall through to schema-6 plausibility', () => {
  for (const schema of [undefined, null, 0, 1, 5, 8, 99, '6', 6.5, NaN]) {
    assert.equal(resolve(identity(build('2.0.0')), schema), null, String(schema));
  }
});

test('malformed build identities and other cabinets cannot select an HMH map', () => {
  const malformed = ['game-1.9.0', 'site-1.9.0', 'site-1.9.0:game-1.9.0:game-2.0.0', 'site-1.9.0:game-1.9', 'site-1.9.0:game-1.9.0:map-v2', '', null, 194];
  for (const hash of malformed) for (const schema of [6, 7]) assert.equal(resolve(identity(hash), schema), null, String(hash));
  for (const candidate of [null, undefined, {}, { gameId: 'stacked', buildHash: build('1.9.0') }]) assert.equal(resolve(candidate, 6), null);
});

test('unbound map labels, version hints and presentation inputs cannot select new rules', () => {
  const canonical = identity(build('1.9.0'));
  const expected = resolve(canonical, 7);
  for (const hint of ['visual-overhaul-greybox-v1', 'map-v2', 'forked-frontier']) {
    assert.equal(resolve({ ...canonical, mapId: hint, gameVersion: '2.0.0' }, 7, { mapId: hint, gameVersion: '2.0.0', areaStreaming: true, quality: 'low' }), expected);
  }
});

test('map contexts cannot be mutated and expose no mutable map catalogue', () => {
  const context = resolve(identity(build('1.9.0')), 7);
  assert.equal(Object.isFrozen(context), true);
  assert.throws(() => { context.mapVersion = 2; }, TypeError);
  assert.throws(() => { context.validatePlausibility = () => ({ verdict: 'ok', flags: [] }); }, TypeError);
  assert.throws(() => { context.areas = []; }, TypeError);
  assert.equal(resolve(identity(build('2.0.0')), 7), context);
  assert.equal(context.validatePlausibility(v7.body.evidence.runSummary).verdict, 'ok');
});

test('all 248 pinned actual-child summaries keep exact legacy plausibility through map dispatch', () => {
  const directory = new URL('./fixtures/hmh-honest-corpus/', import.meta.url);
  const pins = {
    '1.8.3': [68, 'ecd897f5e48857ecaaa4dcbebc17fa77e686199c5db870b3b24bff3e07d3c697'],
    '1.8.4': [52, '7a347eb31de448ca210015f5ea588a88911fef8e601a11268b2417635a760bc5'],
    '1.9.0': [128, 'ec0cefa7f379c5eaf7647c3c458769cb0d219b7f1d7c9c55b157c4736de8255d'],
  };
  const names = readdirSync(directory).filter(name => /^real-child-\d+\.\d+\.\d+\.json$/.test(name)).sort();
  assert.equal(names.length, 3);
  let total = 0;
  for (const name of names) {
    const corpus = JSON.parse(readFileSync(new URL(name, directory), 'utf8'));
    const [count, digest] = pins[corpus.child.release];
    assert.equal(corpus.runs.length, count);
    assert.equal(createHash('sha256').update(JSON.stringify(corpus.runs.map(run => run.runSummary))).digest('hex'), digest);
    for (const run of corpus.runs) {
      const summary = run.runSummary;
      const context = resolve(identity(summary.identity.buildHash), summary.schemaVersion);
      const actual = context.validatePlausibility(summary);
      assert.deepEqual(actual, validateRebootRunPlausibility(summary), `${name}/${run.label}`);
      assert.notEqual(actual.verdict, 'rejected', `${name}/${run.label}`);
      total += 1;
    }
  }
  assert.equal(total, 248);
});

test('v6 and v7 stored runs preserve verified results and canonical evidence bytes', async () => {
  for (const name of ['hmh-valid', 'hmh-realistic', 'hmh-level-90', 'hmh-v7-liquidator']) {
    const fixture = readFixture(name);
    const run = await verifyRankedRun(fixture.body, fixtureVerifyOptions());
    assert.equal(run.ok, true, name);
    assert.equal(run.score, fixture.expected.score, name);
    if (fixture.expected.contract) assert.deepEqual(run.contract, fixture.expected.contract, name);
    assert.deepEqual(run.plausibility, fixture.expected.plausibility, name);
    assert.equal(run.evidence.digest, fixture.expected.evidenceDigest, name);
    const stored = { gameId: run.gameId, identity: structuredClone(run.identity), evidence: { encoding: run.evidence.encoding, text: run.evidence.text } };
    assert.deepEqual(await reverifyStoredRun(stored, { nowMs: FIXTURE_VERIFY_AT_MS }), run, name);
  }
});

test('future-content fixture rejection remains exact and does not become map-v2 approval', async () => {
  for (const name of ['hmh-v7-future-districts', 'hmh-v7-future-four-bosses']) {
    const fixture = readFixture(name);
    assert.deepEqual(await verifyRankedRun(fixture.body, fixtureVerifyOptions()), { ok: false, status: 422, error: 'implausible-run', flags: fixture.expected.plausibility.flags }, name);
  }
});

test('payload schema errors still precede identity, envelope, score and map dispatch', async () => {
  const evidence = changed((summary, evidence) => { summary.unexpectedMap = 'map-v2'; summary.identity.seed += 1; summary.totals.score = 20_000_000_000; evidence.sessionEnvelope.envelopeHash = 'bad'; });
  const detail = validateRunSummaryPayload(evidence.runSummary);
  assert.notEqual(detail, '');
  assert.deepEqual(await call(evidence), { ok: false, status: 400, error: 'run-summary-invalid', detail: detail.slice(0, 240) });
});

test('schema-7 game-version gate still precedes mismatched canonical identity', async () => {
  const evidence = structuredClone(v7.body.evidence);
  evidence.runSummary.identity.buildHash = build('1.8.9');
  evidence.sessionEnvelope.envelopeHash = 'bad';
  assert.equal(validateRunSummaryPayload(evidence.runSummary), '');
  assert.deepEqual(await call(evidence), { ok: false, status: 400, error: 'run-summary-invalid', detail: 'run summary schema 7 requires game 1.9.0 or later' });
});

test('identity mismatch still precedes terminal, envelope, score and plausibility errors', async () => {
  const evidence = changed((summary, evidence) => { summary.identity.seed += 1; summary.identity.terminalReason = 'abandoned'; summary.defeat = { kind: 'none', causeId: 'none', tick: 0, damage: 0 }; summary.totals.score = 20_000_000_000; evidence.sessionEnvelope.envelopeHash = 'bad'; });
  assert.equal(validateRunSummaryPayload(evidence.runSummary), '');
  assert.deepEqual(await call(evidence), { ok: false, status: 400, error: 'run-summary-identity-mismatch' });
});

test('terminal errors still precede envelope, score and plausibility errors', async () => {
  const evidence = changed((summary, evidence) => { summary.identity.terminalReason = 'abandoned'; summary.defeat = { kind: 'none', causeId: 'none', tick: 0, damage: 0 }; summary.totals.score = 20_000_000_000; evidence.sessionEnvelope.envelopeHash = 'bad'; });
  assert.equal(validateRunSummaryPayload(evidence.runSummary), '');
  assert.deepEqual(await call(evidence), { ok: false, status: 400, error: 'run-summary-not-terminal' });
});

test('envelope errors still precede score and plausibility errors', async () => {
  const evidence = changed((summary, evidence) => { summary.totals.score = 20_000_000_000; evidence.sessionEnvelope.envelopeHash = 'bad'; });
  assert.equal(validateRunSummaryPayload(evidence.runSummary), '');
  assert.deepEqual(await call(evidence), { ok: false, status: 400, error: 'session-envelope-invalid' });
});

test('score bounds still precede plausibility and never emit achievement results', async () => {
  const evidence = changed(summary => { summary.totals.score = 20_000_000_000; });
  assert.equal(validateRunSummaryPayload(evidence.runSummary), '');
  const result = await call(evidence);
  assert.equal(result.error, 'score-out-of-bounds');
  assert.equal(result.status, 422);
  assert.equal(result.flags, undefined);
  assert.equal(result.stats, undefined);
});
