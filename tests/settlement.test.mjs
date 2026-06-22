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

test('settlement is live (contracts deployed to LitVM testnet)', () => {
  assert.equal(SETTLEMENT_LIVE, true);
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

test('buildSettlementPlan always includes a score submit call', () => {
  const plan = buildSettlementPlan({
    wallet: WALLET, gameId: 'lester-blaster', sessionId: 'sess-1', score: 1234,
  });
  const methods = plan.calls.map((c) => c.method);
  assert.ok(methods.includes('submitScore'));
  assert.equal(plan.network.token, 'zkLTC');
  assert.equal(plan.network.chainId, 4441);
  assert.ok(plan.feePurpose.includes('settlement gas'));
  assert.ok(plan.feePurpose.includes('dev wallet'));
});

test('buildSettlementPlan adds an unlock call per achievement and a profile update', () => {
  const plan = buildSettlementPlan({
    wallet: WALLET, gameId: 'lester-blaster', sessionId: 'sess-2', score: 50,
    unlockedAchievements: ['first-paid-run', 'first-blood'],
    username: 'AcePilot', profileChanged: true,
  });
  const methods = plan.calls.map((c) => c.method);
  assert.equal(methods.filter((m) => m === 'unlockAchievement').length, 2);
  assert.ok(methods.includes('updateProfile'));
  // profile update should come before the score submit
  assert.ok(methods.indexOf('updateProfile') < methods.indexOf('submitScore'));
});

test('buildSettlementPlan requires wallet/gameId/sessionId', () => {
  assert.throws(() => buildSettlementPlan({ wallet: WALLET, gameId: 'g' }));
});

test('settleRun (simulated) returns deterministic receipts and no live send', async () => {
  const plan = buildSettlementPlan({
    wallet: WALLET, gameId: 'lester-blaster', sessionId: 'sess-3', score: 777,
    unlockedAchievements: ['first-paid-run'],
  });
  const r1 = await settleRun(plan, { live: false });
  const r2 = await settleRun(plan, { live: false });
  assert.equal(r1.mode, 'simulated');
  assert.equal(r1.settled, true);
  assert.ok(r1.primaryTxHash.startsWith('0x'));
  assert.equal(r1.primaryTxHash, r2.primaryTxHash); // deterministic
  assert.ok(r1.receipts.every((rcpt) => rcpt.simulated === true));
});

test('settleRun live path broadcasts via injected sendTransaction', async () => {
  const plan = buildSettlementPlan({
    wallet: WALLET, gameId: 'lester-blaster', sessionId: 'sess-4', score: 10,
  });
  const sent = [];
  const result = await settleRun(plan, {
    live: true,
    contractAddresses: {
      scoreSubmissionRegistry: '0x' + 'c'.repeat(40),
      achievementRegistry: '0x' + 'd'.repeat(40),
      playerProfileRegistry: '0x' + 'e'.repeat(40),
    },
    sendTransaction: async (call) => {
      sent.push(call);
      return '0xlive' + sent.length;
    },
  });
  assert.equal(result.mode, 'live');
  assert.equal(sent.length, plan.calls.length);
  assert.ok(result.primaryTxHash.startsWith('0xlive'));
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
