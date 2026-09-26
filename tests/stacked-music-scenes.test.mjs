import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createMusicScenes, createSceneDirector, SCENE_ORDER, SCENE_NAMES, SCENE_CHOICES, SCENE_POOLS, SCENE_CEILINGS, SECTION_RULES } from '../apps/stacked/src/render/music-scenes.mjs';
import { createStackedAtmosphere } from '../apps/stacked/src/render/atmosphere.mjs';
import { defaultStackedSettings } from '../apps/portal/src/stacked-player-settings.mjs';

// Scene deck (owner direction 2026-09-16): three audio-reactive looks that
// crossfade on musical sections. Deterministic for a signal sequence, pooled
// once, alpha under static ceilings, static under reduced motion.

let contexts = 0, shapes = 0;
class Context { constructor() { contexts++; this.destroyed = false; } destroy() { this.destroyed = true; } }
class Graphics {
  constructor(context = new Context()) { this.context = context; this.visible = true; this.alpha = 1; this.tint = 0xffffff; this.rotation = 0; this.blendMode = 'normal'; this.position = { x: 0, y: 0, set: (x, y) => { this.position.x = x; this.position.y = y; } }; this.scale = { x: 1, y: 1, set: (x, y = x) => { this.scale.x = x; this.scale.y = y; } }; }
  circle() { shapes++; return this; } rect() { shapes++; return this; } poly() { shapes++; return this; } fill() { return this; } stroke() { return this; } clear() { return this; }
  clone() { return new Graphics(this.context); } destroy() { this.destroyed = true; }
}
class Layer { constructor() { this.children = []; } addChild(...children) { this.children.push(...children); } }
const palette = { color: 0x53e9ef, accent: 0xbacfff, deep: 0x1f6f8f };
const snapshot = layer => layer.children.map(node => node.visible ? [node.position.x, node.position.y, node.scale.x, node.scale.y, node.rotation, node.alpha, node.tint] : null);
const signal = (t, level) => ({ time: t, level, bass: level * 0.9, high: level * 0.5, beat: Math.sin(t * 8) > 0.9 ? 0.8 : 0 });
const settings = (overrides = {}) => { const s = defaultStackedSettings(); s.accessibility.reduceMotion = false; s.accessibility.reduceFlash = false; Object.assign(s.video, overrides.video ?? {}); Object.assign(s.accessibility, overrides.accessibility ?? {}); return s; };

test('the deck exposes three named scenes plus auto and off choices', () => {
  assert.deepEqual([...SCENE_ORDER], ['tunnel', 'particles', 'horizon']);
  assert.deepEqual([...SCENE_CHOICES], ['auto', 'tunnel', 'particles', 'horizon', 'off']);
  for (const scene of SCENE_ORDER) assert.equal(typeof SCENE_NAMES[scene], 'string');
  assert.ok(SCENE_POOLS.mobile.dots < SCENE_POOLS.desktop.dots && SCENE_POOLS.mobile.rings <= SCENE_POOLS.desktop.rings);
  for (const ceiling of Object.values(SCENE_CEILINGS)) assert.ok(ceiling > 0 && ceiling <= 0.7);
});

test('the director changes scenes on sustained energy shifts, beat counts, halvings and the time fallback, never before the hold', () => {
  const director = createSceneDirector();
  let t = 0;
  const run = (seconds, level, extra = {}) => { for (let i = 0; i < seconds * 60; i++) { t += 1 / 60; director.update({ mode: 'auto', time: t, level, beat: 0, ...extra }); } return director.state; };
  assert.equal(run(4, 0.3).transitions, 0, 'a quiet intro holds the first scene');
  // A loud drop right away: blocked by the minimum hold, then taken once it elapses.
  run(4, 0.9);
  assert.equal(director.state.transitions, 0);
  run(2, 0.9);
  assert.equal(director.state.transitions, 1); assert.equal(director.state.reason, 'section'); assert.equal(director.state.to, 'particles');
  // Crossfade completes over the configured window with a monotonic mix.
  let previous = director.state.mix;
  for (let i = 0; i < SECTION_RULES.crossfadeSeconds * 60 + 2; i++) { t += 1 / 60; director.update({ mode: 'auto', time: t, level: 0.9, beat: 0 }); assert.ok(director.state.mix >= previous); previous = director.state.mix; }
  assert.equal(director.state.mix, 1); assert.equal(director.state.current, 'particles');
  // Steady energy: 64 beats move on once the hold has elapsed.
  const before = director.state.transitions;
  for (let beat = 0; beat < 70; beat++) for (let i = 0; i < 12; i++) { t += 1 / 60; director.update({ mode: 'auto', time: t, level: 0.9, beat: i < 3 ? 0.8 : 0 }); }
  assert.equal(director.state.transitions, before + 1); assert.equal(director.state.reason, 'beats'); assert.equal(director.state.to, 'horizon');
  // A Halving after the hold advances immediately and wraps to the first scene.
  run(SECTION_RULES.minimumHoldSeconds + 0.1, 0.9);
  director.update({ mode: 'auto', time: t += 1 / 60, level: 0.9, beat: 0, cleared: 4 });
  assert.equal(director.state.reason, 'halving'); assert.equal(director.state.to, 'tunnel');
  // Steady, beatless music: the time fallback keeps the show moving.
  run(SECTION_RULES.fallbackSeconds + 0.2, 0.9);
  assert.equal(director.state.reason, 'time'); assert.equal(director.state.to, 'particles');
});

test('manual cycling, fixed choices and reduced motion cut instantly and deterministically', () => {
  const director = createSceneDirector();
  director.update({ mode: 'horizon', time: 0, level: 0.5 });
  assert.equal(director.state.to, 'horizon'); assert.equal(director.state.mix, 0, 'a chosen scene still crossfades in');
  director.next(1);
  assert.equal(director.state.to, 'tunnel'); assert.equal(director.state.reason, 'manual');
  director.update({ mode: 'auto', time: 1, level: 0.5, reducedMotion: true });
  assert.equal(director.state.mix, 1, 'reduced motion snaps the crossfade');
  for (let i = 0; i < 60 * 60; i++) director.update({ mode: 'auto', time: 1, level: i % 2 ? 1 : 0, beat: 0.9, reducedMotion: true });
  assert.equal(director.state.transitions, 2, 'reduced motion never auto-advances');
  const a = createSceneDirector(), b = createSceneDirector();
  for (let i = 0; i < 1800; i++) { const s = signal(i / 60, i > 900 ? 0.95 : 0.2); a.update({ mode: 'auto', ...s }); b.update({ mode: 'auto', ...s }); }
  assert.deepEqual(a.state, b.state, 'identical signals give identical decisions');
  assert.ok(a.state.transitions >= 1);
});

test('the deck pools every node once, draws every scene with bounded alpha and allocates nothing per frame', () => {
  for (const mobile of [false, true]) {
    const layer = new Layer();
    const deck = createMusicScenes({ layer, Graphics, mobile });
    const pool = mobile ? SCENE_POOLS.mobile : SCENE_POOLS.desktop;
    assert.equal(layer.children.length, pool.stars + 1 + 5 + pool.rows + pool.fans + pool.spokes + pool.rings + pool.dots);
    const before = { contexts, shapes, children: layer.children.length };
    let seen = 0;
    for (const mode of ['tunnel', 'particles', 'horizon', 'auto']) for (const [width, height] of [[1440, 900], [390, 844], [320, 600]]) for (const minimal of [false, true]) for (let i = 0; i < 40; i++) {
      const frame = deck.draw({ mode, ...signal(i / 60 + seen, 0.6 + 0.4 * Math.sin(i)), width, height, lines: i % 20 === 0 ? 4 : 0, intensity: 1, minimal, reduceFlash: false, palette });
      assert.ok(SCENE_ORDER.includes(frame.scene));
      for (const node of layer.children) {
        assert.equal(node.blendMode, 'normal');
        if (!node.visible) continue;
        assert.ok(node.alpha >= 0 && node.alpha <= 1 && Number.isFinite(node.position.x) && Number.isFinite(node.position.y) && Number.isFinite(node.scale.x) && Number.isFinite(node.rotation), `${mode} node finite`);
        assert.ok(Math.abs(node.position.x) <= width * 1.6 && Math.abs(node.position.y) <= height * 1.2, `${mode} stays near the stage`);
      }
      seen += 0.02;
    }
    assert.equal(contexts, before.contexts, 'no GraphicsContext after construction');
    assert.equal(shapes, before.shapes, 'no shape rebuilds per frame');
    assert.equal(layer.children.length, before.children, 'no display objects per frame');
    // Ceilings: at full strength the brightest node of each family stays under its ceiling.
    const [ringPeak, dotPeak, gridPeak] = [[deck.pool.stars + 1 + 5 + pool.rows + pool.fans + pool.spokes, pool.rings, SCENE_CEILINGS.ring], [layer.children.length - pool.dots, pool.dots, SCENE_CEILINGS.dot], [pool.stars + 1 + 5, pool.rows, SCENE_CEILINGS.grid]];
    for (const [mode, [start, count, ceiling]] of [['tunnel', ringPeak], ['particles', dotPeak], ['horizon', gridPeak]]) {
      for (let i = 0; i < 200; i++) deck.draw({ mode, time: 100 + i / 60, width: 1440, height: 900, level: 1, bass: 1, high: 1, beat: 1, intensity: 1, palette });
      const peak = Math.max(...layer.children.slice(start, start + count).map(node => node.visible ? node.alpha : 0));
      assert.ok(peak > 0 && peak <= ceiling + 1e-9, `${mode} peak ${peak} under ${ceiling}`);
    }
    // Off and zero intensity hide everything; reduceFlash dims below the loud value.
    deck.draw({ mode: 'off', time: 200, width: 1440, height: 900, level: 1, intensity: 1, palette });
    assert.ok(layer.children.every(node => !node.visible));
    deck.draw({ mode: 'tunnel', time: 200, width: 1440, height: 900, level: 1, intensity: 0, palette });
    assert.ok(layer.children.every(node => !node.visible));
    for (let i = 0; i < 120; i++) deck.draw({ mode: 'tunnel', time: 300 + i / 60, width: 1440, height: 900, level: 1, beat: 1, intensity: 1, palette });
    const loud = snapshot(layer);
    deck.draw({ mode: 'tunnel', time: 302, width: 1440, height: 900, level: 1, beat: 1, intensity: 1, reduceFlash: true, palette });
    const dim = snapshot(layer);
    assert.ok(loud.some((node, i) => node && dim[i] && dim[i][5] < node[5]), 'reduceFlash lowers ring alpha');
    deck.destroy();
    assert.ok(layer.children.every(node => node.destroyed));
  }
});

test('reduced motion renders identical frames regardless of time and audio, and the atmosphere reports the scene', () => {
  const layer = new Layer(), sceneLayer = new Layer();
  const atmosphere = createStackedAtmosphere({ layer, sceneLayer, Graphics, mobile: false });
  const still = settings({ accessibility: { reduceMotion: true } });
  const draw = (now, prefs, tick = 0) => { atmosphere.audio({ available: true, level: 800, bass: 900, high: 700, onset: true }, now); return atmosphere.draw({ now, tick, lines: 0, width: 1440, height: 900, settings: prefs, feedback: {} }); };
  for (let i = 0; i < 30; i++) draw(i * 16, still);
  const first = snapshot(sceneLayer);
  draw(9000, still); draw(9016, still);
  assert.deepEqual(snapshot(sceneLayer), first, 'reduced motion is static across time and beats');
  const live = settings();
  let info;
  for (let i = 0; i < 90; i++) info = draw(20000 + i * 16, live);
  assert.equal(info.scene, 'tunnel'); assert.equal(info.sceneName, SCENE_NAMES.tunnel); assert.equal(typeof info.sceneTransitions, 'number');
  assert.ok(sceneLayer.children.some(node => node.visible), 'the tunnel is drawn behind the worlds');
  assert.ok(info.signals && info.signals.level >= 0 && info.palette && info.palette.color === info.color, 'signals and palette ride along for the board');
  atmosphere.nextScene();
  for (let i = 0; i < 120; i++) info = draw(22000 + i * 16, live);
  assert.equal(info.scene, 'particles'); assert.equal(info.sceneTransitions, 1);
  live.video.scene = 'off';
  info = draw(24000, live);
  assert.equal(info.scene, 'off'); assert.ok(sceneLayer.children.every(node => !node.visible));
  atmosphere.destroy();
  assert.ok(sceneLayer.children.every(node => node.destroyed));
});

test('the renderer, shell and syntax gate wire the scene deck', () => {
  const renderer = readFileSync(new URL('../apps/stacked/src/render/renderer.mjs', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../apps/stacked/src/main.mjs', import.meta.url), 'utf8');
  const settings = readFileSync(new URL('../apps/portal/src/stacked-player-settings.mjs', import.meta.url), 'utf8');
  const syntax = readFileSync(new URL('../scripts/syntax-check.mjs', import.meta.url), 'utf8');
  assert.match(renderer, /sceneLayer:tree\.layers\.layerBackdrop/);
  assert.match(renderer, /dataset\.visualizerScene = info\.scene/);
  assert.match(renderer, /nextScene: \(\) => atmosphere\?\.nextScene\(\)/, 'fixed scenes stay reachable for QA');
  // The scene mode now persists in the parent settings; the legacy child key is only read there for migration.
  assert.match(settings, /stacked-visual-scenes-v1/);
  assert.doesNotMatch(main, /stacked-visual-scenes-v1/);
  assert.match(main, /expandStackedEffectsPreset/);
  assert.match(syntax, /apps\/stacked\/src\/render\/music-scenes\.mjs/);
  assert.match(syntax, /tests\/stacked-music-scenes\.test\.mjs/);
});
