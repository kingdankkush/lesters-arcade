import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boardPulseAmplitude, boardPulseEnabled, createBoardPulse, PULSE_CEILINGS } from '../apps/stacked/src/render/board-pulse.mjs';
import { PIECE_CELLS, cellsFor, collides } from '../apps/portal/src/stacked-sim.mjs';
import { defaultStackedSettings } from '../apps/portal/src/stacked-player-settings.mjs';

// Music-reactive board (owner direction 2026-09-16): tiny beat/energy glow on
// the well frame and the active piece, capped, and neutralised by every
// accessibility gate plus its own toggle.

const settings = (overrides = {}) => { const s = defaultStackedSettings(); s.accessibility.reduceMotion = false; s.accessibility.reduceFlash = false; s.video.reactiveBoard = true; Object.assign(s.video, overrides.video ?? {}); Object.assign(s.accessibility, overrides.accessibility ?? {}); return s; };
class Node {
  constructor() { this.children = []; this.visible = true; this.alpha = 1; this.tint = 0xffffff; this.destroyed = false; this.position = { x: 0, y: 0, set: (x, y) => { this.position.x = x; this.position.y = y; } }; this.scale = { set() {} }; }
  addChild(...nodes) { this.children.push(...nodes); return nodes.at(-1); }
  addChildAt(node, index) { this.children.splice(index, 0, node); return node; }
  destroy() { this.destroyed = true; }
}
class Graphics extends Node { constructor() { super(); this.context = { destroyed: false, destroy() { this.destroyed = true; } }; } rect() { return this; } roundRect() { return this; } fill() { return this; } stroke() { return this; } clone() { const g = new Graphics(); g.context = this.context; return g; } }
const board = () => { const root = new Node(); const layers = Object.fromEntries(['wellFrame', 'stackLayer', 'garbageWarnLayer', 'ghostLayer', 'activeLayer', 'effectLayer', 'hudLayer'].map(name => [name, new Node()])); root.addChild(...Object.values(layers)); return { root, layers, frame: 'wide' }; };
const geometry = { PIECE_CELLS, cellsFor, collides };

test('amplitudes stay under the ceilings at full signal and scale with intensity', () => {
  const loud = boardPulseAmplitude({ level: 1, beat: 1, high: 1 }, settings({ video: { effectsIntensity: 1 } }));
  assert.ok(loud.frame > 0 && loud.frame <= PULSE_CEILINGS.frame + 1e-9);
  assert.ok(loud.piece > 0 && loud.piece <= PULSE_CEILINGS.piece + 1e-9);
  assert.ok(loud.mix <= PULSE_CEILINGS.tintMix + 1e-9);
  assert.ok(PULSE_CEILINGS.frame <= 0.2 && PULSE_CEILINGS.piece <= 0.26 && PULSE_CEILINGS.tintMix <= 0.35, 'ceilings are tiny');
  const half = boardPulseAmplitude({ level: 1, beat: 1, high: 1 }, settings({ video: { effectsIntensity: 0.5 } }));
  assert.ok(half.frame < loud.frame && half.piece < loud.piece && half.frame > loud.frame * 0.5, 'intensity eases the glow down without killing it');
  const zero = boardPulseAmplitude({ level: 1, beat: 1, high: 1 }, settings({ video: { effectsIntensity: 0 } }));
  assert.deepEqual([zero.frame, zero.piece], [0, 0], 'zero intensity switches the glow off');
  const quiet = boardPulseAmplitude({ level: 0, beat: 0, high: 0 }, settings());
  assert.deepEqual(quiet, { frame: 0, piece: 0, mix: 0 });
  const wild = boardPulseAmplitude({ level: 9, beat: NaN, high: -4 }, settings({ video: { effectsIntensity: 7 } }));
  assert.ok(wild.frame <= PULSE_CEILINGS.frame + 1e-9 && wild.piece <= PULSE_CEILINGS.piece + 1e-9 && wild.mix === 0);
  // Beats matter more than the slow level so the glow lands on the downbeat.
  const beat = boardPulseAmplitude({ level: 0, beat: 1 }, settings()), level = boardPulseAmplitude({ level: 1, beat: 0 }, settings());
  assert.ok(beat.frame > level.frame && beat.piece > level.piece);
});

test('reduced motion, reduced flashes, music off and the board toggle each neutralise the pulse', () => {
  const on = settings();
  assert.equal(boardPulseEnabled(on), true);
  assert.equal(boardPulseEnabled(defaultStackedSettings()), false, 'the shipped default keeps reduced flashes on, so the board stays still until it is turned off');
  for (const off of [
    settings({ accessibility: { reduceMotion: true } }),
    settings({ accessibility: { reduceFlash: true } }),
    settings({ video: { audioReactive: false } }),
    settings({ video: { reactiveBoard: false } }),
  ]) {
    assert.equal(boardPulseEnabled(off), false);
    assert.deepEqual(boardPulseAmplitude({ level: 1, beat: 1, high: 1 }, off), { frame: 0, piece: 0, mix: 0 });
  }
  assert.equal(boardPulseEnabled({ video: {}, accessibility: {} }), true, 'a settings object without the child key defaults to on');
});

test('the board layer draws a frame ring under the well and four halos under the active piece, then cleans up', () => {
  const view = board();
  const pulse = createBoardPulse({ board: view, Graphics, geometry });
  assert.equal(view.root.children[0], pulse.frame, 'the ring sits under every board layer');
  assert.equal(view.layers.garbageWarnLayer.children.length, 4, 'halos live under ghost and active layers');
  const snapshot = { active: { kind: 'T', rotation: 0, x: 3, y: 14 } };
  const palette = { color: 0x53e9ef, accent: 0xbacfff };
  const result = pulse.draw({ settings: settings({ video: { effectsIntensity: 1 } }), signals: { level: 0.5, beat: 1, high: 0 }, palette, snapshot });
  assert.ok(result.enabled && result.frame > 0 && result.piece > 0);
  assert.ok(pulse.frame.visible && pulse.frame.alpha <= PULSE_CEILINGS.frame + 1e-9 && pulse.frame.position.x === 96);
  assert.equal(pulse.frame.tint, 0x53e9ef, 'no highs: the ring keeps the zone colour');
  const expected = cellsFor('T', 0, 3, 14).map(([x, y]) => [96 + x * 32, (19 - y) * 32]).sort();
  assert.deepEqual(pulse.halos.map(h => [h.position.x, h.position.y]).sort(), expected);
  for (const halo of pulse.halos) { assert.ok(halo.visible && halo.alpha <= PULSE_CEILINGS.piece + 1e-9); assert.equal(halo.tint, 0xb66cff); }
  pulse.draw({ settings: settings(), signals: { level: 0.5, beat: 1, high: 1 }, palette, snapshot });
  assert.notEqual(pulse.frame.tint, 0x53e9ef, 'highs tint the ring toward the accent');
  // A piece above the rim only shows its visible cells; no piece shows nothing.
  pulse.draw({ settings: settings(), signals: { level: 1, beat: 1 }, palette, snapshot: { active: { kind: 'I', rotation: 0, x: 3, y: 21 } } });
  assert.ok(pulse.halos.every(h => !h.visible));
  pulse.draw({ settings: settings(), signals: { level: 1, beat: 1 }, palette, snapshot: { active: null } });
  assert.ok(pulse.halos.every(h => !h.visible) && pulse.frame.visible);
  // Any gate hides the ring and halos entirely.
  const off = pulse.draw({ settings: settings({ accessibility: { reduceFlash: true } }), signals: { level: 1, beat: 1 }, palette, snapshot });
  assert.equal(off.enabled, false);
  assert.ok(!pulse.frame.visible && pulse.halos.every(h => !h.visible));
  pulse.draw({ settings: settings(), signals: undefined, palette: undefined, snapshot });
  assert.ok(!pulse.frame.visible, 'no signals means no glow');
  pulse.destroy();
  assert.ok(pulse.frame.destroyed && pulse.halos.every(h => h.destroyed));
});

test('the renderer, shell and syntax gate wire the music-reactive board', () => {
  const renderer = readFileSync(new URL('../apps/stacked/src/render/renderer.mjs', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../apps/stacked/src/main.mjs', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../apps/portal/stacked/index.html', import.meta.url), 'utf8');
  const syntax = readFileSync(new URL('../scripts/syntax-check.mjs', import.meta.url), 'utf8');
  assert.match(renderer, /createBoardPulse\(\{ board, Graphics, geometry \}\)/);
  assert.match(renderer, /pulse\.draw\(\{ settings, signals: info\.signals \?\? undefined, palette: info\.palette \?\? undefined, snapshot \}\)/);
  assert.match(renderer, /dataset\.boardPulse=/);
  assert.match(renderer, /pulse\.destroy\(\)/);
  assert.match(main, /local\.reactiveBoard = \$\('boardPulseToggle'\)\.checked/);
  assert.match(main, /settings\.video\.reactiveBoard = local\.reactiveBoard/);
  assert.match(html, /<input id="boardPulseToggle" type="checkbox" checked> Music-reactive board/);
  assert.match(syntax, /apps\/stacked\/src\/render\/board-pulse\.mjs/);
  assert.match(syntax, /tests\/stacked-board-pulse\.test\.mjs/);
});
