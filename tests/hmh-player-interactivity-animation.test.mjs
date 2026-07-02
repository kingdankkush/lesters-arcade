import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  levelOnePlayerAnimationPlan,
  nearestLevelOneInteractivePrompt,
} from '../apps/portal/src/hmh-level-one-aaa-slices.mjs';

function repoText(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('WO-25 nearest interactive prompt prioritizes actionable Level 1 props in player range', () => {
  const obstacles = [
    {
      id: 'aaa-gas-pump',
      worldX: 3,
      worldY: 0,
      radius: 0.5,
      interactive: { kind: 'hazard', zoneId: 'warehouse-gas-station-yard' },
    },
    {
      id: 'aaa-cache',
      worldX: 1.1,
      worldY: 0.2,
      radius: 0.6,
      hp: 18,
      interactive: { kind: 'reward-cache', reward: 'litecoin-cache', zoneId: 'desert-bone-camp' },
    },
    {
      id: 'aaa-destroyed',
      worldX: 0.4,
      worldY: 0,
      radius: 0.6,
      destroyed: true,
      interactive: { kind: 'reward-cache', reward: 'litecoin-cache' },
    },
  ];

  const prompt = nearestLevelOneInteractivePrompt({ playerX: 0, playerY: 0, obstacles, rangeTiles: 1.8 });

  assert.equal(prompt.active, true);
  assert.equal(prompt.obstacleId, 'aaa-cache');
  assert.equal(prompt.actionable, true);
  assert.equal(prompt.action, 'open-cache');
  assert.match(prompt.label, /PRESS E/i);
  assert.match(prompt.label, /CACHE/i);
});

test('WO-25 interactive prompt explains locked and open boss-gate states without making them damageable', () => {
  const gate = { id: 'aaa-boss-yard-gate', worldX: 0.7, worldY: 0, radius: 0.8, interactive: { kind: 'gate' } };

  const locked = nearestLevelOneInteractivePrompt({ playerX: 0, playerY: 0, obstacles: [gate], bossDefeated: false });
  assert.equal(locked.active, true);
  assert.equal(locked.actionable, false);
  assert.equal(locked.action, 'locked-gate');
  assert.match(locked.label, /BOSS GATE LOCKED/i);

  const open = nearestLevelOneInteractivePrompt({ playerX: 0, playerY: 0, obstacles: [gate], bossDefeated: true });
  assert.equal(open.active, true);
  assert.equal(open.actionable, false);
  assert.equal(open.action, 'gate-open');
  assert.match(open.label, /GATE OPEN/i);
});

test('WO-25 player animation plan exposes throw, interact, hurt, shoot, and movement priority', () => {
  assert.deepEqual(levelOnePlayerAnimationPlan({ frame: 120, lastGrenadeFrame: 116 }).animationStates, ['throw', 'shoot', 'idle']);
  assert.deepEqual(levelOnePlayerAnimationPlan({ frame: 120, lastInteractFrame: 112 }).animationStates, ['melee', 'throw', 'idle']);
  assert.deepEqual(levelOnePlayerAnimationPlan({ frame: 120, invulnerableFrames: 20 }).animationStates, ['hurt', 'idle']);
  assert.deepEqual(levelOnePlayerAnimationPlan({ frame: 120, lastShotFrame: 116, fireFlash: 0 }).animationStates, ['shoot', 'idle']);
  assert.deepEqual(levelOnePlayerAnimationPlan({ frame: 120, moving: true }).animationStates, ['run', 'walk', 'idle']);
});

test('WO-25 runtime wires E/interact prompts and pure player animation planning into Level 1', () => {
  const main = repoText('apps/portal/main.js');
  const syntaxCheck = repoText('scripts/syntax-check.mjs');

  assert.equal(main.includes('nearestLevelOneInteractivePrompt'), true, 'runtime should import/use nearest prompt helper');
  assert.equal(main.includes('function triggerLevelOneInteraction('), true, 'runtime should expose one Level 1 interaction trigger');
  assert.equal(main.includes("key === 'e'"), true, 'keyboard E should trigger player interaction');
  assert.equal(main.includes('levelOnePlayerAnimationPlan({'), true, 'hero animation state should route through pure WO-25 planner');
  assert.equal(main.includes('lastGrenadeFrame'), true, 'successful grenades should drive throw animation');
  assert.equal(syntaxCheck.includes('tests/hmh-player-interactivity-animation.test.mjs'), true, 'new WO-25 test should be in syntax gate');
});
