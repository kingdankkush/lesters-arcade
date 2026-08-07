import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LIGHTNING_LEDGER_CONFIG,
  createLightningLedgerState,
  refillLightningLedgerCells,
  resolveLightningLedgerUpgradePolicy,
  selectLightningLedgerChain,
  stepLightningLedger,
} from '../apps/hmh-reboot/src/lightning-ledger.mjs';
import { DeterministicSimulation, FIXED_STEP_MS } from '../apps/hmh-reboot/src/simulation.mjs';
import * as lightningLedger from '../apps/hmh-reboot/src/lightning-ledger.mjs';

test('W8 Lightning Ledger selects a stable bounded eight-jump LOS chain', () => {
  assert.equal(LIGHTNING_LEDGER_CONFIG.maxJumps, 8);
  assert.equal(LIGHTNING_LEDGER_CONFIG.graceTicks, 6);
  assert.equal(LIGHTNING_LEDGER_CONFIG.breakCooldownTicks, 108);
  assert.equal(LIGHTNING_LEDGER_CONFIG.overheatTicks, 180);
  assert.equal(LIGHTNING_LEDGER_CONFIG.cellSegments, 6);
  const targets = Array.from({ length: 10 }, (_, index) => ({ id: `enemy-${String(index).padStart(2, '0')}`, x: 80 + index * 30, y: index % 2 ? 10 : -10, active: true }));
  const chain = selectLightningLedgerChain({
    origin: { x: 0, y: 0 },
    targets: [...targets].reverse(),
    lineOfSight: (_from, to) => to.id !== 'enemy-03',
    policy: resolveLightningLedgerUpgradePolicy({ branches: { conductivity: 3 } }),
  });
  assert.deepEqual(chain.map((target) => target.id), ['enemy-00', 'enemy-01', 'enemy-02', 'enemy-04', 'enemy-05', 'enemy-06', 'enemy-07', 'enemy-08']);
});

test('W8 Lightning Ledger channels, ramps, honors grace, and fails closed into cooldown', () => {
  const state = createLightningLedgerState();
  const target = { id: 'enemy-00', x: 100, y: 0, active: true };
  let frame = stepLightningLedger(state, { tick: 1, fire: true, validPrimary: true, targets: [target] });
  assert.equal(frame.events[0].type, 'ledger:channel-start');
  frame = stepLightningLedger(state, { tick: 61, fire: true, validPrimary: true, targets: [target] });
  assert.equal(frame.events.find((event) => event.type === 'ledger:pulse').rampPermille, 1667);
  frame = stepLightningLedger(state, { tick: 62, fire: true, validPrimary: false, targets: [] });
  assert.equal(frame.status, 'grace');
  frame = stepLightningLedger(state, { tick: 69, fire: true, validPrimary: false, targets: [] });
  assert.equal(frame.events[0].type, 'ledger:channel-break');
  assert.equal(state.cooldownUntilTick, 177);
  assert.equal(stepLightningLedger(state, { tick: 100, fire: true, validPrimary: true, targets: [target] }).events.length, 0);
});

test('W8 Lightning Ledger overheats at three seconds and stops on dodge, switch, or empty cells', () => {
  const target = { id: 'enemy-00', x: 100, y: 0, active: true };
  const state = createLightningLedgerState();
  assert.equal(state.cellsRemaining, 6);
  stepLightningLedger(state, { tick: 0, fire: true, validPrimary: true, targets: [target] });
  const overheated = stepLightningLedger(state, { tick: 180, fire: true, validPrimary: true, targets: [target] });
  assert.equal(overheated.events.at(-1).type, 'ledger:overheat');
  assert.equal(state.cooldownUntilTick, 360);
  for (const reason of ['dodge', 'switch']) {
    const next = createLightningLedgerState();
    stepLightningLedger(next, { tick: 0, fire: true, validPrimary: true, targets: [target] });
    const stopped = stepLightningLedger(next, { tick: 10, fire: true, validPrimary: true, targets: [target], stopReason: reason });
    assert.equal(stopped.events[0].reason, reason);
    assert.equal(next.active, false);
  }

  const lowCells = createLightningLedgerState({ cellsRemaining: 2 });
  stepLightningLedger(lowCells, { tick: 0, fire: true, validPrimary: true, targets: [target] });
  assert.equal(stepLightningLedger(lowCells, { tick: 30, fire: true, validPrimary: true, targets: [target] }).cellsRemaining, 1);
  const empty = stepLightningLedger(lowCells, { tick: 60, fire: true, validPrimary: true, targets: [target] });
  assert.equal(empty.events.at(-1).reason, 'empty');
  assert.equal(empty.status, 'cooldown');
  assert.equal(empty.cellsRemaining, 0);
  assert.equal(refillLightningLedgerCells(lowCells), 6);
});

function runLightningSchedule(renderHz) {
  const state = createLightningLedgerState();
  const targets = [
    { id: 'enemy-a', x: 100, y: 0, active: true },
    { id: 'enemy-b', x: 170, y: 0, active: true },
  ];
  const events = [];
  const simulation = new DeterministicSimulation();
  simulation.onStep(({ tick }) => {
    const frame = stepLightningLedger(state, {
      tick,
      fire: tick <= 150,
      validPrimary: true,
      origin: { x: 0, y: 0 },
      targets,
      lineOfSight: () => true,
    });
    events.push(...frame.events);
  });
  simulation.start();
  while (simulation.tick < 240) {
    const remainingTicks = 240 - simulation.tick;
    simulation.update(Math.min(1000 / renderHz, remainingTicks * FIXED_STEP_MS));
  }
  return { state, events };
}

test('W8 Lightning Ledger authority is identical across 60, 30, and 20 Hz render partitions', () => {
  const results = [60, 30, 20].map(runLightningSchedule);
  assert.deepEqual(results[1], results[0]);
  assert.deepEqual(results[2], results[0]);
  assert.ok(results[0].events.filter((event) => event.type === 'ledger:pulse').length >= 2);
});

test('W8 Lightning Ledger rejects duplicate IDs and malformed active targets', () => {
  const origin = { x: 0, y: 0 };
  assert.throws(() => selectLightningLedgerChain({ origin, targets: [
    { id: 'duplicate', x: 100, y: 0, active: true },
    { id: 'duplicate', x: 140, y: 0, active: true },
  ] }), /duplicate/i);
  assert.throws(() => selectLightningLedgerChain({ origin, targets: [{ id: '', x: 100, y: 0, active: true }] }), /target/i);
  assert.throws(() => selectLightningLedgerChain({ origin, targets: [{ id: 'bad', x: Number.NaN, y: 0, active: true }] }), /finite/i);
});

test('W8 Lightning Ledger honors exact primary and jump range boundaries plus blocked links', () => {
  const origin = { x: 0, y: 0 };
  const targets = [
    { id: 'primary-edge', x: 900, y: 0, active: true },
    { id: 'jump-edge', x: 1320, y: 0, active: true },
    { id: 'outside-jump', x: 1741, y: 0, active: true },
  ];
  assert.deepEqual(selectLightningLedgerChain({ origin, targets }).map(({ id }) => id), ['primary-edge', 'jump-edge']);
  assert.deepEqual(selectLightningLedgerChain({ origin, targets, lineOfSight: (_from, to) => to.id !== 'primary-edge' }), []);
  assert.deepEqual(selectLightningLedgerChain({ origin, targets, lineOfSight: (_from, to) => to.id !== 'jump-edge' }).map(({ id }) => id), ['primary-edge']);
});

test('W8 Lightning Ledger grace and overheat boundaries are exact', () => {
  const target = { id: 'enemy', x: 100, y: 0, active: true };
  const grace = createLightningLedgerState();
  stepLightningLedger(grace, { tick: 0, fire: true, validPrimary: true, targets: [target] });
  assert.equal(stepLightningLedger(grace, { tick: 6, fire: true, validPrimary: false }).status, 'grace');
  const broken = stepLightningLedger(grace, { tick: 7, fire: true, validPrimary: false });
  assert.equal(broken.events.at(-1).reason, 'invalid-target');

  const heat = createLightningLedgerState();
  stepLightningLedger(heat, { tick: 0, fire: true, validPrimary: true, targets: [target] });
  assert.notEqual(stepLightningLedger(heat, { tick: 179, fire: true, validPrimary: true, targets: [target] }).events.at(-1)?.type, 'ledger:overheat');
  assert.equal(stepLightningLedger(heat, { tick: 180, fire: true, validPrimary: true, targets: [target] }).events.at(-1).type, 'ledger:overheat');
});

test('W8 Lightning Ledger reset clears channel history and permits a clean restart', () => {
  const target = { id: 'enemy', x: 100, y: 0, active: true };
  const state = createLightningLedgerState();
  stepLightningLedger(state, { tick: 0, fire: true, validPrimary: true, targets: [target] });
  stepLightningLedger(state, { tick: 30, fire: true, validPrimary: true, targets: [target] });
  const reset = lightningLedger.resetLightningLedgerState(state);
  assert.deepEqual(reset, createLightningLedgerState());
  const restarted = stepLightningLedger(state, { tick: 0, fire: true, validPrimary: true, targets: [target] });
  assert.equal(restarted.events[0].type, 'ledger:channel-start');
  assert.equal(restarted.cellsRemaining, 6);
});
