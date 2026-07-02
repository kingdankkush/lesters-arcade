import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  COMBAT_FEEDBACK_MOMENTS,
  buildCombatFeedbackPlan,
  buildCombatFeedbackScorecard,
  validateCombatFeedbackCompleteness,
} from '../apps/portal/src/hmh-combat-feedback.mjs';

function repoText(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('WO-32 feedback scorecard covers every required combat moment with multimodal feedback', () => {
  const scorecard = buildCombatFeedbackScorecard();
  const validation = validateCombatFeedbackCompleteness(scorecard);

  assert.equal(validation.ok, true, validation.gaps.join('\n'));
  assert.ok(scorecard.overallScore >= 95, `score ${scorecard.overallScore}`);
  for (const id of ['enemy-hit', 'enemy-kill', 'player-hit', 'powerup-collect', 'xp-collect', 'grenade-detonate', 'level-up', 'boss-clear']) {
    assert.ok(COMBAT_FEEDBACK_MOMENTS[id], `${id} registered`);
    assert.ok(scorecard.rows.find((row) => row.id === id && row.channels.length >= 4), `${id} multimodal row`);
  }
});

test('WO-32 feedback plans respect accessibility and distinguish hit, pickup, boss, and level-up moments', () => {
  const enemyHit = buildCombatFeedbackPlan('enemy-hit', { amount: 17, crit: true, source: 'hash-rail' });
  assert.equal(enemyHit.sfxCue, 'enemy-hit');
  assert.equal(enemyHit.flashFrames >= 8, true);
  assert.equal(enemyHit.vfx.includes('hit-sparks'), true);
  assert.equal(enemyHit.texts.some((entry) => /17/.test(entry.text)), true);

  const quietHit = buildCombatFeedbackPlan('player-hit', { amount: 22, sourceLabel: 'Rug Rat' }, { reduceMotion: true, reduceFlash: true });
  assert.equal(quietHit.shake, 0);
  assert.ok(quietHit.flashFrames <= 4);
  assert.equal(quietHit.texts[0].text, '-22% HP');

  const pickup = buildCombatFeedbackPlan('powerup-collect', { title: 'Cold Wallet Shield', rarity: 'rare' });
  assert.equal(pickup.sfxCue, 'pickup');
  assert.equal(pickup.vfx.includes('coin-pickup-pop'), true);
  assert.ok(pickup.texts.some((entry) => entry.text === 'Cold Wallet Shield'));

  const boss = buildCombatFeedbackPlan('boss-clear', { title: 'The Whale' });
  assert.equal(boss.sfxCue, 'boss-warning');
  assert.ok(boss.texts.some((entry) => /BOSS CLEAR/.test(entry.text)));

  const levelUp = buildCombatFeedbackPlan('level-up', { level: 12, rerollsRemaining: 1 });
  assert.equal(levelUp.sfxCue, 'level-up');
  assert.ok(levelUp.texts.some((entry) => /LEVEL 12/.test(entry.text)));
});

test('WO-32 runtime routes combat feedback through the shared plan helper', () => {
  const main = repoText('apps/portal/main.js');
  const syntaxCheck = repoText('scripts/syntax-check.mjs');

  assert.equal(main.includes("./src/hmh-combat-feedback.mjs"), true);
  assert.equal(main.includes('function applyCombatFeedback('), true);
  assert.equal(main.includes("applyCombatFeedback('enemy-hit'"), true);
  assert.equal(main.includes("applyCombatFeedback('player-hit'"), true);
  assert.equal(main.includes("applyCombatFeedback('enemy-kill'"), true);
  assert.equal(main.includes("applyCombatFeedback('powerup-collect'"), true);
  assert.equal(main.includes("applyCombatFeedback('xp-collect'"), true);
  assert.equal(main.includes("applyCombatFeedback('grenade-detonate'"), true);
  assert.equal(main.includes("applyCombatFeedback('level-up'"), true);
  assert.equal(main.includes("applyCombatFeedback('boss-clear'"), true);
  assert.equal(syntaxCheck.includes('apps/portal/src/hmh-combat-feedback.mjs'), true);
  assert.equal(syntaxCheck.includes('tests/hmh-combat-feedback.test.mjs'), true);
});
