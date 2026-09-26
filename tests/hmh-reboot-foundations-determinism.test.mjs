// Foundations slice (design package S0.2) same-seed evidence check. A headless
// run built from the real kernel, main.mjs's real in-tick offer code, the
// weapon loadout, run progression and the run-summary accumulator produces
// the same evidence digest for two runs of one seed and for every render
// partition, and a projection observer (even a throwing one) cannot move it.
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
  selectRunUpgrade,
  unlockRunProgressionWeapon,
} from '../apps/hmh-reboot/src/run-progression.mjs';
import {
  HMH_WEAPON_ORDER,
  createWeaponLoadout,
  grantWeaponPickup,
  nextOwnedWeaponId,
  progressionByWeapon,
  stepWeaponLoadout,
  switchWeapon,
  weaponIdsWithAmmo,
} from '../apps/hmh-reboot/src/weapon-system.mjs';
import { HMH_RUN_SUMMARY_CATALOGS } from '../sdk/hmh-run-summary-schema.mjs';
import { seededUnit } from '../apps/hmh-reboot/src/deterministic-hash.mjs';
import {
  createRunSummaryAccumulator,
  finalizeRunSummary,
  recordRunKill,
  recordRunTick,
  recordRunUpgradeOffer,
  recordRunUpgradeSelection,
  recordRunWeaponEvent,
  recordRunWeaponFire,
} from '../sdk/hmh-run-summary.mjs';

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

const RUN_TICKS = 1_800;

function headlessRun({ seed, partition, observer = null }) {
  const simulation = new DeterministicSimulation({ seed, maxFrameDeltaMs: 100 });
  const loadout = createWeaponLoadout({ weaponIds: HMH_WEAPON_ORDER, activeWeaponId: HMH_WEAPON_ORDER[0], seed });
  const context = vm.createContext({
    upgradePending: false,
    pendingUpgradeOfferPaint: null,
    progressionPilotEnabled: false,
    simulation,
    runProgression: createRunProgression({ seed }),
    runSummaryAccumulator: createRunSummaryAccumulator({ seed, buildHash: 'site-1.9.0:game-1.9.0', mode: 'ranked', heroId: 'lit-commando', startPosition: { x: 0, y: 0 } }),
    getRunProgressionSnapshot,
    openRunUpgradeOffer,
    weaponIdsWithAmmo,
    weaponLoadout: loadout,
    V6_UPGRADE_IDS: new Set(HMH_RUN_SUMMARY_CATALOGS.upgrades),
    recordRunUpgradeOffer,
    combatAudio: { pause() {}, play() {} },
    upgradePanel: { showUpgrade() {} },
  });
  for (const name of ['recordV6UpgradeOffer', 'openLevelOffer']) context[name] = vm.runInContext(`(${declaratorInit(name)})`, context);
  const openPendingUpgradeOffer = vm.runInContext(`(${declaratorInit('openPendingUpgradeOffer')})`, context);
  const presentUpgradeOffer = vm.runInContext(`(${declaratorInit('presentUpgradeOffer')})`, context);
  const offerTicks = [];
  let kills = 0;
  simulation.onStep(({ tick }) => {
    const ranks = context.runProgression.ranks;
    if (tick === 240 || tick === 900) {
      const weaponId = tick === 240 ? 'scatter-shotgun' : 'hash-rail';
      grantWeaponPickup(loadout, { tick, weaponId, progressionByWeapon: progressionByWeapon(ranks) });
      unlockRunProgressionWeapon(context.runProgression, weaponId);
      recordRunWeaponEvent(context.runSummaryAccumulator, { type: 'pickup', weaponId });
    }
    if (tick % 300 === 0) {
      const next = nextOwnedWeaponId(loadout);
      if (next) switchWeapon(loadout, next, { tick });
    }
    const angle = seededUnit(seed, `aim:${tick}`) * Math.PI * 2;
    const frame = stepWeaponLoadout(loadout, {
      tick,
      fire: true,
      releaseCharged: tick % 90 === 0,
      direction: { x: Math.cos(angle), y: Math.sin(angle) },
      progressionByWeapon: progressionByWeapon(ranks),
    });
    for (const event of frame.events) {
      if (event.type === 'weapon:fire') recordRunWeaponFire(context.runSummaryAccumulator, { weaponId: event.weaponId, emitted: event.shots?.length ?? 0, attackId: event.attackId });
    }
    recordRunTick(context.runSummaryAccumulator, { tick, position: { x: tick % 97, y: tick % 89 }, activeWeaponId: loadout.activeWeaponId, districtId: 'frontier-relay', level: context.runProgression.level });
    // A deterministic kill cadence, several levels over the run.
    if (tick % 45 === 0) {
      kills += 1;
      const snapshot = recordRunDefeat(context.runProgression, { enemyId: `enemy-${kills}`, threatCost: 2 + (kills % 5), tick });
      recordRunKill(context.runSummaryAccumulator, { enemyRoleId: 'bagholder-rusher', weaponId: loadout.activeWeaponId });
      if (snapshot.pendingLevels > 0) context.upgradePending = true;
    }
    if (openPendingUpgradeOffer(tick)) offerTicks.push(tick);
  });
  if (observer) simulation.onProjectionStep(observer);
  simulation.start();
  // The player always takes the card the seed prefers, immediately.
  const resolveOffers = () => {
    presentUpgradeOffer();
    while (simulation.state === 'upgrade') {
      const { pendingChoices } = getRunProgressionSnapshot(context.runProgression);
      const pick = pendingChoices[Math.floor(seededUnit(seed, `pick:${simulation.tick}:${context.runProgression.selectionSequence}`) * pendingChoices.length)];
      const selection = selectRunUpgrade(context.runProgression, pick.id);
      // As main's applySelectedUpgrade: the v6 summary names the v6 cards only.
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
  const snapshot = getRunProgressionSnapshot(context.runProgression);
  const summary = finalizeRunSummary(context.runSummaryAccumulator, {
    endTick: simulation.tick, elapsedMs: simulation.timeMs, terminalReason: 'abandoned',
    score: snapshot.score, level: snapshot.level, xp: snapshot.xp, currentCombo: 0, maxCombo: 0, revealedCells: 0, totalCells: 1,
  });
  const evidence = JSON.stringify({ summary, snapshot, offerTicks, loadout: { active: loadout.activeWeaponId, sequence: loadout.sequence, weapons: loadout.weapons } });
  return { digest: createHash('sha256').update(evidence).digest('hex'), offerTicks, level: snapshot.level };
}

test('two runs of one seed give the same evidence digest, and the run really levels and offers', () => {
  const first = headlessRun({ seed: 0x5eed, partition: 1 });
  const second = headlessRun({ seed: 0x5eed, partition: 1 });
  assert.equal(first.digest, second.digest);
  assert.ok(first.level >= 5, `the fixture reaches several levels (${first.level})`);
  assert.ok(first.offerTicks.length >= 4, 'several offers open during the run');
  assert.ok(first.offerTicks.every((tick) => tick % 45 === 0), 'every offer opens on the tick of the kill that levelled');
  assert.notEqual(headlessRun({ seed: 0x5eee, partition: 1 }).digest, first.digest, 'a different seed changes the evidence');
});

test('the evidence digest is independent of the render partition, catch-up included', () => {
  const reference = headlessRun({ seed: 1234, partition: 1 }).digest;
  for (const partition of [2, 3, 4, { seed: 7 }, { seed: 99 }]) {
    assert.equal(headlessRun({ seed: 1234, partition }).digest, reference, `partition ${JSON.stringify(partition)}`);
  }
});

test('projection observers, even faulting ones, never move the evidence digest', () => {
  const reference = headlessRun({ seed: 42, partition: 3 }).digest;
  let observed = 0;
  assert.equal(headlessRun({ seed: 42, partition: 3, observer: () => { observed += 1; } }).digest, reference);
  assert.equal(observed, RUN_TICKS);
  assert.equal(headlessRun({ seed: 42, partition: 3, observer: () => { throw new Error('art fault'); } }).digest, reference);
});
