import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  HMH_LEVEL_ONE_BOSS_BEAT_SCHEDULE,
  HMH_LEVEL_ONE_PLAYTEST_BALANCE,
  levelOneRoguelikeDropChance,
  levelOneRoguelikePickupAssistAt,
  levelOneRoguelikePerformanceBudgetAt,
  levelOneRoguelikeSpawnDirectorAt,
} from '../apps/portal/src/arcade-core.mjs';

const mainSource = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');

function maxSingleSecondDelta(key, seconds = 30 * 60) {
  let max = 0;
  let previous = levelOneRoguelikeSpawnDirectorAt(0)[key];
  for (let t = 1; t <= seconds; t += 1) {
    const current = levelOneRoguelikeSpawnDirectorAt(t)[key];
    max = Math.max(max, Math.abs(current - previous));
    previous = current;
  }
  return max;
}

test('WO-26 Level 1 uses one open-ended continuous pressure curve, not an 8-minute wall', () => {
  assert.equal(Object.hasOwn(HMH_LEVEL_ONE_PLAYTEST_BALANCE, 'targetSessionSeconds'), false);
  assert.equal(Object.hasOwn(HMH_LEVEL_ONE_PLAYTEST_BALANCE, 'targetPressureSeconds'), false);

  const opening = levelOneRoguelikeSpawnDirectorAt(0);
  const oldWall = levelOneRoguelikeSpawnDirectorAt(8 * 60);
  const eliteBand = levelOneRoguelikeSpawnDirectorAt(25 * 60);

  assert.equal(opening.difficultyLabel, 'opening');
  assert.ok(oldWall.pressure < 0.75, `8:00 cannot be a full-pressure milestone, got ${oldWall.pressure}`);
  assert.ok(oldWall.difficultyLabel !== 'survival-wall');
  assert.ok(eliteBand.pressure > 0.9, `elite band should be overwhelming by 25:00, got ${eliteBand.pressure}`);
  assert.ok(eliteBand.maxEnemiesOnMap <= 64, `25:00 must respect the body-count ceiling, got ${eliteBand.maxEnemiesOnMap}`);
  assert.ok(eliteBand.threatBudget >= 50, `25:00 needs weighted threat pressure, got ${eliteBand.threatBudget}`);
  assert.ok(eliteBand.attackTokenCap <= 5, `25:00 must preserve attack readability, got ${eliteBand.attackTokenCap}`);
});

test('WO-26 difficulty knobs are continuous over a 30-minute simulation', () => {
  assert.ok(maxSingleSecondDelta('spawnIntervalSeconds') <= 0.02);
  assert.ok(maxSingleSecondDelta('maxEnemiesOnMap') <= 1);
  assert.ok(maxSingleSecondDelta('threatBudget') <= 0.2);
  assert.ok(maxSingleSecondDelta('attackTokenCap') <= 1);
  assert.ok(maxSingleSecondDelta('enemyProjectileCap') <= 1);
  assert.ok(maxSingleSecondDelta('eliteEnemyShare') <= 0.01);
  assert.ok(maxSingleSecondDelta('healthMultiplier') <= 0.02);
  assert.ok(maxSingleSecondDelta('damageMultiplier') <= 0.01);

  assert.ok(levelOneRoguelikeDropChance({ elapsedSeconds: 20 * 60, rare: false }) > levelOneRoguelikeDropChance({ elapsedSeconds: 60, rare: false }));
  assert.ok(levelOneRoguelikePickupAssistAt({ elapsedSeconds: 20 * 60, activeEnemies: 64 }).xpAttractRadiusMultiplier > 1);
  assert.ok(levelOneRoguelikePerformanceBudgetAt({ elapsedSeconds: 20 * 60, activeEnemies: 64 }).maxParticles <= 180);
  assert.ok(mainSource.includes('groundOverscanFullscreenTiles'), 'runtime should use the Level 1 budget for fullscreen ground overscan');
  assert.ok(mainSource.includes('maxAnimatedEnemies'), 'runtime should cap animated enemy sprites during late swarms');
  assert.ok(mainSource.includes('enemyAnimationFps'), 'runtime should lower off-peak enemy animation fps under pressure');
});

test('WO-26 approved faster arcade boss beat schedule is data-only and has no 8-minute trigger', () => {
  const beats = HMH_LEVEL_ONE_BOSS_BEAT_SCHEDULE;
  assert.ok(beats.length >= 8);
  assert.equal(beats[0].type, 'mini-boss-pair');
  assert.equal(beats[0].startSeconds, 210);
  assert.equal(beats[1].type, 'major-boss');
  assert.equal(beats[1].startSeconds, 510);
  for (let i = 2; i < beats.length; i += 1) {
    assert.equal(beats[i].startSeconds - beats[i - 1].startSeconds, 180);
  }
  assert.equal(beats.some((beat) => beat.startSeconds === 480), false);
});

test('Level 1 runtime consumes every scheduled major rematch and keeps phase choreography active', () => {
  const spawnStart = mainSource.indexOf('function spawnLevelOneBossBeat(');
  const phaseStart = mainSource.indexOf('function updateLevelOneSignatureBoss(');
  const spawnBlock = mainSource.slice(spawnStart, mainSource.indexOf('\nfunction ', spawnStart + 1));
  const phaseBlock = mainSource.slice(phaseStart, mainSource.indexOf('\nfunction ', phaseStart + 1));

  assert.ok(HMH_LEVEL_ONE_BOSS_BEAT_SCHEDULE.filter((beat) => beat.type === 'major-boss' || beat.type === 'major-rematch').length >= 4);
  assert.match(spawnBlock, /const isMajorBossBeat = beat\.type === 'major-boss' \|\| beat\.type === 'major-rematch'/);
  assert.match(spawnBlock, /if \(isMajorBossBeat && majorBoss\)/);
  assert.doesNotMatch(phaseBlock, /combat\.scriptedBossTriggered && !combat\.bossDefeated/);
});

test('WO-26 runtime HUD is count-up survival with no target denominator or survival-wall snapshot', () => {
  assert.match(mainSource, /label:\s*'SURVIVED'/);
  assert.equal(mainSource.includes("label: 'SURVIVE', value: `${formatSeconds(combat.elapsedGameSeconds)} /"), false);
  assert.equal(mainSource.includes('survivalWallAnnounced'), false);
  assert.equal(mainSource.includes('SURVIVAL WALL'), false);
  assert.match(mainSource, /HMH_LEVEL_ONE_BOSS_BEAT_SCHEDULE/);
});
