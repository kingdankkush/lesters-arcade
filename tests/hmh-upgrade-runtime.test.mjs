import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  applyRoguelikeSkillUpgrade,
  createRoguelikeRunState,
} from '../apps/portal/src/arcade-core.mjs';
import {
  applyUpgradeRevive,
  buildUpgradeRuntimePolicy,
  upgradedClipSize,
} from '../apps/portal/src/hmh-upgrade-runtime.mjs';
import {
  HMH_CERTIFIED_BUILD_PROFILES,
  buildHmhUpgradeBuildCertification,
} from '../apps/portal/src/hmh-long-run-simulator.mjs';

const mainSource = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');

function leveledRun(level = 30) {
  const run = createRoguelikeRunState({ seed: 99, characterId: 'lester-original' });
  run.level = level;
  return run;
}

test('absolute-value upgrades use count and HP-per-second units', () => {
  let run = leveledRun();
  run = applyRoguelikeSkillUpgrade(run, 'damage-alpha');
  run = applyRoguelikeSkillUpgrade(run, 'pierce');
  run.skills['max-health'] = 2;
  run = applyRoguelikeSkillUpgrade(run, 'health-regen');
  run.skills.armor = 2;
  run.skills['max-health'] = 3;
  run = applyRoguelikeSkillUpgrade(run, 'revive');

  assert.equal(run.stats.damage, 1.1);
  assert.equal(run.stats.pierce, 1);
  assert.equal(run.stats.healthRegen, 0.35);
  assert.equal(run.stats.revive, 1);
});

test('runtime policy normalizes every combat-facing upgrade stat', () => {
  const policy = buildUpgradeRuntimePolicy({
    rateOfFire: 1.2,
    magazineSize: 1.25,
    criticalChance: 1.18,
    criticalDamage: 1.4,
    spreadControl: 1.5,
    pierce: 2,
    dashCooldown: 1.25,
    dashDistance: 1.4,
    healthRegen: 0.5,
    scoreMultiplier: 1.3,
    comboRetention: 1.5,
    revive: 1,
    weaponEvolution: 'settler-rail',
  });

  assert.equal(policy.fireRateMultiplier, 1.2);
  assert.equal(policy.magazineMultiplier, 1.25);
  assert.equal(policy.critChanceBonus, 0.18);
  assert.equal(policy.critDamageBonus, 0.4);
  assert.equal(policy.spreadMultiplier, 1 / 1.5);
  assert.equal(policy.additionalPierceTargets, 2);
  assert.equal(policy.dashCooldownSeconds, 1.76);
  assert.equal(policy.dashDistanceMultiplier, 1.4);
  assert.equal(policy.healthRegenPerSecond, 0.5);
  assert.equal(policy.scoreMultiplier, 1.3);
  assert.equal(policy.comboDecayMultiplier, 1 / 1.5);
  assert.equal(policy.reviveCharges, 1);
  assert.equal(policy.weaponEvolution, 'settler-rail');
  assert.equal(upgradedClipSize(8, policy), 10);
});

test('revive consumes exactly one charge and restores 35 percent health', () => {
  assert.deepEqual(applyUpgradeRevive({ health: -4, maxHealth: 120, reviveCharges: 1 }), {
    revived: true,
    health: 42,
    reviveCharges: 0,
  });
  assert.equal(applyUpgradeRevive({ health: -4, maxHealth: 120, reviveCharges: 0 }).revived, false);
});

test('main runtime consumes all upgrade policy outputs', () => {
  for (const token of [
    'buildUpgradeRuntimePolicy',
    'upgradedClipSize',
    'fireRateMultiplier',
    'critChanceBonus',
    'critDamageBonus',
    'spreadMultiplier',
    'additionalPierceTargets',
    'dashCooldownSeconds',
    'dashDistanceMultiplier',
    'healthRegenPerSecond',
    'scoreMultiplier',
    'comboDecayMultiplier',
    'applyUpgradeRevive',
    'weaponEvolution',
  ]) assert.match(mainSource, new RegExp(token));
});

test('six authored upgrade builds complete multi-seed 30-minute certification', () => {
  assert.equal(HMH_CERTIFIED_BUILD_PROFILES.length, 6);
  const report = buildHmhUpgradeBuildCertification();
  assert.equal(report.passed, true, JSON.stringify(report.builds, null, 2));
  assert.equal(report.builds.length, 6);
  for (const build of report.builds) {
    assert.equal(build.completedRuns, 5, build.id);
    assert.equal(build.validRuns, 5, build.id);
    assert.ok(build.minimumBossesDefeated >= 4, build.id);
    assert.ok(build.medianKillsPerMinute >= 8, build.id);
    assert.ok(build.preferredSelected.length >= 3, `${build.id}: ${build.preferredSelected.join(', ')}`);
  }
});
