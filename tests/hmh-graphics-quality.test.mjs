// Perf step 7: the player-facing Graphics Quality setting.
//
// Auto is the device selection the runtime always had (profile plus adaptive
// sharpness). Low, Medium and High pin one runtime-performance profile. Every
// value here only decides how much art is drawn and at what resolution: none
// is read by the simulation, so the setting cannot change a tick, a hit, a
// spawn or a result (scripts/hmh-sim-digest.mjs proves the digest after the
// change). The key rides the existing settings channel as an optional string,
// so a parent that never sends it leaves the child on Auto.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

import {
  GRAPHICS_QUALITY_TIERS,
  RUNTIME_PERFORMANCE_PROFILES,
  createProfileTextureLoader,
  normalizeGraphicsQuality,
  profileTextureUrl,
  resolveGraphicsQualityProfile,
  selectRuntimePerformanceProfile,
} from '../apps/hmh-reboot/src/runtime-performance.mjs';
import { resolveAtmosphereBudget } from '../apps/hmh-reboot/src/world-atmosphere.mjs';
import { HMH_BRIDGE_PROTOCOL, createBridgeEnvelope, validateChildMessage, validateParentMessage } from '../sdk/hmh-bridge-protocol.mjs';
import {
  HMH_PLAYER_SETTINGS_DEFAULTS,
  mergeHmhRuntimeSettings,
  normalizeHmhPlayerSettings,
  projectHmhRuntimeSettings,
} from '../apps/portal/src/hmh-player-settings.mjs';
import { createHmhChildBridge } from '../apps/hmh-reboot/src/bridge.mjs';
import { createHmhRebootHost } from '../apps/portal/src/hmh-reboot-host.mjs';

const src = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const { desktop, mobile, reducedMotion, low } = RUNTIME_PERFORMANCE_PROFILES;
const phone = selectRuntimePerformanceProfile({ width: 414, devicePixelRatio: 3, coarsePointer: true, reduceMotion: false });
const laptop = selectRuntimePerformanceProfile({ width: 1440, devicePixelRatio: 2, coarsePointer: false, reduceMotion: false });
const still = selectRuntimePerformanceProfile({ width: 1440, devicePixelRatio: 1, coarsePointer: false, reduceMotion: true });
const PILOT_PAGE = '/assets/generated/hmh-reboot-production-heroes/lit-commando/lit-commando-pilot.webp';

// ---------------------------------------------------------------------------
// Tiers and the profile each one pins.
// ---------------------------------------------------------------------------

test('the four tiers are auto, low, medium and high; anything else normalizes to auto', () => {
  assert.deepEqual([...GRAPHICS_QUALITY_TIERS], ['auto', 'low', 'medium', 'high']);
  assert.ok(Object.isFrozen(GRAPHICS_QUALITY_TIERS));
  for (const tier of GRAPHICS_QUALITY_TIERS) assert.equal(normalizeGraphicsQuality(tier), tier);
  for (const junk of [undefined, null, '', 'ultra', 'LOW', 1, true, {}, ['low']]) assert.equal(normalizeGraphicsQuality(junk), 'auto', String(junk));
});

test('the low profile keeps the mobile caps and margins, draws fewer marks and particles, and turns contact shadows off', () => {
  assert.ok(Object.isFrozen(low));
  assert.equal(low.id, 'low');
  assert.equal(low.resolutionCap, 1);
  assert.equal(low.antialias, false);
  assert.equal(low.particlesPerHazard, 2);
  assert.equal(low.worldCullMargin, mobile.worldCullMargin);
  assert.equal(low.enemyCullMargin, mobile.enemyCullMargin);
  assert.equal(low.maxAnimatedEnemies, mobile.maxAnimatedEnemies);
  assert.equal(low.maxGoreMarks, 8);
  assert.equal(low.contactShadows, false);
  // The three device profiles are byte-for-byte what perf step 6 left: the
  // Auto tier is today's behaviour.
  assert.deepEqual({ ...desktop }, { id: 'desktop', resolutionCap: 2, antialias: true, particlesPerHazard: 10, worldCullMargin: 192, enemyCullMargin: 224, maxAnimatedEnemies: 96, maxGoreMarks: 48 });
  assert.deepEqual({ ...mobile }, { id: 'mobile', resolutionCap: 1, antialias: false, particlesPerHazard: 4, worldCullMargin: 128, enemyCullMargin: 160, maxAnimatedEnemies: 24, maxGoreMarks: 16 });
  assert.deepEqual({ ...reducedMotion }, { id: 'reduced-motion', resolutionCap: 1, antialias: false, particlesPerHazard: 0, worldCullMargin: 96, enemyCullMargin: 128, maxAnimatedEnemies: 48, maxGoreMarks: 48 });
});

test('auto returns the device profile itself; low, medium and high pin the low, mobile and desktop profiles at the device DPR', () => {
  for (const autoProfile of [phone, laptop, still]) {
    assert.equal(resolveGraphicsQualityProfile({ quality: 'auto', autoProfile, devicePixelRatio: 3 }), autoProfile);
    assert.equal(resolveGraphicsQualityProfile({ quality: 'nonsense', autoProfile, devicePixelRatio: 3 }), autoProfile);
    assert.equal(resolveGraphicsQualityProfile({ autoProfile, devicePixelRatio: 3 }), autoProfile);
  }
  const lowOnPhone = resolveGraphicsQualityProfile({ quality: 'low', autoProfile: phone, devicePixelRatio: 3 });
  assert.deepEqual({ ...lowOnPhone }, { ...low, resolution: 1 });
  assert.ok(Object.isFrozen(lowOnPhone));
  const mediumOnPhone = resolveGraphicsQualityProfile({ quality: 'medium', autoProfile: phone, devicePixelRatio: 3 });
  assert.deepEqual({ ...mediumOnPhone }, { ...mobile, resolution: 1 }, 'medium is the mobile profile');
  const highOnPhone = resolveGraphicsQualityProfile({ quality: 'high', autoProfile: phone, devicePixelRatio: 3 });
  assert.deepEqual({ ...highOnPhone }, { ...desktop, resolution: 2 }, 'high is the desktop profile, capped at 2');
  assert.equal(resolveGraphicsQualityProfile({ quality: 'high', autoProfile: laptop, devicePixelRatio: 1 }).resolution, 1);
  assert.equal(resolveGraphicsQualityProfile({ quality: 'medium', autoProfile: laptop, devicePixelRatio: 2 }).resolution, 1);
  assert.equal(resolveGraphicsQualityProfile({ quality: 'low', autoProfile: laptop, devicePixelRatio: 2 }).antialias, false);
  assert.equal(resolveGraphicsQualityProfile({ quality: 'high', autoProfile: phone, devicePixelRatio: 3 }).antialias, true);
  assert.throws(() => resolveGraphicsQualityProfile({ quality: 'low', devicePixelRatio: 1 }), /autoProfile/);
  assert.throws(() => resolveGraphicsQualityProfile({ quality: 'low', autoProfile: phone, devicePixelRatio: 0 }), /devicePixelRatio/);
});

test('an explicit tier keeps the OS reduced-motion stillness: particles stay at zero, everything else follows the tier', () => {
  for (const quality of ['low', 'medium', 'high']) {
    const profile = resolveGraphicsQualityProfile({ quality, autoProfile: still, devicePixelRatio: 2 });
    assert.equal(profile.particlesPerHazard, 0, quality);
    assert.notEqual(profile.id, 'reduced-motion', quality);
  }
  assert.equal(resolveGraphicsQualityProfile({ quality: 'high', autoProfile: still, devicePixelRatio: 2 }).maxAnimatedEnemies, desktop.maxAnimatedEnemies);
  assert.equal(resolveGraphicsQualityProfile({ quality: 'high', autoProfile: still, devicePixelRatio: 2 }).antialias, true);
});

test('low loads the half-resolution pages like mobile; high keeps the full pages', async () => {
  assert.equal(profileTextureUrl(PILOT_PAGE, low), profileTextureUrl(PILOT_PAGE, mobile));
  assert.match(profileTextureUrl(PILOT_PAGE, low), /@0\.5x\.webp$/u);
  assert.equal(profileTextureUrl(PILOT_PAGE, resolveGraphicsQualityProfile({ quality: 'high', autoProfile: phone, devicePixelRatio: 3 })), PILOT_PAGE);
  assert.equal(profileTextureUrl(PILOT_PAGE, resolveGraphicsQualityProfile({ quality: 'medium', autoProfile: laptop, devicePixelRatio: 1 })), profileTextureUrl(PILOT_PAGE, mobile));
  const Assets = { load: async (url) => ({ url }) };
  assert.equal(createProfileTextureLoader(Assets, resolveGraphicsQualityProfile({ quality: 'high', autoProfile: phone, devicePixelRatio: 3 })), Assets);
  assert.deepEqual(await createProfileTextureLoader(Assets, low).load(PILOT_PAGE), { url: profileTextureUrl(PILOT_PAGE, mobile) });
});

test('low draws a minimal atmosphere: one fog bank and three motes; the other budgets are unchanged', () => {
  assert.deepEqual(resolveAtmosphereBudget(low), { fog: 1, motes: 3 });
  assert.deepEqual(resolveAtmosphereBudget(mobile), { fog: 2, motes: 6 });
  assert.deepEqual(resolveAtmosphereBudget(desktop), { fog: 10, motes: 30 });
  assert.deepEqual(resolveAtmosphereBudget(reducedMotion), { fog: 0, motes: 0 });
  assert.deepEqual(resolveAtmosphereBudget(resolveGraphicsQualityProfile({ quality: 'low', autoProfile: still, devicePixelRatio: 1 })), { fog: 0, motes: 0 });
});

// ---------------------------------------------------------------------------
// Bridge contract: optional, exact, backward compatible.
// ---------------------------------------------------------------------------

const baseSettings = { musicEnabled: true, screenShake: true, gore: false, reduceMotion: false, reduceFlash: false, colorblindTags: false };
const parentInit = (settings) => createBridgeEnvelope({
  type: 'portal:init', sessionId: 'game-session-000000001', messageId: 'portal-1',
  payload: {
    gameId: 'lester-blaster', mode: 'free', heroId: 'lit-commando',
    profile: { displayName: 'Guest', locale: 'en' },
    session: { seed: 1234567890, buildHash: 'site-48:game-48', seasonId: 'season-1', rankedEligible: false },
    settings,
  },
});
const parentSettings = (settings) => createBridgeEnvelope({ type: 'portal:settings', sessionId: 'game-session-000000001', messageId: 'portal-2', payload: { settings } });
const childSettings = (settings) => createBridgeEnvelope({ type: 'game:settings', sessionId: 'game-session-000000001', messageId: 'game-2', payload: { settings } });

test('graphicsQuality is an optional exact string on portal:init, portal:settings and game:settings', () => {
  assert.equal(validateParentMessage(parentInit(baseSettings)).ok, true, 'a parent that never sends the key still passes');
  assert.equal(validateChildMessage(childSettings(baseSettings)).ok, true);
  for (const tier of GRAPHICS_QUALITY_TIERS) {
    const settings = { ...baseSettings, graphicsQuality: tier };
    assert.equal(validateParentMessage(parentInit(settings)).ok, true, tier);
    assert.equal(validateParentMessage(parentSettings(settings)).ok, true, tier);
    assert.equal(validateChildMessage(childSettings(settings)).ok, true, tier);
  }
  for (const bad of ['ultra', 'Low', '', 1, null, true, ['low'], { tier: 'low' }]) {
    const settings = { ...baseSettings, graphicsQuality: bad };
    const parent = validateParentMessage(parentInit(settings));
    assert.equal(parent.ok, false, String(bad));
    assert.match(parent.error, /graphicsQuality/u);
    assert.equal(validateParentMessage(parentSettings(settings)).ok, false, String(bad));
    assert.equal(validateChildMessage(childSettings(settings)).ok, false, String(bad));
  }
});

// ---------------------------------------------------------------------------
// Parent persistence row (apps/portal/src/hmh-player-settings.mjs): the one
// portal file this step touches, so the choice survives a reload and reaches
// the child in portal:init. No schema version change: the row has a default.
// ---------------------------------------------------------------------------

test('the persisted settings gain a graphics domain that defaults to auto and rejects junk', () => {
  assert.equal(HMH_PLAYER_SETTINGS_DEFAULTS.graphics.quality, 'auto');
  assert.equal(HMH_PLAYER_SETTINGS_DEFAULTS.version, 1, 'additive row, no schema bump');
  assert.equal(normalizeHmhPlayerSettings().graphics.quality, 'auto');
  assert.equal(normalizeHmhPlayerSettings({ graphics: { quality: 'low' } }).graphics.quality, 'low');
  assert.equal(normalizeHmhPlayerSettings({ graphics: { quality: 'ultra' } }).graphics.quality, 'auto');
  assert.equal(normalizeHmhPlayerSettings({ graphics: 'high' }).graphics.quality, 'auto');
  assert.equal(normalizeHmhPlayerSettings({ graphicsQuality: 'high' }).graphics.quality, 'high', 'flat legacy key migrates');
  // A persisted record written before this row (no graphics domain) still
  // normalizes and lands on Auto.
  const legacy = JSON.parse(JSON.stringify(HMH_PLAYER_SETTINGS_DEFAULTS));
  delete legacy.graphics;
  assert.equal(normalizeHmhPlayerSettings(legacy).graphics.quality, 'auto');
  assert.ok(Object.isFrozen(normalizeHmhPlayerSettings().graphics));
});

test('the runtime projection sends graphicsQuality and the merge accepts the child echo, ranked or not', () => {
  assert.equal(projectHmhRuntimeSettings().graphicsQuality, 'auto');
  assert.equal(projectHmhRuntimeSettings({ graphics: { quality: 'medium' } }).graphicsQuality, 'medium');
  const merged = mergeHmhRuntimeSettings(HMH_PLAYER_SETTINGS_DEFAULTS, { graphicsQuality: 'high' });
  assert.equal(merged.graphics.quality, 'high');
  assert.equal(mergeHmhRuntimeSettings(HMH_PLAYER_SETTINGS_DEFAULTS, { graphicsQuality: 'low' }, { rankedActive: true }).graphics.quality, 'low', 'a projection-only choice is never ranked-locked');
  assert.equal(mergeHmhRuntimeSettings(merged, { musicVolume: 0.2 }).graphics.quality, 'high', 'an echo without the key keeps the stored tier');
  assert.equal(mergeHmhRuntimeSettings(merged, { graphicsQuality: 'ultra' }).graphics.quality, 'auto', 'junk from the channel normalizes, it is never stored raw');
  // The projected settings validate on the wire with and without the row.
  assert.equal(validateParentMessage(parentInit(projectHmhRuntimeSettings(merged))).ok, true);
});

// ---------------------------------------------------------------------------
// Boot-time delivery: the child reads the parked portal:init before it creates
// its renderer, so antialias and texture pages can follow the tier at boot.
// ---------------------------------------------------------------------------

class FakePort {
  constructor() { this.sent = []; this.onmessage = null; }
  postMessage(message) { this.sent.push(message); }
  start() {}
  close() {}
  emit(data) { this.onmessage?.({ data }); }
}
class FakeWindow {
  constructor() { this.parent = { name: 'portal' }; this.listeners = new Map(); }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  removeEventListener(type) { this.listeners.delete(type); }
  emitMessage(event) { this.listeners.get('message')?.(event); }
}
function childFixture({ deferInitialization }) {
  const windowRef = new FakeWindow();
  const port = new FakePort();
  const pending = [];
  const initializations = [];
  const errors = [];
  const bridge = createHmhChildBridge({
    windowRef,
    expectedParentOrigin: 'https://arcade.test',
    runtimeInfo: { runtimeVersion: '0.1.0', renderer: 'pixi.js', capabilities: ['pause', 'settings'] },
    deferInitialization,
    onInitPending: (payload) => pending.push(payload),
    onInit: (payload) => initializations.push(payload),
    onProtocolError: (error) => errors.push(error),
  });
  bridge.start();
  windowRef.emitMessage({ origin: 'https://arcade.test', source: windowRef.parent, data: { protocol: HMH_BRIDGE_PROTOCOL, type: 'portal:connect', nonce: 'nonce-1234567890abcdef' }, ports: [port] });
  return { port, bridge, pending, initializations, errors };
}

test('a deferred child bridge surfaces the parked portal:init settings before activation, once, validated', () => {
  const { port, bridge, pending, initializations, errors } = childFixture({ deferInitialization: true });
  port.emit(parentInit({ ...baseSettings, graphicsQuality: 'ultra' }));
  assert.equal(pending.length, 0, 'an invalid init never reaches the boot hook');
  assert.equal(errors.length, 1);
  port.emit(parentInit({ ...baseSettings, graphicsQuality: 'high' }));
  assert.equal(pending.length, 1);
  assert.equal(pending[0].settings.graphicsQuality, 'high');
  assert.equal(initializations.length, 0, 'the session is still parked');
  assert.equal(bridge.initialized, false);
  assert.equal(port.sent.length, 0, 'READY waits for activation');
  bridge.activate();
  assert.equal(initializations.length, 1);
  assert.equal(pending.length, 1);
  assert.equal(port.sent[0].type, 'game:ready');
});

test('an immediate child bridge initializes straight away and never calls the boot hook', () => {
  const fixture = childFixture({ deferInitialization: false });
  fixture.port.emit(parentInit(baseSettings));
  assert.equal(fixture.pending.length, 0);
  assert.equal(fixture.initializations.length, 1);
  assert.equal(fixture.errors.length, 0);
});

test('the portal host never forwards a ?graphics= override into a portal-hosted session', () => {
  const documentRef = {
    documentElement: { dataset: {} },
    createElement: () => ({ dataset: {}, setAttribute() {}, addEventListener() {}, focus() {}, contentWindow: { postMessage() {} } }),
  };
  const host = createHmhRebootHost({
    mount: { replaceChildren() {} }, expectedOrigin: 'https://arcade.test', documentRef,
    bridgeFactory: () => ({ connect() {}, send() {}, destroy() {} }), setTimeoutRef: () => 1, clearTimeoutRef: () => {},
    runtimeSearch: '?evidenceSafe=1&graphics=low',
  });
  const frame = host.mountSession({
    sessionId: 'graphics-guard', gameId: 'lester-blaster', mode: 'free', heroId: 'lit-commando',
    profile: { displayName: 'Guard', locale: 'en' },
    session: { seed: 1, buildHash: 'guard', seasonId: 'season-1', rankedEligible: false },
    settings: baseSettings,
  });
  assert.equal(new URL(frame.src).searchParams.has('graphics'), false, 'the tier reaches a portal session only through settings');
});

// ---------------------------------------------------------------------------
// Runtime wiring pins (main.mjs), the pause-panel control and sim isolation.
// ---------------------------------------------------------------------------

test('main.mjs resolves the tier after the bridge starts and before the renderer or the texture loader exist', () => {
  const main = src('apps/hmh-reboot/src/main.mjs');
  const bridgeStart = main.indexOf('bridge.start()');
  const resolved = main.indexOf('performanceProfile = resolveGraphicsQualityProfile({ quality: bootGraphicsQuality,');
  const loader = main.indexOf('const textureAssets = createProfileTextureLoader(Assets, performanceProfile)');
  const appInit = main.indexOf('await app.init(');
  assert.ok(bridgeStart > 0 && resolved > bridgeStart, 'the tier is read after the handshake listener is up');
  assert.ok(loader > resolved && appInit > loader, 'the loader and the renderer see the resolved profile');
  assert.match(main, /const autoPerformanceProfile = selectRuntimePerformanceProfile\(\{/u);
  assert.match(main, /let performanceProfile = autoPerformanceProfile;/u);
  assert.match(main, /const graphicsOverride = runtimeParams\.get\('graphics'\);/u, 'the bench and standalone runs pin a tier from the URL');
  assert.match(main, /onInitPending: \(payload\) => resolveBootSettings\(payload\.settings\)/u);
  assert.match(main, /antialias: performanceProfile\.antialias/u);
  assert.match(main, /resolution: performanceProfile\.resolution/u);
  // A standalone page (no parent) never waits: only an embedded child races
  // the parked init against the boot budget.
  assert.match(main, /graphicsOverride \?\? \(bridge\s*\?/u);
});

test('main.mjs applies a tier change live to the caps, budgets, contact shadows and resolution, and reports it', () => {
  const main = src('apps/hmh-reboot/src/main.mjs');
  assert.match(main, /let atmosphereBudget = resolveAtmosphereBudget\(performanceProfile\)/u);
  assert.match(main, /let particleScale = performanceProfile\.particlesPerHazard/u);
  assert.match(main, /const bakedContactShadowPool = contactShadowPool;/u);
  assert.match(main, /if \(performanceProfile\.contactShadows === false\) contactShadowPool = null;/u, 'Low starts without contact shadows');
  assert.match(main, /let adaptiveResolution = createResolutionPolicy\(\);/u);
  assert.match(main, /max: graphicsQuality === 'auto' && performanceProfile\.id === 'mobile' \? Math\.min\(1\.5,/u, 'only Auto steps the resolution up');
  const apply = main.indexOf('const applyGraphicsQuality = (requested) => {');
  assert.ok(apply > 0);
  const body = main.slice(apply, main.indexOf('\n  };', apply));
  for (const pin of [
    /normalizeGraphicsQuality\(graphicsOverride \?\? requested\)/u,
    /performanceProfile = resolveGraphicsQualityProfile\(\{ quality, autoProfile: autoPerformanceProfile,/u,
    /atmosphereBudget = resolveAtmosphereBudget\(performanceProfile\)/u,
    /particleScale = performanceProfile\.particlesPerHazard/u,
    /contactShadowPool = performanceProfile\.contactShadows === false \? null : bakedContactShadowPool/u,
    /groundShadowLayer\.visible = contactShadowPool !== null/u,
    /adaptiveResolution = createResolutionPolicy\(\)/u,
    /app\.renderer\.resolution = adaptiveResolution\.resolution/u,
    /dataset\.graphicsQuality = quality/u,
  ]) assert.match(body, pin, String(pin));
  assert.match(main, /applyGraphicsQuality\(settings\.graphicsQuality\);/u, 'every settings sync re-reads the tier');
  assert.match(main, /onSettingChoice: applyPauseChoice,/u);
  assert.match(main, /graphicsQuality: normalizeGraphicsQuality\(value\) \}, \{ notify: true \}\)/u, 'the pause choice echoes over game:settings so the portal persists it');
});

test('the pause panel offers the four tiers in a child-owned select beside the SFX slider', () => {
  const html = src('apps/portal/hmh-reboot/index.html');
  const css = src('apps/portal/hmh-reboot/styles.css');
  const pauseStart = html.indexOf('id="hmhPausePanel"');
  const pauseEnd = html.indexOf('hmh-menu-actions', pauseStart);
  const panel = html.slice(pauseStart, pauseEnd);
  const select = /<select id="hmhSettingGraphicsQuality"[^>]*>([\s\S]*?)<\/select>/u.exec(panel);
  assert.ok(select, 'the select lives inside the pause panel');
  assert.deepEqual([...select[1].matchAll(/<option value="([a-z]+)">([A-Za-z]+)<\/option>/gu)].map((m) => [m[1], m[2]]),
    [['auto', 'Auto'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High']]);
  assert.match(panel, /<label class="hmh-setting-range hmh-setting-choice">[\s\S]*?id="hmhSettingGraphicsQuality"[\s\S]*?<\/label>/u);
  assert.equal((html.match(/class="hmh-setting-toggle"/gu) ?? []).length, 4, 'the four toggles keep their pins');
  assert.match(css, /\.hmh-setting-choice select[^}]*min-height:\s*44px/u, 'a 44px touch target');
  const cockpit = src('apps/hmh-reboot/src/cockpit-ui.mjs');
  assert.match(cockpit, /getElementById\('hmhSettingGraphicsQuality'\)/u, 'optional: an older shell without the row still boots');
  assert.match(cockpit, /onSettingChoice\('graphicsQuality', /u);
});

test('no simulation module reads the tier or the tier resolver', () => {
  const dir = new URL('../apps/hmh-reboot/src/', import.meta.url);
  const allowed = new Set(['main.mjs', 'runtime-performance.mjs', 'cockpit-ui.mjs']);
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.mjs') || allowed.has(file)) continue;
    assert.doesNotMatch(readFileSync(new URL(file, dir), 'utf8'), /graphicsQuality|resolveGraphicsQualityProfile|normalizeGraphicsQuality/u, file);
  }
  const bench = src('scripts/hmh-perf-crowd-bench.mjs');
  assert.match(bench, /options\.graphics/u, 'the crowd bench can pin a tier per run');
});
