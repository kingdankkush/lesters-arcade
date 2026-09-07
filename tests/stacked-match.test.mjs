import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStackedRuntime } from '../apps/portal/src/stacked-sim.mjs';
import { createStackedMatch } from '../apps/portal/src/stacked-match.mjs';
import { STACKED_ATTACK_TABLE } from '../apps/portal/src/stacked-versus-table.mjs';

const config = Object.freeze({ startLevel: 1, buildHash: 'stacked-match-test', seasonId: 'stacked-season-preview-1' });
const PERFECT_CLEAR_PATH = Object.freeze([
  ['S', 0, 5], ['T', 1, 3], ['J', 0, 0], ['O', 0, 7], ['Z', 0, 0],
  ['L', 3, 2], ['I', 0, 0], ['Z', 0, 4], ['L', 3, 6], ['O', 0, 7],
].map(Object.freeze));

const stepPlayer = (match, player, mask) => {
  const inputs = Uint8Array.of(0, 0);
  inputs[player] = mask;
  match.stepAll(inputs);
};

const edgePlayer = (match, player, mask) => {
  stepPlayer(match, player, mask);
  if (!match.terminal) stepPlayer(match, player, 0);
};

const hardDropPlayerAt = (match, player, [expectedKind, rotation, targetX]) => {
  assert.equal(match.snapshot().boards[player].active.kind, expectedKind);
  for (let turn = 0; turn < rotation; turn += 1) edgePlayer(match, player, 16);
  while (match.snapshot().boards[player].active.x !== targetX) {
    edgePlayer(match, player, match.snapshot().boards[player].active.x < targetX ? 2 : 1);
  }
  edgePlayer(match, player, 8);
};

const perfectClearAttackTable = (overrides = {}) => ({
  ...STACKED_ATTACK_TABLE,
  base: [0, 0, 0, 0, 0],
  spin: { full: [0, 0, 0, 0, 0], mini: [0, 0, 0, 0, 0] },
  backToBack: 0,
  combo: Array(13).fill(0),
  perfectClear: 24,
  chargeTicks: 0,
  maxRowsPerLock: 8,
  queuePressureThreshold: 20,
  ...overrides,
});

test('one-board match is transparent to the direct runtime for every fixed step', () => {
  const masks = Uint8Array.from({ length: 500 }, (_, tick) => tick % 29 === 0 ? 8 : tick % 13 === 0 ? 16 : tick % 7 === 0 ? 1 : 0);
  const direct = createStackedRuntime({ seed: 77, maxTicks: masks.length, config });
  const match = createStackedMatch({ seed: 77, playerConfigs: [{ ...config, maxTicks: masks.length }], attackTable: null });
  for (const mask of masks) {
    if (direct.terminal) break;
    direct.step(mask);
    match.stepAll(Uint8Array.of(mask));
    assert.equal(match.stateHash(), direct.stateHash());
    assert.deepEqual(match.snapshot().boards[0], direct.snapshot());
  }
  assert.deepEqual(match.result(), direct.result());
  assert.ok(Object.isFrozen(match));
});

test('stepAll consumes distinct per-tick bytes and batching does not reuse a frame snapshot', () => {
  const stream = Uint8Array.from([8, 8, 0, 8, 0, 16, 0, 8]);
  const one = createStackedMatch({ seed: 91, playerConfigs: [{ ...config, maxTicks: 100 }], attackTable: null });
  const batched = createStackedMatch({ seed: 91, playerConfigs: [{ ...config, maxTicks: 100 }], attackTable: null });
  for (const mask of stream) one.stepAll(Uint8Array.of(mask));
  for (let index = 0; index < stream.length; index += 4) {
    for (const mask of stream.slice(index, index + 4)) batched.stepAll(Uint8Array.of(mask));
  }
  assert.equal(batched.stateHash(), one.stateHash());
  assert.deepEqual(batched.snapshot(), one.snapshot());
  assert.equal(one.snapshot().boards[0].piecesLocked, 3, 'held hard-drop bit fires only on distinct rising edges');

  const incorrectlyReused = createStackedMatch({ seed: 91, playerConfigs: [{ ...config, maxTicks: 100 }], attackTable: null });
  for (let index = 0; index < stream.length; index += 4) {
    const staleFrameMask = stream[index];
    for (let catchUp = 0; catchUp < Math.min(4, stream.length - index); catchUp += 1) incorrectlyReused.stepAll(Uint8Array.of(staleFrameMask));
  }
  assert.notEqual(incorrectlyReused.stateHash(), one.stateHash(), 'reusing one frame snapshot across catch-up steps must diverge');
});

test('an injected attack table drives the match-owned garbage router without an app import', () => {
  const table = Object.freeze({
    ...STACKED_ATTACK_TABLE,
    base: Object.freeze([0, 1, 1, 2, 4]),
  });
  const match = createStackedMatch({
    seed: 20260906,
    playerConfigs: [{ ...config, maxTicks: 1000 }, { ...config, maxTicks: 1000 }],
    attackTable: table,
  });
  const clearMasks = [1,0,1,0,1,0,8,0,8,0,16,0,2,0,2,0,8,0,16,0,16,0,1,0,1,0,1,0,8,0,2,0,2,0,2,0,2,0,8,0,8,0];
  for (const mask of clearMasks) match.stepAll(Uint8Array.of(mask, 0));
  const snap = match.snapshot();
  assert.equal(snap.boards[0].lines, 1);
  assert.equal(snap.pendingAttacks[1].length, 1);
  assert.equal(snap.pendingAttacks[1][0].rows, 1);
  assert.equal(snap.pendingAttacks[1][0].holeColumns.length, 1);
  assert.equal(snap.pendingAttacks[1][0].chargeReadyTick, 102, 'tick 41 send becomes eligible at 41 + 1 + 60');
  assert.equal(snap.garbageRngCount, 1);
});

test('simultaneous sends are both delivered on T + 1 + chargeTicks', () => {
  const table = Object.freeze({ ...STACKED_ATTACK_TABLE, base: Object.freeze([0, 1, 1, 2, 4]) });
  const match = createStackedMatch({
    seed: 20260906,
    playerConfigs: [{ ...config, maxTicks: 1000 }, { ...config, maxTicks: 1000 }],
    attackTable: table,
  });
  const clearMasks = [1,0,1,0,1,0,8,0,8,0,16,0,2,0,2,0,8,0,16,0,16,0,1,0,1,0,1,0,8,0,2,0,2,0,2,0,2,0,8,0,8,0];
  for (const mask of clearMasks) match.stepAll(Uint8Array.of(mask, mask));
  const snap = match.snapshot();
  assert.equal(snap.pendingAttacks[0][0].chargeReadyTick, 102);
  assert.equal(snap.pendingAttacks[1][0].chargeReadyTick, 102);
  assert.equal(snap.pendingAttacks[0][0].holeColumns.length, 1);
  assert.equal(snap.pendingAttacks[1][0].holeColumns.length, 1);
  assert.ok(snap.garbageRngCount >= 2, 'both sends draw in player-slot order');
});

test('charged attacks rise on a no-clear lock up to maxRowsPerLock and retain the remainder', () => {
  const table = {
    ...STACKED_ATTACK_TABLE,
    base: [0, 12, 1, 2, 4],
    maxRowsPerLock: 8,
  };
  const match = createStackedMatch({
    seed: 20260906,
    playerConfigs: [{ ...config, maxTicks: 1000 }, { ...config, maxTicks: 1000 }],
    attackTable: table,
  });
  table.base[1] = 99;
  const clearMasks = [1,0,1,0,1,0,8,0,8,0,16,0,2,0,2,0,8,0,16,0,16,0,1,0,1,0,1,0,8,0,2,0,2,0,2,0,2,0,8,0,8,0];
  for (const mask of clearMasks) match.stepAll(Uint8Array.of(mask, 0));
  while (match.snapshot().tick < 103) match.stepAll(Uint8Array.of(0, 0));
  match.stepAll(Uint8Array.of(0, 8));
  const snap = match.snapshot();
  assert.equal(snap.boards[1].piecesLocked, 1);
  assert.equal(snap.boards[1].garbageRowsReceived, 8);
  assert.equal(snap.pendingAttacks[1][0].rows, 4);
  assert.equal(snap.pendingAttacks[1][0].holeColumns.length, 4);
  assert.equal(snap.boards[1].board.slice(0, 80).filter((cell) => cell === 8).length, 72);
});

test('charge boundary excludes an early lock and includes the exact ready tick', () => {
  const table = { ...STACKED_ATTACK_TABLE, base: [0, 2, 1, 2, 4], chargeTicks: 5 };
  const match = createStackedMatch({
    seed: 20260906,
    playerConfigs: [{ ...config, maxTicks: 1000 }, { ...config, maxTicks: 1000 }],
    attackTable: table,
  });
  const clearMasks = [1,0,1,0,1,0,8,0,8,0,16,0,2,0,2,0,8,0,16,0,16,0,1,0,1,0,1,0,8,0,2,0,2,0,2,0,2,0,8,0,8,0];
  for (const mask of clearMasks) match.stepAll(Uint8Array.of(mask, 0));
  const readyTick = match.snapshot().pendingAttacks[1][0].chargeReadyTick;
  assert.equal(readyTick, 47);

  edgePlayer(match, 1, 8);
  assert.equal(match.snapshot().boards[1].garbageRowsReceived, 0);
  assert.equal(match.snapshot().pendingAttacks[1][0].rows, 2);

  while (match.snapshot().tick < readyTick - 1) match.stepAll(Uint8Array.of(0, 0));
  stepPlayer(match, 1, 8);
  assert.equal(match.snapshot().tick, readyTick);
  assert.equal(match.snapshot().boards[1].garbageRowsReceived, 2);
  assert.deepEqual(match.snapshot().pendingAttacks[1], []);
});

test('queue pressure above twenty forces a capped rise through a clearing lock', () => {
  const match = createStackedMatch({
    seed: 12,
    playerConfigs: [{ ...config, maxTicks: 2000 }, { ...config, maxTicks: 2000 }],
    attackTable: perfectClearAttackTable(),
  });
  for (const placement of PERFECT_CLEAR_PATH.slice(0, 5)) hardDropPlayerAt(match, 1, placement);
  for (const placement of PERFECT_CLEAR_PATH) hardDropPlayerAt(match, 0, placement);
  assert.equal(match.snapshot().pendingAttacks[1][0].rows, 24);

  hardDropPlayerAt(match, 1, PERFECT_CLEAR_PATH[5]);
  const snap = match.snapshot();
  assert.equal(snap.boards[1].lines, 1, 'the delivery lock cleared a line');
  assert.equal(snap.boards[1].garbageRowsReceived, 8);
  assert.equal(snap.pendingAttacks[1][0].rows, 16);
  assert.equal(snap.pendingAttacks[1][0].holeColumns.length, 16);
});

test('oldest charged row cancels first and later rows retain order through delivery', () => {
  const match = createStackedMatch({
    seed: 12,
    playerConfigs: [{ ...config, maxTicks: 2000 }, { ...config, maxTicks: 2000 }],
    attackTable: perfectClearAttackTable({
      base: [0, 1, 1, 1, 1],
      spin: { full: [0, 1, 1, 1, 1], mini: [0, 1, 1, 1, 1] },
      perfectClear: 1,
    }),
  });
  for (const placement of PERFECT_CLEAR_PATH.slice(0, 5)) hardDropPlayerAt(match, 1, placement);
  for (const placement of PERFECT_CLEAR_PATH) hardDropPlayerAt(match, 0, placement);
  const queued = match.snapshot().pendingAttacks[1];
  assert.deepEqual(queued.map((entry) => entry.holeColumns[0]), [6, 6, 4]);

  hardDropPlayerAt(match, 1, PERFECT_CLEAR_PATH[5]);
  assert.deepEqual(match.snapshot().pendingAttacks[1].map((entry) => entry.holeColumns[0]), [6, 4]);
  assert.equal(match.snapshot().boards[1].garbageRowsReceived, 0, 'a normal clear defers sub-threshold charged rows');

  hardDropPlayerAt(match, 1, PERFECT_CLEAR_PATH[6]);
  const snap = match.snapshot();
  assert.deepEqual(snap.pendingAttacks[1], []);
  assert.equal(snap.boards[1].garbageRowsReceived, 2);
  assert.deepEqual(snap.boards[1].board.slice(0, 20).filter((cell) => cell === 0), [0, 0]);
  assert.equal(snap.boards[1].board[4], 0, 'newest delivered row retains its hole');
  assert.equal(snap.boards[1].board[10 + 6], 0, 'oldest surviving row is delivered first');
});

test('production lock-path garbage-out freezes a canonical result and retains unapplied overflow rows', () => {
  const match = createStackedMatch({
    seed: 12,
    playerConfigs: [{ ...config, maxTicks: 2000 }, { ...config, maxTicks: 2000 }],
    attackTable: perfectClearAttackTable({ maxRowsPerLock: 24 }),
  });
  for (const placement of PERFECT_CLEAR_PATH.slice(0, 5)) hardDropPlayerAt(match, 1, placement);
  for (const placement of PERFECT_CLEAR_PATH) hardDropPlayerAt(match, 0, placement);
  hardDropPlayerAt(match, 1, PERFECT_CLEAR_PATH[5]);

  const snap = match.snapshot();
  const result = match.result();
  assert.equal(match.terminal, true);
  assert.equal(snap.boards[1].terminalReason, 'garbage-out');
  assert.equal(snap.boards[1].garbageRowsReceived, 22);
  assert.equal(snap.pendingAttacks[1][0].rows, 2, 'rows not applied before overflow remain queued');
  assert.equal(result[1].terminalReason, 'garbage-out');
  assert.equal(result[1].ticks, snap.boards[1].tick);
  assert.equal(result[1].lines, snap.boards[1].lines);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result[1]));
  assert.equal(match.result()[1], result[1]);
  assert.throws(() => match.stepAll(Uint8Array.of(0, 0)), /terminal/);
});

test('null attack table keeps the router inert and two boards share an identical piece sequence', () => {
  const match = createStackedMatch({
    seed: 1234,
    playerConfigs: [{ ...config, maxTicks: 100 }, { ...config, maxTicks: 100 }],
    attackTable: null,
  });
  for (let tick = 0; tick < 10; tick += 1) match.stepAll(Uint8Array.of(tick % 2 ? 0 : 8, tick % 2 ? 0 : 8));
  const snap = match.snapshot();
  assert.deepEqual(snap.pendingAttacks, [[], []]);
  assert.deepEqual(snap.boards[0].queue, snap.boards[1].queue);
  assert.deepEqual(snap.boards[0].active, snap.boards[1].active);
  assert.equal(Number.isInteger(match.stateHash()), true);
  assert.ok(match.stateHash() >= 0 && match.stateHash() <= 0xffffffff);
});

test('match validates its fixed shape and throws after terminal', () => {
  assert.throws(() => createStackedMatch({ seed: 1, playerConfigs: [], attackTable: null }), /playerConfigs/);
  assert.throws(() => createStackedMatch({ seed: 1, playerConfigs: [{ ...config }, { ...config }, { ...config }], attackTable: null }), /playerConfigs/);
  assert.throws(() => createStackedMatch({ seed: 1, playerConfigs: [{ ...config }], attackTable: { ...STACKED_ATTACK_TABLE, base: [0, 1] } }), /attackTable\.base/);
  const match = createStackedMatch({ seed: 1, playerConfigs: [{ ...config, maxTicks: 1 }], attackTable: null });
  assert.deepEqual(Object.keys(match), ['stepAll', 'snapshot', 'stateHash', 'result', 'terminal']);
  assert.throws(() => match.stepAll(Uint8Array.of()), /input/);
  match.stepAll(Uint8Array.of(0));
  assert.equal(match.terminal, true);
  assert.throws(() => match.stepAll(Uint8Array.of(0)), /terminal/);
});
