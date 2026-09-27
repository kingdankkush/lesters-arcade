// Perf step 8: the lazy runtime extras (runtime-extras.mjs) and what hangs off
// them: cabinet haptics, the ?perf=1 overlay, hidden warm-up renders, rotating
// control tips and the QA hooks (?q= tier pin, ?t= pre-roll, waitFrames).
// All of it is projection or tooling; the pins at the end prove main.mjs only
// reaches it through one dynamic import and that no simulation module does.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

import { createCabinetHaptics } from '../apps/portal/src/cabinet-haptics.mjs';
import { PERF_REFRESH_MS, PERF_WINDOW_MS, formatPerfLines, mountPerfOverlay, summarizeFrames } from '../apps/hmh-reboot/src/perf-overlay.mjs';
import { WARMUP_FRAMES, warmRenderer } from '../apps/hmh-reboot/src/render-warmup.mjs';
import { DESKTOP_TIPS, TIP_INTERVAL_MS, TOUCH_TIPS, startStartupTips } from '../apps/hmh-reboot/src/startup-tips.mjs';
import { createFrameWaiter, installRuntimeExtras } from '../apps/hmh-reboot/src/runtime-extras.mjs';
import { RUNTIME_PERFORMANCE_PROFILES } from '../apps/hmh-reboot/src/runtime-performance.mjs';

const src = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

// ---------------------------------------------------------------------------
// Shared cabinet haptics (the API another branch converges on).
// ---------------------------------------------------------------------------

function hapticsFixture({ enabled = true, reduced = false, pads = [] } = {}) {
  const vibrations = [];
  const effects = [];
  const pad = { vibrationActuator: { playEffect: (type, params) => { effects.push({ type, ...params }); return Promise.resolve('complete'); } } };
  const haptics = createCabinetHaptics({
    navigatorRef: { vibrate: (ms) => vibrations.push(ms) },
    getGamepads: () => [null, ...pads.map(() => pad)],
    enabled: () => enabled,
    reducedMotion: () => reduced,
  });
  return { haptics, vibrations, effects };
}

test('cabinet haptics: five named patterns, vibrate plus one dual-rumble scaled by intensity', () => {
  const { haptics, vibrations, effects } = hapticsFixture({ pads: [1, 2] });
  for (const [name, ms] of [['tap', 8], ['hit', 20], ['death', 60], ['clear', 15], ['big', 40]]) assert.equal(haptics.pulse(name), true, name);
  assert.deepEqual(vibrations, [8, 20, 60, 15, 40]);
  assert.equal(effects.length, 5, 'only the first pad with an actuator rumbles');
  assert.deepEqual(effects[1], { type: 'dual-rumble', duration: 20, strongMagnitude: 1, weakMagnitude: 0.6 });
  haptics.pulse('big', 0.5);
  assert.deepEqual(effects.at(-1), { type: 'dual-rumble', duration: 40, strongMagnitude: 0.5, weakMagnitude: 0.3 });
  haptics.pulse('hit', 7);
  assert.equal(effects.at(-1).strongMagnitude, 1, 'intensity clamps to 1');
  for (const junk of ['toString', 'constructor', 'boom', '', undefined]) assert.equal(haptics.pulse(junk), false, String(junk));
  assert.equal(haptics.pulse('hit', 0), false);
  assert.ok(Object.isFrozen(haptics));
});

test('cabinet haptics are a no-op when disabled or under reduced motion, and survive missing or throwing APIs', () => {
  for (const options of [{ enabled: false }, { reduced: true }]) {
    const { haptics, vibrations, effects } = hapticsFixture({ ...options, pads: [1] });
    assert.equal(haptics.pulse('death'), false);
    assert.deepEqual([vibrations, effects], [[], []]);
  }
  const bare = createCabinetHaptics({ navigatorRef: {}, getGamepads: () => undefined });
  assert.equal(bare.pulse('tap'), true);
  const hostile = createCabinetHaptics({
    navigatorRef: { vibrate() { throw new Error('blocked'); } },
    getGamepads: () => [{ vibrationActuator: { playEffect() { throw new Error('unsupported'); } } }],
  });
  assert.doesNotThrow(() => hostile.pulse('big'));
  assert.doesNotMatch(src('apps/portal/src/cabinet-haptics.mjs'), /^\s*import\s/mu, 'no imports');
});

// ---------------------------------------------------------------------------
// ?perf=1 overlay.
// ---------------------------------------------------------------------------

function fakeDocument() {
  const appended = [];
  const makeElement = (tag) => {
    const attributes = new Map();
    return {
      tag, style: {}, dataset: {}, textContent: '', className: '', removed: false,
      setAttribute: (key, value) => attributes.set(key, value),
      getAttribute: (key) => attributes.get(key) ?? null,
      remove() { this.removed = true; },
      after(node) { appended.push(node); },
      append(node) { appended.push(node); },
    };
  };
  return { appended, createElement: makeElement, body: makeElement('body') };
}

test('the overlay summarizes a 2 s window: fps, average and p95 frame time', () => {
  assert.equal(PERF_WINDOW_MS, 2000);
  assert.deepEqual({ ...summarizeFrames([]) }, { fps: 0, avgMs: 0, p95Ms: 0, frames: 0 });
  const steady = summarizeFrames(Array(120).fill(1000 / 60));
  assert.equal(Math.round(steady.fps), 60);
  const spiky = summarizeFrames([...Array(95).fill(16), ...Array(5).fill(50), Number.NaN, -1]);
  assert.equal(spiky.frames, 100);
  assert.equal(spiky.p95Ms, 50);
  assert.equal(spiky.avgMs.toFixed(1), '17.7');
  const lines = formatPerfLines(steady, { enemies: 42, projectiles: 7, tier: 'auto', profile: 'mobile', effects: 'reduced', resolution: 1.5, canvas: '621x1344', textures: 'half' });
  assert.deepEqual(lines, ['60 fps  16.7 ms avg  16.7 p95', 'enemies 42  shots 7', 'tier auto/mobile  fx reduced', 'res 1.50x  621x1344  tex half']);
});

test('the overlay paints from its own frame clock every 500 ms, survives a throwing stats getter, and removes itself', () => {
  const documentRef = fakeDocument();
  let time = 0;
  const queue = [];
  let calls = 0;
  const overlay = mountPerfOverlay({
    documentRef,
    stats: () => { calls += 1; if (calls === 1) throw new Error('not yet'); return { enemies: 3, tier: 'low', profile: 'low', resolution: 1, textures: 'half' }; },
    now: () => time,
    requestFrame: (callback) => { queue.push(callback); return queue.length; },
    cancelFrame: () => {},
  });
  assert.equal(documentRef.appended[0], overlay.element);
  assert.equal(overlay.element.getAttribute('aria-hidden'), 'true');
  assert.equal(overlay.element.style.pointerEvents, 'none', 'never blocks touch controls');
  for (let frame = 0; frame < 90; frame += 1) { time += 1000 / 30; queue.shift()(); }
  assert.match(overlay.element.textContent, /^30 fps/u);
  assert.match(overlay.element.textContent, /tier low\/low/u);
  assert.equal(overlay.element.dataset.fps, '30.0');
  assert.ok(calls >= Math.floor(90 * (1000 / 30) / PERF_REFRESH_MS) - 1);
  overlay.destroy();
  assert.equal(overlay.element.removed, true);
  const pending = queue.length;
  queue.shift()?.();
  assert.equal(queue.length, Math.max(0, pending - 1), 'a destroyed overlay stops scheduling frames');
});

// ---------------------------------------------------------------------------
// Hidden warm-up renders.
// ---------------------------------------------------------------------------

class FakeContainer {
  constructor() { this.children = []; this.destroyed = false; }
  addChild(child) { this.children.push(child); }
  destroy(options) { this.destroyed = true; this.destroyOptions = options; }
}
class FakeSprite {
  constructor({ texture }) { this.texture = texture; this.position = { set: (x, y) => { this.x = x; this.y = y; } }; }
}

test('warm-up renders every texture in a normal and an additive layer offscreen twice, then frees only its sprites', () => {
  assert.equal(WARMUP_FRAMES, 2);
  const renders = [];
  const renderer = { generateTexture: ({ target, resolution }) => { renders.push({ target, resolution }); return { destroy: (all) => renders.at(-1).freed = all }; } };
  const atlas = { id: 'gas-bomber' }, glow = { id: 'core' }, dead = { destroyed: true };
  assert.equal(warmRenderer({ renderer, ContainerClass: FakeContainer, SpriteClass: FakeSprite, textures: [atlas, glow, atlas, null, dead] }), 2);
  assert.equal(renders.length, 2);
  const root = renders[0].target;
  assert.deepEqual(root.children.map((layer) => layer.blendMode), ['normal', 'add']);
  for (const layer of root.children) assert.deepEqual(layer.children.map((sprite) => sprite.texture), [atlas, glow]);
  assert.ok(renders.every((render) => render.freed === true && render.resolution === 1), 'each throwaway target is destroyed');
  assert.equal(root.destroyed, true);
  assert.deepEqual(root.destroyOptions, { children: true }, 'sprites go, textures stay with their atlases');
  assert.equal(warmRenderer({ renderer, ContainerClass: FakeContainer, SpriteClass: FakeSprite, textures: [] }), 0);
  assert.equal(warmRenderer({ renderer: {}, ContainerClass: FakeContainer, SpriteClass: FakeSprite, textures: [atlas] }), 0);
});

// ---------------------------------------------------------------------------
// Rotating control tips.
// ---------------------------------------------------------------------------

function tipsFixture({ busy = 'true', hidden = false } = {}) {
  const documentRef = fakeDocument();
  const panel = { hidden, attrs: { 'aria-busy': busy }, getAttribute(key) { return this.attrs[key] ?? null; } };
  const anchor = { after: (node) => documentRef.appended.push(node) };
  const timers = [];
  let observer = null;
  class FakeObserver { constructor(callback) { this.callback = callback; observer = this; } observe(target, options) { this.target = target; this.options = options; } disconnect() { this.disconnected = true; } }
  return { documentRef, panel, anchor, timers, getObserver: () => observer, FakeObserver, setIntervalRef: (callback, ms) => { timers.push({ callback, ms, cleared: false }); return timers.length - 1; }, clearIntervalRef: (id) => { timers[id].cleared = true; } };
}

test('one decorative tip rotates under the loading copy and leaves the moment loading ends', () => {
  const fixture = tipsFixture();
  startStartupTips({ documentRef: fixture.documentRef, panel: fixture.panel, anchor: fixture.anchor, touch: false, setIntervalRef: fixture.setIntervalRef, clearIntervalRef: fixture.clearIntervalRef, ObserverClass: fixture.FakeObserver });
  const line = fixture.documentRef.appended[0];
  assert.equal(line.getAttribute('aria-hidden'), 'true', 'not a live region');
  assert.equal(line.textContent, `Tip: ${DESKTOP_TIPS[0]}`);
  assert.equal(fixture.timers[0].ms, TIP_INTERVAL_MS);
  fixture.timers[0].callback();
  assert.equal(line.textContent, `Tip: ${DESKTOP_TIPS[1]}`);
  assert.deepEqual(fixture.getObserver().options, { attributes: true, attributeFilter: ['aria-busy', 'hidden'] });
  fixture.panel.attrs['aria-busy'] = 'false';
  fixture.getObserver().callback();
  assert.equal(line.removed, true);
  assert.equal(fixture.timers[0].cleared, true);
  assert.equal(fixture.getObserver().disconnected, true);
});

test('touch devices get touch tips; a panel that is already ready gets none; tips never mention voices, footsteps or dash keys', () => {
  const fixture = tipsFixture();
  startStartupTips({ documentRef: fixture.documentRef, panel: fixture.panel, anchor: fixture.anchor, touch: true, setIntervalRef: fixture.setIntervalRef, clearIntervalRef: fixture.clearIntervalRef, ObserverClass: fixture.FakeObserver });
  assert.equal(fixture.documentRef.appended[0].textContent, `Tip: ${TOUCH_TIPS[0]}`);
  const ready = tipsFixture({ busy: 'false' });
  startStartupTips({ documentRef: ready.documentRef, panel: ready.panel, anchor: ready.anchor, setIntervalRef: ready.setIntervalRef });
  assert.equal(ready.documentRef.appended.length, 0);
  assert.equal(ready.timers.length, 0);
  for (const tip of [...DESKTOP_TIPS, ...TOUCH_TIPS]) {
    assert.ok(tip.length <= 80, tip);
    assert.doesNotMatch(tip, /voice|footstep|Space/iu, tip);
  }
});

// ---------------------------------------------------------------------------
// Runtime extras: QA waiter gating, haptics wiring, governor passthrough.
// ---------------------------------------------------------------------------

function extrasFixture({ embedded = false, search = '', settings = { screenShake: true, reduceMotion: false }, reducedMotionQuery = false } = {}) {
  const pulses = [];
  const frames = [];
  const windowRef = {
    devicePixelRatio: 1,
    requestAnimationFrame: (callback) => frames.push(callback),
    matchMedia: () => ({ matches: reducedMotionQuery }),
    navigator: {},
  };
  const app = { renderer: { resolution: 1 }, screen: { width: 1280, height: 720 }, canvas: { width: 1280, height: 720 }, resize() {} };
  const extras = installRuntimeExtras({ app, dataset: {}, params: new URLSearchParams(search), embedded, settings: () => settings, windowRef, documentRef: fakeDocument() });
  return { extras, windowRef, frames, pulses, app };
}

test('waitFrames resolves after n animation frames and is installed standalone or in evidence mode only', async () => {
  const frames = [];
  const wait = createFrameWaiter((callback) => frames.push(callback));
  let done = false;
  const promise = wait(3).then(() => { done = true; });
  frames.shift()(); frames.shift()();
  await Promise.resolve();
  assert.equal(done, false);
  frames.shift()();
  await promise;
  assert.equal(done, true);
  assert.equal(typeof extrasFixture().windowRef.__HMH?.waitFrames, 'function', 'standalone');
  assert.equal(typeof extrasFixture({ embedded: true, search: 'evidenceSafe=1' }).windowRef.__HMH?.waitFrames, 'function', 'evidence smoke');
  assert.equal(extrasFixture({ embedded: true }).windowRef.__HMH, undefined, 'a real portal session gets no QA hook');
});

test('the extras govern resolution and atmosphere, and pulse haptics only while shake is on and motion is allowed', () => {
  const fixture = extrasFixture();
  assert.equal(fixture.extras.sample(16), null, 'no governor before govern()');
  assert.deepEqual(fixture.extras.atmosphere({ fog: 10, motes: 30 }), { fog: 10, motes: 30 });
  const governor = fixture.extras.govern({ quality: 'auto', profile: { ...RUNTIME_PERFORMANCE_PROFILES.desktop, resolution: 1 } });
  assert.equal(fixture.extras.governor, governor);
  assert.equal(fixture.app.renderer.resolution, 1);
  assert.equal(fixture.extras.pulse('hit'), true);
  assert.equal(extrasFixture({ settings: { screenShake: false } }).extras.pulse('hit'), false);
  assert.equal(extrasFixture({ settings: { screenShake: true, reduceMotion: true } }).extras.pulse('hit'), false);
  assert.equal(extrasFixture({ reducedMotionQuery: true }).extras.pulse('hit'), false, 'the OS reduced-motion preference wins too');
  assert.equal(fixture.extras.warm([]), 0);
  const throwing = installRuntimeExtras({ app: { renderer: { generateTexture() { throw new Error('context lost'); } } }, ContainerClass: FakeContainer, SpriteClass: FakeSprite, windowRef: {}, documentRef: fakeDocument() });
  assert.equal(throwing.warm([{ id: 'atlas' }]), 0, 'a failed warm-up never throws into the ticker or an atlas load');
  // An evidence session never takes the effects rung.
  const evidence = extrasFixture({ embedded: true, search: 'evidenceSafe=1' });
  const pinned = evidence.extras.govern({ quality: 'auto', profile: { ...RUNTIME_PERFORMANCE_PROFILES.desktop, resolution: 1 } });
  assert.deepEqual(pinned.ladder.rungs.map((rung) => rung.effects), ['full']);
  assert.ok(Object.isFrozen(fixture.extras));
});

// ---------------------------------------------------------------------------
// Wiring pins: one lazy import, the QA hooks' guards, and sim isolation.
// ---------------------------------------------------------------------------

test('main.mjs reaches every step-8 module through the lazy extras only; the overlay is a second, perf-only import', () => {
  const main = src('apps/hmh-reboot/src/main.mjs');
  for (const module of ['runtime-extras', 'graphics-governor', 'perf-overlay', 'render-warmup', 'startup-tips', 'cabinet-haptics']) {
    assert.doesNotMatch(main, new RegExp(`^import[^;]*${module}\\.mjs`, 'mu'), `${module} is not in the initial graph`);
  }
  assert.equal((main.match(/import\('\.\/runtime-extras\.mjs'\)/gu) ?? []).length, 1);
  const extras = src('apps/hmh-reboot/src/runtime-extras.mjs');
  assert.match(extras, /if \(params\.get\('perf'\) === '1'\) \{\s*import\('\.\/perf-overlay\.mjs'\)/u, 'the overlay downloads only for ?perf=1');
  assert.doesNotMatch(extras, /^import[^;]*perf-overlay/mu);
  // Haptic moments: player hit, player death, grenade blast, boss phase.
  for (const pin of [
    /lastPlayerHit = \{ tick, sourceId: damageEvent\.sourceId, knockback: damageEvent\.knockback \};\s*extras\?\.pulse\('hit'\);/u,
    /combatAudio\.play\('game-over', \{ volume: 0\.18 \}\);\s*extras\?\.pulse\('death'\);/u,
    /combatAudio\.play\('grenade-boom', \{ volume: 0\.16 \}\);\s*extras\?\.pulse\('big', 0\.8\);/u,
    /combatAudio\.play\('boss-phase', \{ volume: 0\.14 \}\); extras\?\.pulse\('big'\);/u,
  ]) assert.match(main, pin, String(pin));
  // Warm-up: each enemy atlas as it lands, and the bakes before reveal.
  assert.match(main, /enemyRosterTextures\.set\(archetypeId, texture\);\s*extras\?\.warm\(\[texture\]\);/u);
  assert.match(main, /if \(ready && entryButton\.disabled\) \{ renderWorld\(\); extras\?\.warm\(\[\.\.\.enemyRosterTextures\.values\(\), \.\.\.Object\.values\(weaponVfxPool\?\.textures \?\? \{\}\), \.\.\.Object\.values\(atmospherePool\?\.textures \?\? \{\}\)\]\);/u);
});

test('the ?t= pre-roll is standalone only, bounded, idle-input fixed steps before the first gameplay frame', () => {
  const main = src('apps/hmh-reboot/src/main.mjs');
  assert.match(main, /let prerollTicks = bridge \? 0 : Math\.min\(108_000, Math\.max\(0, Math\.floor\(Number\(runtimeParams\.get\('t'\)\) \|\| 0\)\)\);/u, 'a portal child (every Ranked run) never pre-rolls');
  const reveal = main.indexOf("input.reset('artwork-ready', performance.now());");
  const loop = main.indexOf('for (; prerollTicks > 0 && simulation.state === \'active\'; prerollTicks -= 1) {');
  assert.ok(reveal > 0 && loop > reveal && loop - reveal < 200, 'the pre-roll runs at reveal, after the artwork gate');
  assert.match(main.slice(loop, loop + 400), /simulation\.update\(simulation\.fixedStepMs, idle\.actions, idle\.heldActions\);/u, 'one fixed step per call, through the normal simulation entry');
  // The host forwards only evidenceSafe and terminalPilot.
  const host = src('apps/portal/src/hmh-reboot-host.mjs');
  assert.doesNotMatch(host, /runtimeParams\.set\('(?:q|t|graphics)'/u);
});

test('no simulation module imports the step-8 extras', () => {
  const dir = new URL('../apps/hmh-reboot/src/', import.meta.url);
  const allowed = new Set(['main.mjs', 'runtime-extras.mjs']);
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.mjs') || allowed.has(file)) continue;
    assert.doesNotMatch(readFileSync(new URL(file, dir), 'utf8'), /(?:runtime-extras|graphics-governor|perf-overlay|render-warmup|startup-tips|cabinet-haptics)\.mjs['"]/u, file);
  }
  for (const file of ['graphics-governor.mjs', 'perf-overlay.mjs', 'render-warmup.mjs', 'startup-tips.mjs', 'runtime-extras.mjs']) {
    assert.doesNotMatch(readFileSync(new URL(file, dir), 'utf8'), /simulation\.mjs|Math\.random|deterministicUnit/u, `${file} stays out of the simulation and its RNG`);
  }
});
