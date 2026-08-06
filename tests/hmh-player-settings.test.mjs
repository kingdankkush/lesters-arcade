import assert from 'node:assert/strict';
import test from 'node:test';

import {
  HMH_PLAYER_SETTINGS_DEFAULTS,
  HMH_PLAYER_SETTINGS_VERSION,
  mergeHmhRuntimeSettings,
  normalizeHmhPlayerSettings,
  projectHmhRuntimeSettings,
  rebindHmhPlayerKeyboard,
} from '../apps/portal/src/hmh-player-settings.mjs';

test('M5 persisted settings schema owns controls, gameplay, audio, and accessibility domains', () => {
  const settings = normalizeHmhPlayerSettings();
  assert.equal(settings.version, HMH_PLAYER_SETTINGS_VERSION);
  assert.deepEqual(Object.keys(settings), ['version', 'controls', 'gameplay', 'audio', 'accessibility']);
  assert.equal(settings.controls.keyboardBindings.fire, 'Space');
  assert.equal(settings.audio.dynamicRange, 'standard');
  assert.equal(settings.accessibility.hudScale, 1);
  assert.ok(Object.isFrozen(settings));
});

test('M5 flat legacy preferences migrate with bounded values and no unknown fields', () => {
  const settings = normalizeHmhPlayerSettings({
    screenShake: false,
    gore: false,
    autoAimAssist: false,
    reduceMotion: true,
    touchControlOpacity: 99,
    musicVolume: -4,
    unknown: 'drop-me',
  });
  assert.equal(settings.gameplay.screenShake, false);
  assert.equal(settings.gameplay.gore, false);
  assert.equal(settings.gameplay.autoAimAssist, false);
  assert.equal(settings.accessibility.reduceMotion, true);
  assert.equal(settings.controls.touchOpacity, 0.8);
  assert.equal(settings.audio.musicVolume, 0);
  assert.equal('unknown' in settings, false);
});

test('M4 ranked runs lock rebinding while free/menu settings remain editable', () => {
  const rebound = rebindHmhPlayerKeyboard(HMH_PLAYER_SETTINGS_DEFAULTS, 'fire', 'KeyR');
  assert.equal(rebound.controls.keyboardBindings.fire, 'KeyR');
  assert.throws(() => rebindHmhPlayerKeyboard(rebound, 'fire', 'KeyT', { rankedActive: true }), /locked during an active ranked run/i);
});

test('M5 runtime projection sends only bounded child-relevant settings', () => {
  const runtime = projectHmhRuntimeSettings(normalizeHmhPlayerSettings({
    audio: { musicVolume: 0.4, sfxVolume: 0.7, uiVolume: 0.6, dynamicRange: 'night' },
    controls: { gamepadDeadzone: 0.25, gamepadSensitivity: 1.3, touchSensitivity: 0.8, touchScale: 1.2, touchLeftHanded: true, aimAssistStrength: 0.4 },
    accessibility: { hudScale: 1.15, captions: false },
  }));
  assert.equal(runtime.musicVolume, 0.4);
  assert.equal(runtime.sfxVolume, 0.7);
  assert.equal(runtime.uiVolume, 0.6);
  assert.equal(runtime.dynamicRange, 'night');
  assert.equal(runtime.gamepadDeadzone, 0.25);
  assert.equal(runtime.gamepadSensitivity, 1.3);
  assert.equal(runtime.touchSensitivity, 0.8);
  assert.equal(runtime.touchLeftHanded, true);
  assert.equal(runtime.aimAssistStrength, 0.4);
  assert.equal(runtime.touchScale, 1.2);
  assert.equal(runtime.hudScale, 1.15);
  assert.equal(runtime.captionCriticalAudio, false);
  assert.equal(Object.keys(runtime.keyboardBindings).length, 14);
});

test('M5 parent accepts bounded runtime settings but preserves ranked keyboard authority', () => {
  const current = rebindHmhPlayerKeyboard(HMH_PLAYER_SETTINGS_DEFAULTS, 'fire', 'KeyR');
  const incoming = {
    ...projectHmhRuntimeSettings(current),
    keyboardBindings: HMH_PLAYER_SETTINGS_DEFAULTS.controls.keyboardBindings,
    gamepadDeadzone: 0.3,
    musicVolume: 0.25,
  };
  const ranked = mergeHmhRuntimeSettings(current, incoming, { rankedActive: true });
  assert.equal(ranked.controls.keyboardBindings.fire, 'KeyR');
  assert.equal(ranked.controls.gamepadDeadzone, 0.3);
  assert.equal(ranked.audio.musicVolume, 0.25);
  const free = mergeHmhRuntimeSettings(current, incoming);
  assert.equal(free.controls.keyboardBindings.fire, 'Space');
});
