import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as boardPulse from '../apps/stacked/src/render/board-pulse.mjs';
import { boardPulseAmplitude, boardPulseEnabled, createBoardPulse, PULSE_CEILINGS } from '../apps/stacked/src/render/board-pulse.mjs';
import { PIECE_CELLS, cellsFor, collides } from '../apps/portal/src/stacked-sim.mjs';
import { defaultStackedSettings } from '../apps/portal/src/stacked-player-settings.mjs';

// Music-reactive board (owner direction 2026-09-16): tiny beat/energy glow on
// the well frame and the active piece, capped, and neutralised by reduced
// motion, the Off/Calm effects presets and zero intensity. Reduced flashes
// (settings simplification 2026-09-24) keeps a gentle, beat-free breathing glow.

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

test('reduced motion, music off, the board field and zero intensity each neutralise the pulse', () => {
  const on = settings();
  assert.equal(boardPulseEnabled(on), true);
  assert.equal(boardPulseEnabled(defaultStackedSettings()), true, 'the shipped default glows gently: Standard effects with reduced flashes on');
  assert.equal(boardPulseEnabled(settings({ accessibility: { reduceFlash: true } })), true, 'reduced flashes softens the glow instead of removing it');
  for (const off of [
    settings({ accessibility: { reduceMotion: true } }),
    settings({ video: { audioReactive: false } }),
    settings({ video: { reactiveBoard: false } }),
    settings({ video: { effectsIntensity: 0 } }),
  ]) {
    assert.equal(boardPulseEnabled(off), false);
    assert.deepEqual(boardPulseAmplitude({ level: 1, beat: 1, high: 1 }, off), { frame: 0, piece: 0, mix: 0 });
  }
  assert.equal(boardPulseEnabled({ video: {}, accessibility: {} }), true, 'a settings object without the child key defaults to on');
});

test('reduced flashes keeps a gentle glow: level-only, capped at 0.12 alpha, no beat, no hue shift, bounded swing', () => {
  const { GENTLE_PULSE_CEILINGS, GENTLE_SWING } = boardPulse;
  assert.deepEqual({ ...GENTLE_PULSE_CEILINGS }, { frame: 0.12, piece: 0.12, tintMix: 0 });
  assert.ok(Object.isFrozen(GENTLE_PULSE_CEILINGS));
  assert.equal(GENTLE_SWING, 0.5);
  const steps = Array.from({ length: 11 }, (_, i) => i / 10);
  for (const effectsIntensity of [0.4, 0.7, 1]) {
    const gentle = settings({ video: { effectsIntensity }, accessibility: { reduceFlash: true } });
    const frames = [], pieces = [];
    for (const level of steps) {
      const reference = boardPulseAmplitude({ level, beat: 0, high: 0, available: true }, gentle);
      for (const beat of steps) for (const high of [0, 1]) {
        const amplitude = boardPulseAmplitude({ level, beat, high, available: true }, gentle);
        assert.ok(amplitude.frame > 0 && amplitude.frame <= 0.12 + 1e-9 && amplitude.piece <= 0.12 + 1e-9, `capped at ${effectsIntensity}/${level}/${beat}`);
        assert.equal(amplitude.mix, 0, 'no hue shift');
        assert.deepEqual(amplitude, reference, 'beat onsets and highs have no effect');
      }
      frames.push(reference.frame); pieces.push(reference.piece);
    }
    assert.ok(Math.max(...frames) - Math.min(...frames) <= 0.06 + 1e-9, 'the frame swing with the music stays within 0.06 alpha');
    assert.ok(Math.max(...pieces) - Math.min(...pieces) <= 0.06 + 1e-9, 'the piece swing with the music stays within 0.06 alpha');
    const wild = boardPulseAmplitude({ level: 9, beat: NaN, high: 7, available: true }, settings({ video: { effectsIntensity: 7 }, accessibility: { reduceFlash: true } }));
    assert.ok(wild.frame <= 0.12 + 1e-9 && wild.piece <= 0.12 + 1e-9 && wild.mix === 0);
    assert.deepEqual(boardPulseAmplitude({ level: 1, beat: 1, high: 1, available: false }, gentle), { frame: 0, piece: 0, mix: 0 }, 'no live music, no glow');
    assert.deepEqual(boardPulseAmplitude({ level: 1, beat: 1, high: 1 }, gentle), { frame: 0, piece: 0, mix: 0 });
  }
  const standard = boardPulseAmplitude({ level: 0.5, beat: 0, available: true }, defaultStackedSettings());
  assert.ok(standard.frame > 0.04, `the default glow is visible (${standard.frame})`);
  const loud = boardPulseAmplitude({ level: 1, beat: 1, available: true }, settings());
  assert.ok(loud.frame > standard.frame, 'the full pulse is still stronger than the gentle glow');
  const reduced = defaultStackedSettings(true);
  assert.deepEqual(boardPulseAmplitude({ level: 1, beat: 1, available: true }, reduced), { frame: 0, piece: 0, mix: 0 }, 'reduced motion stills the gentle glow too');
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
  // Sub-tick travel (2026-09-26): the halo rides with the board's authored active offset so it never peels off the piece.
  view.activeOffset = { x: -8, y: 24 };
  pulse.draw({ settings: settings({ video: { effectsIntensity: 1 } }), signals: { level: 0.5, beat: 1, high: 0 }, palette, snapshot });
  assert.deepEqual(pulse.halos.map(h => [h.position.x, h.position.y]).sort(), expected.map(([x, y]) => [x - 8, y + 24]).sort(), 'halos follow the piece between ticks');
  view.activeOffset = { x: 0, y: 0 };
  pulse.draw({ settings: settings(), signals: { level: 0.5, beat: 1, high: 1 }, palette, snapshot });
  assert.notEqual(pulse.frame.tint, 0x53e9ef, 'highs tint the ring toward the accent');
  // A piece above the rim only shows its visible cells; no piece shows nothing.
  pulse.draw({ settings: settings(), signals: { level: 1, beat: 1 }, palette, snapshot: { active: { kind: 'I', rotation: 0, x: 3, y: 21 } } });
  assert.ok(pulse.halos.every(h => !h.visible));
  pulse.draw({ settings: settings(), signals: { level: 1, beat: 1 }, palette, snapshot: { active: null } });
  assert.ok(pulse.halos.every(h => !h.visible) && pulse.frame.visible);
  // Reduced flashes (the default) draws the gentle glow in the zone colour only.
  const gentle = pulse.draw({ settings: defaultStackedSettings(), signals: { level: 0.5, beat: 1, high: 1, available: true }, palette, snapshot });
  assert.ok(gentle.enabled && pulse.frame.visible && pulse.frame.alpha > 0.04 && pulse.frame.alpha <= 0.12 + 1e-9);
  assert.equal(pulse.frame.tint, 0x53e9ef, 'gentle mode never shifts the hue');
  assert.ok(pulse.halos.every(h => h.visible && h.alpha <= 0.12 + 1e-9));
  // Any gate hides the ring and halos entirely.
  for (const gate of [settings({ accessibility: { reduceMotion: true } }), settings({ video: { reactiveBoard: false } }), settings({ video: { effectsIntensity: 0 } })]) {
    const off = pulse.draw({ settings: gate, signals: { level: 1, beat: 1, available: true }, palette, snapshot });
    assert.equal(off.enabled, false);
    assert.ok(!pulse.frame.visible && pulse.halos.every(h => !h.visible));
  }
  const silent = pulse.draw({ settings: defaultStackedSettings(), signals: { level: 1, beat: 1, available: false }, palette, snapshot });
  assert.equal(silent.enabled, false, 'gentle mode waits for live music');
  pulse.draw({ settings: settings(), signals: undefined, palette: undefined, snapshot });
  assert.ok(!pulse.frame.visible, 'no signals means no glow');
  pulse.destroy();
  assert.ok(pulse.frame.destroyed && pulse.halos.every(h => h.destroyed));
});

test('the renderer, shell and syntax gate wire the music-reactive board', () => {
  const renderer = readFileSync(new URL('../apps/stacked/src/render/renderer.mjs', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../apps/stacked/src/main.mjs', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../apps/portal/stacked/index.html', import.meta.url), 'utf8');
  const settingsModule = readFileSync(new URL('../apps/portal/src/stacked-player-settings.mjs', import.meta.url), 'utf8');
  const syntax = readFileSync(new URL('../scripts/syntax-check.mjs', import.meta.url), 'utf8');
  assert.match(renderer, /createBoardPulse\(\{ board, Graphics, geometry \}\)/);
  assert.match(renderer, /pulse\.draw\(\{ settings, signals: info\.signals \?\? undefined, palette: info\.palette \?\? undefined, snapshot \}\)/);
  assert.match(renderer, /dataset\.boardPulse=/);
  assert.match(renderer, /pulse\.destroy\(\)/);
  // The board glow follows the Effects preset, stored with the parent settings.
  assert.match(main, /import \{ STACKED_EFFECTS_PRESETS, expandStackedEffectsPreset \} from '\.\.\/\.\.\/portal\/src\/stacked-player-settings\.mjs';/);
  assert.match(main, /Object\.assign\(settings\.video, expandStackedEffectsPreset\(/);
  assert.doesNotMatch(html, /boardPulseToggle/);
  assert.match(settingsModule, /reactiveBoard: true/);
  assert.match(syntax, /apps\/stacked\/src\/render\/board-pulse\.mjs/);
  assert.match(syntax, /tests\/stacked-board-pulse\.test\.mjs/);
});
