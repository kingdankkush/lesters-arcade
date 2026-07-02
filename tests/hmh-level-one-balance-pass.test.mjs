import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  createRoguelikeRunState,
  chooseRoguelikeUpgradeOptions,
  LESTER_BLASTER_ROGUELIKE_SKILL_LIBRARY,
} from '../apps/portal/src/arcade-core.mjs';
import {
  calculatePlayerDamageRecovery,
} from '../apps/portal/src/hmh-combat-balance.mjs';
import {
  buildLevelOneBalanceTelemetrySnapshot,
  buildLevelOneBossChoreographyPlan,
  buildLevelOneSpawnCompositionAt,
  buildLevelOneUpgradeVarietyPlan,
  levelOneBalanceRecommendationAreas,
  levelOneXpPacingPlan,
  validateLevelOneBalancePass,
} from '../apps/portal/src/hmh-level-one-balance-pass.mjs';

const repoPath = (relative) => fileURLToPath(new URL(`../${relative}`, import.meta.url));

test('Level 1 balance pass covers telemetry, XP, spawn composition, bosses, upgrades, and recovery', () => {
  assert.deepEqual(levelOneBalanceRecommendationAreas(), [
    'telemetry-harness',
    'xp-leveling-curve',
    'enemy-role-spawn-composition',
    'mini-boss-final-boss-choreography',
    'weapon-upgrade-build-variety',
    'player-damage-recovery-feel',
  ]);
  const validation = validateLevelOneBalancePass();
  assert.equal(validation.valid, true, validation.errors.join('; '));
});

test('Level 1 telemetry snapshot samples open-ended elite-band survival targets', () => {
  const snapshot = buildLevelOneBalanceTelemetrySnapshot({ sampleSeconds: [0, 300, 600, 900, 1200, 1500] });
  assert.equal(snapshot.mode, 'open-ended-survival');
  assert.equal(snapshot.checkpoints.length, 6);
  assert.equal(snapshot.checkpoints[0].actId, 'safe-road-controls');
  assert.equal(snapshot.checkpoints.at(-1).actId, 'rugpull-boss-yard-extraction');
  assert.ok(snapshot.checkpoints.at(-1).director.maxEnemiesOnMap >= 125);
  assert.ok(snapshot.killsModel.swarmFighter.killsAtEliteBand >= 400);
  assert.ok(snapshot.xpPacing.swarmFighter.targetLevelAtEliteBand >= 18);
  assert.ok(snapshot.xpPacing.firstUpgradeExpectedSeconds >= 45 && snapshot.xpPacing.firstUpgradeExpectedSeconds <= 75);
  assert.ok(snapshot.rewardModel.normalDropChanceAtEliteBand > snapshot.rewardModel.normalDropChanceAtStart);
});

test('Level 1 spawn composition changes by authored act and avoids unfair ambush ranges', () => {
  const saloon = buildLevelOneSpawnCompositionAt(110);
  const forest = buildLevelOneSpawnCompositionAt(220);
  const gasYard = buildLevelOneSpawnCompositionAt(390);
  const boss = buildLevelOneSpawnCompositionAt(465);

  assert.equal(saloon.actId, 'ghost-saloon-mainstreet-duel');
  assert.ok(saloon.roles.some((role) => role.id === 'cover-shooter'));
  assert.ok(forest.roles.some((role) => role.id === 'animal-rusher'));
  assert.ok(gasYard.roles.some((role) => role.id === 'explosive-ranged'));
  assert.ok(gasYard.rangedEnemyShare <= 0.34, 'gas yard can use ranged pressure but should avoid bullet soup');
  assert.equal(boss.genericSpawnSuppression, true, 'boss yard should suppress generic spawn soup during choreography');
  assert.ok(Math.min(...[saloon, forest, gasYard, boss].map((entry) => entry.minSpawnDistanceTiles)) >= 18);
});

test('Level 1 boss choreography has phase gates, add windows, counterplay, and extraction handoff', () => {
  const plan = buildLevelOneBossChoreographyPlan();
  assert.equal(plan.finalBoss.poiId, 'rugpull-gulch-boss-yard');
  assert.equal(plan.finalBoss.phases.length, 3);
  assert.ok(plan.finalBoss.phases.every((phase) => phase.telegraphFrames >= 45));
  assert.ok(plan.finalBoss.phases.some((phase) => phase.addWaveSuppression === true));
  assert.equal(plan.finalBoss.onDefeat.unlocksGate, true);
  assert.equal(plan.finalBoss.onDefeat.activatesExtractionFlare, true);
  assert.ok(plan.miniBosses.length >= 3);
  assert.ok(plan.miniBosses.every((miniBoss) => miniBoss.counterplay && miniBoss.rewardHook));
});

test('Level 1 upgrade variety exposes WO-27 mechanic-changing cards and deterministic three-card offers can include them', () => {
  const plan = buildLevelOneUpgradeVarietyPlan();
  const ids = plan.mechanicCards.map((card) => card.id);
  assert.ok(ids.includes('pierce'));
  assert.ok(ids.includes('grenade-damage'));
  assert.ok(ids.includes('pickup-radius'));
  assert.ok(ids.includes('dash-distance'));
  assert.ok(ids.includes('block-buster'));
  assert.ok(LESTER_BLASTER_ROGUELIKE_SKILL_LIBRARY.some((skill) => skill.id === 'pierce'));

  const run = createRoguelikeRunState({ seed: 91, mode: 'free', campaignLevelNumber: 1 });
  const seededRun = {
    ...run,
    level: 16,
    skills: {
      ...run.skills,
      'damage-alpha': 1,
      'grenade-capacity': 1,
      'grenade-damage': 2,
      'grenade-radius': 2,
      'dash-cooldown': 2,
    },
  };
  const offerIds = new Set();
  for (let seed = 1; seed <= 80; seed += 1) {
    for (const option of chooseRoguelikeUpgradeOptions(seededRun, { seed }).options) offerIds.add(option.id);
  }
  assert.ok(ids.some((id) => offerIds.has(id)), 'mechanic cards should be eligible in live Level 1 choices');
});

test('player damage recovery scales armor, i-frames, knockback, and labels damage sources readably', () => {
  const melee = calculatePlayerDamageRecovery({ damage: 12, source: 'enemy-melee', armor: 1.2, invulnerability: 1.1 });
  const projectile = calculatePlayerDamageRecovery({ damage: 9, source: 'enemy-shot', armor: 1, invulnerability: 1 });
  const hazard = calculatePlayerDamageRecovery({ damage: 5, source: 'environment-hazard', armor: 1.5, invulnerability: 1 });

  assert.equal(melee.appliedDamage < 12, true);
  assert.ok(melee.invulnerableFrames >= 72);
  assert.ok(melee.knockbackTiles > projectile.knockbackTiles);
  assert.match(melee.recapLabel, /melee/i);
  assert.match(projectile.recapLabel, /gunfire/i);
  assert.match(hazard.recapLabel, /hazard/i);
});

test('runtime and design scripts consume the Level 1 balance pass helpers', () => {
  const main = readFileSync(repoPath('apps/portal/main.js'), 'utf8');
  const packageJson = readFileSync(repoPath('package.json'), 'utf8');
  const snapshotScript = readFileSync(repoPath('scripts/write-hmh-balance-snapshot.mjs'), 'utf8');

  assert.equal(main.includes('calculatePlayerDamageRecovery'), true, 'damagePlayer should use recovery helper');
  assert.equal(main.includes('buildLevelOneSpawnCompositionAt'), true, 'spawn runtime should consume authored act composition');
  assert.equal(main.includes('buildLevelOneBossChoreographyPlan'), true, 'boss runtime should consume choreography plan');
  assert.equal(snapshotScript.includes('buildLevelOneBalanceTelemetrySnapshot'), true, 'design:balance should emit balance telemetry');
  const syntaxCheckRunner = readFileSync(repoPath('scripts/syntax-check.mjs'), 'utf8');
  assert.equal(syntaxCheckRunner.includes('apps/portal/src/hmh-level-one-balance-pass.mjs'), true, 'check runner should syntax-check the new module');
  assert.equal(syntaxCheckRunner.includes('tests/hmh-level-one-balance-pass.test.mjs'), true, 'check runner should syntax-check the new test');
});
