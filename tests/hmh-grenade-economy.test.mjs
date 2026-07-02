import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { LESTER_BLASTER_POWER_UPS, createRoguelikeRunState, applyRoguelikeSkillUpgrade } from '../apps/portal/src/arcade-core.mjs';
import { DROP_TABLES, rollDrop } from '../apps/portal/src/drop-tables.mjs';
import {
  HMH_GRENADE_TYPES,
  grenadeCapacityForRun,
  grenadeRefillForPickup,
  planLevelOneGrenadeThrow,
  resolveGrenadeTypeForRun,
} from '../apps/portal/src/hmh-grenade-economy.mjs';

function runWithSkills(skillRanks = {}, unlocks = {}) {
  const run = createRoguelikeRunState({ seed: 28, mode: 'free', campaignLevelNumber: 1 });
  return { ...run, level: 20, skills: { ...run.skills, ...skillRanks }, unlocks: { ...run.unlocks, ...unlocks } };
}

test('WO-28 defines refillable grenade types with distinct combat roles', () => {
  assert.deepEqual(Object.keys(HMH_GRENADE_TYPES).sort(), ['block-buster', 'homing-cluster', 'launcher-rig', 'satoshi-frag'].sort());
  assert.equal(HMH_GRENADE_TYPES['satoshi-frag'].title, 'Crypto Bombs');
  assert.equal(HMH_GRENADE_TYPES['launcher-rig'].role, 'long-range skill shot');
  assert.equal(HMH_GRENADE_TYPES['homing-cluster'].role, 'cluster-control seeker');
  assert.equal(HMH_GRENADE_TYPES['block-buster'].cost, 2);
  assert.ok(HMH_GRENADE_TYPES['block-buster'].blastRadius > HMH_GRENADE_TYPES['satoshi-frag'].blastRadius);
});

test('WO-28 grenade capacity and refills are capped, not infinite', () => {
  const base = runWithSkills();
  const pocketed = runWithSkills({ 'grenade-capacity': 3 });
  assert.equal(grenadeCapacityForRun(base), 3);
  assert.equal(grenadeCapacityForRun(pocketed), 6);
  assert.deepEqual(grenadeRefillForPickup({ current: 0, run: base, amount: 2 }), { before: 0, after: 2, gained: 2, capacity: 3 });
  assert.deepEqual(grenadeRefillForPickup({ current: 2, run: base, amount: 2 }), { before: 2, after: 3, gained: 1, capacity: 3 });
  assert.deepEqual(grenadeRefillForPickup({ current: 6, run: pocketed, amount: 2 }), { before: 6, after: 6, gained: 0, capacity: 6 });
});

test('WO-28 grenade unlocks switch throw plan without changing the single throwable control', () => {
  const base = runWithSkills();
  const launcher = runWithSkills({}, { 'launcher-rig': true });
  const homing = runWithSkills({}, { 'homing-cluster': true });
  const buster = runWithSkills({}, { 'block-buster': true });

  assert.equal(resolveGrenadeTypeForRun(base).id, 'satoshi-frag');
  assert.equal(resolveGrenadeTypeForRun(launcher).id, 'launcher-rig');
  assert.equal(resolveGrenadeTypeForRun(homing).id, 'homing-cluster');
  assert.equal(resolveGrenadeTypeForRun(buster).id, 'block-buster');

  const basePlan = planLevelOneGrenadeThrow({ run: base, currentGrenades: 1, originX: 0, originY: 0, aimX: 1, aimY: 0 });
  const launcherPlan = planLevelOneGrenadeThrow({ run: launcher, currentGrenades: 1, originX: 0, originY: 0, aimX: 1, aimY: 0 });
  const busterPlan = planLevelOneGrenadeThrow({ run: buster, currentGrenades: 1, originX: 0, originY: 0, aimX: 1, aimY: 0 });

  assert.equal(basePlan.throwAllowed, true);
  assert.equal(launcherPlan.throwAllowed, true);
  assert.ok(launcherPlan.plan.maxRange > basePlan.plan.maxRange);
  assert.equal(busterPlan.throwAllowed, false, 'block-buster needs two grenades loaded');
});

test('WO-28 grenade crates exist in the live roguelike drop economy', () => {
  assert.ok(LESTER_BLASTER_POWER_UPS.some((power) => power.id === 'grenade-crate' && power.effect === 'grenades'));
  assert.ok(DROP_TABLES.grunt.some((drop) => drop.id === 'grenade-crate'));
  assert.ok(DROP_TABLES.elite.some((drop) => drop.id === 'grenade-crate'));
  const observed = new Set();
  for (let seed = 1; seed <= 200; seed += 1) observed.add(rollDrop({ seed, tier: 'grunt', dropChance: 1 }));
  assert.ok(observed.has('grenade-crate'), 'seeded grunt table should be able to produce grenade crates');
});

test('WO-28 unlock cards write grenade-type state onto the run', () => {
  const run = runWithSkills({ 'grenade-capacity': 1, 'grenade-damage': 2 });
  const unlocked = applyRoguelikeSkillUpgrade(run, 'homing-cluster');
  assert.equal(unlocked.unlocks['homing-cluster'], true);
  assert.equal(resolveGrenadeTypeForRun(unlocked).id, 'homing-cluster');
});

test('WO-28 runtime wires refill pickups and grenade-type throw plans into main.js', () => {
  const main = readFileSync(new URL('../apps/portal/main.js', import.meta.url), 'utf8');
  assert.ok(main.includes("from './src/hmh-grenade-economy.mjs'"), 'main.js should import the grenade economy helpers');
  assert.ok(main.includes('planLevelOneGrenadeThrow({'), 'roguelike grenade throws should use type-aware planning');
  assert.ok(main.includes("'grenade-crate'"), 'roguelike drop pool should include grenade refill crates');
  assert.ok(/case 'grenades':[\s\S]*grenadeRefillForPickup/.test(main), 'grenade pickups should refill through capped economy helper');
  assert.ok(main.includes('typeId: throwPlan.typeId'), 'active grenades should carry their unlocked type id for detonation/rendering');
});
