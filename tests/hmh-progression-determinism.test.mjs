// Progression release (design package S1.3) same-seed check. A headless run of
// the real kernel, main.mjs's real offer and re-roll code, run progression
// (card 2, the focus gun, re-rolls, the v7 counters), the weapon loadout with
// the four gun trees (Magazine & Salvage credit, the Railgun's charge speed),
// the Launcher's shells through the grenade system, and the run-summary
// accumulator. Two runs of one seed give one evidence digest for every render
// partition; another seed differs. Re-rolls happen while the kernel is frozen
// in the level-up panel, so they can never move a tick.
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
  creditWeaponKills,
  grantWeaponPickup,
  progressionByWeapon,
  stepWeaponLoadout,
  switchWeapon,
  weaponIdsWithAmmo,
} from '../apps/hmh-reboot/src/weapon-system.mjs';
import { createGrenadeSystem, stepGrenadeSystem, throwGrenade } from '../apps/hmh-reboot/src/grenades.mjs';
import { seededUnit } from '../apps/hmh-reboot/src/deterministic-hash.mjs';
import {
  createRunSummaryAccumulator,
  finalizeRunSummary,
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

const RUN_TICKS = 3_600;
const PICKUPS = Object.freeze({ 200: 'scatter-shotgun', 900: 'hash-rail', 1_500: 'launcher-rig', 2_400: 'auto-miner' });
const FLAT = Object.freeze({ groundZ: 0, surfaceId: 'flat' });

function headlessRun({ seed, partition }) {
  const simulation = new DeterministicSimulation({ seed, maxFrameDeltaMs: 100 });
  const loadout = createWeaponLoadout({ weaponIds: HMH_WEAPON_ORDER, activeWeaponId: 'coin-blaster', seed });
  const grenades = createGrenadeSystem({ capacity: 16 });
  const painted = [];
  const context = vm.createContext({
    upgradePending: false,
    pendingUpgradeOfferPaint: null,
    progressionPilotEnabled: false,
    simulation,
    runProgression: createRunProgression({ seed }),
    runSummaryAccumulator: createRunSummaryAccumulator({ seed, buildHash: 'site-1.9.0:game-1.9.0', mode: 'ranked', heroId: 'lit-commando', startPosition: { x: 0, y: 0 } }),
    getRunProgressionSnapshot,
    openRunUpgradeOffer,
    rerollRunUpgradeSlot,
    weaponIdsWithAmmo,
    weaponLoadout: loadout,
    V6_UPGRADE_IDS: new Set(HMH_RUN_SUMMARY_CATALOGS.upgrades),
    recordRunUpgradeOffer,
    combatAudio: { pause() {}, play() {} },
    upgradePanel: { showUpgrade: (snapshot, options) => painted.push([snapshot.pendingChoices.map((choice) => choice.id).join('|'), options?.rerolledSlot ?? null]) },
  });
  for (const name of ['recordV6UpgradeOffer', 'openLevelOffer', 'openPendingUpgradeOffer', 'presentUpgradeOffer', 'applyUpgradeReroll']) {
    context[name] = vm.runInContext(`(${declaratorInit(name)})`, context);
  }
  const offers = [];
  let kills = 0;
  let salvagedRounds = 0;
  simulation.onStep(({ tick }) => {
    const progression = context.runProgression;
    const byWeapon = progressionByWeapon(progression.ranks);
    if (PICKUPS[tick]) {
      const weaponId = PICKUPS[tick];
      grantWeaponPickup(loadout, { tick, weaponId, select: 'if-new', progressionByWeapon: byWeapon });
      unlockRunProgressionWeapon(progression, weaponId);
      recordRunWeaponEvent(context.runSummaryAccumulator, { type: 'pickup', weaponId });
    }
    // A manual swap every 400 ticks moves the focus gun (the Pistol never).
    if (tick % 400 === 0) {
      const owned = HMH_WEAPON_ORDER.filter((id) => loadout.weapons[id].owned && id !== loadout.activeWeaponId);
      const pick = owned[Math.floor(seededUnit(seed, `swap:${tick}`) * owned.length)];
      if (pick && switchWeapon(loadout, pick, { tick })) setRunUpgradeFocus(progression, pick);
    }
    const angle = seededUnit(seed, `aim:${tick}`) * Math.PI * 2;
    const frame = stepWeaponLoadout(loadout, {
      tick, fire: true, releaseCharged: true, direction: { x: Math.cos(angle), y: Math.sin(angle) }, progressionByWeapon: byWeapon,
    });
    for (const event of frame.events) {
      if (event.type !== 'weapon:fire' || event.weaponId !== 'launcher-rig') continue;
      for (const shot of event.shots) throwGrenade(grenades, { tick, mode: 'launcher', origin: { x: 0, y: 0, z: 32 }, direction: shot.direction, damage: shot.damage, blastRadius: shot.blastRadius });
    }
    stepGrenadeSystem(grenades, { tick, queryGround: () => FLAT });
    recordRunTick(context.runSummaryAccumulator, { tick, position: { x: tick % 97, y: tick % 89 }, activeWeaponId: loadout.activeWeaponId, districtId: 'frontier-relay', level: progression.level });
    // A deterministic kill cadence; each kill is credited to the held gun.
    if (tick % 12 === 0) {
      kills += 1;
      const snapshot = recordRunDefeat(progression, { enemyId: `enemy-${kills}`, threatCost: 4 + (kills % 9), tick });
      salvagedRounds += creditWeaponKills(loadout, { tick, weaponId: loadout.activeWeaponId, count: 1, progressionByWeapon: byWeapon })?.rounds ?? 0;
      if (snapshot.pendingLevels > 0) context.upgradePending = true;
    }
    context.openPendingUpgradeOffer(tick);
  });
  simulation.start();
  // The player re-rolls by a seeded rule, then takes a seeded card, while the
  // kernel is frozen; the next pending level opens as its own offer.
  const resolveOffers = () => {
    context.presentUpgradeOffer();
    while (simulation.state === 'upgrade') {
      const progression = context.runProgression;
      for (const slot of [1, 0]) {
        if (seededUnit(seed, `reroll:${progression.selectionSequence}:${slot}`) < 0.45) context.applyUpgradeReroll(slot);
      }
      const { pendingChoices } = getRunProgressionSnapshot(progression);
      offers.push(`${simulation.tick}:${pendingChoices.map((choice) => `${choice.id}@${choice.weaponId ?? '-'}`).join('|')}`);
      const pick = pendingChoices[Math.floor(seededUnit(seed, `pick:${progression.selectionSequence}`) * pendingChoices.length)];
      const selection = selectRunUpgrade(progression, pick.id);
      if (context.V6_UPGRADE_IDS.has(pick.id)) recordRunUpgradeSelection(context.runSummaryAccumulator, pick.id);
      if (!(selection.snapshot.pendingLevels > 0 && context.openLevelOffer())) simulation.leaveUpgrade();
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
    summary, offers, painted, salvagedRounds,
    upgrades: runUpgradeRows(progression), progression: runProgressionRow(progression), ranks: progression.ranks, focus: progression.focusWeaponId,
    loadout: { active: loadout.activeWeaponId, sequence: loadout.sequence, weapons: loadout.weapons },
    grenades: { sequence: grenades.sequence, active: grenades.active },
  });
  return { digest: createHash('sha256').update(evidence).digest('hex'), offers, progression, loadout, salvagedRounds };
}

test('two runs of one seed give one digest, and the run really re-rolls, focuses guns and salvages', () => {
  const first = headlessRun({ seed: 0x5eed, partition: 1 });
  assert.equal(headlessRun({ seed: 0x5eed, partition: 1 }).digest, first.digest);
  assert.ok(first.progression.offersOpened >= 15, `several offers (${first.progression.offersOpened})`);
  assert.ok(first.progression.rerolls >= 5, `re-rolls happen (${first.progression.rerolls})`);
  assert.ok(first.offers.some((offer) => /@scatter-shotgun/.test(offer)) && first.offers.some((offer) => /@hash-rail/.test(offer)), 'card 2 follows the guns');
  assert.ok(first.salvagedRounds > 0, `salvage refunds rounds (${first.salvagedRounds})`);
  assert.notEqual(headlessRun({ seed: 0x5eee, partition: 1 }).digest, first.digest, 'a different seed changes the evidence');
});

test('the digest is independent of the render partition, catch-up included', () => {
  const reference = headlessRun({ seed: 2_024, partition: 1 }).digest;
  for (const partition of [2, 3, 4, { seed: 5 }, { seed: 77 }]) {
    assert.equal(headlessRun({ seed: 2_024, partition }).digest, reference, `partition ${JSON.stringify(partition)}`);
  }
});
