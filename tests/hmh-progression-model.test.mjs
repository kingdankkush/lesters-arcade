// Design package S0.3 (progression part): the headless progression model.
// It runs the real run-progression, weapon, director, enemy-attack, combat,
// grenade, knife and aim modules on an abstract route, and it is the
// measuring stick for the progression release (package 8.3 and 9.2: median
// survival may grow by at most 10% against the 1.8.1 baseline).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  BASELINE_RELATIVE_PATH,
  MAIN_MIRROR,
  MODEL_CONSTANTS,
  PICK_POLICIES,
  PROGRESSION_MODEL_VERSION,
  SURVIVAL_GATE_MAX_GROWTH,
  chooseReroll,
  choosePick,
  compareToBaseline,
  calibrateReferenceDps,
  loadProgressionModules,
  modelConstantsFingerprint,
  modelSeeds,
  pistolReferenceDps,
  readOffer,
  runProgressionModel,
} from '../scripts/hmh-progression-model.mjs';
import { HMH_REFERENCE_DPS, referenceDps } from '../apps/hmh-reboot/src/boss-reference-dps.mjs';

const modules = await loadProgressionModules();
const SHORT = 9_000;

test('the same seed and policy give the same evidence digest, and another seed does not', () => {
  const [seedA, seedB] = modelSeeds(2);
  for (const policy of PICK_POLICIES) {
    const first = runProgressionModel(modules, { seed: seedA, policy, horizonTicks: SHORT });
    const second = runProgressionModel(modules, { seed: seedA, policy, horizonTicks: SHORT });
    const other = runProgressionModel(modules, { seed: seedB, policy, horizonTicks: SHORT });
    assert.match(first.digest, /^[0-9a-f]{64}$/);
    assert.equal(first.digest, second.digest, `${policy} is deterministic`);
    assert.notEqual(first.digest, other.digest, `${policy} depends on the seed`);
    assert.ok(first.kills > 0 && first.level > 1, `${policy} fights and levels (${first.kills} kills, level ${first.level})`);
  }
});

test('XP income is the real run progression: kills, combos and caches add up and the level follows 150·L·(L+1)', () => {
  const [seed] = modelSeeds(1);
  const run = runProgressionModel(modules, { seed, policy: 'seeded', horizonTicks: 24_000 });
  const sourced = Object.values(run.xpBySource).reduce((sum, value) => sum + value, 0);
  assert.equal(sourced, run.xp, 'every XP point has a source');
  assert.ok(run.xpBySource.kills > 0 && run.xpBySource.combos > 0, 'kills and combo milestones both pay XP');
  let expectedLevel = 1;
  while (run.xp >= 150 * expectedLevel * (expectedLevel + 1)) expectedLevel += 1;
  assert.equal(run.level, expectedLevel);
  assert.deepEqual(run.levelTicks.map((entry) => entry.level), Array.from({ length: run.level }, (_, index) => index + 1));
  assert.ok(run.xpByMinute.length === Math.floor(24_000 / 3_600), 'one XP sample per simulated minute');
  assert.ok(run.xpByMinute.every((value, index) => index === 0 || value >= run.xpByMinute[index - 1]), 'XP never decreases');
});

test('every offer is the real two-card offer, and every pick is one of its cards', () => {
  const progression = modules.progression.createRunProgression({ seed: 77 });
  modules.progression.grantRunXp(progression, 900, 1);
  const snapshot = modules.progression.getRunProgressionSnapshot(progression);
  assert.deepEqual(readOffer(modules, progression).map((card) => card.id), snapshot.pendingChoices.map((choice) => choice.id));

  const [seed] = modelSeeds(1);
  for (const policy of PICK_POLICIES) {
    const run = runProgressionModel(modules, { seed, policy, horizonTicks: 24_000 });
    assert.ok(run.offers.length >= 3, `${policy} sees several offers`);
    for (const offer of run.offers) {
      assert.equal(offer.offered.length, 2, 'two cards per offer (1.8.1)');
      assert.ok(offer.offered.includes(offer.picked), `${offer.picked} was offered`);
      assert.equal(offer.rerolls, 0, '1.8.1 has no re-roll');
    }
    assert.equal(run.offers.length, run.level - 1, 'one pick per level gained');
  }
});

test('the three pick policies choose by their stated priorities, and only power and survival re-roll', () => {
  assert.deepEqual([...PICK_POLICIES], ['seeded', 'power', 'survival']);
  const catalog = modules.progression.RUN_UPGRADE_CATALOG;
  const card = (id) => ({ ...catalog[id], rank: 0, nextRank: 1 });
  const context = { seed: 7, level: 3, selectionSequence: 1, weaponCardIds: new Set(['proof-of-work', 'hot-wallet', 'block-reward']) };
  assert.equal(choosePick('power', [card('diamond-hands'), card('proof-of-work')], context), 1);
  assert.equal(choosePick('power', [card('hot-wallet'), card('precision-ledger')], context), 0, 'a weapon card beats a crit card');
  assert.equal(choosePick('survival', [card('proof-of-work'), card('diamond-hands')], context), 1);
  assert.equal(choosePick('survival', [card('layer-two'), card('gas-optimization')], context), 1, 'dash recharge beats repeatable speed');
  const seededPicks = new Set();
  for (let level = 2; level < 40; level += 1) seededPicks.add(choosePick('seeded', [card('diamond-hands'), card('proof-of-work')], { ...context, level }));
  assert.deepEqual([...seededPicks].sort(), [0, 1], 'the seeded policy uses both slots');
  assert.equal(choosePick('seeded', [card('diamond-hands'), card('proof-of-work')], context), choosePick('seeded', [card('diamond-hands'), card('proof-of-work')], context));

  assert.equal(chooseReroll('seeded', [card('layer-two'), card('hardened-wallet')], context), -1, 'the casual policy never re-rolls');
  assert.equal(chooseReroll('power', [card('layer-two'), card('proof-of-work')], context), 0, 'power re-rolls its weak slot');
  assert.equal(chooseReroll('power', [card('hot-wallet'), card('proof-of-work')], context), -1, 'nothing to improve');
  assert.equal(chooseReroll('survival', [card('diamond-hands'), card('validator-training')], context), 1);
  assert.equal(chooseReroll('power', [card('layer-two'), card('proof-of-work')], { ...context, rerolledSlots: new Set([0]) }), -1, 'one re-roll per card');
});

test('the ammo economy uses the real loadout: rounds granted minus rounds fired is what is left', () => {
  const [seed] = modelSeeds(1);
  const run = runProgressionModel(modules, { seed, policy: 'power', horizonTicks: 30_000 });
  const shotgun = run.ammo['scatter-shotgun'];
  assert.ok(shotgun.granted > 0, 'the ravine salvage cache grants the shotgun');
  assert.ok(shotgun.fired > 0, 'the shotgun is fired once picked up');
  for (const [weaponId, ledger] of Object.entries(run.ammo)) {
    if (weaponId === 'coin-blaster') {
      assert.equal(ledger.granted, null, 'the pistol has an unlimited reserve');
      continue;
    }
    assert.equal(ledger.start + ledger.granted - ledger.fired, ledger.end, `${weaponId} rounds balance`);
    assert.ok(ledger.maxReserve <= ledger.reserveCap, `${weaponId} reserve stays within twice its grant`);
  }
  assert.ok(run.ammo['coin-blaster'].fired > 0);
  assert.ok(Object.values(run.ammo).reduce((sum, ledger) => sum + ledger.activeTicks, 0) === run.survivalTicks, 'one active weapon every tick');
});

test('the survival proxy responds to enemy accuracy in the right direction', () => {
  const [seed] = modelSeeds(1);
  const horizonTicks = 36_000;
  const untouchable = runProgressionModel(modules, { seed, policy: 'seeded', horizonTicks, constants: { ...MODEL_CONSTANTS, strikeConnectChance: 0 } });
  const normal = runProgressionModel(modules, { seed, policy: 'seeded', horizonTicks });
  const exposed = runProgressionModel(modules, { seed, policy: 'seeded', horizonTicks, constants: { ...MODEL_CONSTANTS, strikeConnectChance: 1 } });
  assert.equal(untouchable.died, false);
  assert.equal(untouchable.survivalTicks, horizonTicks);
  assert.equal(exposed.died, true);
  assert.ok(exposed.survivalTicks < normal.survivalTicks, `${exposed.survivalTicks} < ${normal.survivalTicks}`);
  assert.ok(exposed.damageTaken > 0 && exposed.dodges > 0, 'automatic dodges absorb some strikes');
});

test('the pistol reference DPS uses the weapon benchmark method and reproduces its rows', () => {
  const benchmark = JSON.parse(readFileSync(new URL('../docs/qa/hmh-weapon-benchmark.json', import.meta.url), 'utf8'));
  const row = (tier) => benchmark.rows.find((entry) => entry.weaponId === 'coin-blaster' && entry.tier === tier && entry.range === 'mid');
  const neutral = { outgoingDamageMultiplier: 1, criticalChanceBonus: 0, criticalDamageBonus: 0 };
  const base = pistolReferenceDps(modules, { ranks: {}, effects: neutral });
  const maxed = pistolReferenceDps(modules, { ranks: { 'proof-of-work': 3, 'hot-wallet': 3, 'block-reward': 3 }, effects: neutral });
  assert.equal(base.raw, row('base').sustainedDps);
  assert.equal(maxed.raw, row('maxed').sustainedDps);
  assert.ok(base.expected > base.raw, 'the reference counts the base 8% critical chance');
  const boosted = pistolReferenceDps(modules, { ranks: {}, effects: { outgoingDamageMultiplier: 1.5, criticalChanceBonus: 0, criticalDamageBonus: 0 } });
  assert.ok(boosted.expected > base.expected * 1.4, 'the outgoing damage multiplier applies');
});

test('the referenceDps calibration is the per-level median table, non-decreasing, over the levels most runs reach', () => {
  const table = [
    { level: 1, runsReached: 10, median: 6.74 },
    { level: 2, runsReached: 10, median: 7.12 },
    { level: 3, runsReached: 10, median: 7.05 },
    { level: 4, runsReached: 6, median: 9.96 },
    { level: 5, runsReached: 4, median: 99 },
  ];
  const calibration = calibrateReferenceDps(table);
  assert.deepEqual([...calibration.levels], [6.7, 7.1, 7.1, 10]);
  assert.equal(calibration.lastLevel, 4, 'a level fewer than half the runs reach is not calibrated');
  assert.throws(() => calibrateReferenceDps([{ level: 2, runsReached: 1, median: 1 }]), /level 1/);
});

test('the survival gate fails above +10% pooled median growth and warns per policy', () => {
  assert.equal(SURVIVAL_GATE_MAX_GROWTH, 0.1);
  const report = (pooled, byPolicy) => ({
    modelVersion: PROGRESSION_MODEL_VERSION,
    constantsFingerprint: modelConstantsFingerprint(),
    config: { seeds: [1, 2], policies: [...PICK_POLICIES], horizonTicks: 100 },
    survival: { pooled: { median: pooled }, byPolicy: Object.fromEntries(PICK_POLICIES.map((policy, index) => [policy, { median: byPolicy[index] }])) },
  });
  const baseline = report(1_000, [1_000, 1_000, 1_000]);
  const within = compareToBaseline(report(1_100, [1_000, 1_150, 1_050]), baseline);
  assert.equal(within.comparable, true);
  assert.equal(within.pass, true);
  assert.deepEqual(within.warnings.map((warning) => warning.policy), ['power']);
  assert.deepEqual(within.pooledQuantiles, { median: 0.1 }, 'the other quantiles are reported when both reports carry them');
  const over = compareToBaseline(report(1_101, [1_000, 1_000, 1_000]), baseline);
  assert.equal(over.pass, false);
  const otherModel = compareToBaseline({ ...report(1_000, [1_000, 1_000, 1_000]), constantsFingerprint: 'x' }, baseline);
  assert.equal(otherModel.comparable, false);
  assert.equal(otherModel.pass, false);
});

test('the committed 1.8.1 baseline was produced by this model, and the boss reference DPS module carries its calibration', () => {
  const baseline = JSON.parse(readFileSync(new URL(`../${BASELINE_RELATIVE_PATH}`, import.meta.url), 'utf8'));
  assert.equal(baseline.modelVersion, PROGRESSION_MODEL_VERSION);
  assert.equal(baseline.constantsFingerprint, modelConstantsFingerprint());
  assert.equal(baseline.source.label, '1.8.1');
  assert.deepEqual(baseline.config.policies, [...PICK_POLICIES]);
  assert.equal(baseline.runs.length, baseline.config.seeds.length * PICK_POLICIES.length);
  assert.equal(baseline.deterministic, true);
  const pooled = baseline.survival.pooled.median;
  assert.ok(pooled > 0.25 * baseline.config.horizonTicks && pooled < 0.9 * baseline.config.horizonTicks, 'the baseline sits inside the horizon, so the gate can see growth');
  assert.deepEqual([...HMH_REFERENCE_DPS.levels], baseline.referenceDps.calibration.levels, 'the child module carries the baseline calibration');
  assert.deepEqual(calibrateReferenceDps(baseline.referenceDps.table).levels, baseline.referenceDps.calibration.levels, 'the calibration follows from the baseline table');
  assert.equal(referenceDps(1), HMH_REFERENCE_DPS.levels[0]);
  assert.equal(referenceDps(HMH_REFERENCE_DPS.levels.length), HMH_REFERENCE_DPS.levels.at(-1));
  assert.equal(referenceDps(1_000), HMH_REFERENCE_DPS.levels.at(-1));
  assert.throws(() => referenceDps(0), /level/);
  assert.throws(() => referenceDps(1.5), /level/);
  for (let level = 1; level < 60; level += 1) assert.ok(referenceDps(level + 1) >= referenceDps(level));
  assert.ok(referenceDps(1) > 6 && referenceDps(1) < 7, 'level 1 is the base Pistol with the base critical chance');
});

test('the model mirrors main.mjs constants it cannot import', () => {
  const source = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  const constant = (name) => Number(source.match(new RegExp(`const ${name} = ([0-9._]+);`))?.[1]?.replaceAll('_', ''));
  assert.equal(MAIN_MIRROR.projectileFlightHeight, constant('PROJECTILE_FLIGHT_HEIGHT'));
  assert.equal(MAIN_MIRROR.maxActiveGrenades, constant('MAX_ACTIVE_GRENADES'));
  assert.equal(MAIN_MIRROR.criticalChanceCap, constant('CRITICAL_CHANCE_CAP'));
  assert.equal(MAIN_MIRROR.baseCriticalChance, constant('BASE_CRITICAL_CHANCE'));
  assert.equal(MAIN_MIRROR.baseCriticalMultiplier, constant('BASE_CRITICAL_MULTIPLIER'));
  assert.match(source, new RegExp(`let maxPlayerHealth = ${MAIN_MIRROR.playerMaxHealth};`));
  assert.match(source, new RegExp(`createGrenadeSystem\\(\\{ capacity: MAX_ACTIVE_GRENADES, handCharges: ${MAIN_MIRROR.openingHandGrenades} \\}\\)`));
  assert.match(source, new RegExp(`directorDebugEnabled \\? 1 : ${MAIN_MIRROR.firstDirectorSpawnTick};`));
  assert.match(source, new RegExp(`capacity: ${MAIN_MIRROR.populationCapacity},\\s*threatCapacity: endurancePressurePilotEnabled \\? runtimeEncounterSnapshot\\(0\\)\\.threatCap : ${MAIN_MIRROR.populationThreatCapacity}`));
});
