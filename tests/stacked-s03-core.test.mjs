import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { SeededRng } from '../apps/portal/src/seeded-rng.mjs';
import { STACKED_CABINET_VERSION } from '../apps/portal/src/stacked-cabinet.mjs';
import {
  applyGarbageRows,
  boardHash,
  buildStackedResultTuple,
  canRejectReorg,
  compactCompletedRows,
  cellsFor,
  collides,
  createStackedRuntime,
  evidenceCeilingReached,
  garbageHoleColumn,
  garbageIntervalTicks,
  levelForLines,
  packStackedBoard,
  reorgCost,
  resolveScoringBlock,
  zoneForTick,
} from '../apps/portal/src/stacked-sim.mjs';
import {
  BOARD_ROWS,
  BOARD_WIDTH,
  GARBAGE_INTERVAL_FLOOR_TICKS,
  GARBAGE_INTERVAL_START_TICKS,
  HASHPOWER_MAX,
  STACKED_COMBO_BONUS_CAP,
  STACKED_MAX_EVIDENCE_BYTES,
  STACKED_MAX_INPUT_TRANSITIONS,
  STACKED_MAX_TICKS,
  STACKED_SEASON_ID,
  STACKED_TERMINAL_REASONS,
} from '../apps/portal/src/stacked-contracts.mjs';

const row = (board, y) => Array.from(board.slice(y * BOARD_WIDTH, (y + 1) * BOARD_WIDTH));
const RESULT_FIELDS = Object.freeze([
  'v', 'gameId', 'seed', 'buildHash', 'seasonId', 'ticks', 'pieces', 'lines', 'level', 'score',
  'quadClears', 'spins', 'perfectClears', 'maxCombo', 'maxBackToBack', 'garbageRowsReceived',
  'garbageGroups', 'garbageRowsCleared', 'holdsUsed', 'bagRefills', 'bagDraws', 'garbageDraws',
  'transitionCount', 'boardHash', 'terminalReason',
]);

const PERFECT_CLEAR_PATH = Object.freeze([
  ['S', 0, 5], ['T', 1, 3], ['J', 0, 0], ['O', 0, 7], ['Z', 0, 0],
  ['L', 3, 2], ['I', 0, 0], ['Z', 0, 4], ['L', 3, 6], ['O', 0, 7],
].map(Object.freeze));

const FIRST_SPIN_SETUP = Object.freeze([
  ['S', 0, 0], ['I', 0, 4], ['O', 0, 7], ['Z', 1, 2], ['L', 0, 5], ['J', 1, -1],
].map(Object.freeze));

const SECOND_SPIN_SETUP = Object.freeze([
  ['T', 3, 2], ['Z', 0, 7], ['I', 1, 2], ['O', 0, 4], ['J', 3, 7],
  ['L', 1, -1], ['S', 0, 1], ['Z', 1, 5], ['J', 1, 4], ['O', 0, 1],
  ['I', 0, 5], ['L', 2, 4], ['S', 1, -1],
].map(Object.freeze));

const edge = (runtime, mask) => {
  runtime.step(mask);
  if (!runtime.terminal) runtime.step(0);
};

const hardDropAt = (runtime, [expectedKind, rotation, targetX]) => {
  assert.equal(runtime.snapshot().active.kind, expectedKind);
  for (let turn = 0; turn < rotation; turn += 1) edge(runtime, 16);
  while (runtime.snapshot().active.x !== targetX) {
    edge(runtime, runtime.snapshot().active.x < targetX ? 2 : 1);
  }
  edge(runtime, 8);
};

const softDropTo = (runtime, targetY) => {
  while (runtime.snapshot().active.y > targetY) runtime.step(4);
  runtime.step(0);
};

const waitForCurrentPieceLock = (runtime) => {
  const locked = runtime.snapshot().piecesLocked;
  while (!runtime.terminal && runtime.snapshot().piecesLocked === locked) runtime.step(0);
};

const fnvBytes = (bytes) => {
  let hash = 0x811c9dc5;
  for (const byte of bytes) { hash ^= byte; hash = Math.imul(hash, 0x01000193) >>> 0; }
  return hash >>> 0;
};

const canonicalFreshRuntimeBytes = (snapshot) => {
  const bytes = [];
  const u32 = (value) => { const word = BigInt.asUintN(32, BigInt(value)); for (let i = 0n; i < 4n; i += 1n) bytes.push(Number((word >> (8n * i)) & 255n)); };
  const u64 = (value) => { const word = BigInt.asUintN(64, BigInt(value)); for (let i = 0n; i < 8n; i += 1n) bytes.push(Number((word >> (8n * i)) & 255n)); };
  const pieceId = (kind) => kind === null ? 0 : 'IJLOSTZ'.indexOf(kind) + 1;

  // Historical S-03 prefix, enumerated independently of production serialization.
  u32(snapshot.tick);
  bytes.push(...snapshot.board);
  u32(pieceId(snapshot.active.kind));
  u32(snapshot.active.x); u32(snapshot.active.y); u32(snapshot.gravityAccQ16);
  u32(snapshot.active.rotation); u32(0);
  u32(snapshot.piecesSpawned % 7); u32(snapshot.bagRngCount);
  bytes.push(pieceId(snapshot.hold), snapshot.holdUsed ? 1 : 0);
  for (const hole of snapshot.garbagePending) { u32(1); u32(0); bytes.push(hole); }
  u32(snapshot.garbageRngCount); bytes.push(snapshot.lastGarbageHole < 0 ? 255 : snapshot.lastGarbageHole);
  u32(zoneForTick(snapshot.tick)); u32(snapshot.comboCount); bytes.push(snapshot.chainActive ? 1 : 0);
  u32(snapshot.lines); u64(snapshot.score);

  // SRT2 append-only correction block.
  bytes.push(0x53, 0x52, 0x54, 0x02);
  u32(snapshot.seed); u32(snapshot.startLevel); u32(snapshot.maxTicks);
  u32(snapshot.piecesSpawned); u32(snapshot.piecesLocked); u32(snapshot.bagRefills);
  u32(snapshot.queue.length);
  for (const kind of snapshot.queue) bytes.push(pieceId(kind));
  bytes.push(snapshot.active.lastKickIndex, snapshot.active.lastActionWasRotation ? 1 : 0);
  u32(snapshot.active.lockTimer); u32(snapshot.active.lockResetsUsed); u32(snapshot.active.lowestYReached);
  bytes.push(snapshot.prevMask);
  u32(snapshot.lastHorizontal); u32(snapshot.lastTransitionTick);
  u32(snapshot.holdsUsed); u32(snapshot.softDropCells); u32(snapshot.hardDropCells);
  u32(snapshot.maxCombo); u32(snapshot.backToBackCount); u32(snapshot.maxBackToBack); u32(snapshot.hashpower);
  u32(snapshot.garbageTimerTicks); u32(snapshot.garbagePending.length);
  for (const hole of snapshot.garbagePending) bytes.push(hole);
  u32(snapshot.lastGarbageHole); u32(snapshot.garbageGroups); u32(snapshot.garbageRowsReceived);
  u32(snapshot.garbageRowsCleared); u32(snapshot.reorgsRejected);
  u32(snapshot.quadClears); u32(snapshot.singles); u32(snapshot.doubles); u32(snapshot.triples);
  u32(snapshot.spinsMini); u32(snapshot.spinsFull); u32(snapshot.perfectClears); u32(snapshot.maxStackHeight);
  u32(snapshot.transitionCount); u32(snapshot.encodedEvidenceBytes);
  bytes.push(snapshot.terminalReason === null ? 0 : STACKED_TERMINAL_REASONS.indexOf(snapshot.terminalReason) + 1);
  return bytes;
};

const driveDeterministicLevelCrossing = () => {
  const runtime = createStackedRuntime({ seed: 28, maxTicks: 20_000, config: { startLevel: 1 } });
  const step = (mask) => runtime.step(mask);
  const choose = () => {
    const snap = runtime.snapshot();
    let best = null;
    for (let rotation = 0; rotation < 4; rotation += 1) for (let x = -2; x < BOARD_WIDTH; x += 1) {
      let y = snap.active.y;
      const sourceBoard = Uint8Array.from(snap.board);
      if (collides(sourceBoard, cellsFor(snap.active.kind, rotation, x, y))) continue;
      while (!collides(sourceBoard, cellsFor(snap.active.kind, rotation, x, y - 1))) y -= 1;
      const board = sourceBoard.slice();
      for (const [cellX, cellY] of cellsFor(snap.active.kind, rotation, x, y)) board[cellY * BOARD_WIDTH + cellX] = 1;
      const compacted = compactCompletedRows(board);
      let holes = 0;
      const heights = [];
      for (let cellX = 0; cellX < BOARD_WIDTH; cellX += 1) {
        let seen = false;
        let height = 0;
        for (let cellY = BOARD_ROWS - 1; cellY >= 0; cellY -= 1) {
          if (compacted.board[cellY * BOARD_WIDTH + cellX]) { seen = true; height = Math.max(height, cellY + 1); }
          else if (seen) holes += 1;
        }
        heights.push(height);
      }
      const aggregateHeight = heights.reduce((sum, value) => sum + value, 0);
      const bumpiness = heights.slice(1).reduce((sum, value, index) => sum + Math.abs(value - heights[index]), 0);
      const score = compacted.lines * compacted.lines * 5000 - aggregateHeight * 510 - holes * 356 - bumpiness * 184;
      if (!best || score > best.score) best = { rotation, x, score };
    }
    return best;
  };
  const place = () => {
    const target = choose();
    assert.ok(target, 'deterministic fixture must have a legal placement');
    for (let index = 0; index < target.rotation; index += 1) { step(16); step(0); }
    while (runtime.snapshot().active.x !== target.x) { step(runtime.snapshot().active.x < target.x ? 2 : 1); step(0); }
    step(8); if (!runtime.terminal) step(0);
  };
  while (runtime.snapshot().lines < 9) place();
  while (runtime.snapshot().garbagePending.length === 0) step(0);
  const before = runtime.snapshot();
  place();
  return { before, after: runtime.snapshot() };
};

test('completed rows compact naively, preserve order, and count cleared garbage rows', () => {
  const board = new Uint8Array(BOARD_WIDTH * BOARD_ROWS);
  board.fill(1, 0, BOARD_WIDTH);
  board[3] = 8;
  board[BOARD_WIDTH + 2] = 4;
  board[2 * BOARD_WIDTH + 7] = 6;
  board.fill(3, 3 * BOARD_WIDTH, 4 * BOARD_WIDTH);

  const result = compactCompletedRows(board);
  assert.deepEqual(result.fullRows, [0, 3]);
  assert.equal(result.lines, 2);
  assert.equal(result.garbageRowsCleared, 1);
  assert.deepEqual(row(result.board, 0), [0, 0, 4, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(row(result.board, 1), [0, 0, 0, 0, 0, 0, 0, 6, 0, 0]);
  assert.ok(row(result.board, BOARD_ROWS - 1).every((value) => value === 0));
  assert.equal(board[0], 1, 'input board is not mutated');
});

test('scoring table, replacement rules, integer order, cap, and no score clamp are exact', () => {
  const cases = [
    [{ lines: 1, spinKind: 'none', chainActive: false, comboCount: -1, level: 1 }, 100],
    [{ lines: 2, spinKind: 'none', chainActive: false, comboCount: 0, level: 2 }, 700],
    [{ lines: 0, spinKind: 'mini', chainActive: false, comboCount: 8, level: 3 }, 300],
    [{ lines: 2, spinKind: 'full', chainActive: true, comboCount: 19, level: 3 }, 8400],
    [{ lines: 4, spinKind: 'full', chainActive: true, comboCount: 20, level: 2 }, 4400],
    [{ lines: 4, spinKind: 'none', chainActive: true, comboCount: -1, level: 1, perfectClear: true }, 4400],
    [{ lines: 3, spinKind: 'mini', chainActive: false, comboCount: -1, level: 1 }, 500],
  ];
  for (const [input, expected] of cases) {
    const result = resolveScoringBlock(input);
    assert.equal(result.scoreDelta, expected, JSON.stringify(input));
    assert.equal(Number.isInteger(result.scoreDelta), true);
    assert.ok(result.scoreDelta >= 0);
  }

  const spinDouble = resolveScoringBlock({ lines: 2, spinKind: 'full', chainActive: false, comboCount: -1, level: 1 });
  assert.equal(spinDouble.clearScore, 1200, 'spin replaces rather than adds the plain double');
  const quadSpin = resolveScoringBlock({ lines: 4, spinKind: 'full', chainActive: false, comboCount: -1, level: 1 });
  assert.equal(quadSpin.clearScore, 800, 'four lines always score HALVING');
  const capped = resolveScoringBlock({ lines: 1, spinKind: 'none', chainActive: false, comboCount: 999, level: 30 });
  assert.equal(capped.comboScore, 50 * STACKED_COMBO_BONUS_CAP * 30);
  const unclamped = resolveScoringBlock({ score: 999_999_990, lines: 4, spinKind: 'none', chainActive: true, comboCount: 20, level: 30, perfectClear: true });
  assert.ok(unclamped.score > 999_999_999);

  for (let level = 1; level < 30; level += 1) {
    const a = resolveScoringBlock({ lines: 3, spinKind: 'full', chainActive: true, comboCount: 3, level });
    const b = resolveScoringBlock({ lines: 3, spinKind: 'full', chainActive: true, comboCount: 3, level: level + 1 });
    assert.ok(b.scoreDelta > a.scoreDelta);
  }
  assert.equal(levelForLines(1, 9), 1);
  assert.equal(levelForLines(1, 10), 2);
  assert.equal(levelForLines(15, 200), 30);
});

test('scoring cross-product covers every line, spin, CHAIN, combo, and level branch', () => {
  const plain = [0, 100, 300, 500, 800];
  const mini = [100, 200, 400];
  const full = [400, 800, 1200, 1600];
  for (const lines of [0, 1, 2, 3, 4]) for (const spinKind of ['none', 'mini', 'full']) {
    for (const chainActive of [false, true]) for (const comboCount of [-1, 0, 19, 20, 99]) for (const level of [1, 7, 30]) {
      let base = plain[lines];
      if (lines !== 4 && spinKind === 'mini' && mini[lines] !== undefined) base = mini[lines];
      if (lines !== 4 && spinKind === 'full' && full[lines] !== undefined) base = full[lines];
      let clearScore = base * level;
      if (chainActive && lines > 0 && (lines === 4 || spinKind !== 'none')) clearScore = Math.floor(clearScore * 3 / 2);
      const nextCombo = lines > 0 ? comboCount + 1 : -1;
      const comboScore = lines > 0 ? 50 * Math.min(nextCombo, 20) * level : 0;
      const actual = resolveScoringBlock({ lines, spinKind, chainActive, comboCount, level });
      assert.equal(actual.scoreDelta, clearScore + comboScore, JSON.stringify({ lines, spinKind, chainActive, comboCount, level }));
      assert.equal(Number.isInteger(actual.scoreDelta), true);
      assert.ok(actual.scoreDelta >= 0);
    }
  }
});

test('garbage cadence, cost wall, hole draw counts, and row application are deterministic', () => {
  assert.equal(garbageIntervalTicks(3599), Number.POSITIVE_INFINITY);
  assert.equal(garbageIntervalTicks(3600), GARBAGE_INTERVAL_START_TICKS);
  assert.equal(garbageIntervalTicks(57_600), GARBAGE_INTERVAL_FLOOR_TICKS);
  assert.equal(garbageIntervalTicks(400_000), GARBAGE_INTERVAL_FLOOR_TICKS);
  assert.equal(reorgCost(0), 1);
  assert.equal(reorgCost(86_399), 8);
  assert.equal(reorgCost(86_400), 9);
  assert.ok(reorgCost(86_400) > HASHPOWER_MAX);
  for (const tick of [86_400, 90_000, 118_800, 432_000]) assert.equal(canRejectReorg(HASHPOWER_MAX, tick), false);

  const first = new SeededRng(7);
  const firstHole = garbageHoleColumn(first, -1);
  assert.equal(first.count, 1);
  assert.ok(firstHole >= 0 && firstHole < BOARD_WIDTH);

  let values = [0];
  const repeat = { count: 0, nextBelow(limit) { this.count += 1; return values.shift() % limit; } };
  assert.equal(garbageHoleColumn(repeat, 4), 4);
  assert.equal(repeat.count, 1);

  values = [4, 3];
  const shift = { count: 0, nextBelow(limit) { this.count += 1; return values.shift() % limit; } };
  const shiftedHole = garbageHoleColumn(shift, 4);
  assert.equal(shift.count, 2);
  assert.notEqual(shiftedHole, 4);

  const empty = new Uint8Array(BOARD_WIDTH * BOARD_ROWS);
  const applied = applyGarbageRows(empty, [2, 2]);
  assert.equal(applied.terminalReason, null);
  assert.equal(applied.rowsApplied, 2);
  assert.deepEqual(row(applied.board, 0), [8, 8, 0, 8, 8, 8, 8, 8, 8, 8]);
  assert.deepEqual(row(applied.board, 1), [8, 8, 0, 8, 8, 8, 8, 8, 8, 8]);

  const overflowing = new Uint8Array(BOARD_WIDTH * BOARD_ROWS);
  overflowing[(BOARD_ROWS - 1) * BOARD_WIDTH] = 1;
  const rejected = applyGarbageRows(overflowing, [0]);
  assert.equal(rejected.terminalReason, 'garbage-out');
  assert.equal(rejected.rowsApplied, 0);
  assert.deepEqual(rejected.board, overflowing);
});

test('zone and ceiling helpers use only integer simulation state', () => {
  assert.deepEqual([0, 10_799, 10_800, 25_200, 43_200, 64_800, 90_000].map(zoneForTick), [0, 0, 1, 2, 3, 4, 5]);
  assert.equal(evidenceCeilingReached(STACKED_MAX_EVIDENCE_BYTES - 1), false);
  assert.equal(evidenceCeilingReached(STACKED_MAX_EVIDENCE_BYTES), true);
  assert.deepEqual(STACKED_TERMINAL_REASONS, ['block-out', 'lock-out', 'garbage-out', 'tick-ceiling', 'evidence-ceiling']);
  assert.ok(Object.isFrozen(STACKED_TERMINAL_REASONS));
});

test('frozen recorder bounds make evidence-ceiling unreachable for every legal stream', () => {
  const maximumLegalEncodedBytes = 24
    + STACKED_MAX_INPUT_TRANSITIONS * 3
    + Math.floor(STACKED_MAX_INPUT_TRANSITIONS / 128)
    + Math.floor(STACKED_MAX_INPUT_TRANSITIONS / 16_384)
    + 4;
  assert.equal(STACKED_MAX_INPUT_TRANSITIONS, STACKED_MAX_TICKS);
  assert.equal(maximumLegalEncodedBytes, 1_299_429);
  assert.ok(maximumLegalEncodedBytes < STACKED_MAX_EVIDENCE_BYTES);
  assert.equal(evidenceCeilingReached(maximumLegalEncodedBytes), false);
});

test('the live runtime compacts and scores a public-input line clear', () => {
  const masks = [1,0,1,0,1,0,8,0,8,0,16,0,2,0,2,0,8,0,16,0,16,0,1,0,1,0,1,0,8,0,2,0,2,0,2,0,2,0,8,0,8,0];
  const runtime = createStackedRuntime({ seed: 20260906, maxTicks: 1000, config: { startLevel: 1 } });
  for (const mask of masks) runtime.step(mask);
  const snap = runtime.snapshot();
  assert.equal(snap.lines, 1);
  assert.equal(snap.singles, 1);
  assert.equal(snap.piecesLocked, 6);
  assert.equal(snap.score, 320);
  assert.equal(snap.hardDropCells, 110);
  assert.equal(snap.comboCount, 0);
  assert.equal(snap.level, 1);
  assert.equal(snap.maxStackHeight, 3);
});

test('production locks integrate combo, HASHPOWER, and a perfect-clear bonus', () => {
  const runtime = createStackedRuntime({ seed: 12, maxTicks: 1000, config: { startLevel: 1 } });
  for (const placement of PERFECT_CLEAR_PATH) hardDropAt(runtime, placement);
  const snap = runtime.snapshot();
  assert.deepEqual(
    {
      piecesLocked: snap.piecesLocked, lines: snap.lines, singles: snap.singles, doubles: snap.doubles,
      score: snap.score, comboCount: snap.comboCount, maxCombo: snap.maxCombo, hashpower: snap.hashpower,
      perfectClears: snap.perfectClears, occupied: snap.board.filter(Boolean).length,
    },
    {
      piecesLocked: 10, lines: 4, singles: 2, doubles: 1, score: 2124, comboCount: 1,
      maxCombo: 1, hashpower: 1, perfectClears: 1, occupied: 0,
    },
  );
});

test('production grounded rotations integrate spin, CHAIN, combo, and HASHPOWER scoring', () => {
  const runtime = createStackedRuntime({ seed: 1, maxTicks: 2000, config: { startLevel: 1 } });
  for (const placement of FIRST_SPIN_SETUP) hardDropAt(runtime, placement);

  softDropTo(runtime, 1);
  edge(runtime, 16);
  edge(runtime, 1);
  softDropTo(runtime, 0);
  edge(runtime, 64);
  runtime.step(64);
  const beforeFirstSpinLock = runtime.snapshot();
  waitForCurrentPieceLock(runtime);
  const afterFirstSpin = runtime.snapshot();
  const firstSurvivalAwards = Math.floor(afterFirstSpin.tick / 60) - Math.floor(beforeFirstSpinLock.tick / 60);
  assert.equal(afterFirstSpin.score - beforeFirstSpinLock.score, 250 + firstSurvivalAwards * 10);
  assert.deepEqual(
    { mini: afterFirstSpin.spinsMini, combo: afterFirstSpin.comboCount, chain: afterFirstSpin.chainActive, hashpower: afterFirstSpin.hashpower },
    { mini: 1, combo: 1, chain: true, hashpower: 1 },
  );

  for (const placement of SECOND_SPIN_SETUP) hardDropAt(runtime, placement);
  while (runtime.snapshot().active.x !== 7) edge(runtime, 2);
  softDropTo(runtime, 5);
  runtime.step(32);
  const beforeSecondSpinLock = runtime.snapshot();
  waitForCurrentPieceLock(runtime);
  const afterSecondSpin = runtime.snapshot();
  const secondSurvivalAwards = Math.floor(afterSecondSpin.tick / 60) - Math.floor(beforeSecondSpinLock.tick / 60);
  assert.equal(afterSecondSpin.score - beforeSecondSpinLock.score, 300 + secondSurvivalAwards * 10);
  assert.deepEqual(
    {
      mini: afterSecondSpin.spinsMini, chain: afterSecondSpin.chainActive,
      backToBack: afterSecondSpin.backToBackCount, maxBackToBack: afterSecondSpin.maxBackToBack,
      hashpower: afterSecondSpin.hashpower,
    },
    { mini: 2, chain: true, backToBack: 2, maxBackToBack: 2, hashpower: 3 },
  );
});

test('solo REORG queues on time but rises only at the next lock boundary', () => {
  const runtime = createStackedRuntime({ seed: 9, maxTicks: 5000, config: { startLevel: 1 } });
  while (runtime.snapshot().tick < 4320) runtime.step(0);
  const queued = runtime.snapshot();
  assert.deepEqual(queued.garbagePending, [1]);
  assert.equal(queued.garbageGroups, 1);
  assert.equal(queued.garbageRowsReceived, 0);
  assert.equal(queued.garbageRngCount, 1);
  runtime.step(8);
  const risen = runtime.snapshot();
  assert.deepEqual(risen.garbagePending, []);
  assert.equal(risen.garbageRowsReceived, 1);
  assert.equal(risen.board.slice(0, BOARD_WIDTH).filter((value) => value === 8).length, 9);
});

test('block-out and lock-out independently freeze canonical results and reject further steps', () => {
  for (const [seed, reason] of [[3, 'block-out'], [1, 'lock-out']]) {
    const runtime = createStackedRuntime({ seed, maxTicks: 1000, config: { startLevel: 1 } });
    while (!runtime.terminal) {
      runtime.step(8);
      if (!runtime.terminal) runtime.step(0);
    }
    assert.equal(runtime.result().terminalReason, reason);
    assert.equal(runtime.result(), runtime.result());
    assert.throws(() => runtime.step(0), /terminal/);
  }
});

test('survival trickle is awarded even when a lock-out occurs on tick 60', () => {
  const runtime = createStackedRuntime({ seed: 1, maxTicks: 200, config: { startLevel: 1 } });
  for (let tick = 0; tick < 37; tick += 1) runtime.step(0);
  while (!runtime.terminal) {
    runtime.step(8);
    if (!runtime.terminal) runtime.step(0);
  }
  assert.equal(runtime.snapshot().tick, 60);
  assert.equal(runtime.result().terminalReason, 'lock-out');
  assert.equal(runtime.result().score, 228);
});

test('packed board is 120 bytes and hashes with canonical nibble order', () => {
  const board = new Uint8Array(BOARD_WIDTH * BOARD_ROWS);
  board[0] = 1;
  board[1] = 8;
  const packed = packStackedBoard(board);
  assert.equal(packed.length, 120);
  assert.equal(packed[0], 0x18);
  assert.match(boardHash(board), /^0x[0-9a-f]{64}$/);
  assert.equal(boardHash(new Uint8Array(BOARD_WIDTH * BOARD_ROWS)), '0x6edd9f6f9cc92cded36e6c4a580933f9c9f1b90562b46903b806f21902a1a54f');
  for (let seed = 0; seed < 8; seed += 1) {
    const sample = new Uint8Array(BOARD_WIDTH * BOARD_ROWS);
    for (let index = 0; index < sample.length; index += 1) sample[index] = (seed * 5 + index * 7) % 9;
    const expected = `0x${createHash('sha256').update(packStackedBoard(sample)).digest('hex')}`;
    assert.equal(boardHash(sample), expected);
  }
});

test('result tuple rejects malformed or inconsistent source state without numeric repair', () => {
  const runtime = createStackedRuntime({ seed: 55, maxTicks: 1, config: { startLevel: 1 } });
  runtime.step(0);
  const valid = runtime.snapshot();
  const malformed = [
    ['tick', null], ['tick', Number.NaN], ['tick', Number.POSITIVE_INFINITY], ['tick', -1], ['tick', 0.5],
    ['score', null], ['score', Number.NaN], ['score', Number.POSITIVE_INFINITY], ['score', -1], ['score', 2.25],
    ['seed', -1], ['seed', 0x1_0000_0000], ['piecesSpawned', -1], ['level', 0], ['transitionCount', 0.5],
  ];
  for (const [field, value] of malformed) {
    assert.throws(() => buildStackedResultTuple({ ...valid, [field]: value }), undefined, `${field}=${String(value)}`);
  }
  for (const field of [
    'seed', 'tick', 'piecesSpawned', 'lines', 'linesCleared', 'level', 'startLevel', 'score', 'quadClears',
    'singles', 'doubles', 'triples', 'spinsMini', 'spinsFull', 'perfectClears', 'maxCombo', 'maxBackToBack',
    'garbageRowsReceived', 'garbageGroups', 'garbageRowsCleared', 'holdsUsed', 'bagRefills', 'bagDraws',
    'garbageRngCount', 'transitionCount',
  ]) {
    assert.throws(() => buildStackedResultTuple({ ...valid, [field]: null }), undefined, `${field}=null`);
    assert.throws(() => buildStackedResultTuple({ ...valid, [field]: Number(valid[field]) + 0.5 }), undefined, `${field}=fraction`);
  }
  assert.throws(() => buildStackedResultTuple({ ...valid, terminalReason: 'other' }), /terminalReason/);
  assert.throws(() => buildStackedResultTuple({ ...valid, buildHash: ' bad' }), /buildHash/);
  assert.throws(() => buildStackedResultTuple({ ...valid, seasonId: 'BAD' }), /seasonId/);
  assert.throws(() => buildStackedResultTuple({ ...valid, board: [...valid.board, 0] }), /board/);
  assert.throws(() => buildStackedResultTuple({ ...valid, board: valid.board.map((cell, index) => index === 0 ? 9 : cell) }), /board/);
  assert.throws(() => buildStackedResultTuple({ ...valid, lines: 1, linesCleared: 1 }), /lines/i);
  assert.throws(() => buildStackedResultTuple({ ...valid, level: 2 }), /level/);
  assert.throws(() => buildStackedResultTuple({ ...valid, spinsMini: 2 }), /spins/);
  assert.throws(() => buildStackedResultTuple({ ...valid, perfectClears: 1 }), /perfectClears/);
  assert.throws(() => buildStackedResultTuple({ ...valid, bagRefills: valid.bagRefills + 1 }), /bagRefills/);
  assert.throws(() => buildStackedResultTuple({ ...valid, bagDraws: 0 }), /bagDraws/);
  assert.throws(() => buildStackedResultTuple({ ...valid, garbageGroups: 1 }), /garbageDraws/);
  assert.throws(() => buildStackedResultTuple({ ...valid, garbageRowsCleared: 1 }), /garbageRowsCleared/);
  assert.throws(() => buildStackedResultTuple({ ...valid, maxTicks: 2 }), /tick-ceiling/);

  const large = buildStackedResultTuple({ ...valid, score: 3_000_000_000 });
  assert.equal(large.score, 3_000_000_000);
  assert.equal(Number.isSafeInteger(large.score), true);
});

test('runtime state hash follows the canonical low-byte-first vector and ignores metadata', () => {
  assert.equal(STACKED_CABINET_VERSION, '0.2.0');
  const config = { startLevel: 1, seasonId: STACKED_SEASON_ID };
  const first = createStackedRuntime({ seed: 77, maxTicks: 10, config: { ...config, buildHash: 'A' } });
  const second = createStackedRuntime({ seed: 77, maxTicks: 10, config: { ...config, buildHash: 'B' } });
  const expected = fnvBytes(canonicalFreshRuntimeBytes(first.snapshot()));
  assert.equal(first.stateHash(), expected);
  assert.equal(second.stateHash(), expected);
  first.step(0); second.step(0);
  assert.equal(first.stateHash(), second.stateHash(), 'build metadata must not affect desync authority');
});

test('level-crossing clear prices same-lock REORG rejection at the pre-clear level', () => {
  const { before, after } = driveDeterministicLevelCrossing();
  assert.deepEqual(
    { tick: before.tick, lines: before.lines, level: before.level, score: before.score, hashpower: before.hashpower, pending: before.garbagePending },
    { tick: 4320, lines: 9, level: 1, score: 2680, hashpower: 1, pending: [5] },
  );
  assert.deepEqual(
    { tick: after.tick, lines: after.lines, level: after.level, score: after.score, hashpower: after.hashpower, rejected: after.reorgsRejected },
    { tick: 4332, lines: 10, level: 2, score: 3064, hashpower: 0, rejected: 1 },
  );
});

test('golden tick-ceiling run reproduces its explicit ordered result tuple', () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/stacked-golden-run.json', import.meta.url), 'utf8'));
  const runtime = createStackedRuntime({
    seed: fixture.seed,
    maxTicks: fixture.maxTicks,
    config: { startLevel: fixture.startLevel, buildHash: fixture.buildHash, seasonId: fixture.seasonId },
  });
  for (const mask of fixture.masks) runtime.step(mask);
  const result = runtime.result();
  assert.deepEqual(Object.keys(result), RESULT_FIELDS);
  assert.deepEqual(Object.keys(fixture.expected), RESULT_FIELDS);
  for (const field of RESULT_FIELDS) assert.equal(result[field], fixture.expected[field], field);
  assert.equal(runtime.stateHash(), fixture.expectedStateHash);
  assert.deepEqual(result, buildStackedResultTuple(runtime.snapshot()));
  assert.ok(Object.isFrozen(result));
  assert.equal(runtime.result(), result, 'terminal result is memoized');
  assert.throws(() => runtime.step(0), /terminal/);
  assert.equal(result.lines <= Math.floor(result.pieces * 4 / 10) + result.garbageRowsReceived, true);
  assert.equal(result.bagRefills, 2 + Math.floor(result.pieces / 7));
  assert.ok(result.bagDraws >= 6 * result.bagRefills);
  assert.ok(result.garbageDraws >= result.garbageGroups);
  assert.ok(result.garbageRowsCleared <= result.garbageRowsReceived);
  assert.equal(Object.values(result).some((value) => typeof value === 'number' && !Number.isInteger(value)), false);
});
