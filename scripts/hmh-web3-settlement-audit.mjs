import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { LITVM_LITEFORGE_NETWORK } from '../apps/portal/src/arcade-core.mjs';
import { LITVM_CONTRACT_ADDRESSES, SETTLEMENT_LIVE, buildSettlementPlan } from '../apps/portal/src/settlement.mjs';
import { PROFILE_REGISTRY_ABI, SCORE_REGISTRY_ABI } from '../apps/portal/src/litvm-chain-client.mjs';
import { LITVM_DEPLOYMENT } from '../apps/portal/src/generated/litvm-addresses.mjs';

function repoRootFromHere() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

function source(repoRoot, rel) {
  return readFileSync(path.join(repoRoot, rel), 'utf8');
}

// Per-game achievement collections nest under one key; flatten for the address checks.
const flattenAddresses = (map) => Object.values(map).flatMap((value) => (value && typeof value === 'object' ? Object.values(value) : [value]));
// The seven hardened contracts of contract §8.1: four shared contracts plus one collection per game.
const HARDENED_ADDRESS_COUNT = 7;

// safe-ranked-live-gate (contract §9.1): every configured address is well formed, and live settlement
// additionally needs a DEPLOYED address module with all seven §8.1 addresses present.
export function rankedLiveGatePasses({ settlementLive = SETTLEMENT_LIVE, deployment = LITVM_DEPLOYMENT, addresses = LITVM_CONTRACT_ADDRESSES, chainClient = '' } = {}) {
  const flat = flattenAddresses(addresses);
  const wellFormed = flat.every((address) => address === null || /^0x[a-fA-F0-9]{40}$/.test(address));
  if (!settlementLive) return wellFormed;
  const deployed = deployment?.status === 'deployed' && flattenAddresses(deployment.addresses ?? {}).length === HARDENED_ADDRESS_COUNT && flattenAddresses(deployment.addresses).every(Boolean);
  return wellFormed && deployed && flat.length === HARDENED_ADDRESS_COUNT && flat.every(Boolean) && chainClient.includes('trusted verifier attestation is required');
}

export function buildWeb3SettlementAudit({ repoRoot = repoRootFromHere() } = {}) {
  const chainClient = source(repoRoot, 'apps/portal/src/litvm-chain-client.mjs');
  const main = source(repoRoot, 'apps/portal/main.js');
  // The cadence boards are maintained where runs are recorded (arcade-core recordScore and
  // recordStackedScore); main.js no longer imports recordCadenceScore (browser-e2e import hygiene).
  const arcadeCore = source(repoRoot, 'apps/portal/src/arcade-core.mjs');
  const settlement = source(repoRoot, 'apps/portal/src/settlement.mjs');
  const plan = buildSettlementPlan({
    wallet: '0x0000000000000000000000000000000000000038',
    gameId: 'lester-blaster',
    sessionId: 'game-session-000000038',
    score: 98765,
    kills: 321,
    maxCombo: 42,
    survivalSeconds: 777,
    bossId: 'bandit-captain',
    unlockedAchievements: ['cabinet-pioneer', 'boss-clear'],
    username: 'AuditRunner',
    profileChanged: true,
    entryFeeMicroUnits: 0,
  });
  const checks = Object.freeze([
    Object.freeze({ id: 'safe-ranked-live-gate', pass: rankedLiveGatePasses({ chainClient }), detail: `address module ${LITVM_DEPLOYMENT.status}; hardened entry address ${LITVM_CONTRACT_ADDRESSES.arcadeRankedEntry}; settlement live=${SETTLEMENT_LIVE} (live needs a deployed module with all seven addresses); unverified writes remain gated` }),
    Object.freeze({ id: 'score-abi-verified-session', pass: SCORE_REGISTRY_ABI.some((sig) => sig.includes('submitVerifiedSession(')), detail: 'score client exposes verifier-attested submission ABI' }),
    Object.freeze({ id: 'profile-abi-set-profile', pass: PROFILE_REGISTRY_ABI.some((sig) => sig.includes('setProfile(string displayName, string avatarUri)')), detail: 'profile client calls deployed setProfile ABI' }),
    Object.freeze({ id: 'ranked-submit-chain-guard', pass: chainClient.includes('submitRankedSession') && chainClient.includes('Wrong network: wallet is on chain') && chainClient.includes('expected ${LITVM_LITEFORGE_NETWORK.chainId}'), detail: 'ranked score write blocks wrong chain before signer transaction' }),
    Object.freeze({ id: 'profile-submit-chain-guard', pass: /export async function submitProfile[\s\S]*getNetwork\(\)[\s\S]*Wrong network/.test(chainClient), detail: 'profile writes use the same LitVM chain guard as score submissions' }),
    Object.freeze({ id: 'ranked-readiness-preflight', pass: main.includes('checkRankedReadiness') && main.includes('rankedEntryApprove'), detail: 'ranked entry performs pre-flight network/funds readiness before run start' }),
    // A3 (ranked-client slice): the relayer publishes through /api/settle; the browser never signs a score submission.
    Object.freeze({ id: 'gameover-submit-only', pass: main.includes('createRankedSettlementClient') && main.includes('lesters:ranked-run') && main.includes('retryPublishGameOver') && main.includes('combat.gameOverSubmitted') && !main.includes('submitRankedSession(') && !main.includes('requestVerifierAttestation('), detail: 'finished Ranked runs settle through the relayed settlement client from the game-over path; no player-signed submit and no /api/attest call' }),
    Object.freeze({ id: 'ranked-identity-single-source', pass: main.includes('rankedIdentityFor('), detail: 'settlement builds its session identity with rankedIdentityFor (A10), the per-game season the entry key uses' }),
    Object.freeze({ id: 'leaderboard-readback', pass: arcadeCore.includes('recordCadenceScore(state, game.id, {') && arcadeCore.includes("recordCadenceScore(state, 'stacked', {"), detail: 'leaderboard path maintains cadence boards' }),
    Object.freeze({ id: 'settlement-plan-methods-match-abi', pass: plan.calls.some((call) => call.method === 'setProfile') && plan.calls.some((call) => call.method === 'submitVerifiedSession') && !plan.calls.some((call) => call.method === 'submitScore' || call.method === 'submitSession' || call.method === 'unlockAchievement'), detail: `plan methods: ${plan.calls.map((call) => call.method).join(', ')}` }),
  ]);
  return Object.freeze({
    version: 'wo-38-web3-settlement-audit-v1',
    network: Object.freeze({
      name: LITVM_LITEFORGE_NETWORK.name,
      chainId: LITVM_LITEFORGE_NETWORK.chainId,
      chainIdHex: LITVM_LITEFORGE_NETWORK.chainIdHex,
      explorerUrl: LITVM_LITEFORGE_NETWORK.explorerUrl,
    }),
    contractAddresses: LITVM_CONTRACT_ADDRESSES,
    plan: Object.freeze({ sessionId: plan.sessionId, methods: Object.freeze(plan.calls.map((call) => call.method)), callCount: plan.calls.length }),
    checks,
    summary: Object.freeze({
      status: checks.every((check) => check.pass) ? 'PASS' : 'FAIL',
      passCount: checks.filter((check) => check.pass).length,
      checkCount: checks.length,
    }),
  });
}

export function renderWeb3SettlementAuditMarkdown(audit = buildWeb3SettlementAudit()) {
  const rows = audit.checks.map((check) => `| ${check.id} | ${check.pass ? 'PASS' : 'FAIL'} | ${check.detail.replaceAll('|', '\\|')} |`).join('\n');
  // One row per address: the per-game achievement registries are a nested map.
  const addressRows = Object.entries(audit.contractAddresses).flatMap(([name, address]) => (address && typeof address === 'object'
    ? Object.entries(address).map(([key, value]) => `| ${name}.${key} | ${value} |`)
    : [`| ${name} | ${address} |`])).join('\n');
  return `# Hard Money Heroes Web3 Wallet → Settlement → Leaderboard Audit\n\nGenerated by \`scripts/hmh-web3-settlement-audit.mjs\`.\n\n## Summary\n\n- Version: ${audit.version}\n- Status: ${audit.summary.status}\n- Network: ${audit.network.name} (${audit.network.chainIdHex} / ${audit.network.chainId})\n- Settlement methods in fixture plan: ${audit.plan.methods.join(', ')}\n\n## Checks\n\n| Check | Status | Detail |\n| --- | --- | --- |\n${rows}\n\n## Contract addresses\n\n| Contract | Address |\n| --- | --- |\n${addressRows}\n`;
}

export function writeWeb3SettlementAudit({ repoRoot = repoRootFromHere() } = {}) {
  const audit = buildWeb3SettlementAudit({ repoRoot });
  const outDir = path.join(repoRoot, 'docs', 'qa');
  mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, 'hard-money-heroes-web3-settlement-audit.json');
  const mdPath = path.join(outDir, 'hard-money-heroes-web3-settlement-audit.md');
  writeFileSync(jsonPath, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
  writeFileSync(mdPath, renderWeb3SettlementAuditMarkdown(audit), 'utf8');
  return Object.freeze({ audit, jsonPath, mdPath });
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const { audit, jsonPath, mdPath } = writeWeb3SettlementAudit();
  console.log(`HMH Web3 settlement audit written: ${jsonPath}`);
  console.log(`HMH Web3 settlement markdown written: ${mdPath}`);
  console.log(`Status: ${audit.summary.status}; checks ${audit.summary.passCount}/${audit.summary.checkCount}`);
  if (audit.summary.status !== 'PASS') process.exitCode = 1;
}
