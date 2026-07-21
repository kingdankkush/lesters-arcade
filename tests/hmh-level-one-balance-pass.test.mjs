import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  buildLevelOneSpawnBudgetState,
  createRoguelikeRunState,
  chooseRoguelikeUpgradeOptions,
  LESTER_BLASTER_ROGUELIKE_SKILL_LIBRARY,
  levelOneEnemyThreatCost,
  levelOneRoguelikeSpawnBudgetAllows,
  levelOneRoguelikeSpawnDirectorAt,
} from '../apps/portal/src/arcade-core.mjs';
import {
  buildSeparationSpatialHash,
  computeSpatialSeparation,
  enemyAiUpdateStride,
  shouldUpdateEnemyAi,
} from '../apps/portal/src/enemy-steering.mjs';
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
  const lateDirector = snapshot.checkpoints.at(-1).director;
  assert.ok(lateDirector.maxEnemiesOnMap <= 64);
  assert.ok(lateDirector.threatBudget >= 50);
  assert.ok(lateDirector.attackTokenCap <= 5);
  assert.ok(lateDirector.enemyProjectileCap <= 72);
  assert.ok(lateDirector.healthMultiplier > snapshot.checkpoints[0].director.healthMultiplier);
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

test('Level 1 boss choreography has phase gates, add windows, counterplay, and open-survival payout', () => {
  const plan = buildLevelOneBossChoreographyPlan();
  assert.equal(plan.finalBoss.poiId, 'rugpull-gulch-boss-yard');
  assert.equal(plan.finalBoss.phases.length, 3);
  assert.ok(plan.finalBoss.phases.every((phase) => phase.telegraphFrames >= 45));
  assert.ok(plan.finalBoss.phases.some((phase) => phase.addWaveSuppression === true));
  assert.equal(plan.finalBoss.onDefeat.continuesSurvival, true);
  assert.equal(plan.finalBoss.onDefeat.dropsBossPayout, true);
  assert.equal(plan.finalBoss.onDefeat.suppressesGenericSpawnsDuringDeathSpectacle, true);
  assert.ok(plan.miniBosses.length >= 3);
  assert.ok(plan.miniBosses.every((miniBoss) => miniBoss.counterplay && miniBoss.rewardHook));
});

test('Level 1 upgrade variety exposes WO-27 mechanic-changing cards and deterministic guided offers can include them', () => {
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

test('generated Level 1 balance report exposes long-run elite-band values without undefined fields', () => {
  const report = readFileSync(repoPath('docs/game-design/hard-money-heroes-level-1-balance-telemetry.md'), 'utf8');
  assert.doesNotMatch(report, /undefined/);
  assert.match(report, /Swarm fighter kills at elite band: 450/);
  assert.match(report, /Swarm fighter target level at elite band: \d+/);
  assert.match(report, /Normal drop chance: 0\.16 → 0\.345/);
});


test('late-run Level 1 pressure shifts to threat quality instead of unbounded raw enemy count', () => {
  const opening = levelOneRoguelikeSpawnDirectorAt(0);
  const late = levelOneRoguelikeSpawnDirectorAt(30 * 60);
  assert.ok(opening.maxEnemiesOnMap <= 18);
  assert.ok(late.maxEnemiesOnMap <= 64, `late cap must respect readability/performance ceiling, got ${late.maxEnemiesOnMap}`);
  assert.ok(late.attackTokenCap <= 5);
  assert.ok(late.enemyProjectileCap <= 72);
  assert.ok(late.spawnBurstCap <= 3);
  assert.ok(late.threatBudget > opening.threatBudget);
  assert.ok(late.healthMultiplier > opening.healthMultiplier);
  assert.ok(late.eliteEnemyShare > opening.eliteEnemyShare);
});

test('enemy threat costs prioritize elites and bosses over raw body count', () => {
  const melee = levelOneEnemyThreatCost({ ranged: false });
  const ranged = levelOneEnemyThreatCost({ ranged: true });
  const elite = levelOneEnemyThreatCost({ ranged: true, elite: true });
  const miniBoss = levelOneEnemyThreatCost({ miniBoss: true, elite: true });
  const boss = levelOneEnemyThreatCost({ boss: true, signatureBoss: true });
  assert.ok(melee < ranged);
  assert.ok(ranged < elite);
  assert.ok(elite < miniBoss);
  assert.ok(miniBoss < boss);
});

test('spawn budget rejects extra bodies, threat overflow, and projectile soup deterministically', () => {
  const enemies = Array.from({ length: 40 }, (_, index) => ({
    id: `enemy-${index}`,
    hp: 10,
    ranged: index % 3 === 0,
    elite: index % 7 === 0,
  }));
  const state = buildLevelOneSpawnBudgetState({ elapsedSeconds: 20 * 60, enemies, enemyProjectiles: 0 });
  assert.equal(state.enemyCount, 40);
  assert.ok(state.threatUsed >= 40);
  assert.equal(levelOneRoguelikeSpawnBudgetAllows(state, { ranged: false }), state.remainingEnemySlots > 0 && state.remainingThreat >= levelOneEnemyThreatCost({ ranged: false }));

  const projectileLocked = buildLevelOneSpawnBudgetState({
    elapsedSeconds: 20 * 60,
    enemies,
    enemyProjectiles: state.enemyProjectileCap,
  });
  assert.equal(projectileLocked.projectileSaturated, true);
  assert.equal(levelOneRoguelikeSpawnBudgetAllows(projectileLocked, { ranged: true }), false);
});

test('spatial separation queries only neighboring buckets and remains deterministic', () => {
  const agents = [
    { x: 0, y: 0 },
    { x: 0.4, y: 0 },
    { x: -0.5, y: 0.2 },
    { x: 20, y: 20 },
    { x: -20, y: -20 },
  ];
  const hash = buildSeparationSpatialHash(agents, { cellSize: 1.2 });
  const a = computeSpatialSeparation(agents[0], agents, hash, { selfIndex: 0, radius: 1.2, maxNeighbors: 10 });
  const b = computeSpatialSeparation(agents[0], agents, hash, { selfIndex: 0, radius: 1.2, maxNeighbors: 10 });
  assert.deepEqual(a, b);
  assert.equal(a.count, 2);
  assert.ok(Number.isFinite(a.x) && Number.isFinite(a.y));
  assert.ok(hash.bucketCount < agents.length);
});

test('AI movement cadence keeps bosses and nearby threats full-rate while throttling distant stragglers', () => {
  assert.equal(enemyAiUpdateStride({ distanceTiles: 6 }), 1);
  assert.equal(enemyAiUpdateStride({ distanceTiles: 6, activeEnemies: 39 }), 1);
  assert.equal(enemyAiUpdateStride({ distanceTiles: 6, activeEnemies: 40 }), 2);
  assert.equal(enemyAiUpdateStride({ distanceTiles: 6, activeEnemies: 47 }), 2);
  assert.equal(enemyAiUpdateStride({ distanceTiles: 6, activeEnemies: 48 }), 3);
  assert.equal(enemyAiUpdateStride({ distanceTiles: 40, boss: true }), 1);
  assert.equal(enemyAiUpdateStride({ distanceTiles: 40, miniBoss: true }), 1);
  assert.equal(enemyAiUpdateStride({ distanceTiles: 6, activeEnemies: 64, boss: true }), 1);
  assert.equal(enemyAiUpdateStride({ distanceTiles: 18 }), 2);
  assert.equal(enemyAiUpdateStride({ distanceTiles: 32 }), 3);
  assert.equal(shouldUpdateEnemyAi({ frame: 12, enemyIndex: 0, stride: 3 }), true);
  assert.equal(shouldUpdateEnemyAi({ frame: 13, enemyIndex: 0, stride: 3 }), false);
});

test('runtime consumes spawn budgets, attack tokens, measured capped steering, and burst limits', () => {
  const main = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  assert.match(main, /buildLevelOneSpawnBudgetState/);
  assert.match(main, /levelOneRoguelikeSpawnBudgetAllows/);
  assert.match(main, /computeSeparation/);
  assert.doesNotMatch(main, /computeSpatialSeparation/);
  assert.match(main, /maxNeighbors: 10/);
  assert.match(main, /enemyAiUpdateStride/);
  assert.doesNotMatch(main, /const movementDt = dt \* aiStride/);
  assert.match(main, /cachedMoveMode/);
  assert.match(main, /const movementDt = Math\.min\(dt, 0\.05\)/);
  assert.match(main, /const spawnedEnemy = spawnRoguelikeEnemy\(director\)/);
  assert.match(main, /if \(!spawnedEnemy\) break;[\s\S]*spawnedThisStep \+= 1;[\s\S]*roguelikeSpawnTimer \+= director\.spawnIntervalSeconds/);
  assert.match(main, /spawnBurstCap/);
  assert.match(main, /attackTokenCap/);
  assert.match(main, /attackTokenHeld/);
  assert.match(main, /Boolean\(enemy\.attackTokenHeld\)/);
  assert.match(main, /ctx\.ellipse\(centerX, footY \+ 1/);
  assert.match(main, /enemyProjectileCap/);
});
