import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stackedParentKnowsPresets, stackedPreferencesRequest, withStackedEffectsPreset } from '../apps/stacked/src/preferences-bridge.mjs';
import { STACKED_EFFECTS_PRESETS, defaultStackedSettings, expandStackedEffectsPreset, applyStackedPresentationPreferences } from '../apps/portal/src/stacked-player-settings.mjs';
import { validateStackedBridgeMessage, validateStackedBridgeSettings } from '../apps/portal/src/stacked-bridge-protocol.mjs';

// Deploy skew (settings review 2026-09-25): an arcade tab that loaded the 1.8.1
// host keeps its exact-key validator while a relaunch loads the new child. A
// rejected preferences request stops the host's message sequence, so every
// later child message, including the Ranked result, fails as out of order.

// The 1.8.1 host contract at 60ea173a, copied here because tests cannot read
// Git history: `game:preferences-request` accepted exactly these required keys
// plus any of the optional ones, and nothing else.
const V181_REQUIRED = Object.freeze(['reduceMotion', 'reducedEffects', 'audioReactive', 'ghostPiece', 'gridLines', 'sfxEnabled']);
const V181_OPTIONAL = Object.freeze(['visualizer', 'effectsIntensity', 'sfxVolume', 'colorblindPieces', 'reduceFlash', 'touchLeftHanded']);
const v181Accepts = payload => V181_REQUIRED.every(key => Object.hasOwn(payload, key))
  && Object.keys(payload).every(key => V181_REQUIRED.includes(key) || V181_OPTIONAL.includes(key));
// The 1.8.1 settings shape (no preset keys) and the 1.8.1 host's echo of a request.
const v181Settings = video => { const settings = defaultStackedSettings(); settings.video = { qualityTier: 'auto', reducedEffects: false, audioReactive: true, ghostPiece: true, gridLines: true, visualizer: 'journey', effectsIntensity: 0.7, ...video }; return settings; };
const v181Apply = (settings, p) => ({ ...settings,
  accessibility: { ...settings.accessibility, reduceMotion: p.reduceMotion, reduceFlash: p.reduceFlash ?? settings.accessibility.reduceFlash, colorblindPieces: p.colorblindPieces ?? settings.accessibility.colorblindPieces },
  controls: { ...settings.controls, touchLeftHanded: p.touchLeftHanded ?? settings.controls.touchLeftHanded },
  video: { ...settings.video, reducedEffects: p.reducedEffects, audioReactive: p.audioReactive, ghostPiece: p.ghostPiece, gridLines: p.gridLines, visualizer: p.visualizer ?? settings.video.visualizer ?? 'journey', effectsIntensity: p.effectsIntensity ?? settings.video.effectsIntensity ?? 0.7 },
  audio: { ...settings.audio, sfxEnabled: p.sfxEnabled, sfxVolume: p.sfxVolume ?? settings.audio.sfxVolume },
});
const envelope = payload => ({ protocol: 'stacked-bridge/v1', type: 'game:preferences-request', sessionId: 'test-session', messageId: 'game-1', payload });
const withPreset = preset => { const settings = defaultStackedSettings(); Object.assign(settings.video, expandStackedEffectsPreset(preset)); return settings; };

test('only a parent whose init settings carry a valid preset is treated as preset-aware', () => {
  assert.equal(stackedParentKnowsPresets(defaultStackedSettings()), true);
  assert.equal(stackedParentKnowsPresets({ ...defaultStackedSettings(), startLevel: 3 }), true, 'init settings add startLevel');
  assert.equal(stackedParentKnowsPresets(v181Settings()), false, 'a 1.8.1 host sends no preset');
  for (const bad of [undefined, null, {}, { video: null }, { video: { effectsPreset: 'lively' } }, { video: { effectsPreset: 'toString' } }]) assert.equal(stackedParentKnowsPresets(bad), false, JSON.stringify(bad));
});

test('a 1.8.1 host is sent only keys it accepts, and the current host still reads the same preset from them', () => {
  for (const preset of STACKED_EFFECTS_PRESETS) {
    const settings = withPreset(preset);
    const legacy = stackedPreferencesRequest(settings, { presets: false });
    assert.equal(v181Accepts(legacy), true, preset + ': a 1.8.1 host accepts the request, so its message sequence keeps advancing');
    assert.equal(validateStackedBridgeMessage(envelope(legacy)).ok, true, preset + ': the current host accepts it too');
    assert.equal(applyStackedPresentationPreferences(defaultStackedSettings(), legacy).video.effectsPreset, preset, preset + ': the legacy fields classify back exactly');
    const full = stackedPreferencesRequest(settings, { presets: true });
    assert.equal(v181Accepts(full), false, preset + ': the preset keys would stall a 1.8.1 host, which is why they are gated');
    assert.deepEqual([full.effectsPreset, full.scene, full.reactiveBoard], [preset, settings.video.scene, settings.video.reactiveBoard]);
    assert.equal(validateStackedBridgeMessage(envelope(full)).ok, true);
    assert.equal(applyStackedPresentationPreferences(defaultStackedSettings(), full).video.effectsPreset, preset);
    assert.deepEqual(Object.keys(full).filter(key => !Object.hasOwn(legacy, key)).sort(), ['effectsPreset', 'reactiveBoard', 'scene']);
  }
});

test('settings from a 1.8.1 host gain the nearest preset in the child copy', () => {
  for (const [video, preset] of [
    [{}, 'standard'], [{ effectsIntensity: 0 }, 'off'], [{ reducedEffects: true, effectsIntensity: 0.4 }, 'calm'],
    [{ audioReactive: false }, 'calm'], [{ effectsIntensity: 1 }, 'full'], [{ effectsIntensity: 0.9 }, 'full'],
  ]) {
    const settings = v181Settings(video);
    assert.equal(withStackedEffectsPreset(settings), settings, 'normalizes in place');
    assert.deepEqual({ ...settings.video }, { ...v181Settings(video).video, ...expandStackedEffectsPreset(preset) }, JSON.stringify(video));
    assert.equal(validateStackedBridgeSettings(settings), true);
  }
  // A preset-aware parent is the authority: its settings are not re-derived.
  const current = withPreset('full'); current.video.effectsIntensity = 0.9;
  const before = structuredClone(current);
  assert.deepEqual(withStackedEffectsPreset(current), before);
  assert.equal(withStackedEffectsPreset(undefined), undefined);
});

test('every preset survives a round trip through a 1.8.1 host echo', () => {
  for (const preset of STACKED_EFFECTS_PRESETS) {
    let host = v181Settings();
    const child = withStackedEffectsPreset(structuredClone(host));
    Object.assign(child.video, expandStackedEffectsPreset(preset));
    const request = stackedPreferencesRequest(child, { presets: stackedParentKnowsPresets(host) });
    assert.equal(v181Accepts(request), true);
    host = v181Apply(host, request);
    const echoed = withStackedEffectsPreset(structuredClone(host));
    assert.equal(echoed.video.effectsPreset, preset, preset + ': the radios stay on the player\'s choice');
    assert.deepEqual({ ...echoed.video }, { ...child.video }, preset + ': the renderer sees the same fields');
  }
});

test('the request carries every projection preference and nothing that affects play', () => {
  const settings = withPreset('calm');
  Object.assign(settings.accessibility, { reduceMotion: true, reduceFlash: false, colorblindPieces: true });
  Object.assign(settings.video, { ghostPiece: false, gridLines: false, visualizer: 'orbit' });
  Object.assign(settings.audio, { sfxVolume: 0, sfxEnabled: false });
  settings.controls.touchLeftHanded = true;
  settings.startLevel = 9; settings.handling.dasMs = 67;
  assert.deepEqual(stackedPreferencesRequest(settings, { presets: true }), {
    reduceMotion: true, reducedEffects: true, audioReactive: false, ghostPiece: false, gridLines: false, sfxEnabled: false,
    effectsPreset: 'calm', scene: 'off', reactiveBoard: false, effectsIntensity: 0.4, visualizer: 'orbit', sfxVolume: 0,
    colorblindPieces: true, reduceFlash: false, touchLeftHanded: true,
  });
});

test('the child gates the preset keys on the init settings and normalizes both inbound settings paths', async () => {
  const main = await readFile(new URL('../apps/stacked/src/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /import \{ stackedParentKnowsPresets, stackedPreferencesRequest, withStackedEffectsPreset \} from '\.\/preferences-bridge\.mjs';/);
  assert.match(main, /parentPresets = stackedParentKnowsPresets\(init\.settings\); settings = withStackedEffectsPreset\(structuredClone\(init\.settings\)\)/);
  assert.match(main, /settings = withStackedEffectsPreset\(structuredClone\(message\.payload\.settings\)\)/);
  assert.match(main, /bridge\.send\('game:preferences-request', stackedPreferencesRequest\(settings, \{ presets: parentPresets \}\)\)/);
  assert.doesNotMatch(main, /effectsPreset: video\.effectsPreset/, 'the payload is built in one tested place');
});
