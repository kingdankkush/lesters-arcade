import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as playerSettings from '../apps/portal/src/stacked-player-settings.mjs';
import { defaultStackedSettings, readStackedSettings, saveStackedSettings, applyStackedPresentationPreferences } from '../apps/portal/src/stacked-player-settings.mjs';
import { validateStackedBridgeMessage, validateStackedBridgeSettings } from '../apps/portal/src/stacked-bridge-protocol.mjs';
test('settings survive reload, preserve safe defaults and never recover unaccepted input timing', () => {
  let raw;
  const storage = {setItem:(k,v)=>{raw=v;},getItem:()=>raw};
  const settings = defaultStackedSettings();
  settings.accessibility.reduceMotion = true; settings.video.gridLines = false; settings.handling.arrMs = 1;
  assert.equal(saveStackedSettings(storage, settings), true);
  const restored = readStackedSettings(storage);
  assert.equal(restored.accessibility.reduceMotion, true); assert.equal(restored.video.gridLines, false);
  assert.equal(restored.handling.arrMs, 33); assert.equal(validateStackedBridgeSettings(restored), true);
  assert.equal(saveStackedSettings({setItem(){throw Error('quota');}}, settings), false);
});
test('preference requests accept only bounded projection choices', () => {
  const m = {protocol:'stacked-bridge/v1', type:'game:preferences-request', sessionId:'test-session', messageId:'game-1', payload:{reduceMotion:true,reducedEffects:false,audioReactive:true,ghostPiece:true,gridLines:true,sfxEnabled:true}};
  assert.equal(validateStackedBridgeMessage(m).ok, true);
  assert.equal(validateStackedBridgeMessage({...m,payload:{...m.payload,startLevel:15}}).ok, false);
});

test('left-handed layout and flash preferences roundtrip without changing handling', () => {
  const settings=defaultStackedSettings(),p={reduceMotion:false,reducedEffects:false,audioReactive:true,ghostPiece:true,gridLines:true,sfxEnabled:true,reduceFlash:false,touchLeftHanded:true};
  const updated=applyStackedPresentationPreferences(settings,p);
  let raw; const storage={setItem:(k,v)=>{raw=v;},getItem:()=>raw};
  saveStackedSettings(storage,updated); const restored=readStackedSettings(storage);
  assert.equal(restored.controls.touchLeftHanded,true);assert.equal(restored.accessibility.reduceFlash,false);
  assert.deepEqual(restored.handling,settings.handling);
  assert.equal(validateStackedBridgeMessage({protocol:'stacked-bridge/v1',type:'game:preferences-request',sessionId:'test-session',messageId:'game-1',payload:p}).ok,true);
});

// Settings simplification (owner direction 2026-09-24): one Effects preset
// replaces intensity, minimal effects, React to music, the backdrop scene and
// the music-reactive board toggle. Everything persists under the parent key.
const memory = (initial = {}) => {
  const data = { ...initial }, writes = [];
  return { data, writes, getItem: key => (Object.hasOwn(data, key) ? data[key] : null), setItem: (key, value) => { writes.push(key); data[key] = String(value); } };
};
const PARENT_KEY = 'stacked-player-settings-v1', LEGACY_KEY = 'stacked-visual-scenes-v1';
const noOs = { prefersReducedMotion: false };
const presetRequest = (overrides = {}) => ({ reduceMotion: false, reducedEffects: false, audioReactive: true, ghostPiece: true, gridLines: true, sfxEnabled: true, ...overrides });

test('each effects preset expands to one fixed set of renderer fields; unknown presets fall back to standard', () => {
  const { STACKED_EFFECTS_PRESETS, STACKED_SCENE_MODES, STACKED_LEGACY_SCENES_KEY, expandStackedEffectsPreset } = playerSettings;
  assert.deepEqual([...STACKED_EFFECTS_PRESETS], ['off', 'calm', 'standard', 'full']);
  assert.deepEqual([...STACKED_SCENE_MODES], ['auto', 'off']);
  assert.equal(STACKED_LEGACY_SCENES_KEY, LEGACY_KEY);
  assert.ok(Object.isFrozen(STACKED_EFFECTS_PRESETS) && Object.isFrozen(STACKED_SCENE_MODES));
  assert.deepEqual(expandStackedEffectsPreset('off'), { effectsPreset: 'off', effectsIntensity: 0, reducedEffects: true, audioReactive: false, scene: 'off', reactiveBoard: false });
  assert.deepEqual(expandStackedEffectsPreset('calm'), { effectsPreset: 'calm', effectsIntensity: 0.4, reducedEffects: true, audioReactive: false, scene: 'off', reactiveBoard: false });
  assert.deepEqual(expandStackedEffectsPreset('standard'), { effectsPreset: 'standard', effectsIntensity: 0.7, reducedEffects: false, audioReactive: true, scene: 'auto', reactiveBoard: true });
  assert.deepEqual(expandStackedEffectsPreset('full'), { effectsPreset: 'full', effectsIntensity: 1, reducedEffects: false, audioReactive: true, scene: 'auto', reactiveBoard: true });
  for (const bad of ['lively', undefined, null, 3, 'toString', '__proto__']) assert.deepEqual(expandStackedEffectsPreset(bad), expandStackedEffectsPreset('standard'), String(bad));
  const first = expandStackedEffectsPreset('full'); first.effectsIntensity = 0;
  assert.equal(expandStackedEffectsPreset('full').effectsIntensity, 1, 'every call returns a fresh object');
});

test('legacy effect fields classify into the nearest preset', () => {
  const classify = playerSettings.stackedEffectsPresetFromLegacy;
  for (const [input, expected] of [
    [{}, 'standard'], [undefined, 'standard'],
    [{ effectsIntensity: 0 }, 'off'], [{ effectsIntensity: 0, reducedEffects: false }, 'off'],
    [{ reducedEffects: true }, 'calm'], [{ audioReactive: false }, 'calm'], [{ effectsIntensity: 0.35 }, 'calm'],
    [{ scene: 'off' }, 'calm'], [{ reactiveBoard: false }, 'calm'], [{ effectsIntensity: 0.9, reducedEffects: true }, 'calm'],
    [{ effectsIntensity: 0.9 }, 'full'], [{ effectsIntensity: 0.85 }, 'full'], [{ effectsIntensity: 1, scene: 'horizon', reactiveBoard: true }, 'full'],
    [{ effectsIntensity: 0.7 }, 'standard'], [{ effectsIntensity: 0.55 }, 'standard'],
    [{ effectsIntensity: NaN }, 'standard'], [{ effectsIntensity: 99 }, 'standard'], [{ effectsIntensity: -1 }, 'standard'], [{ effectsIntensity: '0' }, 'standard'],
  ]) assert.equal(classify(input), expected, JSON.stringify(input));
});

test('defaults: Standard effects, reduced flashes on, 35% game sound, and a valid bridge payload', () => {
  const settings = defaultStackedSettings();
  assert.equal(settings.video.effectsPreset, 'standard');
  assert.equal(settings.video.scene, 'auto'); assert.equal(settings.video.reactiveBoard, true);
  assert.equal(settings.video.effectsIntensity, 0.7); assert.equal(settings.video.reducedEffects, false); assert.equal(settings.video.audioReactive, true);
  assert.equal(settings.accessibility.reduceFlash, true, 'reduced flashes stay on by default as the safety option');
  assert.equal(settings.audio.sfxVolume, 0.35); assert.equal(settings.audio.sfxEnabled, true);
  assert.equal(validateStackedBridgeSettings(settings), true);
  assert.equal(validateStackedBridgeSettings({ ...settings, startLevel: 1 }, { initial: true }), true);
  const read = readStackedSettings(memory(), false, noOs);
  assert.deepEqual(read, settings);
  assert.equal(validateStackedBridgeSettings(read), true);
});

test('a saved preset wins over stale derived fields beside it', () => {
  const storage = memory({ [PARENT_KEY]: JSON.stringify({ video: { effectsPreset: 'calm', effectsIntensity: 1, reducedEffects: false, audioReactive: true, scene: 'auto', reactiveBoard: true } }) });
  const read = readStackedSettings(storage, false, noOs);
  assert.deepEqual({ ...read.video }, { ...defaultStackedSettings().video, effectsPreset: 'calm', effectsIntensity: 0.4, reducedEffects: true, audioReactive: false, scene: 'off', reactiveBoard: false });
});

test('the legacy child scene key migrates into the parent settings read-only', () => {
  const legacy = JSON.stringify({ scene: 'off', reactiveBoard: true });
  const storage = memory({ [LEGACY_KEY]: legacy });
  const read = readStackedSettings(storage, false, noOs);
  assert.equal(read.video.effectsPreset, 'calm');
  assert.equal(storage.data[LEGACY_KEY], legacy, 'the legacy key stays for a 1.8.1 rollback');
  assert.deepEqual(storage.writes, [], 'reading never writes');
  assert.equal(readStackedSettings(memory({ [LEGACY_KEY]: JSON.stringify({ scene: 'horizon', reactiveBoard: false }) }), false, noOs).video.effectsPreset, 'calm');
  assert.equal(readStackedSettings(memory({ [LEGACY_KEY]: JSON.stringify({ scene: 'tunnel', reactiveBoard: true }) }), false, noOs).video.effectsPreset, 'standard');
  assert.equal(readStackedSettings(memory({ [LEGACY_KEY]: JSON.stringify({ scene: 'warp', reactiveBoard: 'no' }) }), false, noOs).video.effectsPreset, 'standard', 'unknown legacy values are ignored');
  // A saved parent preset beats the legacy key.
  const both = memory({ [LEGACY_KEY]: legacy, [PARENT_KEY]: JSON.stringify({ video: { effectsPreset: 'full' } }) });
  assert.equal(readStackedSettings(both, false, noOs).video.effectsPreset, 'full');
  // A malformed legacy key cannot drop parent values, and a malformed parent key cannot drop the legacy classification.
  const badLegacy = memory({ [LEGACY_KEY]: '{oops', [PARENT_KEY]: JSON.stringify({ video: { gridLines: false, effectsIntensity: 0.9 }, accessibility: { colorblindPieces: true } }) });
  const kept = readStackedSettings(badLegacy, false, noOs);
  assert.equal(kept.video.gridLines, false); assert.equal(kept.accessibility.colorblindPieces, true); assert.equal(kept.video.effectsPreset, 'full');
  assert.equal(readStackedSettings(memory({ [LEGACY_KEY]: legacy, [PARENT_KEY]: '{oops' }), false, noOs).video.effectsPreset, 'calm');
  const throwing = { getItem(key) { if (key === PARENT_KEY) throw new Error('blocked'); return legacy; } };
  assert.equal(readStackedSettings(throwing, false, noOs).video.effectsPreset, 'calm');
  assert.deepEqual(readStackedSettings({ getItem() { throw new Error('blocked'); } }, false, noOs), defaultStackedSettings());
  assert.deepEqual(readStackedSettings(undefined, false, noOs), defaultStackedSettings());
});

test('1.8.1 saves classify from their derived fields and keep every other preference', () => {
  const saved181 = { ...defaultStackedSettings(), video: { qualityTier: 'auto', reducedEffects: true, audioReactive: true, ghostPiece: false, gridLines: true, visualizer: 'aurora', effectsIntensity: 0.7 } };
  const read = readStackedSettings(memory({ [PARENT_KEY]: JSON.stringify(saved181) }), false, noOs);
  assert.equal(read.video.effectsPreset, 'calm'); assert.equal(read.video.ghostPiece, false); assert.equal(read.video.visualizer, 'aurora');
  assert.equal(validateStackedBridgeSettings(read), true);
  // Only the documented projection preferences are recovered; derived and unknown fields are rebuilt.
  const injected = readStackedSettings(memory({ [PARENT_KEY]: JSON.stringify({ video: { effectsPreset: 'full', qualityTier: 'mobile', scene: 'horizon', extra: true }, accessibility: { hudScale: 2 }, audio: { musicEnabled: false } }) }), false, noOs);
  assert.equal(injected.video.qualityTier, 'auto'); assert.equal(injected.video.scene, 'auto'); assert.equal(Object.hasOwn(injected.video, 'extra'), false);
  assert.equal(injected.accessibility.hudScale, 1); assert.equal(injected.audio.musicEnabled, false);
  assert.equal(validateStackedBridgeSettings(injected), true);
});

test('game sound is one volume: zero means off and an old disabled toggle reads as zero', () => {
  const read = audio => { const value = readStackedSettings(memory({ [PARENT_KEY]: JSON.stringify({ audio }) }), false, noOs).audio; return [value.sfxVolume, value.sfxEnabled]; };
  assert.deepEqual(read({ sfxEnabled: false, sfxVolume: 0.35 }), [0, false]);
  assert.deepEqual(read({ sfxVolume: 0 }), [0, false]);
  assert.deepEqual(read({ sfxVolume: 0.2 }), [0.2, true]);
  assert.deepEqual(read({ sfxEnabled: true, sfxVolume: 2 }), [0.35, true]);
});

test('the OS reduced-motion preference seeds the first run; a saved choice wins', () => {
  assert.equal(readStackedSettings(memory(), false, { prefersReducedMotion: true }).accessibility.reduceMotion, true);
  assert.equal(readStackedSettings(memory(), true, noOs).accessibility.reduceMotion, true, 'the arcade setting still seeds it');
  assert.equal(readStackedSettings(memory(), false, noOs).accessibility.reduceMotion, false);
  const saved = memory({ [PARENT_KEY]: JSON.stringify({ accessibility: { reduceMotion: false } }) });
  assert.equal(readStackedSettings(saved, true, { prefersReducedMotion: true }).accessibility.reduceMotion, false);
  assert.equal(readStackedSettings(memory()).accessibility.reduceMotion, false, 'Node has no matchMedia, so the default seed is off');
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'matchMedia');
  try {
    globalThis.matchMedia = query => ({ matches: query === '(prefers-reduced-motion: reduce)' });
    assert.equal(readStackedSettings(memory()).accessibility.reduceMotion, true, 'the browser seed reads prefers-reduced-motion');
    globalThis.matchMedia = () => { throw new Error('unsupported'); };
    assert.equal(readStackedSettings(memory()).accessibility.reduceMotion, false);
  } finally { if (previous) Object.defineProperty(globalThis, 'matchMedia', previous); else delete globalThis.matchMedia; }
});

test('read, save and read again is stable for every preset and seed', () => {
  for (const preset of ['off', 'calm', 'standard', 'full']) for (const seed of [false, true]) {
    const storage = memory({ [PARENT_KEY]: JSON.stringify({ video: { effectsPreset: preset, visualizer: 'orbit' }, audio: { sfxVolume: 0.5 } }) });
    const first = readStackedSettings(storage, seed, { prefersReducedMotion: seed });
    assert.equal(saveStackedSettings(storage, first), true);
    const second = readStackedSettings(storage, seed, { prefersReducedMotion: seed });
    assert.deepEqual(second, first, preset);
    assert.equal(validateStackedBridgeSettings(second), true);
    assert.equal(validateStackedBridgeSettings({ ...second, startLevel: 1 }, { initial: true }), true);
  }
});

test('the host applies a preferences request authoritatively: the preset expansion overrides whatever derived fields the child sent', () => {
  const settings = defaultStackedSettings();
  const off = applyStackedPresentationPreferences(settings, presetRequest({ effectsPreset: 'off', effectsIntensity: 1, reducedEffects: false, audioReactive: true, scene: 'auto', reactiveBoard: true }));
  assert.deepEqual({ ...off.video }, { ...settings.video, effectsPreset: 'off', effectsIntensity: 0, reducedEffects: true, audioReactive: false, scene: 'off', reactiveBoard: false });
  assert.deepEqual(off.handling, settings.handling); assert.deepEqual(off.controls.keyboardBindings, settings.controls.keyboardBindings);
  const legacy = applyStackedPresentationPreferences(settings, presetRequest({ reducedEffects: true }));
  assert.equal(legacy.video.effectsPreset, 'calm', 'a request without a preset uses the legacy classification');
  assert.equal(applyStackedPresentationPreferences(settings, presetRequest({ effectsIntensity: 0.95 })).video.effectsPreset, 'full');
  assert.equal(applyStackedPresentationPreferences(settings, presetRequest({ scene: 'off' })).video.effectsPreset, 'calm');
  const muted = applyStackedPresentationPreferences(settings, presetRequest({ sfxEnabled: false, sfxVolume: 0.6 }));
  assert.deepEqual([muted.audio.sfxVolume, muted.audio.sfxEnabled], [0, false]);
  const quiet = applyStackedPresentationPreferences(settings, presetRequest({ sfxVolume: 0 }));
  assert.deepEqual([quiet.audio.sfxVolume, quiet.audio.sfxEnabled], [0, false]);
  const loud = applyStackedPresentationPreferences(settings, presetRequest({ sfxVolume: 0.8, effectsPreset: 'full' }));
  assert.deepEqual([loud.audio.sfxVolume, loud.audio.sfxEnabled, loud.video.effectsPreset], [0.8, true, 'full']);
  for (const updated of [off, legacy, muted, quiet, loud]) assert.equal(validateStackedBridgeSettings(updated), true);
});

test('Ranked start level is untouched: the child still builds its session from the parent start level only', async () => {
  const main = await readFile(new URL('../apps/stacked/src/main.mjs', import.meta.url), 'utf8');
  assert.ok(main.includes('createStackedPlaySession({ ...init.session, mode: init.mode, startLevel: settings.startLevel })'));
  const settings = defaultStackedSettings();
  assert.equal(Object.hasOwn(settings, 'startLevel'), false, 'settings never carry a start level; the portal adds it at init');
  assert.equal(Object.hasOwn(applyStackedPresentationPreferences(settings, presetRequest({ effectsPreset: 'full' })), 'startLevel'), false);
  assert.deepEqual(applyStackedPresentationPreferences(settings, presetRequest({ effectsPreset: 'off' })).handling, { dasMs: 133, arrMs: 33, dcdMs: 0, cancelDas: true }, 'handling stays at the contract constants');
});
