import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SETTLEMENT_LIVE,
  ZKLTC_SETTLEMENT_GAS,
  estimateSettlementGas,
  buildSettlementPlan,
  settleRun,
} from '../apps/portal/src/settlement.mjs';

const WALLET = '0x' + 'a'.repeat(40);

test('ranked settlement fails closed until the verifier contract and attestation service are approved', () => {
  assert.equal(SETTLEMENT_LIVE, false);
});

test('estimateSettlementGas scales with achievements + profile change', () => {
  const base = estimateSettlementGas({ achievementCount: 0, profileChanged: false });
  assert.equal(base.totalGas, ZKLTC_SETTLEMENT_GAS.scoreSubmit);
  assert.equal(base.token, 'zkLTC');

  const withExtras = estimateSettlementGas({ achievementCount: 2, profileChanged: true });
  const expected = ZKLTC_SETTLEMENT_GAS.scoreSubmit
    + ZKLTC_SETTLEMENT_GAS.achievementUnlock * 2n
    + ZKLTC_SETTLEMENT_GAS.profileUpdate;
  assert.equal(withExtras.totalGas, expected);
  assert.equal(withExtras.estimatedFeeWei, expected * ZKLTC_SETTLEMENT_GAS.gasPriceWei);
});

test('buildSettlementPlan always includes a submitSession call (deployed ABI)', () => {
  const plan = buildSettlementPlan({
    wallet: WALLET, gameId: 'lester-blaster', sessionId: 'sess-1', score: 1234,
  });
  const methods = plan.calls.map((c) => c.method);
  // The deployed ScoreSubmissionRegistry exposes submitSession(...), NOT submitScore.
  assert.ok(methods.includes('submitSession'));
  assert.ok(!methods.includes('submitScore'), 'submitScore is not a real deployed method');
  assert.equal(plan.network.token, 'zkLTC');
  assert.equal(plan.network.chainId, 4441);
  assert.ok(plan.feePurpose.includes('settlement gas'));
  assert.ok(plan.feePurpose.includes('dev wallet'));
});

test('submitSession call carries the full deployed ABI arg shape', () => {
  const plan = buildSettlementPlan({
    wallet: WALLET, gameId: 'hard-money-heroes', sessionId: 'sess-abi', score: 9000,
    kills: 42, maxCombo: 13, survivalSeconds: 480, bossId: 'rug-pull-baron',
    unlockedAchievements: ['clear-level-1', 'beat-rug-pull-baron'],
  });
  const submit = plan.calls.find((c) => c.method === 'submitSession');
  assert.ok(submit, 'plan must contain a submitSession call');
  assert.equal(submit.contract, 'scoreSubmissionRegistry');
  // args must mirror submitSession(sessionId, gameId, score, kills, maxCombo,
  // survivalSeconds, bossId, achievements[]).
  const a = submit.args;
  assert.equal(a.sessionId, 'sess-abi');
  assert.equal(a.gameId, 'hard-money-heroes');
  assert.equal(a.score, 9000);
  assert.equal(a.kills, 42);
  assert.equal(a.maxCombo, 13);
  assert.equal(a.survivalSeconds, 480);
  assert.equal(a.bossId, 'rug-pull-baron');
  assert.deepEqual([...a.achievements], ['clear-level-1', 'beat-rug-pull-baron']);
});

test('achievements ride inside submitSession, not separate unlock calls', () => {
  const plan = buildSettlementPlan({
    wallet: WALLET, gameId: 'lester-blaster', sessionId: 'sess-2', score: 50,
    unlockedAchievements: ['first-paid-run', 'first-blood'],
  });
  const methods = plan.calls.map((c) => c.method);
  // AchievementRegistry.unlockFor is onlyLedger — a player wallet cannot call
  // it, so there must be NO standalone achievement-unlock calls in the plan.
  assert.ok(!methods.includes('unlockAchievement'));
  assert.ok(!methods.includes('unlockFor'));
  const submit = plan.calls.find((c) => c.method === 'submitSession');
  assert.deepEqual([...submit.args.achievements], ['first-paid-run', 'first-blood']);
});

test('profile change uses the idempotent setProfile method', () => {
  const plan = buildSettlementPlan({
    wallet: WALLET, gameId: 'lester-blaster', sessionId: 'sess-2b', score: 50,
    username: 'AcePilot', profileChanged: true,
  });
  const methods = plan.calls.map((c) => c.method);
  // PlayerProfileRegistry: use setProfile (create-or-update), never updateProfile
  // (which reverts when the wallet has no profile yet).
  assert.ok(methods.includes('setProfile'));
  assert.ok(!methods.includes('updateProfile'));
  const profileCall = plan.calls.find((c) => c.method === 'setProfile');
  assert.equal(profileCall.contract, 'playerProfileRegistry');
  assert.equal(profileCall.args.displayName, 'AcePilot');
  assert.ok('avatarUri' in profileCall.args);
  // profile update should come before the score submit
  assert.ok(methods.indexOf('setProfile') < methods.indexOf('submitSession'));
});

test('paid entry fee produces a registry-derived startPaidSession router call without caller split/token args', () => {
  const plan = buildSettlementPlan({
    wallet: WALLET, gameId: 'lester-blaster', sessionId: 'sess-paid', score: 10,
    entryFeeMicroUnits: 250_000, paymentToken: 'zkLTC',
  });
  const routeCall = plan.calls.find((c) => c.contract === 'arcadePaymentRouter');
  assert.ok(routeCall, 'paid session must include a router call');
  // Deployed ArcadePaymentRouter exposes startPaidSession(...), not routeRevenueSplit.
  assert.equal(routeCall.method, 'startPaidSession');
  assert.ok(!plan.calls.some((c) => c.method === 'routeRevenueSplit'));
  const { args } = routeCall;
  assert.equal(args.sessionId, 'sess-paid');
  assert.equal(args.gameId, 'lester-blaster');
  assert.equal(args.amount, 250_000);
  assert.deepEqual(Object.keys(args).sort(), ['amount', 'gameId', 'sessionId']);
  assert.equal('paymentToken' in args, false);
  assert.equal('settlementGasUsed' in args, false);
  assert.equal('split' in args, false);
});

test('zero entry fee (free ranked testnet) emits no router call', () => {
  const plan = buildSettlementPlan({
    wallet: WALLET, gameId: 'lester-blaster', sessionId: 'sess-free', score: 10,
    entryFeeMicroUnits: 0,
  });
  assert.ok(!plan.calls.some((c) => c.contract === 'arcadePaymentRouter'));
});

test('buildSettlementPlan requires wallet/gameId/sessionId', () => {
  assert.throws(() => buildSettlementPlan({ wallet: WALLET, gameId: 'g' }));
});

test('settleRun (simulated) returns deterministic simulated receipts without explorer tx hashes', async () => {
  const plan = buildSettlementPlan({
    wallet: WALLET, gameId: 'lester-blaster', sessionId: 'sess-3', score: 777,
    unlockedAchievements: ['first-paid-run'],
  });
  const r1 = await settleRun(plan, { live: false });
  const r2 = await settleRun(plan, { live: false });
  assert.equal(r1.mode, 'simulated');
  assert.equal(r1.settled, true);
  assert.equal(r1.primaryTxHash, null);
  assert.ok(r1.primarySimulatedTxHash.startsWith('sim:'));
  assert.equal(r1.primarySimulatedTxHash, r2.primarySimulatedTxHash); // deterministic
  assert.ok(r1.receipts.every((rcpt) => rcpt.simulated === true));
  // primaryTxHash resolves off the submitSession receipt.
  const submitReceipt = r1.receipts.find((rcpt) => rcpt.method === 'submitSession');
  assert.equal(submitReceipt.txHash, null);
  assert.equal(r1.primarySimulatedTxHash, submitReceipt.simulatedTxHash);
});

test('settleRun generic live path is dev-flagged and re-checks chain id before every broadcast', async () => {
  const plan = buildSettlementPlan({
    wallet: WALLET, gameId: 'lester-blaster', sessionId: 'sess-4', score: 10,
  });
  const sent = [];
  await assert.rejects(
    () => settleRun(plan, { live: true, sendTransaction: async () => '0x' }),
    /generic live settlement path is disabled/,
  );

  const result = await settleRun(plan, {
    live: true,
    allowGenericLiveSettlement: true,
    getChainId: async () => 4441,
    contractAddresses: {
      scoreSubmissionRegistry: '0x' + 'c'.repeat(40),
      achievementRegistry: '0x' + 'd'.repeat(40),
      playerProfileRegistry: '0x' + 'e'.repeat(40),
      arcadePaymentRouter: '0x' + 'f'.repeat(40),
    },
    sendTransaction: async (call) => {
      sent.push(call);
      return '0xlive' + sent.length;
    },
  });
  assert.equal(result.mode, 'live');
  assert.equal(sent.length, plan.calls.length);
  assert.ok(result.primaryTxHash.startsWith('0xlive'));
  // every broadcast call names a method that exists on the deployed contracts
  const validMethods = new Set(['submitSession', 'setProfile', 'startPaidSession']);
  assert.ok(sent.every((c) => validMethods.has(c.method)), 'only deployed methods may be broadcast');
});

test('settleRun generic live path aborts when fresh chain id is wrong', async () => {
  const plan = buildSettlementPlan({
    wallet: WALLET, gameId: 'lester-blaster', sessionId: 'sess-4-wrong-chain', score: 10,
  });
  await assert.rejects(
    () => settleRun(plan, {
      live: true,
      allowGenericLiveSettlement: true,
      getChainId: async () => 1,
      contractAddresses: { scoreSubmissionRegistry: '0x' + 'c'.repeat(40) },
      sendTransaction: async () => '0xlive',
    }),
    /wrong chain before broadcast/,
  );
});

test('settleRun live path is blocked when contract addresses are missing', async () => {
  const plan = buildSettlementPlan({
    wallet: WALLET, gameId: 'lester-blaster', sessionId: 'sess-5', score: 10,
  });
  await assert.rejects(
    () => settleRun(plan, { live: true, sendTransaction: async () => '0x', contractAddresses: {} }),
    /missing deployed contract addresses/,
  );
});
