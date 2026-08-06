import { DEFAULT_KEYBOARD_BINDINGS, normalizeKeyboardBindings, rebindKeyboardAction } from '../../hmh-reboot/src/action-map.mjs';

export const HMH_PLAYER_SETTINGS_VERSION = 1;
const clamp = (value, min, max, fallback) => Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Number(value))) : fallback;
const bool = (value, fallback) => typeof value === 'boolean' ? value : fallback;
const freeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};

export const HMH_PLAYER_SETTINGS_DEFAULTS = freeze({
  version: HMH_PLAYER_SETTINGS_VERSION,
  controls: {
    keyboardBindings: { ...DEFAULT_KEYBOARD_BINDINGS },
    gamepadDeadzone: 0.2,
    gamepadSensitivity: 1,
    touchSensitivity: 1,
    pointerSensitivity: 1,
    aimAssistStrength: 0.25,
    touchScale: 1,
    touchOpacity: 0.4,
    touchLeftHanded: false,
  },
  gameplay: {
    screenShake: true,
    gore: true,
    autoEnterFullscreen: true,
    autoAimAssist: true,
  },
  audio: {
    musicEnabled: true,
    sfxEnabled: true,
    uiEnabled: true,
    musicVolume: 0.7,
    sfxVolume: 0.85,
    uiVolume: 0.8,
    dynamicRange: 'standard',
  },
  accessibility: {
    reduceMotion: false,
    reduceFlash: false,
    colorblindTags: false,
    captions: true,
    hudScale: 1,
  },
});

export function normalizeHmhPlayerSettings(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const controls = source.controls && typeof source.controls === 'object' ? source.controls : source;
  const gameplay = source.gameplay && typeof source.gameplay === 'object' ? source.gameplay : source;
  const audio = source.audio && typeof source.audio === 'object' ? source.audio : source;
  const accessibility = source.accessibility && typeof source.accessibility === 'object' ? source.accessibility : source;
  return freeze({
    version: HMH_PLAYER_SETTINGS_VERSION,
    controls: {
      keyboardBindings: normalizeKeyboardBindings(controls.keyboardBindings),
      gamepadDeadzone: clamp(controls.gamepadDeadzone, 0.05, 0.5, 0.2),
      gamepadSensitivity: clamp(controls.gamepadSensitivity, 0.5, 2, 1),
      touchSensitivity: clamp(controls.touchSensitivity, 0.5, 2, 1),
      pointerSensitivity: clamp(controls.pointerSensitivity, 0.5, 2, 1),
      aimAssistStrength: clamp(controls.aimAssistStrength, 0, 1, 0.25),
      touchScale: clamp(controls.touchScale, 0.75, 1.5, 1),
      touchOpacity: clamp(controls.touchOpacity ?? controls.touchControlOpacity, 0.2, 0.8, 0.4),
      touchLeftHanded: bool(controls.touchLeftHanded, false),
    },
    gameplay: {
      screenShake: bool(gameplay.screenShake, true),
      gore: bool(gameplay.gore, true),
      autoEnterFullscreen: bool(gameplay.autoEnterFullscreen, true),
      autoAimAssist: bool(gameplay.autoAimAssist, true),
    },
    audio: {
      musicEnabled: bool(audio.musicEnabled, true),
      sfxEnabled: bool(audio.sfxEnabled, true),
      uiEnabled: bool(audio.uiEnabled, true),
      musicVolume: clamp(audio.musicVolume, 0, 1, 0.7),
      sfxVolume: clamp(audio.sfxVolume, 0, 1, 0.85),
      uiVolume: clamp(audio.uiVolume, 0, 1, 0.8),
      dynamicRange: ['standard', 'night', 'wide'].includes(audio.dynamicRange) ? audio.dynamicRange : 'standard',
    },
    accessibility: {
      reduceMotion: bool(accessibility.reduceMotion, false),
      reduceFlash: bool(accessibility.reduceFlash, false),
      colorblindTags: bool(accessibility.colorblindTags, false),
      captions: bool(accessibility.captions, true),
      hudScale: clamp(accessibility.hudScale, 0.8, 1.3, 1),
    },
  });
}

export function rebindHmhPlayerKeyboard(settings, actionId, code, { rankedActive = false } = {}) {
  const normalized = normalizeHmhPlayerSettings(settings);
  return normalizeHmhPlayerSettings({
    ...normalized,
    controls: {
      ...normalized.controls,
      keyboardBindings: rebindKeyboardAction(normalized.controls.keyboardBindings, actionId, code, { rankedActive }),
    },
  });
}

export function mergeHmhRuntimeSettings(settings, runtime, { rankedActive = false } = {}) {
  const current = normalizeHmhPlayerSettings(settings);
  const value = runtime && typeof runtime === 'object' ? runtime : {};
  return normalizeHmhPlayerSettings({
    ...current,
    controls: {
      ...current.controls,
      keyboardBindings: rankedActive ? current.controls.keyboardBindings : value.keyboardBindings ?? current.controls.keyboardBindings,
      gamepadDeadzone: value.gamepadDeadzone ?? current.controls.gamepadDeadzone,
      gamepadSensitivity: value.gamepadSensitivity ?? current.controls.gamepadSensitivity,
      touchSensitivity: value.touchSensitivity ?? current.controls.touchSensitivity,
      touchScale: value.touchScale ?? current.controls.touchScale,
      touchLeftHanded: value.touchLeftHanded ?? current.controls.touchLeftHanded,
      aimAssistStrength: value.aimAssistStrength ?? current.controls.aimAssistStrength,
    },
    gameplay: {
      ...current.gameplay,
      screenShake: value.screenShake ?? current.gameplay.screenShake,
      gore: value.gore ?? current.gameplay.gore,
      autoAimAssist: value.autoAimAssist ?? current.gameplay.autoAimAssist,
    },
    audio: {
      ...current.audio,
      musicEnabled: value.musicEnabled ?? current.audio.musicEnabled,
      musicVolume: value.musicVolume ?? current.audio.musicVolume,
      sfxVolume: value.sfxVolume ?? current.audio.sfxVolume,
      uiVolume: value.uiVolume ?? current.audio.uiVolume,
      dynamicRange: value.dynamicRange ?? current.audio.dynamicRange,
    },
    accessibility: {
      ...current.accessibility,
      reduceMotion: value.reduceMotion ?? current.accessibility.reduceMotion,
      reduceFlash: value.reduceFlash ?? current.accessibility.reduceFlash,
      colorblindTags: value.colorblindTags ?? current.accessibility.colorblindTags,
      captions: value.captionCriticalAudio ?? current.accessibility.captions,
      hudScale: value.hudScale ?? current.accessibility.hudScale,
    },
  });
}

export function projectHmhRuntimeSettings(settings) {
  const value = normalizeHmhPlayerSettings(settings);
  return freeze({
    musicEnabled: value.audio.musicEnabled,
    screenShake: value.gameplay.screenShake,
    gore: value.gameplay.gore,
    reduceMotion: value.accessibility.reduceMotion,
    reduceFlash: value.accessibility.reduceFlash,
    colorblindTags: value.accessibility.colorblindTags,
    keyboardBindings: { ...value.controls.keyboardBindings },
    gamepadDeadzone: value.controls.gamepadDeadzone,
    gamepadSensitivity: value.controls.gamepadSensitivity,
    touchSensitivity: value.controls.touchSensitivity,
    touchLeftHanded: value.controls.touchLeftHanded,
    aimAssistStrength: value.gameplay.autoAimAssist ? value.controls.aimAssistStrength : 0,
    touchScale: value.controls.touchScale,
    autoAimAssist: value.gameplay.autoAimAssist,
    musicVolume: value.audio.musicVolume,
    sfxVolume: value.audio.sfxEnabled ? value.audio.sfxVolume : 0,
    uiVolume: value.audio.uiEnabled ? value.audio.uiVolume : 0,
    dynamicRange: value.audio.dynamicRange,
    hudScale: value.accessibility.hudScale,
    captionCriticalAudio: value.accessibility.captions,
  });
}
