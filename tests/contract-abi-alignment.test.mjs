// ABI alignment gate: every contract method the FRONTEND references must
// actually exist in the deployed Solidity source under contracts/src/.
//
// This test exists because buildSettlementPlan once emitted method names that
// did not exist on the deployed contracts (submitScore vs submitSession,
// unlockAchievement vs onlyLedger unlockFor, routeRevenueSplit vs
// startPaidSession, updateProfile vs setProfile). Those bugs were invisible to
// the unit suite because the plan is a plain data structure — nothing compared
// it against the real ABI. This gate closes that gap: it parses the .sol
// sources for their external/public function names and asserts the frontend
// only ever names methods that are really there.
//
// Handoff ref: docs/plans/2026-07-01-*-high-end-llm-handoff.md §6.1 Q2, §6.2 P0.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import { buildSettlementPlan } from '../apps/portal/src/settlement.mjs';
import { SCORE_REGISTRY_ABI, PROFILE_REGISTRY_ABI } from '../apps/portal/src/litvm-chain-client.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

function solSource(name) {
  return readFileSync(join(root, 'contracts', 'src', `${name}.sol`), 'utf8');
}

// Extract the set of function names declared in a Solidity source. Matches
// `function <name>(` for external/public/internal/private/view functions.
function solFunctionNames(source) {
  const names = new Set();
  const re = /function\s+([A-Za-z_]\w*)\s*\(/g;
  let m;
  while ((m = re.exec(source)) !== null) names.add(m[1]);
  return names;
}

// Map the settlement plan's `contract` id -> deployed Solidity source name.
const CONTRACT_SOURCE_BY_ID = {
  playerProfileRegistry: 'PlayerProfileRegistry',
  scoreSubmissionRegistry: 'ScoreSubmissionRegistry',
  achievementRegistry: 'AchievementRegistry',
  arcadePaymentRouter: 'ArcadePaymentRouter',
};

test('every settlement-plan call names a method that exists on its Solidity contract', () => {
  // Exercise all plan branches: profile change + achievements + paid entry fee.
  const plan = buildSettlementPlan({
    wallet: '0x' + '1'.repeat(40),
    gameId: 'hard-money-heroes',
    sessionId: 'sess-abi-gate',
    score: 4242,
    kills: 30,
    maxCombo: 9,
    survivalSeconds: 300,
    bossId: 'rug-pull-baron',
    unlockedAchievements: ['clear-level-1', 'beat-rug-pull-baron'],
    username: 'AbiGate',
    profileChanged: true,
    entryFeeMicroUnits: 250_000,
    paymentToken: 'zkLTC',
  });

  const fnCache = new Map();
  for (const call of plan.calls) {
    const sourceName = CONTRACT_SOURCE_BY_ID[call.contract];
    assert.ok(sourceName, `plan references unknown contract id: ${call.contract}`);
    if (!fnCache.has(sourceName)) fnCache.set(sourceName, solFunctionNames(solSource(sourceName)));
    const fns = fnCache.get(sourceName);
    assert.ok(
      fns.has(call.method),
      `settlement plan calls ${call.contract}.${call.method}(), but ${sourceName}.sol has no such function. Deployed functions: ${[...fns].sort().join(', ')}`,
    );
  }
});

test('the plan never names methods that were removed as non-existent', () => {
  const plan = buildSettlementPlan({
    wallet: '0x' + '1'.repeat(40),
    gameId: 'hard-money-heroes',
    sessionId: 'sess-abi-gate-2',
    score: 100,
    unlockedAchievements: ['a', 'b'],
    username: 'X',
    profileChanged: true,
    entryFeeMicroUnits: 100_000,
  });
  const methods = new Set(plan.calls.map((c) => c.method));
  for (const dead of ['submitScore', 'unlockAchievement', 'routeRevenueSplit', 'updateProfile']) {
    assert.ok(!methods.has(dead), `${dead} is not a deployed method and must not appear in the plan`);
  }
});

test('litvm-chain-client ABI method names exist in their Solidity sources', () => {
  // The live on-chain path builds ethers.Contract instances from these ABI
  // fragments. Each fragment's function name must exist in the .sol source.
  const scoreFns = solFunctionNames(solSource('ScoreSubmissionRegistry'));
  const profileFns = solFunctionNames(solSource('PlayerProfileRegistry'));

  const abiFnName = (frag) => frag.match(/function\s+([A-Za-z_]\w*)\s*\(/)?.[1];

  for (const frag of SCORE_REGISTRY_ABI) {
    const name = abiFnName(frag);
    assert.ok(name, `unparseable ABI fragment: ${frag}`);
    assert.ok(scoreFns.has(name), `SCORE_REGISTRY_ABI names ${name}, missing from ScoreSubmissionRegistry.sol`);
  }
  for (const frag of PROFILE_REGISTRY_ABI) {
    const name = abiFnName(frag);
    assert.ok(name, `unparseable ABI fragment: ${frag}`);
    assert.ok(profileFns.has(name), `PROFILE_REGISTRY_ABI names ${name}, missing from PlayerProfileRegistry.sol`);
  }
});

test('the live submitSession ABI arg count matches the Solidity signature', () => {
  // Guard against arg drift: submitSession takes exactly 8 params in the source.
  const src = solSource('ScoreSubmissionRegistry');
  const sig = src.match(/function\s+submitSession\s*\(([^)]*)\)/s);
  assert.ok(sig, 'submitSession signature not found in ScoreSubmissionRegistry.sol');
  const params = sig[1].split(',').map((s) => s.trim()).filter(Boolean);
  assert.equal(params.length, 8, `submitSession should take 8 params, source has ${params.length}`);

  const abiFrag = SCORE_REGISTRY_ABI.find((f) => f.includes('function submitSession'));
  assert.ok(abiFrag, 'submitSession missing from SCORE_REGISTRY_ABI');
  const abiParams = abiFrag.match(/\(([^)]*)\)/)[1].split(',').map((s) => s.trim()).filter(Boolean);
  assert.equal(abiParams.length, 8, `SCORE_REGISTRY_ABI submitSession should take 8 params, has ${abiParams.length}`);
});
