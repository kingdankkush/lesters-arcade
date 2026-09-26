// Design package 8.3 timing fix (S0.2). A level-up offer, forced or earned,
// opens at the end of the tick whose XP produced the level, inside that tick.
// Entering the modal upgrade state stops the catch-up loop, so no later tick of
// the same frame runs behind the panel and the offer tick no longer depends on
// how many catch-up steps a frame took. The frame loop only paints the panel.
// The projection-observer hook (package 7.9) is stepped once per tick,
// catch-up included, and can never change or stop the simulation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parse } from 'acorn';
import { FIXED_STEP_MS, MAX_CATCH_UP_STEPS, DeterministicSimulation } from '../apps/hmh-reboot/src/simulation.mjs';
import { createRunProgression, getRunProgressionSnapshot, openRunUpgradeOffer, recordRunDefeat } from '../apps/hmh-reboot/src/run-progression.mjs';
import { HMH_WEAPON_ORDER, createWeaponLoadout, weaponIdsWithAmmo } from '../apps/hmh-reboot/src/weapon-system.mjs';
import { HMH_RUN_SUMMARY_CATALOGS } from '../sdk/hmh-run-summary-schema.mjs';

const mainSource = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
const mainAst = parse(mainSource, { sourceType: 'module', ecmaVersion: 'latest' });

function findAll(root, predicate, found = []) {
  if (!root || typeof root !== 'object') return found;
  if (root.type && predicate(root)) found.push(root);
  for (const value of Object.values(root)) {
    if (Array.isArray(value)) value.forEach((child) => findAll(child, predicate, found));
    else if (value && typeof value === 'object') findAll(value, predicate, found);
  }
  return found;
}

const declaratorNamed = (name) => {
  const [node] = findAll(mainAst, (node) => node.type === 'VariableDeclarator' && node.id.type === 'Identifier' && node.id.name === name);
  assert.ok(node?.init, `main.mjs must declare ${name}`);
  return node.init;
};

function activeSimulation(options = {}) {
  const simulation = new DeterministicSimulation(options);
  simulation.start();
  return simulation;
}

// ---------------------------------------------------------------------------
// The kernel: modal states stop catch-up; the projection observer.
// ---------------------------------------------------------------------------

test('an offer opened inside a tick stops catch-up: steps === 1 with 4 ticks due', () => {
  const simulation = activeSimulation({ maxFrameDeltaMs: 100 });
  const ticks = [];
  simulation.onStep(({ tick }) => {
    ticks.push(tick);
    if (tick === 1) simulation.enterUpgrade();
  });
  const frame = simulation.update(FIXED_STEP_MS * MAX_CATCH_UP_STEPS);
  assert.equal(frame.steps, 1);
  assert.deepEqual(ticks, [1]);
  assert.equal(simulation.state, 'upgrade');
  assert.equal(simulation.update(FIXED_STEP_MS * 4).steps, 0, 'no tick runs behind the panel');
  simulation.leaveUpgrade();
  assert.equal(simulation.update(FIXED_STEP_MS).steps, 1, 'the next frame starts from a fresh accumulator');
  assert.deepEqual(ticks, [1, 2]);
});

test('every modal transition inside a tick ends the catch-up loop on that tick', () => {
  for (const [name, enter] of [
    ['upgrade', (simulation) => simulation.enterUpgrade()],
    ['menu', (simulation) => simulation.enterMenu()],
    ['paused', (simulation) => simulation.pause()],
    ['game-over', (simulation) => simulation.gameOver()],
  ]) {
    const simulation = activeSimulation({ maxFrameDeltaMs: 100 });
    simulation.onStep(({ tick }) => { if (tick === 2) enter(simulation); });
    const replay = [];
    simulation.onReplayEvent(({ tick }) => replay.push(tick));
    assert.equal(simulation.update(FIXED_STEP_MS * 4).steps, 2, name);
    assert.equal(simulation.state, name);
    assert.deepEqual(replay, [1, 2], `${name}: the modal tick itself is still recorded`);
  }
});

test('a tick that enters a modal state ends the batch even with time left in the accumulator', () => {
  // resetAccumulator already empties the batch; the explicit state guard is the
  // contract, so a future transition that forgets to reset still stops here.
  const simulation = activeSimulation({ maxFrameDeltaMs: 100 });
  simulation.onStep(({ tick }) => {
    if (tick !== 1) return;
    simulation.enterUpgrade();
    simulation.accumulatorMs = FIXED_STEP_MS * 3;
  });
  assert.equal(simulation.update(FIXED_STEP_MS * 4).steps, 1);
  assert.equal(simulation.tick, 1);
});

test('projection observers step once per tick, catch-up included, identically across render partitions', () => {
  const run = (stepsPerFrame) => {
    const simulation = activeSimulation({ maxFrameDeltaMs: 100 });
    const records = [];
    let distance = 0;
    simulation.onStep(() => {});
    simulation.onProjectionStep(({ tick }) => {
      distance += tick % 3 === 1 ? 1 : 0;
      records.push(`${tick}:${distance}`);
    });
    for (let tick = 0; tick < 24; tick += stepsPerFrame) simulation.update(FIXED_STEP_MS * stepsPerFrame);
    return records;
  };
  const one = run(1);
  assert.equal(one.length, 24);
  assert.deepEqual(one.slice(0, 4), ['1:1', '2:1', '3:1', '4:2']);
  for (const partition of [2, 3, 4]) assert.deepEqual(run(partition), one, `partition ${partition}`);
});

test('a throwing projection observer never stops or changes the simulation', () => {
  const plain = activeSimulation({ seed: 9, maxFrameDeltaMs: 100 });
  const observed = activeSimulation({ seed: 9, maxFrameDeltaMs: 100 });
  const replayPlain = [];
  const replayObserved = [];
  plain.onReplayEvent((event) => replayPlain.push(event));
  observed.onReplayEvent((event) => replayObserved.push(event));
  let calls = 0;
  const stop = observed.onProjectionStep(() => { calls += 1; throw new Error('art fault'); });
  plain.update(FIXED_STEP_MS * 4, { fire: true });
  observed.update(FIXED_STEP_MS * 4, { fire: true });
  assert.equal(calls, 4);
  assert.deepEqual(replayObserved, replayPlain);
  assert.equal(observed.tick, plain.tick);
  assert.equal(observed.getProjectionFaultCount(), 4);
  stop();
  observed.update(FIXED_STEP_MS);
  assert.equal(calls, 4, 'unsubscribed observers are not stepped');
  assert.throws(() => observed.onProjectionStep(null), /callback/i);
});

// ---------------------------------------------------------------------------
// main.mjs: the real offer code, run against the real kernel and progression.
// ---------------------------------------------------------------------------

function offerHarness({ progressionPilotEnabled = false } = {}) {
  const calls = [];
  const context = {
    upgradePending: false,
    pendingUpgradeOfferPaint: null,
    progressionPilotEnabled,
    simulation: activeSimulation({ seed: 7, maxFrameDeltaMs: 100 }),
    runProgression: createRunProgression({ seed: 7 }),
    runSummaryAccumulator: { offers: [] },
    getRunProgressionSnapshot,
    openRunUpgradeOffer,
    weaponIdsWithAmmo,
    weaponLoadout: createWeaponLoadout({ weaponIds: HMH_WEAPON_ORDER, seed: 7 }),
    V6_UPGRADE_IDS: new Set(HMH_RUN_SUMMARY_CATALOGS.upgrades),
    recordRunUpgradeOffer: (accumulator, ids) => accumulator.offers.push([...ids]),
    combatAudio: {
      pause: () => calls.push(['audio-pause']),
      play: (cue) => calls.push(['audio-play', cue]),
    },
    upgradePanel: { showUpgrade: (snapshot) => calls.push(['show', snapshot.pendingChoices.map((choice) => choice.id)]) },
  };
  vm.createContext(context);
  for (const name of ['recordV6UpgradeOffer', 'openLevelOffer', 'openPendingUpgradeOffer', 'presentUpgradeOffer']) {
    const init = declaratorNamed(name);
    context[name] = vm.runInContext(`(${mainSource.slice(init.start, init.end)})`, context);
  }
  return { context, calls };
}

test('main opens a level offer inside the tick whose XP levelled, and the frame only paints it', () => {
  const { context, calls } = offerHarness();
  const ticks = [];
  context.simulation.onStep(({ tick }) => {
    ticks.push(tick);
    if (tick === 1) {
      const snapshot = recordRunDefeat(context.runProgression, { enemyId: 'whale', threatCost: 20, tick });
      assert.ok(snapshot.pendingLevels > 0, 'the fixture levels up on tick 1');
      context.upgradePending = true;
    }
    context.openPendingUpgradeOffer(tick);
  });
  const frame = context.simulation.update(FIXED_STEP_MS * 4);
  assert.equal(frame.steps, 1, 'catch-up stops on the offer tick');
  assert.deepEqual(ticks, [1]);
  assert.equal(context.simulation.state, 'upgrade');
  assert.equal(context.upgradePending, false);
  const offered = getRunProgressionSnapshot(context.runProgression).pendingChoices.map((choice) => choice.id);
  assert.deepEqual(context.runSummaryAccumulator.offers, [offered], 'the offer is recorded once, on its tick');
  assert.deepEqual(calls, [], 'the tick decides; it does not paint');
  context.presentUpgradeOffer();
  assert.deepEqual(calls, [['audio-pause'], ['show', offered]]);
  context.presentUpgradeOffer();
  assert.equal(calls.length, 2, 'one paint per offer');
  assert.ok(!calls.some(([kind, cue]) => kind === 'audio-play' && cue === 'upgrade-offer'), 'the upgrade-offer cue is gone (owner audio list)');
});

test('an offer never opens on a tick that ended the run', () => {
  const { context } = offerHarness();
  context.simulation.onStep(({ tick }) => {
    recordRunDefeat(context.runProgression, { enemyId: `enemy-${tick}`, threatCost: 20, tick });
    context.upgradePending = true;
    context.simulation.gameOver();
    context.openPendingUpgradeOffer(tick);
  });
  context.simulation.update(FIXED_STEP_MS * 4);
  assert.equal(context.simulation.state, 'game-over');
  assert.deepEqual(context.runSummaryAccumulator.offers, []);
  assert.equal(context.pendingUpgradeOfferPaint, null);
});

test('the forced progression-pilot level opens inside tick 2 whatever the frame partition', () => {
  for (const stepsPerFrame of [1, 2, 3, 4]) {
    const { context } = offerHarness({ progressionPilotEnabled: true });
    recordRunDefeat(context.runProgression, { enemyId: 'evidence-progression-pilot', threatCost: 20, tick: 0 });
    context.upgradePending = true;
    const ticks = [];
    context.simulation.onStep(({ tick }) => { ticks.push(tick); context.openPendingUpgradeOffer(tick); });
    for (let frame = 0; frame < 3 && context.simulation.state === 'active'; frame += 1) {
      context.simulation.update(FIXED_STEP_MS * stepsPerFrame);
    }
    assert.equal(context.simulation.state, 'upgrade', `partition ${stepsPerFrame}`);
    assert.equal(context.simulation.tick, 2, `partition ${stepsPerFrame}: the offer tick is 2`);
    assert.deepEqual(ticks, [1, 2]);
    assert.equal(context.runSummaryAccumulator.offers.length, 1);
  }
});

test('the step callback ends by opening a pending offer, and the frame loop never enters upgrade itself', () => {
  const [onStep] = findAll(mainAst, (node) => node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && node.callee.property.name === 'onStep');
  const body = onStep.arguments[0].body.body;
  const last = body.at(-1);
  assert.equal(mainSource.slice(last.start, last.end), 'openPendingUpgradeOffer(tick);');
  const [ticker] = findAll(mainAst, (node) => node.type === 'CallExpression' && node.callee.type === 'MemberExpression'
    && node.callee.property.name === 'add' && mainSource.slice(node.callee.object.start, node.callee.object.end) === 'app.ticker');
  const tickerSource = mainSource.slice(ticker.start, ticker.end);
  assert.doesNotMatch(tickerSource, /enterUpgrade\(/);
  assert.doesNotMatch(tickerSource, /upgradePending/);
  const update = tickerSource.indexOf('simulation.update(');
  assert.ok(update > 0 && tickerSource.indexOf('presentUpgradeOffer();') > update, 'the frame paints after the ticks run');
  assert.doesNotMatch(mainSource, /play\('upgrade-offer'/);
});
