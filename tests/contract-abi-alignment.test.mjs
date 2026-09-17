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
// 2026-09-16: contract set replaced by the native-fee design (ArcadeRankedEntry.openSession,
// ScoreSubmissionRegistry.submitVerifiedSession(run, achievements, signature), soulbound
// AchievementRegistry.mintFor). The unverified submitSession and the ERC-20
// ArcadePaymentRouter.startPaidSession no longer exist and are pinned as dead below.
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
  // Solidity generates externally callable getters for public state variables.
  const getters = /\b(?:address(?:\s+payable)?|u?int\d*|bool|string|bytes\d*)\s+public\s+(?:(?:immutable|constant)\s+)?([A-Za-z_]\w*)\s*(?:=|;)/g;
  while ((m = getters.exec(source)) !== null) names.add(m[1]);
  // Public mappings also generate getters: `mapping(...) public name;`
  const mappingGetters = /mapping\([^;]*\)\s+public\s+([A-Za-z_]\w*)\s*;/g;
  while ((m = mappingGetters.exec(source)) !== null) names.add(m[1]);
  return names;
}

// Split the first `name(...)` argument list in `text` at top-level commas only (nested tuples
// stay intact). Linear walk; no regex backtracking.
function topLevelParams(text) {
  const start = text.indexOf('(');
  assert.ok(start >= 0, `no parameter list in: ${text}`);
  const params = [];
  let depth = 0;
  let current = '';
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '(') {
      depth += 1;
      if (depth === 1) continue;
    } else if (ch === ')') {
      depth -= 1;
      if (depth === 0) {
        if (current.trim()) params.push(current.trim());
        return params;
      }
    } else if (ch === ',' && depth === 1) {
      params.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  throw new Error(`unbalanced parameter list in: ${text}`);
}

// Map the settlement plan's `contract` id -> deployed Solidity source name.
const CONTRACT_SOURCE_BY_ID = {
  playerProfileRegistry: 'PlayerProfileRegistry',
  scoreSubmissionRegistry: 'ScoreSubmissionRegistry',
  achievementRegistry: 'AchievementRegistry',
  arcadeRankedEntry: 'ArcadeRankedEntry',
  gameRegistry: 'GameRegistry',
};

const NATIVE_ENTRY_FEE_WEI = '100000000000000000'; // 0.1 zkLTC

function samplePlan(overrides = {}) {
  // Exercise all plan branches: profile change + achievements + paid entry fee.
  return buildSettlementPlan({
    wallet: '0x' + '1'.repeat(40),
    gameId: 'lester-blaster',
    sessionId: 'sess-abi-gate',
    score: 4242,
    kills: 30,
    maxCombo: 9,
    survivalSeconds: 300,
    bossId: 'rug-pull-baron',
    unlockedAchievements: ['clear-level-1', 'beat-rug-pull-baron'],
    username: 'AbiGate',
    profileChanged: true,
    entryFeeWei: NATIVE_ENTRY_FEE_WEI,
    ...overrides,
  });
}

test('every settlement-plan call names a method that exists on its Solidity contract', () => {
  const plan = samplePlan();

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
  const plan = samplePlan({ sessionId: 'sess-abi-gate-2', unlockedAchievements: ['a', 'b'], username: 'X' });
  const methods = new Set(plan.calls.map((c) => c.method));
  for (const dead of ['submitScore', 'unlockAchievement', 'routeRevenueSplit', 'updateProfile', 'submitSession', 'startPaidSession', 'unlockFor']) {
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

test('the unverified submitSession path no longer exists in the Solidity source', () => {
  const src = solSource('ScoreSubmissionRegistry');
  assert.equal(/function\s+submitSession\s*\(/.test(src), false, 'submitSession must be removed; only verifier-attested runs settle');
  assert.equal(SCORE_REGISTRY_ABI.some((f) => /function\s+submitSession\s*\(/.test(f)), false, 'SCORE_REGISTRY_ABI must not advertise submitSession');
});

test('the live submitVerifiedSession ABI arg count matches the Solidity signature', () => {
  // Guard against arg drift: submitVerifiedSession(run, achievements, signature) takes exactly 3 params.
  const src = solSource('ScoreSubmissionRegistry');
  const sig = src.match(/function\s+submitVerifiedSession\s*\(([^)]*)\)/s);
  assert.ok(sig, 'submitVerifiedSession signature not found in ScoreSubmissionRegistry.sol');
  const params = sig[1].split(',').map((s) => s.trim()).filter(Boolean);
  assert.equal(params.length, 3, `submitVerifiedSession should take 3 params, source has ${params.length}`);

  const abiFrag = SCORE_REGISTRY_ABI.find((f) => f.includes('function submitVerifiedSession'));
  assert.ok(abiFrag, 'submitVerifiedSession missing from SCORE_REGISTRY_ABI');
  // Count only top-level params: the VerifiedRun tuple's 13 fields sit one paren level deeper.
  const abiParams = topLevelParams(abiFrag.slice(abiFrag.indexOf('submitVerifiedSession')));
  assert.equal(abiParams.length, 3, `SCORE_REGISTRY_ABI submitVerifiedSession should take 3 params, has ${abiParams.length}`);
  assert.match(abiFrag, /bytes\s+signature/, 'signature is a 65-byte blob, not v/r/s');
});

test('ABI alignment recognizes generated public getters, not private state', () => {
  const names = solFunctionNames(`
    address public immutable gameRegistry;
    uint256 public constant MAX_SCORE = 42;
    mapping(bytes32 => mapping(address => uint256)) public bestScore;
    address private owner;
    function submitVerifiedSession() external {}
  `);
  assert.deepEqual([...names].sort(), ['MAX_SCORE', 'bestScore', 'gameRegistry', 'submitVerifiedSession']);
});

test('2026-09-16 owner-decision surface exists in the Solidity sources the portal will bind to', () => {
  const entryFns = solFunctionNames(solSource('ArcadeRankedEntry'));
  for (const name of ['openSession', 'quoteEntry', 'settlementGasReserveWei', 'relayerVault', 'setSettlementGasReserve', 'setRelayerVault', 'entryFeeEnabled', 'isPaid']) {
    assert.ok(entryFns.has(name), `ArcadeRankedEntry.sol must expose ${name}`);
  }
  const scoreFns = solFunctionNames(solSource('ScoreSubmissionRegistry'));
  for (const name of ['submitVerifiedSession', 'achievementRegistryByGame', 'setAchievementRegistry', 'relayers']) {
    assert.ok(scoreFns.has(name), `ScoreSubmissionRegistry.sol must expose ${name}`);
  }
  assert.equal(scoreFns.has('achievementRegistry'), false, 'single achievementRegistry() getter retired in favour of achievementRegistryByGame(gameId)');
  const src = solSource('ScoreSubmissionRegistry');
  assert.match(src, /function setAchievementRegistry\(bytes32 gameId, address/, 'setAchievementRegistry is keyed by gameId');
});
