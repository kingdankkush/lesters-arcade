import { buildReplayVerificationEnvelope } from './hmh-run-integrity.mjs';

export const WEB3_LIVE_REQUIRED_GATES = Object.freeze([
  Object.freeze({ id: 'deterministic-replay-verifier', label: 'Deterministic replay verifier path' }),
  Object.freeze({ id: 'chain-read-leaderboards', label: 'Chain-read leaderboards and player sessions' }),
  Object.freeze({ id: 'official-profile-durability', label: 'Official profile durability' }),
  Object.freeze({ id: 'on-chain-registry-economy', label: 'On-chain registry/economy gates' }),
]);

function bool(v) { return Boolean(v); }

export function verifyReplayEnvelopeForSubmission(envelope = {}, expected = {}) {
  const reasons = [];
  if (!envelope || typeof envelope !== 'object') reasons.push('envelope missing');
  const recomputed = buildReplayVerificationEnvelope({
    seed: envelope.seed,
    gameVersion: envelope.gameVersion,
    survivalSeconds: envelope.survivalSeconds,
    level: envelope.level,
    totalXp: envelope.totalXp,
    postCapScoreBonus: envelope.postCapScoreBonus,
    rngDraws: envelope.rngDraws,
    inputChecksum: envelope.inputChecksum,
    eventChecksum: envelope.eventChecksum,
  });
  if (envelope.version !== recomputed.version) reasons.push(`version mismatch: ${envelope.version} !== ${recomputed.version}`);
  if (envelope.replayHash !== recomputed.replayHash) reasons.push('replayHash mismatch: envelope fields do not reproduce hash');
  if (expected.gameVersion && envelope.gameVersion !== expected.gameVersion) reasons.push(`gameVersion mismatch: ${envelope.gameVersion} !== ${expected.gameVersion}`);
  if (expected.level != null && Number(envelope.level) !== Number(expected.level)) reasons.push(`level mismatch: ${envelope.level} !== ${expected.level}`);
  if (expected.survivalSeconds != null && Math.abs(Number(envelope.survivalSeconds) - Number(expected.survivalSeconds)) > 0.001) {
    reasons.push(`survivalSeconds mismatch: ${envelope.survivalSeconds} !== ${expected.survivalSeconds}`);
  }
  return Object.freeze({ ok: reasons.length === 0, reasons: Object.freeze(reasons), replayHash: envelope.replayHash ?? null, recomputedHash: recomputed.replayHash });
}

function gate(id, status, evidence = [], blockers = []) {
  return Object.freeze({ id, status, evidence: Object.freeze(evidence), blockers: Object.freeze(blockers) });
}

export function buildWeb3LiveReadinessReport({
  replayVerifier = {},
  chainReads = {},
  profileDurability = {},
  registryEconomy = {},
} = {}) {
  const gates = [];
  gates.push(gate(
    'deterministic-replay-verifier',
    replayVerifier.ok ? 'PASS' : 'BLOCKED',
    replayVerifier.evidence ?? [],
    replayVerifier.ok ? [] : ['Replay envelope must be verified before ranked submit.'],
  ));

  const chainReadsOk = bool(chainReads.leaderboard) && bool(chainReads.playerSessions) && bool(chainReads.profile);
  gates.push(gate(
    'chain-read-leaderboards',
    chainReadsOk ? 'PASS' : 'PARTIAL',
    [`fallback=${chainReads.fallback ?? 'local-cache'}`],
    chainReadsOk ? [] : ['Global leaderboard, player sessions, and profile reads must all have gas-free read paths.'],
  ));

  const profileOk = bool(profileDurability.localPersistence) && bool(profileDurability.chainProfileRead) && bool(profileDurability.chainProfileWrite);
  gates.push(gate(
    'official-profile-durability',
    profileOk ? 'PASS' : 'PARTIAL',
    ['local profile persistence + optional player-signed profile write/read'],
    profileOk ? [] : ['Profile needs local persistence, chain write, and chain read durability before official launch.'],
  ));

  const registryOk = bool(registryEconomy.gameRegistry) && bool(registryEconomy.splitConfig) && bool(registryEconomy.legalApproved);
  const registryBlockers = [];
  if (!registryEconomy.gameRegistry) registryBlockers.push('GameRegistry cabinet approval path is not live-gated.');
  if (!registryEconomy.splitConfig) registryBlockers.push('SplitConfig/economy settings are not production-approved.');
  if (!registryEconomy.legalApproved) registryBlockers.push('Legal/brand/economy approval is required before real-value launch.');
  gates.push(gate('on-chain-registry-economy', registryOk ? 'PASS' : 'BLOCKED', [], registryBlockers));

  const passCount = gates.filter((item) => item.status === 'PASS').length;
  const blockedCount = gates.filter((item) => item.status === 'BLOCKED').length;
  return Object.freeze({
    version: 'hmh-web3-live-readiness-v1',
    gates: Object.freeze(gates),
    summary: Object.freeze({
      status: blockedCount === 0 && passCount === gates.length ? 'PASS' : passCount > 0 ? 'PARTIAL' : 'BLOCKED',
      passCount,
      blockedCount,
      gateCount: gates.length,
    }),
  });
}

export function renderWeb3LiveReadinessMarkdown(report = buildWeb3LiveReadinessReport()) {
  const rows = report.gates.map((gateItem) => `| ${gateItem.id} | ${gateItem.status} | ${gateItem.evidence.join('; ') || '—'} | ${gateItem.blockers.join('; ') || '—'} |`).join('\n');
  return `# HMH Web3 Live Readiness\n\n- Version: ${report.version}\n- Status: ${report.summary.status}\n- Gates passed: ${report.summary.passCount}/${report.summary.gateCount}\n\n| Gate | Status | Evidence | Blockers |\n| --- | --- | --- | --- |\n${rows}\n`;
}
