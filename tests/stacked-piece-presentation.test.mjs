import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { PIECE_FX_EVENTS, createBoardPiecePresentation, createPiecePresentation } from '../apps/stacked/src/render/piece-presentation.mjs';
import { defaultStackedSettings } from '../apps/portal/src/stacked-player-settings.mjs';

/**
 * ST-N03 (owner direction 2026-09-16): piece presentation for hold, level,
 * ledger rise, perfect clear, top-out, danger and the lock thud. Presentation
 * only, bounded, and silent under reduced motion exactly like the spark layer.
 */

const settings = defaultStackedSettings();
const fixture = (extra = {}) => ({ tick: 1, board: Array(240).fill(0), active: { kind: 'T', rotation: 0, x: 3, y: 14 }, lines: 0, level: 1, piecesLocked: 0, holdsUsed: 0, hardDropCells: 0, garbageRowsReceived: 0, perfectClears: 0, terminal: false, ...extra });

test('every counter transition maps to one named event and never allocates past capacity', () => {
  const fx = createPiecePresentation({ mobile: true });
  assert.equal(fx.state.capacity, 192);
  const cases = [
    ['hold', { holdsUsed: 1 }],
    ['level', { level: 2 }],
    ['ledger', { garbageRowsReceived: 1 }],
    ['perfect', { perfectClears: 1 }],
    ['terminal', { terminal: true }],
    ['lock', { piecesLocked: 1, hardDropCells: 12 }],
  ];
  let before = fixture(), now = 0;
  for (const [event, delta] of cases) {
    const after = { ...before, tick: before.tick + 1, ...delta };
    const emitted = fx.state.emitted;
    fx.step(before, after, now, settings);
    assert.equal(fx.state.lastEvent, event, `${event} must be the last event`);
    if (event === 'lock') assert.ok(fx.state.shakeAmplitude > 1.6 && fx.state.shakeAmplitude <= 4, 'a hard drop lands harder, bounded to four authored px');
    else assert.ok(fx.state.emitted > emitted, `${event} emits motes`);
    before = after; now += 100;
  }
  assert.deepEqual([...PIECE_FX_EVENTS].sort(), cases.map(([event]) => event).sort());
  // Repeating the same tick emits nothing; a rewind resets everything.
  const emitted = fx.state.emitted;
  fx.step(before, before, now, settings);
  assert.equal(fx.state.emitted, emitted);
  fx.step(before, { ...before, tick: 0 }, now, settings);
  assert.equal(fx.state.count, 0);
  assert.equal(fx.state.lastEvent, '');
});

test('three thousand events stay inside the ring buffer and expire to zero', () => {
  const fx = createPiecePresentation({ mobile: false });
  let before = fixture(), now = 0;
  for (let i = 0; i < 3000; i++) {
    const after = { ...before, tick: before.tick + 1, level: before.level + 1, holdsUsed: before.holdsUsed + 1 };
    fx.step(before, after, now, settings);
    fx.update(now, settings);
    assert.ok(fx.state.count <= fx.state.capacity, `count ${fx.state.count} exceeded ${fx.state.capacity}`);
    before = after; now += 16;
  }
  fx.update(now + 10_000, settings);
  assert.equal(fx.state.count, 0, 'every mote expires');
});

test('reduced motion and zero intensity produce no motes, no shake and no danger band', () => {
  for (const quiet of [
    { ...settings, accessibility: { ...settings.accessibility, reduceMotion: true } },
    { ...settings, video: { ...settings.video, effectsIntensity: 0 } },
  ]) {
    const fx = createPiecePresentation({ mobile: false });
    const before = fixture();
    fx.step(before, { ...before, tick: 2, piecesLocked: 1, hardDropCells: 10, holdsUsed: 1, level: 2, terminal: true }, 0, quiet);
    fx.update(5, quiet, 1);
    assert.equal(fx.state.count, 0);
    assert.equal(fx.shakeOffset(5, quiet), 0);
    assert.equal(fx.state.danger, 0);
  }
  const fx = createPiecePresentation({ mobile: false });
  const before = fixture();
  fx.step(before, { ...before, tick: 2, piecesLocked: 1, hardDropCells: 10 }, 0, settings);
  assert.ok(fx.shakeOffset(40, settings) > 0, 'the thud dips the well briefly');
  assert.equal(fx.shakeOffset(400, settings), 0, 'and settles within the shake window');
  fx.update(0, settings, .5);
  assert.equal(fx.state.danger, .5);
});

class Node {
  constructor() { this.children = []; this.visible = true; this.alpha = 1; this.tint = 0xffffff; this.position = { x: 0, y: 0, set: (x, y) => { this.position.x = x; this.position.y = y; } }; this.scale = { set: (x, y = x) => { this.scale.x = x; this.scale.y = y; } }; this.destroyed = false; }
  addChild(...nodes) { this.children.push(...nodes); return nodes.at(-1); }
  destroy() { this.destroyed = true; }
}
class Graphics extends Node {
  constructor() { super(); this.context = { destroy() {} }; }
  circle() { return this; } rect() { return this; } fill() { return this; } clone() { return new Graphics(); }
}

test('the board layer draws bounded bands inside the well, settles the inner layers and cleans up', () => {
  const layers = Object.fromEntries(['stackLayer', 'ghostLayer', 'activeLayer', 'effectLayer'].map(name => [name, new Node()]));
  const board = { frame: 'wide', layers };
  const view = createBoardPiecePresentation({ board, Graphics, mobile: false });
  assert.equal(layers.effectLayer.children.length, view.state.capacity + 6, 'one pooled mote per slot plus six bands');
  const before = fixture();
  view.step(before, { ...before, tick: 2, level: 2, piecesLocked: 1, hardDropCells: 8 }, 1000, settings);
  const frame = view.draw(1050, settings, .8);
  assert.equal(frame.lastEvent, 'level', 'a level transition outranks the lock it landed on');
  assert.ok(frame.count > 0);
  assert.ok(frame.shake > 0 && frame.shake <= 4);
  assert.equal(layers.stackLayer.position.y, frame.shake);
  const visible = layers.effectLayer.children.filter(node => node.visible);
  for (const node of visible) {
    assert.ok(node.alpha <= .8 + 1e-9, 'no band or mote exceeds the additive ceiling');
    assert.ok(node.position.x >= 0 && node.position.x <= 96 + 320, 'nothing leaves the well band on the wide frame');
  }
  // The danger and level bands are present but faint.
  const bands = layers.effectLayer.children.slice(view.state.capacity);
  assert.ok(bands.some(node => node.visible && node.alpha <= .12 + 1e-9), 'bands stay at or under 0.12 alpha');
  const quiet = { ...settings, accessibility: { ...settings.accessibility, reduceFlash: true } };
  view.draw(1060, quiet, 1);
  assert.ok(bands.every(node => !node.visible || node.alpha <= .07 + 1e-9), 'reduceFlash halves the band ceiling');
  view.reset();
  assert.equal(layers.stackLayer.position.y, 0);
  view.destroy();
  assert.ok(layers.effectLayer.children.every(node => node.destroyed));
});

test('the renderer, syntax gate and presentation wiring include the piece layer', () => {
  const renderer = readFileSync(new URL('../apps/stacked/src/render/renderer.mjs', import.meta.url), 'utf8');
  const syntax = readFileSync(new URL('../scripts/syntax-check.mjs', import.meta.url), 'utf8');
  assert.match(renderer, /createBoardPiecePresentation\(\{board,Graphics,mobile\}\)/);
  assert.match(renderer, /pieceFx\?\.step\(before,snapshot,now,settings\)/);
  assert.match(renderer, /dataset\.pieceFx=String\(fx\.count\)/);
  assert.match(renderer, /pieceFx\?\.destroy\(\)/);
  assert.match(syntax, /apps\/stacked\/src\/render\/piece-presentation\.mjs/);
});
