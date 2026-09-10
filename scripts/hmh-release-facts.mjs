// M-2: offline, read-only source projection; never a release/transaction authority.
import { readFileSync, writeFileSync, existsSync, mkdirSync, realpathSync, mkdtempSync, renameSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { parse } from 'acorn';
import { parseReadmeProductionMarker } from './production-doc-drift-check.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const requireFact = (condition, message) => { if (!condition) throw new Error(message); };
const ID = /^(?:REGISTER:(?:[A-Z]-\d+[a-z]?|owner-playtests)|WEB3:B-[1-5]|STACKED:S-(?:0[1-9]|1\d|2[0-2]))$/;
const LOCAL_STATUSES = new Set(['local_committed_candidate', 'local_integrated_not_release_certified', 'local_integrated_release_pending', 'source_and_partial_runtime', 'adopted_local_release_pending', 'private_enemy_candidate']);

const INPUTS = Object.freeze({
  hmh: 'apps/portal/games/hard-money-heroes/game.manifest.json',
  chikun: 'apps/portal/games/chikun/game.manifest.json',
  register: 'docs/hmh-reboot/OPEN-WORK-CURRENT-STATUS.json',
  queue: 'docs/qa/hmh-upgrade-execution-queue.json',
  release: 'docs/qa/hmh-owner-return-checkpoint.json',
  challenges: 'docs/qa/hmh-parent-challenges-checkpoint.json',
  profile: 'docs/qa/hmh-parent-profile-truth-checkpoint.json',
  requirements: 'docs/hmh-reboot/RANKED-DATA-AND-LAUNCH-EPOCH-REQUIREMENTS.md',
  settlement: 'apps/portal/src/settlement.mjs',
  readme: 'README.md',
  generator: 'scripts/hmh-release-facts.mjs',
});

export function validateEvidencePath(value) {
  requireFact(typeof value === 'string' && /^(?:apps|sdk|scripts|tests)\/.+\.(?:mjs|js|css|html)$/.test(value)
    && !value.includes('\\') && !value.split('/').some(part => ['', '.', '..'].includes(part)), 'Unsafe evidence path');
  return value;
}
function inside(root, target) {
  const relative = path.relative(root, target);
  requireFact(relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative), 'Path escapes repository root');
  return target;
}
export function parseSettlementLive(source) {
  const tree = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const nodes = tree.body.filter(n => n.type === 'ExportNamedDeclaration' && n.declaration?.type === 'VariableDeclaration')
    .flatMap(n => n.declaration.declarations).filter(n => n.id.type === 'Identifier' && n.id.name === 'SETTLEMENT_LIVE');
  requireFact(nodes.length === 1 && nodes[0].init?.type === 'Literal' && typeof nodes[0].init.value === 'boolean', 'Missing or non-literal exported settlement flag');
  return nodes[0].init.value;
}

export function loadReleaseFactInputs(root = ROOT) {
  const base = realpathSync(root); const sources = new Map();
  const read = relative => {
    const file = inside(base, realpathSync(path.join(base, relative)));
    const bytes = readFileSync(file);
    sources.set(relative, { path: relative, sha256: sha256(bytes), bytes: bytes.length });
    return bytes.toString('utf8');
  };
  const json = key => JSON.parse(read(INPUTS[key]));
  const hmh = json('hmh'); const chikun = json('chikun');
  requireFact(hmh.id === 'hard-money-heroes' && chikun.id === 'chikun', 'Cabinet manifest identity mismatch');
  const register = json('register'); const queue = json('queue'); const releaseLedger = json('release');
  const sourceCheckpoints = [
    { label: 'Parent Free challenges', taskIds: ['REGISTER:M-3'], data: json('challenges') },
    { label: 'Parent profile and achievement truth', taskIds: ['REGISTER:L-5', 'REGISTER:L-6'], data: json('profile') },
  ].map(({ label, taskIds, data }) => {
    const entries = Array.isArray(data.files) ? data.files.map(f => [f.path, f.afterSha256]) : Object.entries(data.files ?? {});
    const bindings = entries.map(([p, expected]) => {
      validateEvidencePath(p); requireFact(/^[a-f0-9]{64}$/.test(expected), 'Malformed evidence digest');
      const present = existsSync(path.join(base, p));
      const currentSha256 = present ? (read(p), sources.get(p).sha256) : null;
      return { path: p, expectedSha256: expected, currentSha256, matches: present && currentSha256 === expected };
    });
    return { label, taskIds, status: data.status, recordedAt: data.recordedAt ?? data.sourceFreezeAt ?? null, bindings };
  });
  const settlementLive = parseSettlementLive(read(INPUTS.settlement));
  const recordedProductionMarker = parseReadmeProductionMarker(read(INPUTS.readme));
  read(INPUTS.requirements); read(INPUTS.generator);
  return { cabinetManifests: [hmh, chikun], register, queue, releaseLedger, sourceCheckpoints, settlementLive,
    recordedProductionMarker, sourceInputs: [...sources.values()].sort((a, b) => a.path.localeCompare(b.path, 'en')) };
}

export function buildReleaseFacts(input) {
  const { register, queue, releaseLedger, settlementLive, sourceCheckpoints, sourceInputs, cabinetManifests } = input;
  requireFact(typeof settlementLive === 'boolean', 'Settlement flag must be explicit');
  requireFact(Array.isArray(sourceInputs) && sourceInputs.length > 0 && sourceInputs.every(s =>
    typeof s.path === 'string' && s.path.length > 0 && /^[a-f0-9]{64}$/.test(s.sha256)
    && Number.isSafeInteger(s.bytes) && s.bytes >= 0), 'Malformed source-input hash or byte count');
  requireFact(new Set(sourceInputs.map(s => s.path)).size === sourceInputs.length, 'Duplicate source-input path');
  requireFact(Array.isArray(register.items) && register.itemCount === register.items.length, 'Register count mismatch');
  const byId = new Map();
  for (const item of register.items) {
    requireFact(typeof item.id === 'string' && ID.test(item.id) && !byId.has(item.id), 'Malformed or duplicate original ID');
    byId.set(item.id, item);
  }
  requireFact(Array.isArray(queue.groups) && queue.counts.groups === queue.groups.length, 'Group count mismatch');
  requireFact(queue.counts.closedByThisSlice === 0, 'This incomplete-inventory projection cannot authorize closure');
  const seenGroups = new Set(); const seenIds = new Set();
  const features = queue.groups.map(group => {
    requireFact(/^hmh-\d{2}$/.test(group.id) && !seenGroups.has(group.id), 'Malformed or duplicate group ID');
    seenGroups.add(group.id);
    requireFact(group.acceptanceClosed === false, 'Closure requires separate exact-candidate acceptance');
    const label = /^(partial|open|owner-gated):\s+([\s\S]+)$/.exec(group.content);
    requireFact(label && Array.isArray(group.originalIds) && group.originalIds.length > 0, 'Unsupported group content');
    const items = group.originalIds.map(id => {
      requireFact(typeof id === 'string' && ID.test(id) && byId.has(id) && !seenIds.has(id) && !id.startsWith('STACKED:'), 'Unknown, duplicate or excluded group ID');
      seenIds.add(id); return byId.get(id);
    });
    const localCheckpoint = sourceCheckpoints.some(c => c.taskIds.some(id => group.originalIds.includes(id))
      && c.bindings.length > 0 && c.bindings.every(b => b.matches === true));
    let state = 'unfinished';
    if (label[1] === 'owner-gated') state = 'gated';
    else if (localCheckpoint || items.some(i => LOCAL_STATUSES.has(i.status))) state = 'local';
    else if (items.every(i => i.status === 'deployed_partial_certification' && typeof i.currentEvidence === 'string' && i.currentEvidence.length > 0)) state = 'public-recorded';
    return { id: group.id, title: label[2].replace(/\s*\(`[^\n]+`\)\s*$/, ''), originalIds: [...group.originalIds],
      inventoryStatus: label[1], state, acceptanceClosed: false, currentPublicVerified: false,
      registerStatuses: items.map(i => ({ id: i.id, status: i.status })),
      evidenceScope: state === 'public-recorded' ? `Historical register snapshot ${register.proofAt}; not a fresh hosted check`
        : state === 'local' ? 'Local source/recorded implementation; combined build, browser and release acceptance not certified here'
          : state === 'gated' ? 'Owner or operational acceptance remains separate' : 'Implementation or acceptance remains incomplete/unverified' };
  });
  requireFact(seenIds.size === queue.counts.originalIds, 'Feature ID count mismatch');
  requireFact(Array.isArray(releaseLedger.sourceGates?.steps) && releaseLedger.sourceGates.steps.every(s => typeof s.name === 'string' && Number.isInteger(s.exitCode)), 'Malformed recorded release gates');
  const steps = releaseLedger.sourceGates.steps;
  const cabinets = cabinetManifests.map(m => {
    requireFact(typeof m.id === 'string' && typeof m.name === 'string' && typeof m.status === 'string' && typeof m.rankedEligible === 'boolean' && Array.isArray(m.capabilities), 'Malformed cabinet declaration');
    return { manifestId: m.id, name: m.name, declaredVersion: m.version, declaredStatus: m.status,
      declaredRankedEligible: m.rankedEligible, declaredCapabilities: [...m.capabilities],
      publicVerification: 'not-performed', rankedChainVerification: 'not-performed' };
  });
  requireFact(new Set(cabinets.map(c => c.manifestId)).size === cabinets.length, 'Duplicate cabinet declaration');
  const checkpoints = sourceCheckpoints.map(c => ({ label: c.label, taskIds: [...c.taskIds], recordedStatus: c.status,
    recordedAt: c.recordedAt, boundFiles: c.bindings.length, currentFileMatches: c.bindings.filter(b => b.matches === true).length,
    mismatches: c.bindings.filter(b => b.matches !== true).map(b => b.path),
    scope: 'Whole-file snapshot comparison only. Later accepted layers can supersede a hash; mismatch is not itself a defect or permission to overwrite.' }));
  return { schema: 'hmh-release-facts/v1', scope: 'Offline source snapshot; not a release certificate or public-byte verification',
    sourceSnapshotSha256: sha256(JSON.stringify(sourceInputs)), sourceInputs, productionPromotionAuthorized: false,
    recordedProductionMarker: input.recordedProductionMarker ?? null, cabinets,
    counts: { features: features.length, originalIdsInFeatures: seenIds.size, originalRegisterIds: byId.size,
      states: Object.fromEntries(['public-recorded', 'local', 'unfinished', 'gated'].map(s => [s, features.filter(f => f.state === s).length])) },
    release: { recordedAt: releaseLedger.checkedAt, recordedHead: releaseLedger.head, recordedVerdict: releaseLedger.verdict,
      recordedGates: { total: steps.length, passed: steps.filter(s => s.exitCode === 0).length, failed: steps.filter(s => s.exitCode !== 0).length },
      recordedUnexpectedFailures: [...(releaseLedger.unexpectedFailures ?? [])], currentCandidateCertified: false,
      scope: 'Recorded historical combined run, not rerun or rebound by this generator' },
    settlement: { state: settlementLive ? 'gated' : 'simulated', liveFlag: settlementLive, chainAcceptance: 'not-performed',
      disclosure: 'This flag is not payment, gas, receipt, score, NFT or provider verification. Real-wallet/native entry, ABI, durable history, epoch and authority acceptance remain separate.' },
    checkpoints, features, originalRegisterIds: [...byId.keys()], pausedExcludedIds: [...byId.keys()].filter(id => id.startsWith('STACKED:')) };
}

const cell = value => String(value ?? 'Not recorded').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
export function renderReleaseFactsMarkdown(f) {
  const lines = ['# Hard Money Heroes / Lester’s Arcade fact sheet', '', '**Internal source snapshot. Not a release certificate, launch announcement or current public/chain verification.**', '',
    `Input snapshot SHA-256: \`${f.sourceSnapshotSha256}\``, '',
    '## What the labels mean', '',
    '- **public-recorded:** a historical deployed foundation is recorded. Current hosted bytes and the unfinished upgrade are NOT certified.',
    '- **local:** source or recorded local implementation exists; final acceptance remains open.',
    '- **unfinished:** implementation or required evidence remains incomplete/unverified.',
    '- **gated:** owner, operational or authority acceptance remains separate.',
    '- **simulated:** local settlement output is not an on-chain transaction or verified competitive result.', '',
    '## Cabinet declarations', '', '| Cabinet | Manifest ID / version | Declared status | Ranked eligible declaration | Actual public / chain verification |', '| --- | --- | --- | --- | --- |'];
  for (const c of f.cabinets) lines.push(`| ${cell(c.name)} | ${cell(c.manifestId)} / ${cell(c.declaredVersion)} | ${cell(c.declaredStatus)} | ${cell(c.declaredRankedEligible)} | Not performed |`);
  lines.push('', 'Manifest eligibility is not proof of wallet connection, paid-entry charging, trusted verification, settlement or NFT minting. The legacy manifest description is not adopted as current art/canon direction.', '',
    '## Release and settlement boundary', '', `- README-recorded production marker: ${cell(f.recordedProductionMarker)}. Not fetched by this offline generator.`,
    `- Last recorded combined run: **${cell(f.release.recordedVerdict)}**, ${cell(f.release.recordedAt)}; ${f.release.recordedGates.passed}/${f.release.recordedGates.total} gates passed. This is historical, not a check of the current candidate.`,
    `- Recorded source HEAD: \`${cell(f.release.recordedHead)}\`.`, `- Current candidate certified by this report: **No**. Promotion authorized: **No**.`,
    `- Settlement: **${cell(f.settlement.state)}**; SETTLEMENT_LIVE=${f.settlement.liveFlag}. ${cell(f.settlement.disclosure)}`,
    '- Testnet native entry price, gas and any additional fee must be disclosed separately. No fee amount, split, NFT authority or Mainnet activation is selected here.',
    '- Requirements: [Ranked, wallet, NFT and launch epoch](../hmh-reboot/RANKED-DATA-AND-LAUNCH-EPOCH-REQUIREMENTS.md).',
    '- The recorded first-time desktop/mobile playtests, physical-device coverage and exact-candidate owner acceptance are not replaced by source checks.', '', 'Recorded unexpected release failures:');
  for (const item of f.release.recordedUnexpectedFailures) lines.push(`- ${cell(item)}`);
  if (!f.release.recordedUnexpectedFailures.length) lines.push('- None listed in the historical receipt; not evidence of a fresh clean run.');
  lines.push('', '## Later source checkpoints', '', '| Checkpoint | Recorded status | Whole-file hashes matching now | Limits |', '| --- | --- | --- | --- |');
  for (const c of f.checkpoints) lines.push(`| ${cell(c.label)} | ${cell(c.recordedStatus)} | ${c.currentFileMatches}/${c.boundFiles} | ${cell(c.scope)} ${c.mismatches.length ? `Differing/missing: ${cell(c.mismatches.join(', '))}` : ''} |`);
  lines.push('', '## Unfinished-upgrade feature matrix', '', `${f.counts.features} work groups cover ${f.counts.originalIdsInFeatures} unique original IDs. No acceptance is closed by this projection.`, '', '| Group | Feature / remaining acceptance | Evidence state | Inventory state | Original IDs |', '| --- | --- | --- | --- | --- |');
  for (const row of f.features) lines.push(`| ${cell(row.id)} | ${cell(row.title)} | ${cell(row.state)} | ${cell(row.inventoryStatus)} | ${cell(row.originalIds.join(', '))} |`);
  lines.push('', '## Original ID coverage and paused scope', '', `${f.originalRegisterIds.length} original namespaced IDs are retained below; ${f.pausedExcludedIds.length} STACKED IDs remain excluded from active HMH work. Settled source/format decisions are not reopened.`, '', f.originalRegisterIds.map(cell).join(', '), '',
    '## Source inputs', '', 'These hashes bind local input bytes, not execution, deployment or human approval. Regenerate after integration; `--check` fails when inputs/output drift.', '',
    '| Repository-relative input | SHA-256 | Bytes |', '| --- | --- | --- |');
  for (const s of f.sourceInputs) lines.push(`| ${cell(s.path)} | ${cell(s.sha256)} | ${s.bytes} |`);
  lines.push('', 'Regenerate: `node scripts/hmh-release-facts.mjs --write`', '', 'Verify freshness without writing: `node scripts/hmh-release-facts.mjs --check`', '');
  return lines.join('\n');
}

export function syncReleaseFacts({ root = ROOT, output = path.join(root, 'docs/releases'), mode = '--check' } = {}) {
  requireFact(['--check', '--write'].includes(mode), 'Use --check or --write');
  const base = realpathSync(root); const out = inside(base, path.resolve(output));
  let parent = out;
  while (!existsSync(parent)) parent = path.dirname(parent);
  inside(base, realpathSync(parent));
  const facts = buildReleaseFacts(loadReleaseFactInputs(base));
  const outputs = { 'hmh-fact-sheet.json': `${JSON.stringify(facts, null, 2)}\n`, 'hmh-fact-sheet.md': renderReleaseFactsMarkdown(facts) };
  if (mode === '--write') mkdirSync(out, { recursive: true });
  for (const [name, text] of Object.entries(outputs)) {
    const file = path.join(out, name);
    if (existsSync(file)) inside(base, realpathSync(file));
    if (mode === '--write') {
      // Replace the artifact directory entry, not a shared hard-link inode.
      const temporary = mkdtempSync(path.join(out, '.hmh-facts-'));
      try {
        const staged = path.join(temporary, name);
        writeFileSync(staged, text, { flag: 'wx' });
        renameSync(staged, file);
      } finally { rmSync(temporary, { recursive: true, force: true }); }
    }
    else requireFact(existsSync(file) && readFileSync(file, 'utf8') === text, `Stale or missing fact sheet: ${name}`);
  }
  return { mode, output: path.relative(base, out).replaceAll(path.sep, '/'), counts: facts.counts, sourceSnapshotSha256: facts.sourceSnapshotSha256, currentCandidateCertified: false };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    const args = process.argv.slice(2); const mode = args.shift(); let output;
    if (args.length) { requireFact(args.length === 2 && args[0] === '--output', 'Unexpected arguments'); output = args[1]; }
    requireFact(mode === '--check' || mode === '--write', 'Use --check or --write');
    console.log(JSON.stringify(syncReleaseFacts({ mode, ...(output ? { output } : {}) }), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
