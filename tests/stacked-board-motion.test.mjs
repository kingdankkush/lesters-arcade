import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PIECE_CELLS, cellsFor, collides, createStackedRuntime } from '../apps/portal/src/stacked-sim.mjs';
import { LOCK_THUD_PX, SHAKE_MAX_PX, SQUASH_MS, TRAUMA, createBoardMotion, createBoardMotionView } from '../apps/stacked/src/render/board-motion.mjs';
import { defaultStackedSettings } from '../apps/portal/src/stacked-player-settings.mjs';

/**
 * 1.9.0 feel pass: a damped spring on the board container for the lock thud
 * (2 authored px), trauma shake on HALVING / ledger rise / garbage-out, and a
 * squash of cleared rows. Presentation only and silent under reduced motion.
 */
const settings = defaultStackedSettings();
const full = { ...settings, video: { ...settings.video, effectsIntensity: 1 }, accessibility: { ...settings.accessibility, reduceFlash: false } };
const geometry = { PIECE_CELLS, cellsFor, collides };
const blank = (extra = {}) => ({ tick: 1, board: Array(240).fill(0), active: { kind: 'I', rotation: 0, x: 3, y: 0 }, lines: 0, piecesLocked: 0, hardDropCells: 0, holdsUsed: 0, garbageRowsReceived: 0, terminal: false, terminalReason: null, ...extra });
const sample = (motion, from, to, s = full) => { const ys = []; for (let t = from; t <= to; t += 2) ys.push(motion.offset(t, s).y); return ys; };

test('a lock kicks a damped spring that dips at most two authored px and rings out', () => {
  const motion = createBoardMotion();
  motion.step(blank(), blank({ tick: 2, piecesLocked: 1, hardDropCells: 18 }), 1000, full);
  const ys = sample(motion, 1000, 1600);
  const peak = Math.max(...ys);
  assert.ok(peak > LOCK_THUD_PX * .95 && peak <= LOCK_THUD_PX + 1e-9, `peak ${peak}`);
  assert.ok(Math.min(...ys) < 0, 'the spring overshoots back once');
  assert.ok(Math.min(...ys) > -LOCK_THUD_PX * .5, 'damped: the rebound is smaller than the dip');
  assert.equal(motion.offset(1500, full).y, 0, 'and it settles inside the spring window');
  // A soft lock thuds less; a stream of locks never exceeds one thud's energy.
  const soft = createBoardMotion();
  soft.step(blank(), blank({ tick: 2, piecesLocked: 1 }), 0, full);
  assert.ok(Math.max(...sample(soft, 0, 400)) < peak);
  const burst = createBoardMotion();
  for (let i = 0; i < 12; i += 1) burst.step(blank({ tick: i + 1, piecesLocked: i }), blank({ tick: i + 2, piecesLocked: i + 1, hardDropCells: 1 }), i * 16, full);
  assert.ok(Math.max(...sample(burst, 0, 800).map(Math.abs)) <= LOCK_THUD_PX * 1.6, 'rapid locks stay bounded');
});

test('HALVING, ledger rise and garbage-out add decaying trauma; the shake is bounded and halved by reduced flashes', () => {
  const motion = createBoardMotion();
  motion.step(blank(), blank({ tick: 2, piecesLocked: 1, lines: 4 }), 0, full);
  assert.ok(Math.abs(motion.offset(0, full).trauma - TRAUMA.halving) < 1e-9);
  motion.step(blank({ tick: 2 }), blank({ tick: 3, garbageRowsReceived: 1 }), 0, full);
  motion.step(blank({ tick: 3 }), blank({ tick: 4, terminal: true, terminalReason: 'garbage-out' }), 0, full);
  assert.equal(motion.offset(0, full).trauma, 1, 'trauma saturates at one');
  let biggest = 0;
  for (let t = 0; t < 300; t += 3) biggest = Math.max(biggest, Math.hypot(motion.offset(t, full).x, motion.offset(t, full).y));
  assert.ok(biggest > 2 && biggest <= SHAKE_MAX_PX * Math.SQRT2 + LOCK_THUD_PX);
  const quiet = { ...full, accessibility: { ...full.accessibility, reduceFlash: true } };
  const shake = s => { let m = 0; for (let t = 400; t < 500; t += 1) m = Math.max(m, Math.abs(motion.offset(t, s).x)); return m; };
  assert.ok(Math.abs(shake(quiet) - shake(full) / 2) < 1e-6, 'reduced flashes halve the shake');
  assert.equal(motion.offset(1000, full).trauma, 0, 'trauma decays to rest');
  // A top-out that is not garbage-out does not shake.
  const calm = createBoardMotion();
  calm.step(blank(), blank({ tick: 2, terminal: true, terminalReason: 'block-out' }), 0, full);
  assert.equal(calm.offset(10, full).trauma, 0);
});

test('reduced motion and zero intensity keep the board still', () => {
  for (const quiet of [
    { ...settings, accessibility: { ...settings.accessibility, reduceMotion: true } },
    { ...settings, video: { ...settings.video, effectsIntensity: 0 } },
  ]) {
    const motion = createBoardMotion();
    motion.step(blank(), blank({ tick: 2, piecesLocked: 1, lines: 4, hardDropCells: 9, garbageRowsReceived: 1 }), 0, quiet);
    for (const t of [0, 20, 60, 200]) assert.deepEqual(motion.offset(t, quiet), { x: 0, y: 0, spring: 0, trauma: 0 });
    assert.equal(motion.squash(10).count, 0);
  }
});

class Node {
  constructor() { this.children = []; this.visible = true; this.alpha = 1; this.tint = 0xffffff; this.position = { x: 0, y: 0, set: (x, y) => { this.position.x = x; this.position.y = y; } }; this.scale = { x: 1, y: 1, set: (x, y = x) => { this.scale.x = x; this.scale.y = y; } }; this.destroyed = false; }
  addChild(...nodes) { this.children.push(...nodes); return nodes.at(-1); }
  destroy() { this.destroyed = true; }
}
class Graphics extends Node {
  constructor() { super(); this.context = { destroy() {} }; }
  roundRect() { return this; } fill() { return this; } clone() { return new Graphics(); }
}

test('a real clear squashes exactly the cleared rows in their locked colours, and the board container carries the motion', () => {
  // Fill the bottom row except column 9 with garbage, then drop a vertical I into column 9.
  const board = Array(240).fill(0);
  for (let x = 0; x < 9; x += 1) board[x] = 8;
  const before = blank({ board, active: { kind: 'I', rotation: 1, x: 7, y: 0 } });
  const after = { ...before, tick: 2, piecesLocked: 1, lines: 1, hardDropCells: 16, board: (() => { const next = Array(240).fill(0); next[9] = 1; next[19] = 1; next[29] = 1; return next; })() };
  const root = new Node();
  const layers = { effectLayer: new Node() };
  const boardView = { frame: 'wide', layers, applyShake: (x, y) => root.position.set(x, y) };
  const view = createBoardMotionView({ board: boardView, Graphics, geometry });
  assert.equal(layers.effectLayer.children.length, 40);
  view.step(before, after, 1000, full);
  const colors = { I: 0x111111, garbage: 0x888888 };
  const frame = view.draw(1000 + SQUASH_MS * .4, full, colors);
  const visible = layers.effectLayer.children.filter(node => node.visible);
  assert.equal(frame.squashing, 1);
  assert.equal(visible.length, 10, 'one full row of ten cells');
  assert.deepEqual(visible.map(node => node.tint), [...Array(9).fill(0x888888), 0x111111]);
  assert.ok(visible.every(node => node.position.y === 19 * 32 + 16 && node.scale.y < 1 && node.scale.x > 1), 'the bottom row flattens and widens');
  assert.ok(visible.every(node => node.position.x >= 96 && node.position.x <= 96 + 320));
  assert.equal(root.position.y, frame.y);
  assert.ok(root.position.y > 0, 'the lock dips the board container');
  view.draw(1000 + SQUASH_MS + 1, full, colors);
  assert.equal(layers.effectLayer.children.filter(node => node.visible).length, 0, 'the squash ends');
  view.reset();
  assert.deepEqual([root.position.x, root.position.y], [0, 0]);
  view.destroy();
  assert.ok(layers.effectLayer.children.every(node => node.destroyed));
});

test('board motion never touches the simulation and is wired into the renderer', () => {
  const runtime = createStackedRuntime({ seed: 11 }), control = createStackedRuntime({ seed: 11 });
  const motion = createBoardMotion();
  let before = runtime.snapshot();
  for (let i = 0; i < 600 && !runtime.terminal; i += 1) {
    const mask = i % 9 === 0 ? 8 : i % 5 === 0 ? 2 : 0;
    const after = runtime.step(mask); control.step(mask);
    motion.step(before, after, i * 16.7, full, geometry);
    motion.offset(i * 16.7, full);
    before = after;
  }
  assert.equal(runtime.stateHash(), control.stateHash());
  const renderer = readFileSync(new URL('../apps/stacked/src/render/renderer.mjs', import.meta.url), 'utf8');
  assert.match(renderer, /createBoardMotionView\(\{ board, Graphics, geometry \}\)/);
  assert.match(renderer, /motion\.step\(before,snapshot,now,settings\)/);
  assert.match(renderer, /motion\.draw\(now,settings,/);
  assert.match(renderer, /motion\.destroy\(\)/);
});
