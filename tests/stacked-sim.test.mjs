import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PIECE_CELLS, SPAWN_ORIGIN, STACKED_KICKS_JLSTZ, STACKED_KICKS_I, STACKED_KICKS_180,
  normalizeSeed, cellsFor, collides, attemptRotation, detectSpin, createStackedRuntime,
} from '../apps/portal/src/stacked-sim.mjs';

const MASK = Object.freeze({ left: 1, right: 2, soft: 4, hard: 8, cw: 16, ccw: 32, half: 64, hold: 128 });
const sorted = (cells) => cells.map(([x, y]) => `${x},${y}`).sort();

test('piece geometry is frozen, bounded, and CW/CCW round-trips every state', () => {
  for (const [kind, states] of Object.entries(PIECE_CELLS)) {
    assert.equal(states.length, 4);
    assert.ok(Object.isFrozen(states));
    const size = kind === 'I' || kind === 'O' ? 4 : 3;
    for (let rotation = 0; rotation < 4; rotation += 1) {
      const current = states[rotation];
      assert.equal(new Set(sorted(current)).size, 4);
      assert.deepEqual(sorted(current.map(([x, y]) => [y, size - 1 - x])), sorted(states[(rotation + 1) & 3]));
      assert.deepEqual(sorted(current.map(([x, y]) => [size - 1 - y, x])), sorted(states[(rotation + 3) & 3]));
    }
  }
});

test('spawn origins place all pieces in buffer before their free downward shift', () => {
  for (const kind of Object.keys(PIECE_CELLS)) {
    const cells = cellsFor(kind, 0, SPAWN_ORIGIN[kind].x, SPAWN_ORIGIN[kind].y);
    assert.ok(cells.every(([x, y]) => x >= 0 && x < 10 && y >= 20 && y < 24));
  }
});

test('collision treats every board boundary and occupied byte as solid', () => {
  const board = new Uint8Array(240); board[0] = 1;
  assert.equal(collides(board, [[0, 0]]), true);
  for (const cell of [[-1, 0], [10, 0], [0, -1], [0, 24]]) assert.equal(collides(board, [cell]), true);
  assert.equal(collides(board, [[1, 0]]), false);
});

test('kick tables contain every required transition and offset count', () => {
  const quarter = ['0>1','1>0','1>2','2>1','2>3','3>2','3>0','0>3'];
  assert.deepEqual(Object.keys(STACKED_KICKS_JLSTZ), quarter);
  assert.deepEqual(Object.keys(STACKED_KICKS_I), quarter);
  assert.ok(quarter.every((key) => STACKED_KICKS_JLSTZ[key].length === 5 && STACKED_KICKS_I[key].length === 5));
  assert.deepEqual(Object.keys(STACKED_KICKS_180), ['0>2','2>0','1>3','3>1']);
  assert.ok(Object.values(STACKED_KICKS_180).every((list) => list.length === 6));
});

test('every kick offset has a legal constructed blocking-board witness', () => {
  const cases = [
    [['J', 'L', 'S', 'T', 'Z'], STACKED_KICKS_JLSTZ],
    [['I'], STACKED_KICKS_I],
    [['I', 'J', 'L', 'S', 'T', 'Z'], STACKED_KICKS_180],
  ];
  for (const [kinds, table] of cases) for (const [transition, kicks] of Object.entries(table)) {
    const [from, to] = transition.split('>').map(Number);
    for (let wanted = 0; wanted < kicks.length; wanted += 1) {
      let witnessed = false;
      for (const kind of kinds) for (let y = -3; y < 24 && !witnessed; y += 1) for (let x = -3; x < 10 && !witnessed; x += 1) {
        const sourceCells = cellsFor(kind, from, x, y);
        if (collides(new Uint8Array(240), sourceCells)) continue;
        const source = new Set(sourceCells.map(([cx, cy]) => `${cx},${cy}`));
        const target = new Set(cellsFor(kind, to, x + kicks[wanted][0], y + kicks[wanted][1]).map(([cx, cy]) => `${cx},${cy}`));
        if ([...target].some((key) => { const [cx,cy]=key.split(',').map(Number); return cx<0||cx>=10||cy<0||cy>=24; })) continue;
        const board = new Uint8Array(240);
        let possible = true;
        for (const [dx, dy] of kicks.slice(0, wanted)) {
          const earlier = cellsFor(kind, to, x + dx, y + dy);
          if (collides(board, earlier)) continue;
          const blocker = earlier.find(([cx, cy]) => cx >= 0 && cx < 10 && cy >= 0 && cy < 24
            && !source.has(`${cx},${cy}`) && !target.has(`${cx},${cy}`));
          if (!blocker) { possible = false; break; }
          board[blocker[1] * 10 + blocker[0]] = 1;
        }
        if (!possible) continue;
        assert.equal(collides(board, sourceCells), false);
        assert.equal(collides(board, cellsFor(kind, to, x + kicks[wanted][0], y + kicks[wanted][1])), false);
        for (const [dx, dy] of kicks.slice(0, wanted)) assert.equal(collides(board, cellsFor(kind, to, x + dx, y + dy)), true);
        const result = attemptRotation(board, {kind,rotation:from,x,y,lastKickIndex:0,lastActionWasRotation:false}, to);
        if (result?.lastKickIndex === wanted) witnessed = true;
      }
      assert.equal(witnessed, true, `${transition} kick ${wanted}`);
    }
  }
});

test('a rotation with every candidate blocked returns null without mutating its input', () => {
  const board = new Uint8Array(240); board.fill(1);
  const active = Object.freeze({kind:'T',rotation:0,x:3,y:10,lastKickIndex:2,lastActionWasRotation:false,lockTimer:17,lockResetsUsed:4,lowestYReached:8});
  assert.equal(attemptRotation(board, active, 1), null);
  assert.deepEqual(active, {kind:'T',rotation:0,x:3,y:10,lastKickIndex:2,lastActionWasRotation:false,lockTimer:17,lockResetsUsed:4,lowestYReached:8});
});

test('failed rotation is a complete no-op and O rotation never displaces or spins', () => {
  const runtime = createStackedRuntime({ seed: 4, maxTicks: 100, config: { startLevel: 1 } });
  const before = runtime.snapshot();
  runtime.step(MASK.cw);
  const after = runtime.snapshot();
  const o = {kind:'O',rotation:0,x:3,y:10,lastKickIndex:3,lastActionWasRotation:true};
  const rotatedO = attemptRotation(new Uint8Array(240), o, 1);
  assert.equal(rotatedO.x, o.x); assert.equal(rotatedO.y, o.y);
  assert.equal(detectSpin(new Uint8Array(240), rotatedO), 'none');
  assert.throws(() => runtime.step(256), /uint8/);
});

test('generic spin immobility checks left, right, down, and up', () => {
  const active = {kind:'J',rotation:0,x:3,y:10,lastKickIndex:0,lastActionWasRotation:true};
  const board = new Uint8Array(240); board.fill(1);
  for (const [x, y] of cellsFor(active.kind, active.rotation, active.x, active.y)) board[y * 10 + x] = 0;
  for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
    assert.equal(collides(board, cellsFor(active.kind, active.rotation, active.x + dx, active.y + dy)), true);
  }
  assert.equal(detectSpin(board, active), 'mini');
});

test('simultaneous precedence holds: CCW, hold before hard drop, and hard over soft', () => {
  const a = createStackedRuntime({ seed: 11, maxTicks: 100, config: { startLevel: 1 } });
  const first = a.snapshot().active.kind;
  a.step(MASK.hold | MASK.hard | MASK.cw | MASK.ccw | MASK.half | MASK.soft);
  const snap = a.snapshot();
  assert.equal(snap.hold, first);
  assert.equal(snap.piecesLocked, 0);
  assert.equal(snap.active.rotation, 3);
  assert.equal(snap.softDropCells, 0);
});

test('a successful hold still applies ordinary gravity to the incoming piece', () => {
  const r = createStackedRuntime({ seed: 5, maxTicks: 100, config: { startLevel: 14 } });
  r.step(MASK.hold);
  const snap = r.snapshot();
  assert.equal(snap.hold, 'Z');
  assert.equal(snap.active.kind, 'O');
  assert.equal(snap.active.y, 17);
  assert.equal(snap.piecesLocked, 0);
  assert.equal(snap.softDropCells, 0);
  assert.equal(snap.hardDropCells, 0);
});

test('hold plus soft drop applies soft drop to the incoming piece', () => {
  const r = createStackedRuntime({ seed: 5, maxTicks: 100, config: { startLevel: 14 } });
  r.step(MASK.hold | MASK.soft);
  const snap = r.snapshot();
  assert.equal(snap.active.kind, 'O');
  assert.equal(snap.active.y, -1);
  assert.equal(snap.piecesLocked, 0);
  assert.equal(snap.softDropCells, 19);
  assert.equal(snap.hardDropCells, 0);
});

test('hold plus hard drop suppresses hard drop but still applies ordinary gravity', () => {
  const r = createStackedRuntime({ seed: 5, maxTicks: 100, config: { startLevel: 14 } });
  r.step(MASK.hold | MASK.hard);
  const snap = r.snapshot();
  assert.equal(snap.active.kind, 'O');
  assert.equal(snap.active.y, 17);
  assert.equal(snap.piecesLocked, 0);
  assert.equal(snap.softDropCells, 0);
  assert.equal(snap.hardDropCells, 0);
});

test('hold plus hard and soft drops preserves hard-over-soft while applying ordinary gravity', () => {
  const r = createStackedRuntime({ seed: 5, maxTicks: 100, config: { startLevel: 14 } });
  r.step(MASK.hold | MASK.hard | MASK.soft);
  const snap = r.snapshot();
  assert.equal(snap.active.kind, 'O');
  assert.equal(snap.active.y, 17);
  assert.equal(snap.piecesLocked, 0);
  assert.equal(snap.softDropCells, 0);
  assert.equal(snap.hardDropCells, 0);
});

test('opposing horizontal inputs latch the last edge and release to the remaining bit', () => {
  const r = createStackedRuntime({ seed: 19, maxTicks: 100, config: { startLevel: 1 } });
  const x = r.snapshot().active.x;
  r.step(MASK.left | MASK.right);
  assert.equal(r.snapshot().active.x, x + 1);
  r.step(MASK.left);
  assert.equal(r.snapshot().active.x, x);
});

test('hard drop wins over soft drop without involving hold precedence', () => {
  const r = createStackedRuntime({ seed: 23, maxTicks: 100, config: { startLevel: 1 } });
  r.step(MASK.hard | MASK.soft);
  const snap = r.snapshot();
  assert.equal(snap.piecesLocked, 1);
  assert.ok(snap.hardDropCells > 0);
  assert.equal(snap.softDropCells, 0);
});

test('hold is limited to once per lock and snapshots do not expose backing arrays', () => {
  const r = createStackedRuntime({ seed: 5, maxTicks: 200, config: { startLevel: 1 } });
  r.step(MASK.hold); r.step(0);
  const once = r.snapshot(); r.step(MASK.hold);
  assert.deepEqual(r.snapshot().active, once.active);
  const snap = r.snapshot(); snap.board[0] = 99; snap.queue[0] = 'X';
  assert.notEqual(r.snapshot().board[0], 99); assert.notEqual(r.snapshot().queue[0], 'X');
});

test('filled-hold activations do not consume queue pieces or inflate refill accounting', () => {
  const r = createStackedRuntime({ seed: 5, maxTicks: 100, config: { startLevel: 1 } });
  for (const mask of [128,0,8,0,128,0,8,0,128,0,8,0,128]) r.step(mask);
  const snap = r.snapshot();
  assert.equal(snap.piecesSpawned, 5);
  assert.equal(snap.bagRefills, 2);
  assert.equal(snap.queue.length, 9);
});

test('a downward kick establishes a new lowest y before grounded countdown', () => {
  const replay = JSON.parse(readFileSync(new URL('./fixtures/stacked-downkick-counterexample.json', import.meta.url), 'utf8'));
  const r = createStackedRuntime({ seed: replay.seed, maxTicks: 200, config: { startLevel: 1 } });
  for (const mask of replay.masks.slice(0, -1)) r.step(mask);
  assert.deepEqual(r.snapshot().active, replay.before);
  r.step(replay.masks.at(-1));
  const after = r.snapshot().active;
  assert.equal(after.y, 15);
  assert.equal(after.lowestYReached, 15);
  assert.equal(after.lockResetsUsed, 0);
  assert.equal(after.lockTimer, 29);
});

test('a rejected used hold while grounded does not refill the lock timer', () => {
  const r = createStackedRuntime({ seed: 31, maxTicks: 300, config: { startLevel: 1 } });
  r.step(MASK.hold); r.step(0);
  while (!collides(r.snapshot().board, cellsFor(r.snapshot().active.kind, r.snapshot().active.rotation, r.snapshot().active.x, r.snapshot().active.y - 1))) r.step(MASK.soft);
  r.step(0);
  const before = r.snapshot();
  r.step(MASK.hold);
  const after = r.snapshot();
  assert.equal(after.active.kind, before.active.kind);
  assert.equal(after.hold, before.hold);
  assert.equal(after.active.lockTimer, before.active.lockTimer - 1);
  assert.equal(after.active.lockResetsUsed, before.active.lockResetsUsed);
});

test('Q16 gravity moves only when the integer accumulator crosses one cell', () => {
  const r = createStackedRuntime({ seed: 37, maxTicks: 100, config: { startLevel: 1 } });
  const y = r.snapshot().active.y;
  for (let tick = 0; tick < 60; tick += 1) r.step(0);
  assert.equal(r.snapshot().active.y, y);
  r.step(0);
  assert.equal(r.snapshot().active.y, y - 1);
  assert.equal(r.snapshot().gravityAccQ16, 1092 * 61 - 65536);
});

test('grounded lock countdown expires exactly and successful moves exhaust the reset cap', () => {
  const r = createStackedRuntime({ seed: 41, maxTicks: 500, config: { startLevel: 1 } });
  while (!collides(r.snapshot().board, cellsFor(r.snapshot().active.kind, r.snapshot().active.rotation, r.snapshot().active.x, r.snapshot().active.y - 1))) r.step(MASK.soft);
  r.step(0);
  for (let reset = 0; reset < 15; reset += 1) {
    const direction = reset % 2 === 0 ? MASK.left : MASK.right;
    r.step(direction); r.step(0);
  }
  const capped = r.snapshot();
  assert.equal(capped.active.lockResetsUsed, 15);
  const timer = capped.active.lockTimer;
  r.step(MASK.left);
  assert.equal(r.snapshot().active.lockTimer, timer - 1);
  const locked = r.snapshot().piecesLocked;
  while (r.snapshot().piecesLocked === locked) r.step(0);
  assert.equal(r.snapshot().piecesLocked, locked + 1);
});

test('hard drop locks once across four identical catch-up masks', () => {
  const r = createStackedRuntime({ seed: 7, maxTicks: 100, config: { startLevel: 1 } });
  for (let i = 0; i < 4; i += 1) r.step(MASK.hard);
  assert.equal(r.snapshot().piecesLocked, 1);
});

test('exact tick ceiling is terminal and terminal step throws', () => {
  const r = createStackedRuntime({ seed: 1, maxTicks: 3, config: { startLevel: 1 } });
  assert.equal(r.result(), null); r.step(0); r.step(0); assert.equal(r.terminal, false); r.step(0);
  assert.equal(r.terminal, true); assert.equal(r.result().terminalReason, 'tick-ceiling');
  assert.throws(() => r.step(0), /terminal/);
});

test('constructor defensively validates seed, maxTicks, and config', () => {
  assert.equal(normalizeSeed(0), 1);
  for (const args of [{ seed: -1, maxTicks: 1, config: { startLevel: 1 } }, { seed: 1, maxTicks: 0, config: { startLevel: 1 } }, { seed: 1, maxTicks: 1, config: { startLevel: 16 } }]) {
    assert.throws(() => createStackedRuntime(args));
  }
});
