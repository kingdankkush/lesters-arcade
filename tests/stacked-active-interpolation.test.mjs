// Sub-tick interpolation of the active piece (projection only).
//
// The simulation still advances in whole 60 Hz ticks. Between ticks the
// renderer offsets the active piece from its previous tick cell toward its
// current one by the frame's accumulator fraction (alpha). Everything here is a
// read of committed snapshots: the inputs consumed per tick, the evidence
// bytes, the replay and the result are proven identical with and without it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { TICK_MS, createActiveInterpolation } from '../apps/stacked/src/render/active-interpolation.mjs';
import { createStackedBoardView, boardCellToAuthored } from '../apps/stacked/src/render/board-view.mjs';
import { createStackedRenderer } from '../apps/stacked/src/render/renderer.mjs';
import { createStackedPlaySession } from '../apps/stacked/src/play-session.mjs';
import { PIECE_CELLS, cellsFor, collides, createStackedRuntime, replayStackedRun } from '../apps/portal/src/stacked-sim.mjs';
import { CELL_PX } from '../apps/portal/src/stacked-contracts.mjs';

const geometry = Object.freeze({ PIECE_CELLS, cellsFor, collides });
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-9, `${message ?? ''} expected ${expected}, got ${actual}`);
// Synthetic consecutive snapshots: only the named fields change between them.
const base = () => ({ tick: 10, terminal: false, piecesLocked: 2, piecesSpawned: 3, holdsUsed: 0, hardDropCells: 0, active: { kind: 'T', rotation: 0, x: 3, y: 17 } });
const after = (changes = {}, active = {}) => ({ ...base(), tick: 11, ...changes, active: changes.active === null ? null : { ...base().active, ...active } });

test('TICK_MS is the fixed 60 Hz step the frame loop accumulates', () => {
  near(TICK_MS, 1000 / 60);
});

test('a one-row gravity fall interpolates from the previous row toward the current one', () => {
  const interpolation = createActiveInterpolation();
  interpolation.step(base(), after({}, { y: 16 }));
  const at = alpha => interpolation.offset(after({}, { y: 16 }), alpha, true);
  near(at(0).y, 1, 'alpha 0 renders the previous row');
  near(at(0).x, 0);
  near(at(0.25).y, 0.75, 'a quarter of the way to the next tick');
  near(at(0.5).y, 0.5);
  near(at(0.999).y, 0.001);
});

test('a horizontal shift interpolates along x and soft-drop falls are capped at one cell', () => {
  const interpolation = createActiveInterpolation();
  interpolation.step(base(), after({}, { x: 4 }));
  near(interpolation.offset(after({}, { x: 4 }), 0.25, true).x, -0.75, 'previous column is one cell to the left');
  near(interpolation.offset(after({}, { x: 4 }), 0.25, true).y, 0);
  interpolation.step(base(), after({}, { y: 14 }));
  near(interpolation.offset(after({}, { y: 14 }), 0, true).y, 1, 'a three-row soft drop still reads as one cell of travel');
  interpolation.step(base(), after({}, { x: 1, y: 15 }));
  const both = interpolation.offset(after({}, { x: 1, y: 15 }), 0.5, true);
  near(both.x, 0.5); near(both.y, 0.5);
});

test('lock, hard drop, rotation, hold, spawn, game over and a missing piece snap to the tick state', () => {
  const cases = {
    lock: after({ piecesLocked: 3, piecesSpawned: 4 }, { kind: 'I', y: 18 }),
    'hard drop': after({ hardDropCells: 12, piecesLocked: 3, piecesSpawned: 4 }, { y: 18 }),
    rotation: after({}, { rotation: 1, y: 16 }),
    hold: after({ holdsUsed: 1 }, { kind: 'L', y: 19 }),
    swap: after({ holdsUsed: 1 }, { kind: 'Z' }),
    spawn: after({ piecesSpawned: 4 }, { y: 19 }),
    'game over': after({ terminal: true }, { y: 16 }),
    'no piece': after({ active: null }),
  };
  for (const [name, next] of Object.entries(cases)) {
    const interpolation = createActiveInterpolation();
    interpolation.step(base(), next);
    const offset = interpolation.offset(next, 0, true);
    assert.equal(offset.x, 0, `${name} must not slide along x`);
    assert.equal(offset.y, 0, `${name} must not slide along y`);
  }
  const interpolation = createActiveInterpolation();
  interpolation.step({ ...base(), active: null }, after({}, { y: 16 }));
  assert.equal(interpolation.offset(after({}, { y: 16 }), 0, true).y, 0, 'no previous piece means nothing to travel from');
});

test('reduced motion, a foreign snapshot, alpha at or past one, and reset all yield the tick state', () => {
  const interpolation = createActiveInterpolation();
  const fallen = after({}, { y: 16 });
  interpolation.step(base(), fallen);
  assert.equal(interpolation.offset(fallen, 0.25, false).y, 0, 'reduced motion switches interpolation off');
  near(interpolation.offset(fallen, 0.25, true).y, 0.75, 'and it resumes when motion is allowed again');
  assert.equal(interpolation.offset({ ...fallen, tick: 40 }, 0.25, true).y, 0, 'a snapshot from another tick (undo, restart) never inherits the delta');
  near(interpolation.offset(fallen, 0.25, true).y, 0.75, 'a foreign snapshot does not discard the delta for the real one');
  assert.equal(interpolation.offset(fallen, 1, true).y, 0, 'alpha 1 is the current tick');
  assert.equal(interpolation.offset(fallen, 0, true).y, 0, 'reaching the tick consumes the delta, so a resume at alpha 0 does not jump back');
  interpolation.step(base(), fallen);
  assert.equal(interpolation.offset(fallen, 1.7, true).y, 0, 'a capped catch-up frame (alpha past one) renders the current tick');
  interpolation.step(base(), fallen);
  interpolation.reset();
  assert.equal(interpolation.offset(fallen, 0, true).y, 0, 'reset forgets the pending delta');
  interpolation.step(base(), fallen);
  near(interpolation.offset(fallen, -0.5, true).y, 1, 'a negative alpha clamps to the previous cell, never beyond it');
});

test('the offset is a reused object: no allocation per frame', () => {
  const interpolation = createActiveInterpolation();
  const fallen = after({}, { y: 16 });
  interpolation.step(base(), fallen);
  const first = interpolation.offset(fallen, 0.2, true);
  const second = interpolation.offset(fallen, 0.6, true);
  assert.equal(first, second, 'offset() hands back the same object every frame');
  near(second.y, 0.4);
  assert.equal(interpolation.offset(fallen, 0.6, true), first);
});

test('canonical runtime snapshots produce the same deltas and snaps as the synthetic ones', () => {
  const runtime = createStackedRuntime({ seed: 0x51a2 });
  const interpolation = createActiveInterpolation();
  let before = runtime.snapshot();
  let next = runtime.step(2); // right
  interpolation.step(before, next);
  assert.equal(next.active.x, before.active.x + 1);
  near(interpolation.offset(next, 0.5, true).x, -0.5, 'a real horizontal shift');
  before = next; next = runtime.step(16); // rotate
  interpolation.step(before, next);
  assert.notEqual(next.active.rotation, before.active.rotation);
  assert.equal(interpolation.offset(next, 0, true).x + interpolation.offset(next, 0, true).y, 0, 'a real rotation snaps');
  // Level-1 gravity crosses one row every 61 ticks: the fall tick interpolates, the ticks around it do not.
  let falls = 0;
  for (let i = 0; i < 70; i++) {
    before = next; next = runtime.step(0);
    interpolation.step(before, next);
    const offset = interpolation.offset(next, 0, true);
    if (next.active.y === before.active.y - 1) { falls++; near(offset.y, 1, `fall at tick ${next.tick}`); }
    else assert.equal(offset.y, 0, `no travel at tick ${next.tick}`);
  }
  assert.equal(falls, 1);
  before = next; next = runtime.step(128); // hold
  interpolation.step(before, next);
  assert.equal(next.holdsUsed, before.holdsUsed + 1);
  assert.equal(interpolation.offset(next, 0, true).y, 0, 'a real hold snaps');
  before = next; next = runtime.step(8); // hard drop
  interpolation.step(before, next);
  assert.equal(next.piecesLocked, before.piecesLocked + 1);
  assert.equal(interpolation.offset(next, 0, true).y, 0, 'a real hard drop snaps');
  // Level 15 gravity is two rows per tick: still one cell of travel.
  const fast = createStackedRuntime({ seed: 7, config: { startLevel: 15 } });
  before = fast.snapshot(); next = fast.step(0);
  assert.equal(next.active.y, before.active.y - 2);
  interpolation.step(before, next);
  near(interpolation.offset(next, 0, true).y, 1, 'capped at one cell');
});

test('interpolating never changes the inputs, evidence, replay or result of a run', () => {
  const masks = Array.from({ length: 900 }, (_, i) => i % 97 === 0 ? 8 : i % 31 === 0 ? 16 : i % 13 === 0 ? 2 : i % 17 === 0 ? 1 : i % 41 === 0 ? 128 : i % 7 === 0 ? 4 : 0);
  const drive = withInterpolation => {
    const run = createStackedPlaySession({ seed: 4242, mode: 'ranked' });
    const interpolation = withInterpolation ? createActiveInterpolation() : null;
    const chain = [];
    for (const mask of masks) {
      if (run.snapshot.terminal) break;
      const before = run.snapshot, next = run.step(mask);
      const frozenBefore = JSON.stringify(before), frozenNext = JSON.stringify(next);
      if (interpolation) {
        interpolation.step(before, next);
        for (const alpha of [0, 0.3, 0.7, 1]) interpolation.offset(next, alpha, true);
        assert.equal(JSON.stringify(next), frozenNext, 'the projection never mutates a snapshot');
        assert.equal(JSON.stringify(before), frozenBefore, 'nor the previous one');
      }
      chain.push(next.tick, next.active?.x ?? -1, next.active?.y ?? -1, next.prevMask, next.score);
    }
    while (!run.snapshot.terminal) run.step(8);
    return { chain, evidence: Buffer.from(run.evidence()).toString('hex'), result: run.result, replay: replayStackedRun(run.evidence(), { expectedSeed: 4242 }) };
  };
  const control = drive(false), interpolated = drive(true);
  assert.deepEqual(interpolated.chain, control.chain, 'same tick-by-tick piece positions and masks');
  assert.equal(interpolated.evidence, control.evidence, 'byte-identical evidence');
  assert.deepEqual(interpolated.result, control.result, 'identical result tuple');
  assert.deepEqual(interpolated.replay, interpolated.result, 'the server-side replay still verifies the run');
});

// ---------------------------------------------------------------------------
// Board view: the offset moves only the active piece's visuals.
class Node {
  constructor() { this.children = []; this.visible = true; this.alpha = 1; this.tint = 0xffffff; this.rotation = 0; this.position = { x: 0, y: 0, set: (x, y = x) => { this.position.x = x; this.position.y = y; } }; this.scale = { x: 1, y: 1, set: (x, y = x) => { this.scale.x = x; this.scale.y = y; } }; }
  addChild(...children) { this.children.push(...children); return children.at(-1); }
  addChildAt(child) { this.children.unshift(child); return child; }
  removeChildren() { return this.children.splice(0); }
  destroy(options = {}) { this.destroyed = true; if (options.children) { for (const child of this.children) child.destroy?.({ children: true }); this.children = []; } }
}
class Graphics extends Node {
  constructor() { super(); this.context = { destroy() {} }; let proxy; proxy = new Proxy(this, { get(target, key) { if (key in target) return target[key]; return () => proxy; } }); return proxy; }
  clone() { return new Graphics(); }
}
class Text extends Node { constructor({ text = '', style = {} } = {}) { super(); this.text = text; this.style = { ...style }; this.anchor = { set() {} }; } }
const constructors = { Container: Node, Graphics, Text };
const model = () => Object.freeze({ board: Object.freeze(Array.from({ length: 240 }, (_, i) => i < 10 ? 1 : 0)), active: Object.freeze({ kind: 'T', rotation: 0, x: 3, y: 17 }), queue: ['I', 'O', 'S', 'Z', 'J'], hold: 'L', score: 0, level: 1, lines: 0, tick: 11 });
const footprint = layer => layer.children.filter(child => child.visible && child.__stackedKind).map(child => [child.position.x, child.position.y]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
// Expected authored footprint of a piece's visible cells (rows above the rim are clipped, as the board does).
const authored = (piece, dx = 0, dy = 0) => cellsFor(piece.kind, piece.rotation, piece.x, piece.y).map(([x, y]) => boardCellToAuthored({ x, y, frame: 'wide' })).filter(p => p.visible).map(p => [p.x + dx, p.y + dy]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);

test('setActiveOffset translates only the active visuals by whole-cell fractions, in authored pixels', () => {
  const view = createStackedBoardView({ index: 0, rows: 24, cells: 10, frame: 'wide', geometry, ...constructors });
  const snapshot = model();
  view.present(snapshot);
  const ghost = footprint(view.layers.ghostLayer), stack = footprint(view.layers.stackLayer);
  view.setActiveOffset(0, 0.75);
  assert.deepEqual(footprint(view.layers.activeLayer), authored(snapshot.active, 0, -0.75 * CELL_PX), 'three quarters of a cell up the well (authored y grows downward)');
  assert.deepEqual(view.activeOffset, { x: 0, y: -0.75 * CELL_PX });
  assert.deepEqual(footprint(view.layers.ghostLayer), ghost, 'the ghost stays on its tick cells');
  assert.deepEqual(footprint(view.layers.stackLayer), stack, 'locked cells never move');
  view.setActiveOffset(-0.5, 0);
  assert.deepEqual(footprint(view.layers.activeLayer), authored(snapshot.active, -0.5 * CELL_PX, 0), 'half a cell to the left');
  view.setActiveOffset(0, 0);
  assert.deepEqual(footprint(view.layers.activeLayer), authored(snapshot.active), 'zero offset is the tick position');
  view.destroy();
});

test('a zero-step frame reuses the last projection while the active offset keeps moving', () => {
  const view = createStackedBoardView({ index: 0, rows: 24, cells: 10, frame: 'wide', geometry, ...constructors });
  const snapshot = model();
  const first = view.present(snapshot);
  view.setActiveOffset(0, 1);
  const second = view.present(snapshot);
  assert.equal(second, first, 'the same frozen snapshot short-circuits the board rebuild');
  assert.deepEqual(footprint(view.layers.activeLayer), authored(snapshot.active, 0, -CELL_PX));
  view.setActiveOffset(0, 0.25);
  assert.equal(view.present(snapshot), first);
  assert.deepEqual(footprint(view.layers.activeLayer), authored(snapshot.active, 0, -0.25 * CELL_PX));
  // A new snapshot is drawn with the offset already applied.
  const next = Object.freeze({ ...snapshot, tick: 12, active: Object.freeze({ ...snapshot.active, y: 16 }) });
  view.setActiveOffset(0, 0.5);
  assert.notEqual(view.present(next), first);
  assert.deepEqual(footprint(view.layers.activeLayer), authored(next.active, 0, -0.5 * CELL_PX));
  view.reset();
  assert.deepEqual(view.activeOffset, { x: 0, y: 0 }, 'reset clears the offset with the run');
  view.destroy();
});

// ---------------------------------------------------------------------------
// Renderer: alpha reaches the board through frame(), gameplay() records the tick delta.
const fakeApp = () => { const stage = new Node(); const listeners = {}; return { stage, canvas: { width: 1440, height: 1000 }, renderer: { resolution: 1, on(name, fn) { listeners[name] = fn; }, off(name) { delete listeners[name]; } }, render() { this.renders = (this.renders ?? 0) + 1; } }; };
const settingsFor = reduceMotion => ({ video: { ghostPiece: true, gridLines: true, visualizer: 'journey', effectsPreset: 'off', effectsIntensity: 0, audioReactive: false, reactiveBoard: false, backdropScenes: false }, accessibility: { reduceMotion, reduceFlash: true, colorblindPieces: false }, audio: { sfxVolume: 0, sfxEnabled: false }, controls: { touchLeftHanded: false } });

test('frame(snapshot, now, settings, alpha) interpolates the active piece recorded by gameplay(), and reduced motion holds the tick cells', () => {
  const app = fakeApp(), stageElement = { dataset: {} };
  const renderer = createStackedRenderer({ app, stageElement, geometry, ...constructors, isMobile: () => false });
  const runtime = createStackedRuntime({ seed: 0x51a2 });
  const before = runtime.snapshot(), next = runtime.step(2);
  const settings = settingsFor(false);
  renderer.gameplay(before, next, 100, settings);
  renderer.frame(next, 100, settings, 0.25);
  const cells = renderer.board.layers.activeLayer.children.filter(child => child.visible && child.__stackedKind).map(child => [child.position.x, child.position.y]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  assert.deepEqual(cells, authored(next.active, -0.75 * CELL_PX, 0), 'alpha 0.25 renders three quarters of a cell short of the new column');
  renderer.frame(next, 116, settings, 0.75);
  assert.deepEqual(renderer.board.activeOffset, { x: -0.25 * CELL_PX, y: 0 });
  renderer.frame(next, 133, settings);
  assert.deepEqual(renderer.board.activeOffset, { x: 0, y: 0 }, 'a caller that passes no alpha gets the tick state');
  renderer.gameplay(before, next, 150, settings);
  renderer.frame(next, 150, settingsFor(true), 0.25);
  assert.deepEqual(renderer.board.activeOffset, { x: 0, y: 0 }, 'reduced motion renders whole-tick steps');
  renderer.gameplay(before, next, 166, settings);
  renderer.frame(next, 166, settings, 0);
  assert.deepEqual(renderer.board.activeOffset, { x: -CELL_PX, y: 0 });
  renderer.resetEffects();
  renderer.frame(next, 183, settings, 0);
  assert.deepEqual(renderer.board.activeOffset, { x: 0, y: 0 }, 'undo resets the pending delta with the effects');
  renderer.destroy();
});

test('the frame loop passes accumulator / TICK_MS as alpha only while the run is stepping', async () => {
  const main = await readFile(new URL('../apps/stacked/src/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /renderer\.frame\(run\.snapshot, now, settings, alpha\)/u, 'the per-frame present receives alpha');
  assert.match(main, /const alpha = started && !run\.paused && !run\.snapshot\.terminal \? accumulator \/ TICK_MS : 1;/u, 'paused, unstarted and finished frames render the tick state');
  assert.match(main, /while \(accumulator >= TICK_MS && steps\+\+ < 4 && !run\.snapshot\.terminal\)/u, 'the fixed step and its four-step catch-up cap are unchanged');
  assert.match(main, /import \{ TICK_MS \} from '\.\/render\/active-interpolation\.mjs';/u);
});
