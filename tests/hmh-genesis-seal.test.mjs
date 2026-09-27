// The Genesis Seal (design package 8.4, build ledger slice 7): the boss drop,
// its pedestal, the contact pickup, the bank, and the on-pickup resolution
// into an immediate evolution, a banked Seal or the evolution panel. The v7
// evolutions and progression rows it feeds are checked against the shared v7
// schema rules (S10-S12, S14-S15, S18).
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BOSS_REWARD_PEDESTALS,
  GENESIS_SEAL_RULES,
  HMH_WAVE_ONE_EVOLUTIONS,
  collectGenesisSeals,
  createBossDrops,
  dropGenesisSeal,
  evolutionCandidates,
  evolveBankedSealOnMastery,
  openRunEvolutionOffer,
  rerollRunEvolutionSlot,
  resolveGenesisSeal,
  runEvolutionRows,
  runWeaponMastered,
  selectRunEvolution,
} from '../apps/hmh-reboot/src/boss-drops.mjs';
import {
  createRunProgression,
  getRunProgressionSnapshot,
  openRunUpgradeOffer,
  rerollRunUpgradeSlot,
  runProgressionRow,
  selectRunUpgrade,
  setRunUpgradeFocus,
  unlockRunProgressionWeapon,
} from '../apps/hmh-reboot/src/run-progression.mjs';
import { readFileSync } from 'node:fs';
import { LIQUIDATOR_ARENAS, bossArenaInterior } from '../apps/hmh-reboot/src/boss-arenas.mjs';
import { liquidatorOpenArena } from '../apps/hmh-reboot/src/liquidator-boss.mjs';
import { OBJECTIVE_REWARDS } from '../apps/hmh-reboot/src/objective-rewards.mjs';
import { LEVEL_ONE_WORLD as world, createLevelOneGroundQuery } from '../apps/hmh-reboot/src/level-one-world.mjs';
import { createCollisionBody, resolveSweptCircleMotion } from '../apps/hmh-reboot/src/collision.mjs';
import { HMH_V7_EVOLUTIONS } from '../sdk/hmh-run-contract-v7.mjs';
import { HMH_RUN_SUMMARY_CATALOGS_V7 } from '../sdk/hmh-run-summary-schema-v7.mjs';

const ranksFor = (upgrades) => Object.fromEntries(Object.entries(upgrades).map(([id, rank]) => [id, rank]));
function progressionWith({ owned = ['coin-blaster'], ranks = {}, focus = null } = {}) {
  const progression = createRunProgression({ seed: 9, ownedWeaponIds: ['coin-blaster'] });
  for (const weaponId of owned) if (weaponId !== 'coin-blaster') unlockRunProgressionWeapon(progression, weaponId);
  Object.assign(progression.ranks, ranksFor(ranks));
  if (focus) setRunUpgradeFocus(progression, focus);
  return progression;
}
const MASTER = Object.freeze(Object.fromEntries(Object.entries(HMH_V7_EVOLUTIONS).map(([, row]) => [row.weaponId, row.mastery])));

test('the wave-1 roster is the v7 catalogue\'s wave 1, and mastery matches the contract', () => {
  assert.deepEqual(Object.values(HMH_WAVE_ONE_EVOLUTIONS).sort(), Object.entries(HMH_V7_EVOLUTIONS).filter(([, row]) => row.wave === 1).map(([id]) => id).sort());
  for (const [evolutionId, row] of Object.entries(HMH_V7_EVOLUTIONS)) {
    const progression = progressionWith({ owned: [row.weaponId], ranks: row.mastery });
    assert.equal(runWeaponMastered(progression.ranks, row.weaponId), true, `${evolutionId} mastery`);
    const [first] = Object.keys(row.mastery);
    progression.ranks[first] -= 1;
    assert.equal(runWeaponMastered(progression.ranks, row.weaponId), false, `${evolutionId} one rank short`);
  }
});

test('one Seal per boss id per run, at its arena\'s reward pedestal; contact within 80 collects it, no button', () => {
  const drops = createBossDrops();
  const seal = dropGenesisSeal(drops, { bossId: 'liquidator', tick: 40_000, arenaId: 'margin-floor' });
  assert.deepEqual({ x: seal.x, y: seal.y }, BOSS_REWARD_PEDESTALS['margin-floor']);
  assert.equal(seal.first, true, 'the run\'s first drop is flagged for its banner');
  assert.equal(dropGenesisSeal(drops, { bossId: 'liquidator', tick: 41_000, arenaId: 'dark-pool' }), null, 'never a second Seal for one boss');
  assert.deepEqual(collectGenesisSeals(drops, { tick: 40_001, hero: { x: seal.x + 81, y: seal.y } }), []);
  assert.deepEqual(collectGenesisSeals(drops, { tick: 40_002, hero: { x: seal.x + 80, y: seal.y } }).map((row) => row.bossId), ['liquidator']);
  assert.deepEqual(collectGenesisSeals(drops, { tick: 40_003, hero: { x: seal.x, y: seal.y } }), [], 'collected once');
  // It never expires.
  const late = createBossDrops();
  dropGenesisSeal(late, { bossId: 'liquidator', tick: 1, arenaId: 'dark-pool' });
  assert.equal(collectGenesisSeals(late, { tick: 900_000, hero: BOSS_REWARD_PEDESTALS['dark-pool'] }).length, 1);
  assert.equal(GENESIS_SEAL_RULES.pickupRadius, 80);
  assert.equal(GENESIS_SEAL_RULES.bankCap, 4);
  assert.throws(() => dropGenesisSeal(createBossDrops(), { bossId: 'not-a-boss', tick: 1, arenaId: 'margin-floor' }), /boss/);
});

// Review of ae96301e: ?boss=1 fights the Liquidator on liquidatorOpenArena
// (id 'open-floor'), which has no pedestal. dropGenesisSeal runs inside the
// fixed-step callback, where a throw halts the run, so it drops nothing there.
test('a defeat on the open-floor debug arena drops no Seal, spends nothing and does not throw', () => {
  const arenaId = liquidatorOpenArena({ x: 1_780, y: 2_400 }).id;
  assert.equal(arenaId, 'open-floor');
  assert.equal(Object.hasOwn(BOSS_REWARD_PEDESTALS, arenaId), false);
  const drops = createBossDrops();
  assert.doesNotThrow(() => dropGenesisSeal(drops, { bossId: 'liquidator', tick: 900, arenaId }));
  assert.equal(dropGenesisSeal(drops, { bossId: 'liquidator', tick: 901, arenaId }), null);
  assert.deepEqual(drops, createBossDrops(), 'no Seal, no boss marked as dropped, no bank slot used');
  // Inherited keys are not pedestals either.
  assert.equal(dropGenesisSeal(createBossDrops(), { bossId: 'liquidator', tick: 1, arenaId: 'toString' }), null);
  // The same boss still drops on a real arena afterwards.
  assert.equal(dropGenesisSeal(drops, { bossId: 'liquidator', tick: 40_000, arenaId: 'margin-floor' }).first, true);
  // main.mjs reads the result optionally, so a null drop announces nothing.
  const main = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /if \(dropGenesisSeal\(bossDrops, \{ bossId: 'liquidator', tick, arenaId: defeatedArenaId \}\)\?\.first\)/);
});

test('the pedestals: inside the arena, on dry walkable ground clear of every collider, 120 or more from every objective reward', () => {
  const queryGround = createLevelOneGroundQuery();
  const hero = createCollisionBody({ id: 'player', kind: 'player', radius: world.player.radius, minZ: 0, maxZ: 56 });
  assert.deepEqual(Object.keys(BOSS_REWARD_PEDESTALS).sort(), Object.keys(LIQUIDATOR_ARENAS).sort());
  for (const [arenaId, pedestal] of Object.entries(BOSS_REWARD_PEDESTALS)) {
    const interior = bossArenaInterior(LIQUIDATOR_ARENAS[arenaId]);
    assert.ok(pedestal.x >= interior.minX && pedestal.x <= interior.maxX && pedestal.y >= interior.minY && pedestal.y <= interior.maxY, `${arenaId} pedestal is inside`);
    for (let step = 0; step < 16; step += 1) {
      const x = pedestal.x + Math.cos(step * Math.PI / 8) * GENESIS_SEAL_RULES.pickupRadius;
      const y = pedestal.y + Math.sin(step * Math.PI / 8) * GENESIS_SEAL_RULES.pickupRadius;
      const ground = queryGround(x, y);
      assert.ok(ground.walkable && !ground.deepWater && ground.kind !== 'water', `${arenaId} pickup disk is dry at ${x},${y}`);
    }
    const fit = resolveSweptCircleMotion({ body: hero, start: { x: pedestal.x, y: pedestal.y, z: queryGround(pedestal.x, pedestal.y).groundZ }, delta: { x: 0, y: 0 }, blockers: world.collisionBlockers, bounds: world.bounds });
    assert.equal(fit.depenetrations.length, 0, `${arenaId} pedestal clips ${fit.depenetrations.map((entry) => entry.blockerId)}`);
    for (const reward of OBJECTIVE_REWARDS) {
      assert.ok(Math.hypot(reward.x - pedestal.x, reward.y - pedestal.y) >= 120, `${arenaId} pedestal is 120+ from ${reward.id}`);
    }
  }
});

test('on pickup: no candidate banks the Seal, one non-Pistol candidate evolves at once, anything else opens the panel', () => {
  const none = progressionWith({ owned: ['coin-blaster', 'scatter-shotgun'] });
  assert.deepEqual(resolveGenesisSeal(none, { tick: 10 }), { outcome: 'banked', weaponId: null, evolutionId: null });
  assert.deepEqual(runProgressionRow(none), { offersOpened: 0, evolutionOffersOpened: 0, rerolls: 0, sealsFound: 1, sealsBanked: 1, evolutionsApplied: 0, revivesUsed: 0 });

  const one = progressionWith({ owned: ['coin-blaster', 'scatter-shotgun'], ranks: MASTER['scatter-shotgun'] });
  assert.deepEqual(resolveGenesisSeal(one, { tick: 11 }), { outcome: 'evolved', weaponId: 'scatter-shotgun', evolutionId: 'double-spend' });
  assert.deepEqual(one.evolutions, { 'scatter-shotgun': 'double-spend' });
  assert.equal(runProgressionRow(one).sealsBanked, 0);
  assert.equal(runProgressionRow(one).evolutionOffersOpened, 0, 'no panel');

  const pistolOnly = progressionWith({ ranks: MASTER['coin-blaster'] });
  assert.equal(resolveGenesisSeal(pistolOnly, { tick: 12 }).outcome, 'panel', 'the Pistol alone opens the panel');
  const two = progressionWith({ owned: ['coin-blaster', 'scatter-shotgun', 'hash-rail'], ranks: { ...MASTER['scatter-shotgun'], ...MASTER['hash-rail'] } });
  assert.equal(resolveGenesisSeal(two, { tick: 13 }).outcome, 'panel');
  // An evolved gun is no longer a candidate; wave-2 guns never are.
  const wave2 = progressionWith({ owned: ['coin-blaster', 'lightning-ledger'], ranks: MASTER['lightning-ledger'] });
  assert.deepEqual(evolutionCandidates(wave2), []);
});

test('candidates: non-Pistol guns first (focus gun, then the weapon order), the Pistol last', () => {
  const progression = progressionWith({
    owned: ['coin-blaster', 'scatter-shotgun', 'auto-miner', 'hash-rail'],
    ranks: { ...MASTER['coin-blaster'], ...MASTER['scatter-shotgun'], ...MASTER['auto-miner'], ...MASTER['hash-rail'] },
    focus: 'hash-rail',
  });
  assert.deepEqual(evolutionCandidates(progression), ['hash-rail', 'scatter-shotgun', 'auto-miner', 'coin-blaster']);
  progression.evolutions['scatter-shotgun'] = 'double-spend';
  assert.deepEqual(evolutionCandidates(progression), ['hash-rail', 'auto-miner', 'coin-blaster']);
});

test('the evolution panel: the first two candidates (or "Bank the Seal" second), re-rolls cycle the candidates then the bank', () => {
  const progression = progressionWith({
    owned: ['coin-blaster', 'scatter-shotgun', 'auto-miner', 'hash-rail'],
    ranks: { ...MASTER['coin-blaster'], ...MASTER['scatter-shotgun'], ...MASTER['auto-miner'] },
  });
  assert.equal(resolveGenesisSeal(progression, { tick: 5 }).outcome, 'panel');
  const choices = openRunEvolutionOffer(progression);
  assert.deepEqual(choices.map((choice) => [choice.id, choice.kind, choice.weaponId, choice.rerollState]),
    [['double-spend', 'evolution', 'scatter-shotgun', 'ready'], ['hashstorm-overdrive', 'evolution', 'auto-miner', 'ready']]);
  assert.equal(openRunEvolutionOffer(progression), null, 'opened once');
  assert.deepEqual(getRunProgressionSnapshot(progression).pendingChoices.map((choice) => choice.id), ['double-spend', 'hashstorm-overdrive']);
  assert.equal(getRunProgressionSnapshot(progression).offerKind, 'evolution');
  assert.throws(() => selectRunUpgrade(progression, 'proof-of-work'), /evolution panel/);
  assert.throws(() => rerollRunUpgradeSlot(progression, 0), /evolution panel/);
  assert.equal(openRunUpgradeOffer(progression), null, 'no level offer opens over the panel');
  assert.equal(rerollRunEvolutionSlot(progression, 1).id, 'settler-rail', 'card 2 re-rolls to the next candidate (the Pistol last)');
  assert.equal(rerollRunEvolutionSlot(progression, 1), null, 'one re-roll per card');
  assert.equal(rerollRunEvolutionSlot(progression, 0).id, 'bank-seal', 'the candidates are spent: Bank the Seal');
  const rows = runEvolutionRows(progression);
  assert.deepEqual(rows.map((row) => row.evolutionId), HMH_RUN_SUMMARY_CATALOGS_V7.evolutions);
  assert.deepEqual(Object.fromEntries(rows.filter((row) => row.offered).map((row) => [row.evolutionId, row.offered])), { 'settler-rail': 1, 'double-spend': 1, 'hashstorm-overdrive': 1 }, 'the bank is never counted');
  const result = selectRunEvolution(progression, 'settler-rail');
  assert.deepEqual(result, { outcome: 'evolved', weaponId: 'coin-blaster', evolutionId: 'settler-rail' });
  assert.equal(progression.offer, null);
  assert.deepEqual(runProgressionRow(progression), { offersOpened: 0, evolutionOffersOpened: 1, rerolls: 2, sealsFound: 1, sealsBanked: 0, evolutionsApplied: 1, revivesUsed: 0 });
  assert.equal(runEvolutionRows(progression).find((row) => row.evolutionId === 'settler-rail').applied, 1);
});

test('Bank the Seal keeps it; a later pick that masters a non-Pistol gun evolves it at once; the Pistol never evolves automatically', () => {
  const progression = progressionWith({ owned: ['coin-blaster', 'scatter-shotgun'], ranks: { ...MASTER['coin-blaster'] } });
  assert.equal(resolveGenesisSeal(progression, { tick: 1 }).outcome, 'panel');
  const choices = openRunEvolutionOffer(progression);
  assert.deepEqual(choices.map((choice) => choice.id), ['settler-rail', 'bank-seal']);
  assert.equal(choices[1].rerollState, 'none');
  assert.deepEqual(selectRunEvolution(progression, 'bank-seal'), { outcome: 'banked', weaponId: null, evolutionId: null });
  assert.equal(runProgressionRow(progression).sealsBanked, 1);
  // The Pistol is mastered but never evolves from the bank.
  assert.equal(evolveBankedSealOnMastery(progression, 'block-reward'), null);
  // Master the Shotgun one pick at a time: only the completing pick evolves it.
  progression.ranks['scatter-pump'] = 3;
  progression.ranks['scatter-dump'] = 3;
  progression.ranks['scatter-shells'] = 2;
  assert.equal(evolveBankedSealOnMastery(progression, 'scatter-shells'), null, 'not mastered yet');
  progression.ranks['scatter-shells'] = 3;
  assert.deepEqual(evolveBankedSealOnMastery(progression, 'scatter-shells'), { weaponId: 'scatter-shotgun', evolutionId: 'double-spend' });
  assert.equal(runProgressionRow(progression).sealsBanked, 0);
  assert.equal(evolveBankedSealOnMastery(progression, 'scatter-shells'), null, 'nothing left banked');
});

test('evolving never uses a level-up pick', () => {
  const progression = progressionWith({ owned: ['coin-blaster', 'scatter-shotgun'], ranks: MASTER['scatter-shotgun'] });
  progression.pendingLevels = 2;
  const before = { pending: progression.pendingLevels, sequence: progression.selectionSequence, ranks: { ...progression.ranks } };
  resolveGenesisSeal(progression, { tick: 3 });
  assert.deepEqual({ pending: progression.pendingLevels, sequence: progression.selectionSequence, ranks: { ...progression.ranks } }, before);
});

test('the Seal path emits v7 evolutions and progression rows the shared schema accepts (S10-S12, S14-S15, S18)', async () => {
  const { readFileSync } = await import('node:fs');
  const { validateRunSummaryPayload } = await import('../sdk/hmh-run-summary-schema-v7.mjs');
  // hmh-v7-future-four-bosses: four bosses defeated, the Pistol mastered before the
  // third, and the Settler Rail taken from a panel.
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/ranked/hmh-v7-future-four-bosses.json', import.meta.url), 'utf8')).body.evidence.runSummary;
  const progression = progressionWith();
  const outcomes = [];
  outcomes.push(resolveGenesisSeal(progression, { tick: 7_560 }).outcome);
  outcomes.push(resolveGenesisSeal(progression, { tick: 19_200 }).outcome);
  Object.assign(progression.ranks, MASTER['coin-blaster']);
  outcomes.push(resolveGenesisSeal(progression, { tick: 28_800 }).outcome);
  assert.deepEqual(openRunEvolutionOffer(progression).map((choice) => choice.id), ['settler-rail', 'bank-seal']);
  selectRunEvolution(progression, 'settler-rail');
  outcomes.push(resolveGenesisSeal(progression, { tick: 56_400 }).outcome);
  assert.deepEqual(outcomes, ['banked', 'banked', 'panel', 'banked']);
  const row = runProgressionRow(progression, { revivesUsed: fixture.progression.revivesUsed });
  assert.deepEqual([row.sealsFound, row.sealsBanked, row.evolutionsApplied, row.evolutionOffersOpened], [4, 3, 1, 1]);
  const payload = {
    ...fixture,
    evolutions: runEvolutionRows(progression),
    progression: { ...fixture.progression, evolutionOffersOpened: row.evolutionOffersOpened, sealsFound: row.sealsFound, sealsBanked: row.sealsBanked, evolutionsApplied: row.evolutionsApplied },
  };
  assert.equal(validateRunSummaryPayload(payload), '');
  // The ordering the schema relies on: applied <= found <= bosses defeated.
  const tooMany = { ...payload, progression: { ...payload.progression, sealsFound: 5, sealsBanked: 4 } };
  assert.match(validateRunSummaryPayload(tooMany), /Genesis Seals are inconsistent/);
});
