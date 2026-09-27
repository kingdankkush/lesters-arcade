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
import { BOARD_VISIBLE_ROWS, CELL_PX, GRAVITY_LEVEL_CAP, STACKED_GRAVITY_Q16 } from '../apps/portal/src/stacked-contracts.mjs';
import { createBoardPulse } from '../apps/stacked/src/render/board-pulse.mjs';

const geometry = Object.freeze({ PIECE_CELLS, cellsFor, collides });
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-9, `${message ?? ''} expected ${expected}, got ${actual}`);
// Synthetic consecutive snapshots: only the named fields change between them.
const base = () => ({ tick: 10, terminal: false, piecesLocked: 2, piecesSpawned: 3, holdsUsed: 0, hardDropCells: 0, active: { kind: 'T', rotation: 0, x: 3, y: 17 } });
const after = (changes = {}, active = {}) => ({ ...base(), tick: 11, ...changes, active: changes.active === null ? null : { ...base().active, ...active } });

test('TICK_MS is the fixed 60 Hz step the frame loop accumulates', () => {
  near(TICK_MS, 1000 / 60);
});

test('a one-row gravity fall interpolates from the previous row toward the current one', () => {
  const interpolation = createActiveInterpolation({ geometry });
  interpolation.step(base(), after({}, { y: 16 }));
  const at = alpha => interpolation.offset(after({}, { y: 16 }), alpha, true);
  near(at(0).y, 1, 'alpha 0 renders the previous row');
  near(at(0).x, 0);
  near(at(0.25).y, 0.75, 'a quarter of the way to the next tick');
  near(at(0.5).y, 0.5);
  near(at(0.999).y, 0.001);
});

test('a horizontal shift interpolates along x and soft-drop falls are capped at one cell', () => {
  const interpolation = createActiveInterpolation({ geometry });
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
    const interpolation = createActiveInterpolation({ geometry });
    interpolation.step(base(), next);
    const offset = interpolation.offset(next, 0, true);
    assert.equal(offset.x, 0, `${name} must not slide along x`);
    assert.equal(offset.y, 0, `${name} must not slide along y`);
  }
  const interpolation = createActiveInterpolation({ geometry });
  interpolation.step({ ...base(), active: null }, after({}, { y: 16 }));
  assert.equal(interpolation.offset(after({}, { y: 16 }), 0, true).y, 0, 'no previous piece means nothing to travel from');
});

test('reduced motion, a foreign snapshot, alpha at or past one, and reset all yield the tick state', () => {
  const interpolation = createActiveInterpolation({ geometry });
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
  const interpolation = createActiveInterpolation({ geometry });
  const fallen = after({}, { y: 16 });
  interpolation.step(base(), fallen);
  const first = interpolation.offset(fallen, 0.2, true);
  const second = interpolation.offset(fallen, 0.6, true);
  assert.equal(first, second, 'offset() hands back the same object every frame');
  near(second.y, 0.4);
  assert.equal(interpolation.offset(fallen, 0.6, true), first);
});

test('a fall whose cells would emerge from above the well rim snaps its vertical travel and keeps the horizontal one', () => {
  const interpolation = createActiveInterpolation({ geometry });
  // Every non-I piece spawns on rows 20 and 19; the board culls row 20. Sliding the row-20 cells down into row 19
  // would draw them over the rim, so the fall renders on its tick rows instead.
  const spawned = { ...base(), active: { kind: 'Z', rotation: 0, x: 3, y: 18 } };
  const fallen = after({}, { kind: 'Z', y: 17 });
  interpolation.step(spawned, fallen);
  assert.equal(interpolation.offset(fallen, 0.05, true).y, 0, 'no vertical travel from above the rim');
  const shifted = after({}, { kind: 'Z', x: 4, y: 17 });
  interpolation.step(spawned, shifted);
  const both = interpolation.offset(shifted, 0.5, true);
  near(both.x, -0.5, 'the horizontal travel of the same tick is kept');
  assert.equal(both.y, 0);
  // A level-15 two-row fall from the same spawn lands the top cells on row 18: their capped one-cell travel starts on
  // row 19, inside the well, so it still interpolates.
  const fast = after({}, { kind: 'Z', y: 16 });
  interpolation.step(spawned, fast);
  near(interpolation.offset(fast, 0, true).y, 1, 'travel that starts on a visible row is untouched');
  // The I piece spawns on row 19: its first fall never leaves the well.
  const bar = { ...base(), active: { kind: 'I', rotation: 0, x: 3, y: 17 } }, barFall = after({}, { kind: 'I', y: 16 });
  interpolation.step(bar, barFall);
  near(interpolation.offset(barFall, 0, true).y, 1);
  // A vertical I whose top cell sits on row 20 (near block-out) is caught too.
  const tall = { ...base(), active: { kind: 'I', rotation: 1, x: 3, y: 17 } }, tallFall = after({}, { kind: 'I', rotation: 1, y: 16 });
  interpolation.step(tall, tallFall);
  assert.equal(interpolation.offset(tallFall, 0, true).y, 0);
  assert.throws(() => createActiveInterpolation(), TypeError, 'the rim rule needs the canonical piece geometry');
  assert.throws(() => createActiveInterpolation({ geometry: {} }), TypeError);
});

test('canonical runtime snapshots produce the same deltas and snaps as the synthetic ones', () => {
  const runtime = createStackedRuntime({ seed: 0x51a2 });
  const interpolation = createActiveInterpolation({ geometry });
  let before = runtime.snapshot();
  let next = runtime.step(2); // right
  interpolation.step(before, next);
  assert.equal(next.active.x, before.active.x + 1);
  near(interpolation.offset(next, 0.5, true).x, -0.5, 'a real horizontal shift');
  before = next; next = runtime.step(16); // rotate
  interpolation.step(before, next);
  assert.notEqual(next.active.rotation, before.active.rotation);
  assert.equal(interpolation.offset(next, 0, true).x + interpolation.offset(next, 0, true).y, 0, 'a real rotation snaps');
  // Level-1 gravity crosses one row every 61 ticks: the ticks around a fall never travel. The rotated Z still has a
  // cell on row 20, so its first fall would draw that cell sliding in over the rim and snaps vertically; the second
  // fall, entirely inside the well, interpolates.
  let falls = 0;
  for (let i = 0; i < 130; i++) {
    before = next; next = runtime.step(0);
    interpolation.step(before, next);
    const offset = interpolation.offset(next, 0, true);
    if (next.active.y === before.active.y - 1) {
      falls++;
      if (falls === 1) {
        assert.ok(cellsFor(before.active.kind, before.active.rotation, before.active.x, before.active.y).some(([, y]) => y >= BOARD_VISIBLE_ROWS), 'the first fall starts with a cell above the rim');
        assert.equal(offset.y, 0, `first fall at tick ${next.tick} snaps instead of crossing the rim`);
      } else near(offset.y, 1, `fall at tick ${next.tick}`);
    }
    else assert.equal(offset.y, 0, `no travel at tick ${next.tick}`);
  }
  assert.equal(falls, 2);
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
    const interpolation = withInterpolation ? createActiveInterpolation({ geometry }) : null;
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

test('the first fall of a freshly spawned piece never draws an active cell or its halo above the well rim', () => {
  const app = fakeApp(), stageElement = { dataset: {} };
  const renderer = createStackedRenderer({ app, stageElement, geometry, ...constructors, isMobile: () => false });
  const runtime = createStackedRuntime({ seed: 0x51a2 });
  const settings = settingsFor(false);
  const rows = piece => cellsFor(piece.kind, piece.rotation, piece.x, piece.y).map(([, y]) => y);
  let before = runtime.snapshot(), next = before;
  assert.equal(before.active.kind, 'Z');
  assert.ok(rows(before.active).some(y => y >= BOARD_VISIBLE_ROWS), 'the Z spawns with its top cells on row 20, which the board culls');
  while (next.active.y === before.active.y) { before = next; next = runtime.step(0); }
  assert.equal(next.tick, 61); assert.equal(next.active.y, before.active.y - 1);
  // The music-reactive halo rides board.activeOffset, so it is checked against the same frames.
  const pulse = createBoardPulse({ board: renderer.board, Graphics, geometry });
  const pulseSettings = { ...settings, video: { ...settings.video, reactiveBoard: true, audioReactive: true, effectsIntensity: 1 }, accessibility: { ...settings.accessibility, reduceFlash: false } };
  for (const alpha of [0.05, 0.5, 0.95]) {
    renderer.gameplay(before, next, 100, settings);
    renderer.frame(next, 100, settings, alpha);
    const visuals = footprint(renderer.board.layers.activeLayer);
    assert.equal(visuals.length, 4, 'all four cells sit on visible rows after the fall');
    for (const [, y] of visuals) assert.ok(y >= 0, `alpha ${alpha}: an active cell was drawn above the rim at authored y ${y}`);
    assert.deepEqual(visuals, authored(next.active), `alpha ${alpha}: the piece stays rigid on its tick rows`);
    pulse.draw({ settings: pulseSettings, signals: { level: 0.5, beat: 1, high: 0 }, palette: {}, snapshot: next });
    const halos = pulse.halos.filter(halo => halo.visible);
    assert.equal(halos.length, 4);
    for (const halo of halos) assert.ok(halo.position.y >= 0, `alpha ${alpha}: the halo overshot the rim at authored y ${halo.position.y}`);
  }
  // The next fall, entirely inside the well, still interpolates.
  do { before = next; next = runtime.step(0); } while (next.active.y === before.active.y);
  assert.ok(rows(before.active).every(y => y < BOARD_VISIBLE_ROWS));
  renderer.gameplay(before, next, 200, settings);
  renderer.frame(next, 200, settings, 0.5);
  assert.deepEqual(footprint(renderer.board.layers.activeLayer), authored(next.active, 0, -0.5 * CELL_PX), 'a mid-well fall reads half a cell above its tick rows');
  pulse.draw({ settings: pulseSettings, signals: { level: 0.5, beat: 1, high: 0 }, palette: {}, snapshot: next });
  assert.deepEqual(pulse.halos.filter(halo => halo.visible).map(halo => [halo.position.x, halo.position.y]).sort((a, b) => a[0] - b[0] || a[1] - b[1]), authored(next.active, 0, -0.5 * CELL_PX), 'and the halo travels with it');
  pulse.destroy(); renderer.destroy();
});

test('the frame loop passes accumulator / TICK_MS as alpha only while the run is stepping', async () => {
  const main = await readFile(new URL('../apps/stacked/src/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /renderer\.frame\(run\.snapshot, now, settings, alpha\)/u, 'the per-frame present receives alpha');
  assert.match(main, /const alpha = started && !run\.paused && !run\.snapshot\.terminal \? accumulator \/ TICK_MS : 1;/u, 'paused, unstarted and finished frames render the tick state');
  assert.match(main, /while \(accumulator >= TICK_MS && steps\+\+ < 4 && !run\.snapshot\.terminal\)/u, 'the fixed step and its four-step catch-up cap are unchanged');
  assert.match(main, /import \{ TICK_MS \} from '\.\/render\/active-interpolation\.mjs';/u);
});

// Review of the rim fix (6d622b47): the rule must hold for every piece type at
// every level, not only for the seed 0x51a2 Z at level 1. Each first-piece kind
// (a seed per kind) is driven from its spawn at start levels 1 to 15 under five
// input patterns (idle gravity, held soft drop, shifts, rotations, rotations
// with soft drop), and every piece those runs spawn is checked on every tick:
// the interpolation steps on every tick exactly as the renderer's gameplay()
// does, and on every tick that can carry vertical travel (a fall or a spawn)
// the board view draws the piece at each alpha. No visible active cell may be
// drawn above the well rim (authored y < 0), which is the same as a cell on
// row 19 or below never being drawn above row 19. On every other tick the
// vertical offset must be zero. The halo rides board.activeOffset (the renderer
// test above), so it follows the same frames. Levels 16 to 20 cannot be started
// (startLevel caps at 15) and are reached only by clearing lines; gravity
// indexes STACKED_GRAVITY_Q16 at min(level, GRAVITY_LEVEL_CAP = 15), so a level
// 16-20 piece falls exactly as a level-15 one, and the level-15 traces are
// replayed with the snapshot level shown as 16 to 20.
test('no spawned piece of any type draws above row 19 at any alpha, levels 1 to 20', () => {
  const SEED_FOR_KIND = Object.freeze({ S: 1, I: 2, T: 4, Z: 5, L: 7, J: 15, O: 30 });
  const ALPHAS = [0, 0.05, 0.25, 0.5, 0.75, 0.95, 0.999];
  const PATTERNS = Object.freeze({
    idle: () => 0,
    soft: () => 4,
    shift: tick => (tick % 3 === 0 ? 2 : tick % 7 === 0 ? 1 : 0),
    rotate: tick => (tick % 4 === 0 ? 16 : 0),
    'rotate+soft': tick => (tick % 4 === 0 ? 16 : 0) | 4,
  });
  const TICKS = 240;
  for (let level = 16; level <= 20; level++) assert.equal(STACKED_GRAVITY_Q16[Math.min(level, GRAVITY_LEVEL_CAP)], STACKED_GRAVITY_Q16[15], `level ${level} falls as level 15`);
  const coverage = { frames: 0, spawns: 0, rimFalls: 0, snappedRimFalls: 0, interpolatedFalls: 0, kinds: new Set(), levels: new Set() };
  const view = createStackedBoardView({ index: 0, rows: 24, cells: 10, frame: 'wide', geometry, ...constructors });
  for (const [kind, seed] of Object.entries(SEED_FOR_KIND)) {
    for (let startLevel = 1; startLevel <= 15; startLevel++) {
      for (const [patternName, pattern] of Object.entries(PATTERNS)) {
        const runtime = createStackedRuntime({ seed, config: { startLevel } });
        const trace = [runtime.snapshot()];
        assert.equal(trace[0].active.kind, kind);
        for (let t = 0; t < TICKS && !trace.at(-1).terminal; t++) trace.push(runtime.step(pattern(t)));
        for (const shownLevel of startLevel === 15 ? [15, 16, 17, 18, 19, 20] : [startLevel]) {
          coverage.levels.add(shownLevel);
          const shown = snapshot => (snapshot.level >= shownLevel ? snapshot : Object.freeze({ ...snapshot, level: shownLevel }));
          const interpolation = createActiveInterpolation({ geometry });
          view.reset();
          for (let i = 1; i < trace.length; i++) {
            const before = shown(trace[i - 1]), next = shown(trace[i]);
            const label = `${kind} level ${shownLevel} ${patternName} tick ${next.tick}`;
            interpolation.step(before, next);
            const fell = Boolean(next.active && before.active && next.active.y < before.active.y);
            const spawned = next.piecesSpawned !== before.piecesSpawned;
            if (spawned) coverage.spawns++;
            if (!fell && !spawned) {
              assert.equal(interpolation.offset(next, 0, true).y, 0, `${label}: vertical travel without a fall`);
              continue;
            }
            if (!next.active) continue;
            coverage.kinds.add(next.active.kind);
            const fromRim = fell && cellsFor(before.active.kind, before.active.rotation, before.active.x, before.active.y).some(([, y]) => y >= BOARD_VISIBLE_ROWS);
            if (fromRim) coverage.rimFalls++;
            view.present(next);
            for (const alpha of ALPHAS) {
              const offset = interpolation.offset(next, alpha, true);
              if (offset.y !== 0) coverage.interpolatedFalls++;
              else if (fromRim && alpha === 0) coverage.snappedRimFalls++;
              view.setActiveOffset(offset.x, offset.y);
              coverage.frames++;
              const drawn = footprint(view.layers.activeLayer);
              for (const [, y] of drawn) assert.ok(y >= 0, `${label} alpha ${alpha}: an active cell was drawn above the rim at authored y ${y}`);
              // The same statement in rows: a visible cell's drawn row (tick row plus the offset) never passes row 19.
              for (const [, row] of cellsFor(next.active.kind, next.active.rotation, next.active.x, next.active.y)) {
                if (row < BOARD_VISIBLE_ROWS) assert.ok(row + offset.y <= BOARD_VISIBLE_ROWS - 1 + 1e-9, `${label} alpha ${alpha}: row ${row} drawn at ${row + offset.y}`);
              }
            }
          }
        }
      }
    }
  }
  view.destroy();
  assert.deepEqual([...coverage.kinds].sort(), ['I', 'J', 'L', 'O', 'S', 'T', 'Z'], 'every piece type was on the board');
  assert.deepEqual([...coverage.levels].sort((a, b) => a - b), Array.from({ length: 20 }, (_, i) => i + 1), 'every level 1 to 20');
  assert.ok(coverage.rimFalls > 300, `falls that start above the rim: ${coverage.rimFalls}`);
  assert.ok(coverage.snappedRimFalls > 100, `rim falls snapped rather than travelled: ${coverage.snappedRimFalls}`);
  assert.ok(coverage.interpolatedFalls > 1000, `mid-well travel still interpolates: ${coverage.interpolatedFalls}`);
  assert.ok(coverage.spawns > 7 * 20 * 5, `later spawns were checked too: ${coverage.spawns}`);
});
