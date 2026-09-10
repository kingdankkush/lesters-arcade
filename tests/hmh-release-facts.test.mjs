import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, mkdtempSync, writeFileSync, rmSync, linkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = fileURLToPath(new URL('..', import.meta.url));
const target = new URL('../scripts/hmh-release-facts.mjs', import.meta.url);
const module = existsSync(target) ? await import(target) : {};
function api(name) { assert.equal(typeof module[name], 'function', `${name} must exist`); return module[name]; }
function fixture() {
  return {
    cabinetManifests: [{ id: 'hard-money-heroes', name: 'Hard Money Heroes', status: 'playable', version: '1.0.0', rankedEligible: true, capabilities: ['ranked', 'achievements'] }],
    register: { itemCount: 4, proofAt: '2026-09-08T00:00:00Z', items: [
      { id: 'REGISTER:B-3', status: 'deployed_partial_certification', currentEvidence: 'Historical byte receipt, not current proof' },
      { id: 'REGISTER:M-3', status: 'open_needs_scoped_verification' },
      { id: 'REGISTER:owner-playtests', status: 'human_gate' },
      { id: 'STACKED:S-01', status: 'accepted_not_publicly_playable' },
    ] },
    queue: { counts: { groups: 3, originalIds: 3, closedByThisSlice: 0 }, groups: [
      { id: 'hmh-01', content: 'partial: Ad containment (`REGISTER:B-3`)', originalIds: ['REGISTER:B-3'], acceptanceClosed: false },
      { id: 'hmh-02', content: 'open: Challenge seeds (`REGISTER:M-3`)', originalIds: ['REGISTER:M-3'], acceptanceClosed: false },
      { id: 'hmh-03', content: 'owner-gated: Recorded players (`REGISTER:owner-playtests`)', originalIds: ['REGISTER:owner-playtests'], acceptanceClosed: false },
    ] },
    releaseLedger: { checkedAt: '2026-09-09T00:00:00Z', verdict: 'BLOCKED', head: 'a'.repeat(40), sourceGates: { finished: true, passed: false, steps: [{ name: 'check', exitCode: 0 }, { name: 'release', exitCode: 1 }] }, unexpectedFailures: ['Known clearance failure'], published: false },
    settlementLive: false,
    sourceCheckpoints: [{ label: 'Challenges', status: 'source-reviewed; build/browser pending', taskIds: ['REGISTER:M-3'], bindings: [{ path: 'apps/portal/src/hmh-challenges.mjs', matches: true }], recordedAt: '2026-09-10T00:00:00Z' }],
    sourceInputs: [{ path: 'docs/example.json', sha256: 'a'.repeat(64), bytes: 10 }],
  };
}

test('manifest playable/rankedEligible is a declaration, never proof of public or chain acceptance', () => {
  const f = api('buildReleaseFacts')(fixture());
  assert.equal(f.cabinets[0].manifestId, 'hard-money-heroes');
  assert.equal(f.cabinets[0].publicVerification, 'not-performed');
  assert.equal(f.cabinets[0].rankedChainVerification, 'not-performed');
  assert.equal(f.cabinets[0].declaredRankedEligible, true);
  assert.equal(f.productionPromotionAuthorized, false);
});

test('matrix separates recorded public foundations, local source, unfinished acceptance and owner gates', () => {
  const f = api('buildReleaseFacts')(fixture());
  assert.deepEqual(f.features.map(r => r.state), ['public-recorded', 'local', 'gated']);
  assert.ok(f.features.every(r => r.currentPublicVerified === false && r.acceptanceClosed === false));
  assert.equal(f.release.currentCandidateCertified, false);
  assert.equal(f.release.recordedVerdict, 'BLOCKED');
  assert.equal(f.release.recordedGates.failed, 1);
  assert.deepEqual(f.release.recordedUnexpectedFailures, ['Known clearance failure']);
});

test('stale source checkpoints retain the record but do not promote unfinished work', () => {
  const input = fixture(); input.sourceCheckpoints[0].bindings[0].matches = false;
  const f = api('buildReleaseFacts')(input);
  assert.equal(f.features[1].state, 'unfinished');
  assert.equal(f.checkpoints[0].currentFileMatches, 0);
  assert.equal(f.checkpoints[0].recordedStatus, input.sourceCheckpoints[0].status);
});

test('empty source bindings do not count as authenticated source', () => {
  const input = fixture(); input.sourceCheckpoints[0].bindings = [];
  assert.equal(api('buildReleaseFacts')(input).features[1].state, 'unfinished');
});

test('unknown register status fails closed without a completion or local-implementation inference', () => {
  const input = fixture(); input.register.items[1].status = 'new-unreviewed-state'; input.sourceCheckpoints = [];
  assert.equal(api('buildReleaseFacts')(input).features[1].state, 'unfinished');
});

test('simulated settlement is not a receipt, NFT mint or paid-entry charge', () => {
  const f = api('buildReleaseFacts')(fixture());
  assert.equal(f.settlement.state, 'simulated');
  assert.equal(f.settlement.liveFlag, false);
  assert.equal(f.settlement.chainAcceptance, 'not-performed');
  assert.match(f.settlement.disclosure, /not.*payment|no.*payment/i);
});

test('a true live flag is gated, not proof of verified settlement', () => {
  const input = fixture(); input.settlementLive = true;
  const f = api('buildReleaseFacts')(input);
  assert.equal(f.settlement.state, 'gated');
  assert.equal(f.settlement.chainAcceptance, 'not-performed');
  assert.equal(f.productionPromotionAuthorized, false);
});

for (const [name, mutate] of [
  ['declared group count drift', d => d.queue.counts.groups++],
  ['declared ID count drift', d => d.queue.counts.originalIds++],
  ['declared register count drift', d => d.register.itemCount++],
  ['duplicate register ID', d => d.register.items.push({ ...d.register.items[0] })],
  ['duplicate group ID', d => d.queue.groups[1].id = d.queue.groups[0].id],
  ['reused ID across groups', d => d.queue.groups[1].originalIds = ['REGISTER:B-3']],
  ['unknown ID', d => d.queue.groups[1].originalIds = ['REGISTER:not-real']],
  ['malformed original identifier', d => d.register.items[0].id = ' REGISTER:B-3'],
  ['paused STACKED scope leakage', d => d.queue.groups[1].originalIds = ['STACKED:S-01']],
  ['unproved closure', d => d.queue.groups[1].acceptanceClosed = true],
  ['closure total contradiction', d => d.queue.counts.closedByThisSlice = 1],
  ['unsupported content status', d => d.queue.groups[1].content = 'complete: Challenge'],
  ['missing settlement flag', d => delete d.settlementLive],
  ['untyped manifest ranked eligibility', d => d.cabinetManifests[0].rankedEligible = 'true'],
]) {
  test(`rejects ${name} without repairing identifiers or totals`, () => {
    const build = api('buildReleaseFacts'); const d = fixture(); mutate(d); assert.throws(() => build(d));
  });
}

test('preserves every register identifier including paused leading-zero IDs without activating STACKED', () => {
  const f = api('buildReleaseFacts')(fixture());
  assert.deepEqual(f.originalRegisterIds, ['REGISTER:B-3', 'REGISTER:M-3', 'REGISTER:owner-playtests', 'STACKED:S-01']);
  assert.deepEqual(f.pausedExcludedIds, ['STACKED:S-01']);
  assert.equal(f.counts.features, 3); assert.equal(f.counts.originalIdsInFeatures, 3);
});

test('current partial inventory does not resurrect an obsolete owner-input gate', () => {
  const d = fixture(); d.queue.groups[1].content = 'partial: Delivered-source reconciliation (`REGISTER:M-3`)';
  d.register.items[1].status = 'owner_or_input_gate_verify_before_action';
  assert.equal(api('buildReleaseFacts')(d).features[1].state, 'local');
});

for (const [name, mutate] of [
  ['trailing newline in original ID', d => d.register.items[0].id += '\n'],
  ['trailing newline in group ID', d => d.queue.groups[0].id += '\n'],
  ['malformed input digest', d => d.sourceInputs[0].sha256 = 'not-a-hash'],
  ['negative input byte count', d => d.sourceInputs[0].bytes = -1],
]) test(`fails closed on ${name}`, () => { const build = api('buildReleaseFacts'); const d = fixture(); mutate(d); assert.throws(() => build(d)); });

test('trailing newline in an evidence path is rejected, not normalized', () => {
  assert.throws(() => api('validateEvidencePath')('apps/portal/src/arcade-core.mjs\n'));
});

test('even an all-green historical ledger cannot certify or publish the current candidate', () => {
  const d = fixture(); d.releaseLedger.verdict = 'PASS'; d.releaseLedger.sourceGates.steps.forEach(s => s.exitCode = 0);
  d.releaseLedger.published = true;
  const f = api('buildReleaseFacts')(d);
  assert.equal(f.release.currentCandidateCertified, false); assert.equal(f.productionPromotionAuthorized, false);
});

test('source projection is deterministic and does not mutate inputs', () => {
  const d = fixture(); const before = structuredClone(d); const build = api('buildReleaseFacts');
  assert.deepEqual(build(d), build(d)); assert.deepEqual(d, before);
});

test('markdown escapes table and HTML text rather than rendering data as executable markup', () => {
  const d = fixture(); d.queue.groups[1].content = 'open: <script>alert(1)</script> | test (`REGISTER:M-3`)';
  const md = api('renderReleaseFactsMarkdown')(api('buildReleaseFacts')(d));
  assert.ok(!md.includes('<script>')); assert.ok(md.includes('&lt;script&gt;'));
  assert.match(md, /\\\| test/); assert.match(md, /not a release certificate/i);
});

test('settlement parser reads the actual exported literal and ignores comments/string decoys', () => {
  const parse = api('parseSettlementLive');
  assert.equal(parse('// export const SETTLEMENT_LIVE = true;\nconst decoy="SETTLEMENT_LIVE=true";\nexport const SETTLEMENT_LIVE = false;'), false);
  assert.equal(parse('export const SETTLEMENT_LIVE = true;'), true);
  assert.throws(() => parse('const SETTLEMENT_LIVE = false;'));
  assert.throws(() => parse('export const SETTLEMENT_LIVE = Boolean(0);'));
  assert.throws(() => parse('/* export const SETTLEMENT_LIVE=false */'));
});

test('unsafe evidence paths are rejected before reading credentials or outside-root files', () => {
  const validate = api('validateEvidencePath');
  for (const p of ['../outside.js', 'C:/private.js', '/private.js', 'apps/../secrets.js', '.env', '.git/config', 'apps\\secret.js', 'apps//x.js']) assert.throws(() => validate(p));
  assert.equal(validate('apps/portal/src/arcade-core.mjs'), 'apps/portal/src/arcade-core.mjs');
});

test('real repository adapters cover all 55 groups, 67 feature IDs and all 99 original namespaced IDs', async () => {
  const input = await api('loadReleaseFactInputs')(root);
  const f = api('buildReleaseFacts')(input);
  assert.equal(f.counts.features, 55); assert.equal(f.counts.originalIdsInFeatures, 67); assert.equal(f.originalRegisterIds.length, 99);
  assert.equal(f.pausedExcludedIds.length, 22);
  assert.equal(f.cabinets.length, 2);
  assert.equal(f.settlement.liveFlag, false);
  assert.ok(f.sourceInputs.every(s => /^[a-f0-9]{64}$/.test(s.sha256) && Number.isSafeInteger(s.bytes)));
  assert.ok(!JSON.stringify(f).includes('C:\\Users\\'));
  assert.ok(!JSON.stringify(f).includes('kingdankkush420@'));
});

test('CLI write and check exercise the actual generated pair and reject tampering', () => {
  api('buildReleaseFacts');
  const out = mkdtempSync(path.join(root, '.tmp', 'facts-test-'));
  const run = mode => spawnSync(process.execPath, [fileURLToPath(target), mode, '--output', out], { cwd: root, encoding: 'utf8' });
  try {
    const written = run('--write'); assert.equal(written.status, 0, written.stderr);
    const jsonFile = path.join(out, 'hmh-fact-sheet.json'); const mdFile = path.join(out, 'hmh-fact-sheet.md');
    const original = readFileSync(jsonFile, 'utf8'); assert.equal(JSON.parse(original).counts.features, 55);
    assert.equal(run('--check').status, 0);
    writeFileSync(mdFile, 'tampered'); assert.equal(run('--check').status, 1);
    assert.equal(readFileSync(jsonFile, 'utf8'), original);
    assert.equal(readFileSync(mdFile, 'utf8'), 'tampered');
    assert.equal(run('--unknown').status, 1);
  } finally { rmSync(out, { recursive: true, force: true }); }
});

test('writing generated artifacts does not overwrite another hard-linked file', () => {
  const out = mkdtempSync(path.join(root, '.tmp', 'facts-link-test-'));
  const other = mkdtempSync(path.join(tmpdir(), 'hmh-facts-unrelated-'));
  const sentinel = path.join(other, 'unrelated.txt');
  try {
    writeFileSync(sentinel, 'preserve unrelated bytes');
    linkSync(sentinel, path.join(out, 'hmh-fact-sheet.json'));
    const result = spawnSync(process.execPath, [fileURLToPath(target), '--write', '--output', out], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(sentinel, 'utf8'), 'preserve unrelated bytes');
    assert.equal(JSON.parse(readFileSync(path.join(out, 'hmh-fact-sheet.json'), 'utf8')).counts.features, 55);
  } finally { rmSync(out, { recursive: true, force: true }); rmSync(other, { recursive: true, force: true }); }
});

test('new source and tests are covered by the separate syntax registry', () => {
  const s = readFileSync(new URL('../scripts/syntax-check.mjs', import.meta.url), 'utf8');
  assert.ok(s.includes('"scripts/hmh-release-facts.mjs"'));
  assert.ok(s.includes('"tests/hmh-release-facts.test.mjs"'));
});
