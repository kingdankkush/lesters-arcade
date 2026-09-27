// Genesis Seal and wave-1 evolutions (design package S1.7, build ledger slice
// 7) same-seed check. A headless run of the real kernel, main.mjs's real Seal
// pickup, evolution panel, level offers, picks and re-rolls (the declarators
// themselves, evaluated from main.mjs), run progression, boss-drops, the
// weapon loadout with the evolved guns (Double Spend volleys, Hashstorm vents,
// Crit Candle's charge rebate), the grenade system and Crypto Bomb Orbit's
// bomblet pool. Seals drop on scripted "defeats" (one per boss id) at the
// arena pedestals and are walked over a little later. Two runs of one seed
// give one evidence digest for every render partition; another seed differs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parse } from 'acorn';

import { FIXED_STEP_MS, DeterministicSimulation } from '../apps/hmh-reboot/src/simulation.mjs';
import {
  createRunProgression,
  getRunProgressionSnapshot,
  openRunUpgradeOffer,
  recordRunDefeat,
  rerollRunUpgradeSlot,
  runProgressionRow,
  runUpgradeRows,
  selectRunUpgrade,
  setRunUpgradeFocus,
  unlockRunProgressionWeapon,
} from '../apps/hmh-reboot/src/run-progression.mjs';
import {
  HMH_WEAPON_ORDER,
  createWeaponLoadout,
  creditCritCandleKills,
  creditWeaponCardPick,
  creditWeaponKills,
  grantWeaponPickup,
  progressionByWeapon,
  refillWeaponLoadout,
  stepWeaponLoadout,
  switchWeapon,
  weaponIdsWithAmmo,
} from '../apps/hmh-reboot/src/weapon-system.mjs';
import {
  BOSS_REWARD_PEDESTALS,
  collectGenesisSeals,
  createBossDrops,
  dropGenesisSeal,
  evolveBankedSealOnMastery,
  openRunEvolutionOffer,
  rerollRunEvolutionSlot,
  resolveGenesisSeal,
  runEvolutionRows,
  selectRunEvolution,
} from '../apps/hmh-reboot/src/boss-drops.mjs';
import { createBombletPool, spawnBomblets, stepBomblets, ventRingHits } from '../apps/hmh-reboot/src/evolution-effects.mjs';
import { runUpgradeContent } from '../apps/hmh-reboot/src/progression-content.mjs';
import { createGrenadeSystem, stepGrenadeSystem, throwGrenade } from '../apps/hmh-reboot/src/grenades.mjs';
import { createPlayerDefeatController } from '../apps/hmh-reboot/src/combat-lifecycle.mjs';
import { seededUnit } from '../apps/hmh-reboot/src/deterministic-hash.mjs';
import {
  createRunSummaryAccumulator,
  finalizeRunSummary,
  recordRunBombletDetonation,
  recordRunGrenadeDetonation,
  recordRunKill,
  recordRunTick,
  recordRunUpgradeOffer,
  recordRunUpgradeSelection,
  recordRunWeaponEvent,
} from '../sdk/hmh-run-summary.mjs';
import { HMH_RUN_SUMMARY_CATALOGS } from '../sdk/hmh-run-summary-schema.mjs';

const mainSource = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
const mainAst = parse(mainSource, { sourceType: 'module', ecmaVersion: 'latest' });
function declaratorInit(name) {
  let found = null;
  (function walk(node) {
    if (found || !node || typeof node !== 'object') return;
    if (node.type === 'VariableDeclarator' && node.id?.name === name) { found = node.init; return; }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object') walk(value);
    }
  })(mainAst);
  assert.ok(found, `main.mjs declares ${name}`);
  return mainSource.slice(found.start, found.end);
}

const RUN_TICKS = 7_200;
// Launcher, Railgun, then the Shotgun: the Shotgun is the focus gun first.
const PICKUPS = Object.freeze({ 150: 'launcher-rig', 300: 'hash-rail', 450: 'scatter-shotgun' });
// Scripted first defeats, each dropping its boss's Seal on a pedestal.
const DEFEATS = Object.freeze({ 1_200: ['rug-pull-baron', 'margin-floor'], 3_900: ['lockkeeper', 'dark-pool'], 6_300: ['fifty-one-percent-foreman', 'margin-floor'] });
const WALK_TICKS = 40;
const FLAT = Object.freeze({ groundZ: 0, surfaceId: 'flat' });
const MAIN_DECLARATORS = ['recordV6UpgradeOffer', 'openLevelOffer', 'openEvolutionPanel', 'openPendingUpgradeOffer', 'presentUpgradeOffer', 'applyUpgradeReroll',
  'announceEvolution', 'applyGenesisSealPickup', 'closeUpgradeShell', 'applySelectedEvolution', 'applySelectedUpgrade'];

function headlessRun({ seed, partition }) {
  const simulation = new DeterministicSimulation({ seed, maxFrameDeltaMs: 100 });
  const loadout = createWeaponLoadout({ weaponIds: HMH_WEAPON_ORDER, activeWeaponId: 'coin-blaster', seed });
  const grenades = createGrenadeSystem({ capacity: 16 });
  const bomblets = createBombletPool();
  const drops = createBossDrops();
  const banners = [];
  const painted = [];
  const context = vm.createContext({
    upgradePending: false,
    evolutionPending: false,
    pendingUpgradeOfferPaint: null,
    progressionPilotEnabled: false,
    simulation,
    runProgression: createRunProgression({ seed }),
    runSummaryAccumulator: createRunSummaryAccumulator({ seed, buildHash: 'site-1.9.0:game-1.9.0', mode: 'ranked', heroId: 'lit-commando', startPosition: { x: 0, y: 0 } }),
    getRunProgressionSnapshot, openRunUpgradeOffer, rerollRunUpgradeSlot, selectRunUpgrade, weaponIdsWithAmmo,
    openRunEvolutionOffer, rerollRunEvolutionSlot, selectRunEvolution, evolveBankedSealOnMastery, resolveGenesisSeal, runUpgradeContent,
    weaponLoadout: loadout,
    V6_UPGRADE_IDS: new Set(HMH_RUN_SUMMARY_CATALOGS.upgrades),
    recordRunUpgradeOffer, recordRunUpgradeSelection, creditWeaponCardPick, buildProgressionByWeapon: progressionByWeapon,
    WEAPON_TITLE_BY_ID: { 'scatter-shotgun': 'Shotgun', 'launcher-rig': 'Grenade Launcher', 'hash-rail': 'Railgun', 'coin-blaster': 'Pistol', 'auto-miner': 'Machine Gun' },
    announcePickupEvent: (event, _options, tick) => banners.push(`${tick}:${event.type}:${event.title ?? ''}`),
    pushCombatVisualEvent: () => {},
    setAccessibleCombatStatus: () => {},
    actor: { x: 0, y: 0, groundZ: 0 },
    combatAudio: { pause() {}, play() {}, resume() {} },
    upgradePanel: { showUpgrade: (snapshot, options) => painted.push(`${snapshot.offerKind}:${snapshot.pendingChoices.map((choice) => choice.id).join('|')}:${options?.rerolledSlot ?? '-'}`), hideUpgrade() {} },
    input: null, cockpit: null, dashState: null, grenadeSystem: null, bridge: null,
    maxPlayerHealth: 100, playerHealth: 100, playerDefeatController: null, createPlayerDefeatController, raiseHandGrenadeMaximum: () => {},
    lastLevelUpBeat: null, app: { ticker: { start() {} } }, performance: { now: () => 0 }, statePayload: () => ({}),
  });
  for (const name of MAIN_DECLARATORS) context[name] = vm.runInContext(`(${declaratorInit(name)})`, context);
  const offers = [];
  let kills = 0;
  let volleys = 0;
  let vents = 0;
  let ventHits = 0;
  let bombletHits = 0;
  const pendingWalks = [];
  simulation.onStep(({ tick }) => {
    const progression = context.runProgression;
    const byWeapon = progressionByWeapon(progression.ranks, progression.evolutions);
    if (PICKUPS[tick]) {
      const weaponId = PICKUPS[tick];
      grantWeaponPickup(loadout, { tick, weaponId, select: 'if-new', progressionByWeapon: byWeapon });
      unlockRunProgressionWeapon(progression, weaponId);
      recordRunWeaponEvent(context.runSummaryAccumulator, { type: 'pickup', weaponId });
    }
    // The player cycles the guns by hand every 500 ticks once all three are
    // carried (a manual switch moves the focus gun, as in main.mjs).
    if (tick > 450 && tick % 500 === 0) {
      const cycle = ['scatter-shotgun', 'launcher-rig', 'hash-rail'];
      const next = cycle[(tick / 500) % cycle.length];
      if (switchWeapon(loadout, next, { tick })) setRunUpgradeFocus(progression, next);
    }
    // An ammo haven every 600 ticks keeps the guns fed.
    if (tick % 600 === 0) refillWeaponLoadout(loadout, { tick, progressionByWeapon: byWeapon });
    const angle = seededUnit(seed, `aim:${tick}`) * Math.PI * 2;
    const frame = stepWeaponLoadout(loadout, { tick, fire: true, releaseCharged: true, direction: { x: Math.cos(angle), y: Math.sin(angle) }, progressionByWeapon: byWeapon });
    const ring = [0, 1, 2, 3].map((index) => ({ id: `ring-${index}`, x: Math.cos(index + tick * 0.01) * 90, y: Math.sin(index + tick * 0.01) * 90, radius: 18 }));
    for (const event of frame.events) {
      if (event.type === 'weapon:fire' && event.volley) volleys += 1;
      if (event.type === 'weapon:vent') { vents += 1; ventHits += ventRingHits(event, { origin: { x: 0, y: 0 }, targets: ring }).length; }
      if (event.type !== 'weapon:fire' || event.weaponId !== 'launcher-rig') continue;
      for (const shot of event.shots) throwGrenade(grenades, { tick, mode: 'launcher', origin: { x: 0, y: 0, z: 32 }, direction: shot.direction, damage: shot.damage, blastRadius: shot.blastRadius });
    }
    const grenadeFrame = stepGrenadeSystem(grenades, { tick, queryGround: () => FLAT });
    // The summary records blasts and bomblets as main.mjs does; a bomblet that
    // hits stands in for a kill (credited, like main.mjs, to its hit's weapon).
    for (const detonation of grenadeFrame.detonations) recordRunGrenadeDetonation(context.runSummaryAccumulator, detonation);
    for (const detonation of stepBomblets(bomblets, { tick, targets: ring }).detonations) {
      recordRunBombletDetonation(context.runSummaryAccumulator, detonation);
      bombletHits += detonation.hits.length;
      if (detonation.hits.length) recordRunKill(context.runSummaryAccumulator, { enemyRoleId: 'forkrunner', weaponId: detonation.hits[0].weaponId });
    }
    if (progression.evolutions['launcher-rig']) {
      for (const detonation of grenadeFrame.detonations) spawnBomblets(bomblets, { tick, parentId: detonation.grenadeId, centre: detonation.point, parentDamage: detonation.damage });
    }
    recordRunTick(context.runSummaryAccumulator, { tick, position: { x: tick % 97, y: tick % 89 }, activeWeaponId: loadout.activeWeaponId, districtId: 'frontier-relay', level: progression.level });
    // A kill every 6 ticks, credited to the held gun; every third a crit.
    if (tick % 6 === 0) {
      kills += 1;
      const snapshot = recordRunDefeat(progression, { enemyId: `enemy-${kills}`, threatCost: 4 + (kills % 9), tick });
      creditWeaponKills(loadout, { tick, weaponId: loadout.activeWeaponId, count: 1, progressionByWeapon: byWeapon });
      if (kills % 3 === 0 && loadout.activeWeaponId === 'hash-rail') creditCritCandleKills(loadout, { tick, count: 1, progressionByWeapon: byWeapon });
      if (snapshot.pendingLevels > 0) context.upgradePending = true;
    }
    // Scripted first defeats drop their Seal; the hero walks onto the pedestal.
    if (DEFEATS[tick]) {
      const [bossId, arenaId] = DEFEATS[tick];
      const seal = dropGenesisSeal(drops, { bossId, tick, arenaId });
      if (seal?.first) banners.push(`${tick}:genesis-seal:dropped:`);
      pendingWalks.push({ tick: tick + WALK_TICKS, hero: BOSS_REWARD_PEDESTALS[arenaId] });
    }
    for (const walk of pendingWalks.filter((row) => row.tick === tick)) {
      for (const seal of collectGenesisSeals(drops, { tick, hero: walk.hero })) context.applyGenesisSealPickup(seal, tick);
    }
    context.openPendingUpgradeOffer(tick);
  });
  simulation.start();
  // Picks while the kernel is frozen: seeded re-rolls, card 2 when it is a
  // gun card, the Pistol's cards otherwise; in the evolution panel a seeded
  // choice between the cards (sometimes the bank).
  const resolveOffers = () => {
    context.presentUpgradeOffer();
    while (simulation.state === 'upgrade') {
      const progression = context.runProgression;
      const key = `${progression.selectionSequence}:${progression.evolutionOffersOpened}`;
      if (progression.offer.kind === 'evolution') {
        if (seededUnit(seed, `evo-reroll:${key}`) < 0.5) context.applyUpgradeReroll(1);
        const { pendingChoices } = getRunProgressionSnapshot(progression);
        offers.push(`${simulation.tick}:E:${pendingChoices.map((choice) => choice.id).join('|')}`);
        context.applySelectedUpgrade(pendingChoices[seededUnit(seed, `evo-pick:${key}`) < 0.8 ? 0 : pendingChoices.length - 1].id);
        continue;
      }
      if (seededUnit(seed, `reroll:${key}:0`) < 0.5) context.applyUpgradeReroll(0);
      if (seededUnit(seed, `reroll:${key}:1`) < 0.2) context.applyUpgradeReroll(1);
      const { pendingChoices } = getRunProgressionSnapshot(progression);
      offers.push(`${simulation.tick}:L:${pendingChoices.map((choice) => `${choice.id}@${choice.weaponId ?? '-'}`).join('|')}`);
      const gunCard = pendingChoices.find((choice) => choice.weaponId);
      const pistolCard = pendingChoices.find((choice) => ['proof-of-work', 'hot-wallet', 'block-reward'].includes(choice.id));
      const pick = (gunCard && seededUnit(seed, `pick:${key}`) < 0.7 ? gunCard : pistolCard) ?? pendingChoices[0];
      context.applySelectedUpgrade(pick.id);
    }
  };
  let frameIndex = 0;
  while (simulation.tick < RUN_TICKS) {
    const steps = typeof partition === 'number' ? partition : 1 + Math.floor(seededUnit(partition.seed, `frame:${frameIndex}`) * 4);
    frameIndex += 1;
    simulation.update(FIXED_STEP_MS * Math.min(steps, RUN_TICKS - simulation.tick));
    resolveOffers();
  }
  const progression = context.runProgression;
  const snapshot = getRunProgressionSnapshot(progression);
  const summary = finalizeRunSummary(context.runSummaryAccumulator, {
    endTick: simulation.tick, elapsedMs: simulation.timeMs, terminalReason: 'abandoned',
    score: snapshot.score, level: snapshot.level, xp: snapshot.xp, currentCombo: 0, maxCombo: 0, revealedCells: 0, totalCells: 1,
  });
  const evidence = JSON.stringify({
    summary, offers, painted, banners, volleys, vents, ventHits, bombletHits,
    upgrades: runUpgradeRows(progression), evolutions: runEvolutionRows(progression), progression: runProgressionRow(progression), ranks: progression.ranks, applied: progression.evolutions,
    loadout: { active: loadout.activeWeaponId, sequence: loadout.sequence, weapons: loadout.weapons },
    grenades: { sequence: grenades.sequence, active: grenades.active }, bomblets, drops,
  });
  return { digest: createHash('sha256').update(evidence).digest('hex'), summary, offers, banners, progression, volleys, vents, bombletHits };
}

test('two runs of one seed give one digest; Seals bank, evolve on mastery and open the panel, and the evolved guns fire', () => {
  const first = headlessRun({ seed: 39, partition: 1 });
  assert.equal(headlessRun({ seed: 39, partition: 1 }).digest, first.digest);
  const row = runProgressionRow(first.progression);
  assert.equal(row.sealsFound, 3, 'three Seals, one per boss id');
  assert.ok(row.evolutionsApplied <= row.sealsFound && row.sealsBanked === row.sealsFound - row.evolutionsApplied);
  assert.ok(first.banners.some((banner) => banner.includes('genesis-seal:dropped')), 'the first drop is announced once');
  assert.equal(first.banners.filter((banner) => banner.includes('genesis-seal:dropped')).length, 1);
  assert.ok(first.banners.some((banner) => banner.includes('genesis-seal:banked')), 'a Seal banks');
  assert.ok(first.banners.some((banner) => banner.includes('evolution:applied')), 'a gun evolves');
  assert.ok(row.evolutionsApplied >= 2, `several evolutions (${JSON.stringify(first.progression.evolutions)})`);
  assert.ok(first.offers.some((offer) => offer.includes(':E:')), 'an evolution panel opens');
  assert.ok(first.volleys > 0, `Double Spend fires its volleys (${first.volleys})`);
  assert.ok(first.bombletHits > 0, `bomblets orbit and hit (${first.bombletHits})`);
  // Bomblet kills are grenade kills, and each has its grenade contact
  // (grenade-kills-above-contacts on the v6 and v7 verifier paths); bomblets
  // are never detonations.
  const { grenades } = first.summary;
  assert.ok(grenades.kills > 0, JSON.stringify(grenades));
  assert.ok(grenades.kills <= grenades.contacts, JSON.stringify(grenades));
  assert.equal(grenades.contacts, first.bombletHits, 'the blasts here hit nothing; every contact is a bomblet hit');
  assert.notEqual(headlessRun({ seed: 40, partition: 1 }).digest, first.digest, 'a different seed changes the evidence');
});

test('the digest is independent of the render partition, catch-up included', () => {
  const reference = headlessRun({ seed: 39, partition: 1 }).digest;
  for (const partition of [2, 3, 4, { seed: 5 }, { seed: 77 }]) {
    assert.equal(headlessRun({ seed: 39, partition }).digest, reference, `partition ${JSON.stringify(partition)}`);
  }
});

test('a Seal and a level on the same tick open the evolution panel first; the level offer chains after it', () => {
  const simulation = new DeterministicSimulation({ seed: 3 });
  const progression = createRunProgression({ seed: 3 });
  unlockRunProgressionWeapon(progression, 'scatter-shotgun');
  unlockRunProgressionWeapon(progression, 'hash-rail');
  Object.assign(progression.ranks, { 'scatter-pump': 3, 'scatter-dump': 3, 'scatter-shells': 3, 'rail-blocktime': 3, 'rail-proof': 3, 'rail-mempool': 3 });
  const loadout = createWeaponLoadout({ weaponIds: HMH_WEAPON_ORDER, activeWeaponId: 'coin-blaster', seed: 3 });
  const painted = [];
  let left = 0;
  const context = vm.createContext({
    upgradePending: false, evolutionPending: false, pendingUpgradeOfferPaint: null, progressionPilotEnabled: false,
    simulation: { get state() { return simulation.state; }, get tick() { return 500; }, enterUpgrade: () => simulation.enterUpgrade(), leaveUpgrade: () => { left += 1; simulation.leaveUpgrade(); } },
    runProgression: progression,
    runSummaryAccumulator: createRunSummaryAccumulator({ seed: 3, buildHash: 'site-1.9.0:game-1.9.0', mode: 'ranked', heroId: 'lit-commando', startPosition: { x: 0, y: 0 } }),
    getRunProgressionSnapshot, openRunUpgradeOffer, rerollRunUpgradeSlot, selectRunUpgrade, weaponIdsWithAmmo,
    openRunEvolutionOffer, rerollRunEvolutionSlot, selectRunEvolution, evolveBankedSealOnMastery, resolveGenesisSeal, runUpgradeContent,
    weaponLoadout: loadout, V6_UPGRADE_IDS: new Set(HMH_RUN_SUMMARY_CATALOGS.upgrades),
    recordRunUpgradeOffer, recordRunUpgradeSelection, creditWeaponCardPick, buildProgressionByWeapon: progressionByWeapon,
    WEAPON_TITLE_BY_ID: {}, announcePickupEvent: () => {}, pushCombatVisualEvent: () => {}, setAccessibleCombatStatus: () => {},
    actor: { x: 0, y: 0, groundZ: 0 }, combatAudio: { pause() {}, play() {}, resume() {} },
    upgradePanel: { showUpgrade: (snapshot) => painted.push(snapshot.offerKind), hideUpgrade() {} },
    input: null, cockpit: null, dashState: null, grenadeSystem: null, bridge: null,
    maxPlayerHealth: 100, playerHealth: 100, playerDefeatController: null, createPlayerDefeatController, raiseHandGrenadeMaximum: () => {},
    lastLevelUpBeat: null, app: { ticker: { start() {} } }, performance: { now: () => 0 }, statePayload: () => ({}),
  });
  for (const name of MAIN_DECLARATORS) context[name] = vm.runInContext(`(${declaratorInit(name)})`, context);
  simulation.start();
  // One tick: a kill levels the hero and a Seal is picked up with two mastered guns.
  simulation.onStep(({ tick }) => {
    for (let kill = 0; progression.pendingLevels === 0; kill += 1) recordRunDefeat(progression, { enemyId: `e${kill}`, threatCost: 10, tick });
    context.upgradePending = true;
    assert.equal(context.applyGenesisSealPickup({ id: 'genesis-seal:liquidator' }, tick).outcome, 'panel');
    assert.equal(context.openPendingUpgradeOffer(tick), true);
  });
  simulation.update(FIXED_STEP_MS);
  assert.equal(simulation.state, 'upgrade');
  assert.equal(progression.offer.kind, 'evolution', 'the evolution panel opens first');
  assert.equal(progression.offersOpened, 0, 'no level offer yet');
  context.presentUpgradeOffer();
  context.applySelectedUpgrade(progression.offer.slots[0].id);
  assert.equal(progression.offer?.kind, 'level', 'the level offer chains after the evolution');
  assert.equal(simulation.state, 'upgrade');
  assert.equal(left, 0);
  assert.equal(Object.keys(progression.evolutions).length, 1);
  while (progression.offer) context.applySelectedUpgrade(getRunProgressionSnapshot(progression).pendingChoices[0].id);
  assert.equal(left, 1, 'the shell closes once, after the last level');
  assert.deepEqual(painted.slice(0, 2), ['evolution', 'level']);
});
