import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  bossBeatHealthMultiplier,
  buildBossBalanceCards,
  buildBossBalanceScorecard,
  validateBossBalanceCards,
} from '../apps/portal/src/hmh-boss-balance-pass.mjs';

function repoText(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('WO-33 boss balance cards cover all Level 1 boss-class runtime actors', () => {
  const cards = buildBossBalanceCards();
  const ids = cards.map((card) => card.enemyId);

  assert.equal(cards.length, 4);
  assert.equal(ids.includes('claim-jumper-sheriff'), true);
  assert.equal(ids.includes('scam-cult-zealot'), true);
  assert.equal(ids.includes('gas-beast'), true);
  assert.equal(ids.includes('rug-pull-baron'), true);
  assert.equal(cards.filter((card) => card.role === 'mini-boss').length, 3);
  assert.equal(cards.filter((card) => card.role === 'boss').length, 1);
});

test('WO-33 balance validation keeps schedule, phase count, cadence, and HP multipliers in bounds', () => {
  const cards = buildBossBalanceCards();
  const validation = validateBossBalanceCards(cards);
  const scorecard = buildBossBalanceScorecard(cards);

  assert.equal(validation.ok, true, validation.gaps.join('\n'));
  assert.equal(scorecard.overallScore, 100);
  assert.equal(scorecard.summary.miniBossCount, 3);
  assert.equal(scorecard.summary.majorBossCount, 1);
  assert.equal(scorecard.summary.scheduleSpacingOk, true);
  assert.ok(scorecard.summary.firstMiniBossSeconds <= 240);
  assert.ok(scorecard.summary.firstMajorBossSeconds >= 480);
});

test('WO-33 final boss escalates without unreadable cadence spikes', () => {
  const boss = buildBossBalanceCards().find((card) => card.role === 'boss');
  assert.equal(boss.phaseCount, 3);
  assert.deepEqual(boss.fanShotsByPhase, [3, 5, 7]);
  assert.ok(Math.min(...boss.attackResetFramesByPhase) >= 58, 'boss volley cooldown must stay readable');
  assert.ok(Math.max(...boss.fanSpreadRadByPhase) <= 1.1, 'fan spread should fit the readable arena cone');
  assert.equal(boss.addSuppressionPhases.includes('gate-warning'), true);
  assert.equal(boss.addSuppressionPhases.includes('extraction-break'), true);
});

test('WO-33 mini-bosses use two-phase enrage without outrunning the player', () => {
  const minis = buildBossBalanceCards().filter((card) => card.role === 'mini-boss');
  for (const card of minis) {
    assert.equal(card.phaseCount, 2, `${card.enemyId} phase count`);
    assert.equal(card.enrageHpPct, 50, `${card.enemyId} enrage threshold`);
    assert.ok(card.enrageAttackResetMul >= 0.58 && card.enrageAttackResetMul <= 0.72, `${card.enemyId} enrage cadence`);
    assert.ok(card.chaseSpeedCapRatio <= 0.92, `${card.enemyId} speed cap`);
    assert.ok(card.telegraphFrames >= 24, `${card.enemyId} readable tell`);
  }
});

test('WO-33 boss beat health multiplier is capped and monotonic', () => {
  const tiers = [1, 2, 3, 4, 5].map((tier) => bossBeatHealthMultiplier(tier));
  for (let i = 1; i < tiers.length; i += 1) assert.ok(tiers[i] >= tiers[i - 1]);
  assert.equal(bossBeatHealthMultiplier(1), 1.22);
  assert.ok(bossBeatHealthMultiplier(9) <= 2.2);
});

test('WO-33 runtime and syntax gate consume the boss balance pass', () => {
  const main = repoText('apps/portal/main.js');
  const syntaxCheck = repoText('scripts/syntax-check.mjs');

  assert.equal(main.includes("./src/hmh-boss-balance-pass.mjs"), true);
  assert.equal(main.includes('bossBeatHealthMultiplier(beat.pressureTier)'), true);
  assert.equal(syntaxCheck.includes('apps/portal/src/hmh-boss-balance-pass.mjs'), true);
  assert.equal(syntaxCheck.includes('tests/hmh-boss-balance-pass.test.mjs'), true);
});
