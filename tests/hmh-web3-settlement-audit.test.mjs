import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { buildWeb3SettlementAudit } from '../scripts/hmh-web3-settlement-audit.mjs';

function repoText(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('WO-38 Web3 settlement audit passes wallet to settlement to leaderboard checks', () => {
  const audit = buildWeb3SettlementAudit();
  assert.equal(audit.summary.status, 'PASS', JSON.stringify(audit.checks, null, 2));
  assert.equal(audit.network.chainId, 4441);
  assert.ok(audit.plan.methods.includes('setProfile'));
  assert.ok(audit.plan.methods.includes('submitVerifiedSession'));
});

test('the audit markdown lists every address, the nested achievement registries included', async () => {
  const { renderWeb3SettlementAuditMarkdown } = await import('../scripts/hmh-web3-settlement-audit.mjs');
  const audit = buildWeb3SettlementAudit();
  const markdown = renderWeb3SettlementAuditMarkdown(audit);
  assert.doesNotMatch(markdown, /\[object Object\]/);
  for (const gameId of Object.keys(audit.contractAddresses.achievementRegistries)) {
    assert.match(markdown, new RegExp(`\\| achievementRegistries\\.${gameId} \\| 0x[0-9a-fA-F]{40} \\|`), gameId);
  }
});

test('WO-38 profile and ranked writes both enforce the LitVM chain guard', () => {
  const chainClient = repoText('apps/portal/src/litvm-chain-client.mjs');
  assert.match(chainClient, /export async function submitRankedSession[\s\S]*getNetwork\(\)[\s\S]*Wrong network/);
  assert.match(chainClient, /export async function submitProfile[\s\S]*getNetwork\(\)[\s\S]*Wrong network/);
});

test('WO-38 runtime settles ranked sessions only through the relayed client from the game-over path', () => {
  const main = repoText('apps/portal/main.js');
  assert.equal(main.includes('checkRankedReadiness'), true);
  assert.equal(main.includes('createRankedSettlementClient'), true);
  assert.equal(main.includes('rankedIdentityFor('), true);
  assert.equal(main.includes('lesters:ranked-run'), true);
  assert.equal(main.includes('retryPublishGameOver'), true);
  assert.equal(main.includes('combat.gameOverSubmitted'), true);
  // A3: no player-signed score submission and no /api/attest call remain.
  assert.equal(main.includes('submitRankedSession('), false);
  assert.equal(main.includes('requestVerifierAttestation('), false);
});

test('WO-38 syntax and verification gates include Web3 settlement audit', () => {
  const packageJson = repoText('package.json');
  const syntaxCheck = repoText('scripts/syntax-check.mjs');
  assert.equal(packageJson.includes('design:web3-audit'), true);
  assert.equal(syntaxCheck.includes('scripts/hmh-web3-settlement-audit.mjs'), true);
  assert.equal(syntaxCheck.includes('tests/hmh-web3-settlement-audit.test.mjs'), true);
});
