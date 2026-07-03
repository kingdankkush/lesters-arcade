import assert from 'node:assert/strict';
import test from 'node:test';

import {
  LESTER_BLASTER_ISOMETRIC_ROGUELIKE,
  LESTER_BLASTER_ROGUELIKE_SKILL_LIBRARY,
  applyRoguelikeSkillUpgrade,
  chooseRoguelikeUpgradeOptions,
  createRoguelikeRunState,
} from '../apps/portal/src/arcade-core.mjs';
import { simulateHmhRunEconomy } from '../apps/portal/src/hmh-run-simulator.mjs';

const byId = (id) => LESTER_BLASTER_ROGUELIKE_SKILL_LIBRARY.find((skill) => skill.id === id);
const baseSkills = () => LESTER_BLASTER_ROGUELIKE_SKILL_LIBRARY.filter((skill) => skill.kind !== 'evolution');
const sumRanks = (skills = LESTER_BLASTER_ROGUELIKE_SKILL_LIBRARY) => skills.reduce((sum, skill) => sum + skill.maxRank, 0);

function assertLegalOffer(option, run) {
  assert.ok(option, 'expected an option');
  assert.ok((run.skills?.[option.id] ?? 0) < option.maxRank, `${option.id} should not be max rank`);
  if (option.gate?.playerLevel) assert.ok((run.level ?? 1) >= option.gate.playerLevel, `${option.id} should satisfy player level gate`);
  for (const req of option.gate?.requires ?? []) {
    assert.ok((run.skills?.[req.skillId] ?? 0) >= req.rank, `${option.id} requires ${req.skillId} r${req.rank}`);
  }
}

test('WO-27 upgrade tree is a compact ranked base tree with deliberate scarcity', () => {
  const tree = baseSkills();
  assert.ok(tree.length >= 24 && tree.length <= 28, `expected 24-28 base upgrades, got ${tree.length}`);
  assert.ok(sumRanks(tree) >= 95 && sumRanks(tree) <= 120, `expected 95-120 base total ranks, got ${sumRanks(tree)}`);

  for (const skill of tree) {
    assert.equal(skill.maxLevel, skill.maxRank, `${skill.id} should expose maxLevel alias for runtime compatibility`);
    assert.ok(Array.isArray(skill.ranks), `${skill.id} needs explicit per-rank stats`);
    assert.equal(skill.ranks.length, skill.maxRank, `${skill.id} ranks length should match maxRank`);
    if (skill.kind === 'unlock') assert.equal(skill.maxRank, 1, `${skill.id} unlocks are one-rank picks`);
    else assert.ok(skill.maxRank >= 3 && skill.maxRank <= 5, `${skill.id} should be rankable 3-5 times`);
  }

  for (const id of ['damage-alpha', 'reload-hands', 'critical-chance', 'critical-damage', 'move-speed', 'magazine-size', 'rate-of-fire', 'projectile-speed', 'pierce', 'spread-control', 'grenade-capacity', 'grenade-damage', 'grenade-radius', 'xp-gain', 'pickup-radius', 'power-up-luck', 'max-health', 'health-regen', 'armor', 'dash-cooldown', 'dash-distance', 'coin-value', 'combo-retention', 'revive', 'launcher-rig', 'homing-cluster', 'block-buster']) {
    assert.ok(byId(id), `missing required upgrade ${id}`);
  }

  assert.equal(byId('revive').gate.playerLevel, 20);
  assert.deepEqual(byId('homing-cluster').gate.requires, [{ skillId: 'grenade-damage', rank: 2 }]);
  assert.deepEqual(byId('block-buster').gate.requires, [{ skillId: 'grenade-radius', rank: 2 }]);
  const golden = LESTER_BLASTER_ROGUELIKE_SKILL_LIBRARY.filter((skill) => skill.kind === 'evolution');
  assert.equal(golden.length >= 4, true, 'WO-45 golden evolutions extend the base tree without counting as base scarcity cards');
  assert.equal(golden.every((skill) => skill.rarity === 'golden' && skill.maxRank === 1), true);
});

test('Wave 2 draft offers exactly 3 legal cards, respects gates, and never empties across 80 levels', () => {
  assert.equal(LESTER_BLASTER_ISOMETRIC_ROGUELIKE.levelUp.choicesPerLevel, 3);
  let run = createRoguelikeRunState({ seed: 2701, mode: 'free', campaignLevelNumber: 1 });

  for (let level = 1; level <= 80; level += 1) {
    run = { ...run, level };
    const offer = chooseRoguelikeUpgradeOptions(run, { seed: 27_000 + level });
    assert.equal(offer.options.length, 3, `level ${level} should offer 3 cards`);
    assert.equal(new Set(offer.options.map((option) => option.id)).size, 3, `level ${level} should not duplicate cards`);
    for (const option of offer.options) assertLegalOffer(option, run);
    run = applyRoguelikeSkillUpgrade(run, offer.options[0].id);
  }
});

test('WO-27 locked preview data explains gates without leaking locked cards into legal options', () => {
  const run = createRoguelikeRunState({ seed: 9, mode: 'free', campaignLevelNumber: 1 });
  const offer = chooseRoguelikeUpgradeOptions({ ...run, level: 4 }, { seed: 99, includeLockedPreviews: true });
  assert.equal(offer.options.some((option) => option.id === 'launcher-rig'), false);
  assert.ok(offer.lockedPreviews.some((preview) => preview.id === 'launcher-rig' && /LEVEL 10/.test(preview.gateHint)));
  assert.ok(offer.lockedPreviews.some((preview) => preview.id === 'revive' && /LEVEL 20/.test(preview.gateHint)));
});

test('Wave 2 XP simulator sustains 60-80 level endless-run cadence', () => {
  const average20 = simulateHmhRunEconomy({ minutes: 20, skillFactor: 0.75, tickSeconds: 1 }).summary;
  const strong = simulateHmhRunEconomy({ minutes: 28, skillFactor: 0.9, tickSeconds: 1 });
  const elite25 = simulateHmhRunEconomy({ minutes: 25, skillFactor: 1, tickSeconds: 1 }).summary;
  const m8 = strong.timeline.find((point) => point.minute === 8);
  const m20 = strong.timeline.find((point) => point.minute === 20);
  const m28 = strong.timeline.find((point) => point.minute === 28);

  assert.ok(m8.level >= 30 && m8.level <= 38, `strong 8-minute run should reach level 30-38, got level ${m8.level}`);
  assert.ok(m20.level >= 58 && m20.level <= 70, `strong 20-minute run should reach level 58-70, got level ${m20.level}`);
  assert.ok(m28.level >= 72 && m28.level <= 80, `strong 28-minute run should reach level 72-80, got level ${m28.level}`);
  assert.ok(average20.level >= 45, `20-minute average run should reach at least level 45, got level ${average20.level}`);
  assert.ok(elite25.level <= 80, `level cap should prevent over-leveling, got level ${elite25.level}`);
  assert.ok(sumRanks() >= 80, `Wave 2 80-level economy needs at least 80 available rank slots, got ${sumRanks()}`);
});
