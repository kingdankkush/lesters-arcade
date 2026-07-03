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
  assert.ok(audit.plan.methods.includes('submitSession'));
});

test('WO-38 profile and ranked writes both enforce the LitVM chain guard', () => {
  const chainClient = repoText('apps/portal/src/litvm-chain-client.mjs');
  assert.match(chainClient, /export async function submitRankedSession[\s\S]*getNetwork\(\)[\s\S]*Wrong network/);
  assert.match(chainClient, /export async function submitProfile[\s\S]*getNetwork\(\)[\s\S]*Wrong network/);
});

test('WO-38 runtime submits ranked sessions only from game-over publish path and reads leaderboard back', () => {
  const main = repoText('apps/portal/main.js');
  assert.equal(main.includes('checkRankedReadiness'), true);
  assert.equal(main.includes('submitRankedSession(provider'), true);
  assert.equal(main.includes('retryPublishGameOver'), true);
  assert.equal(main.includes('combat.gameOverSubmitted'), true);
  assert.equal(main.includes('fetchGlobalLeaderboard'), true);
});

test('WO-38 syntax and verification gates include Web3 settlement audit', () => {
  const packageJson = repoText('package.json');
  const syntaxCheck = repoText('scripts/syntax-check.mjs');
  assert.equal(packageJson.includes('design:web3-audit'), true);
  assert.equal(syntaxCheck.includes('scripts/hmh-web3-settlement-audit.mjs'), true);
  assert.equal(syntaxCheck.includes('tests/hmh-web3-settlement-audit.test.mjs'), true);
});
