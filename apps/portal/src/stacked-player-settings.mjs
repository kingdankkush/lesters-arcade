import { STACKED_ACTIONS, STACKED_PLAYER_SETTINGS_KEY } from './stacked-contracts.mjs';
export const STACKED_VISUALIZERS = Object.freeze(['journey', 'living', 'aurora', 'orbit', 'spectrum']);
// Settings simplification (owner direction 2026-09-24): one Effects preset sets
// the renderer's projection fields together. The expanded fields are stored
// beside the preset so a 1.8.1 rollback still reads a consistent object.
export const STACKED_EFFECTS_PRESETS = Object.freeze(['off', 'calm', 'standard', 'full']);
export const STACKED_SCENE_MODES = Object.freeze(['auto', 'off']);
// Written by the 1.8.1 child; read here once for migration, never written or deleted.
export const STACKED_LEGACY_SCENES_KEY = 'stacked-visual-scenes-v1';
const LEGACY_SCENES = Object.freeze(['auto', 'tunnel', 'particles', 'horizon', 'off']);
const EFFECTS_PRESET_FIELDS = Object.freeze({
  off: Object.freeze({ effectsIntensity: 0, reducedEffects: true, audioReactive: false, scene: 'off', reactiveBoard: false }),
  calm: Object.freeze({ effectsIntensity: 0.4, reducedEffects: true, audioReactive: false, scene: 'off', reactiveBoard: false }),
  standard: Object.freeze({ effectsIntensity: 0.7, reducedEffects: false, audioReactive: true, scene: 'auto', reactiveBoard: true }),
  full: Object.freeze({ effectsIntensity: 1, reducedEffects: false, audioReactive: true, scene: 'auto', reactiveBoard: true }),
});
export function expandStackedEffectsPreset(preset) {
  const effectsPreset = STACKED_EFFECTS_PRESETS.includes(preset) ? preset : 'standard';
  return { effectsPreset, ...EFFECTS_PRESET_FIELDS[effectsPreset] };
}
// Nearest preset for settings saved before presets existed (1.8.1 and earlier).
export function stackedEffectsPresetFromLegacy({ effectsIntensity, reducedEffects, audioReactive, scene, reactiveBoard } = {}) {
  const intensity = typeof effectsIntensity === 'number' && Number.isFinite(effectsIntensity) && effectsIntensity >= 0 && effectsIntensity <= 1 ? effectsIntensity : 0.7;
  if (intensity === 0) return 'off';
  if (reducedEffects === true || audioReactive === false || intensity < 0.55 || scene === 'off' || reactiveBoard === false) return 'calm';
  return intensity >= 0.85 ? 'full' : 'standard';
}
export const STACKED_DEFAULT_BINDINGS = Object.freeze({
  moveLeft: ['ArrowLeft', 'KeyA'], moveRight: ['ArrowRight', 'KeyD'], softDrop: ['ArrowDown', 'KeyS'],
  hardDrop: ['Space', null], rotateCW: ['ArrowUp', 'KeyX'], rotateCCW: ['KeyZ', null],
  rotate180: ['KeyV', null], hold: ['KeyC', 'ShiftLeft'],
});
export function defaultStackedSettings(reducedMotion = false) {
  return {
    version: 1, handling: { dasMs: 133, arrMs: 33, dcdMs: 0, cancelDas: true },
    controls: { keyboardBindings: Object.fromEntries(STACKED_ACTIONS.map(key => [key, { primary: STACKED_DEFAULT_BINDINGS[key][0], secondary: STACKED_DEFAULT_BINDINGS[key][1] }])), touchLayout: 'buttons', touchOpacity: 0.7, touchLeftHanded: false, touchSensitivity: 1 },
    video: { qualityTier: 'auto', ghostPiece: true, gridLines: true, visualizer: 'journey', ...expandStackedEffectsPreset('standard') },
    audio: { musicEnabled: true, sfxEnabled: true, sfxVolume: 0.35 },
    accessibility: { reduceMotion: reducedMotion, reduceFlash: true, colorblindPieces: false, hudScale: 1 },
  };
}
const osPrefersReducedMotion = () => {
  try { return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true; } catch { return false; }
};
// Only these saved booleans are recovered; derived effect fields come from the preset.
const SAVED_BOOLEANS = Object.freeze([
  ['video', 'ghostPiece'], ['video', 'gridLines'], ['audio', 'musicEnabled'], ['audio', 'sfxEnabled'],
  ['accessibility', 'reduceMotion'], ['accessibility', 'reduceFlash'], ['accessibility', 'colorblindPieces'], ['controls', 'touchLeftHanded'],
]);
export function readStackedSettings(storage, reducedMotion = false, { prefersReducedMotion = osPrefersReducedMotion() } = {}) {
  // The arcade or OS reduced-motion setting seeds the value until the first STACKED save.
  const value = defaultStackedSettings(Boolean(reducedMotion || prefersReducedMotion));
  let saved = null;
  const legacy = {};
  try {
    saved = JSON.parse(storage?.getItem(STACKED_PLAYER_SETTINGS_KEY) ?? 'null');
    // Only projection preferences are recovered until handling remapping has its own acceptance.
    for (const [group, key] of SAVED_BOOLEANS) if (typeof saved?.[group]?.[key] === 'boolean') value[group][key] = saved[group][key];
    if (STACKED_VISUALIZERS.includes(saved?.video?.visualizer)) value.video.visualizer = saved.video.visualizer;
    const volume = saved?.audio?.sfxVolume;
    if (typeof volume === 'number' && Number.isFinite(volume) && volume >= 0 && volume <= 1) value.audio.sfxVolume = volume;
  } catch { saved = null; /* unavailable or malformed device settings use safe defaults */ }
  // Separate try: a malformed legacy key never drops the parent values above.
  try {
    const old = JSON.parse(storage?.getItem(STACKED_LEGACY_SCENES_KEY) ?? 'null');
    if (LEGACY_SCENES.includes(old?.scene)) legacy.scene = old.scene;
    if (typeof old?.reactiveBoard === 'boolean') legacy.reactiveBoard = old.reactiveBoard;
  } catch { /* the legacy key is optional */ }
  const savedPreset = saved?.video?.effectsPreset;
  const preset = STACKED_EFFECTS_PRESETS.includes(savedPreset) ? savedPreset : stackedEffectsPresetFromLegacy({
    effectsIntensity: saved?.video?.effectsIntensity, reducedEffects: saved?.video?.reducedEffects, audioReactive: saved?.video?.audioReactive,
    scene: legacy.scene, reactiveBoard: legacy.reactiveBoard,
  });
  Object.assign(value.video, expandStackedEffectsPreset(preset));
  // One volume: zero means off, and an old disabled toggle reads as zero.
  if (saved?.audio?.sfxEnabled === false) value.audio.sfxVolume = 0;
  value.audio.sfxEnabled = value.audio.sfxVolume > 0;
  return value;
}
// The host is the authority for what gets saved: the preset expansion overrides
// any derived effect fields the child sent.
export function applyStackedPresentationPreferences(settings, p) {
  const preset = STACKED_EFFECTS_PRESETS.includes(p.effectsPreset) ? p.effectsPreset : stackedEffectsPresetFromLegacy({
    effectsIntensity: p.effectsIntensity ?? settings.video.effectsIntensity,
    reducedEffects: p.reducedEffects, audioReactive: p.audioReactive, scene: p.scene, reactiveBoard: p.reactiveBoard,
  });
  const sfxVolume = p.sfxEnabled === false ? 0 : (p.sfxVolume ?? settings.audio.sfxVolume);
  return { ...settings,
    accessibility: { ...settings.accessibility, reduceMotion:p.reduceMotion, reduceFlash:p.reduceFlash ?? settings.accessibility.reduceFlash, colorblindPieces:p.colorblindPieces ?? settings.accessibility.colorblindPieces },
    controls: { ...settings.controls, touchLeftHanded:p.touchLeftHanded ?? settings.controls.touchLeftHanded },
    video: { ...settings.video, ghostPiece:p.ghostPiece, gridLines:p.gridLines, visualizer:p.visualizer ?? settings.video.visualizer ?? 'journey', ...expandStackedEffectsPreset(preset) },
    audio: { ...settings.audio, sfxVolume, sfxEnabled: sfxVolume > 0 },
  };
}
export function saveStackedSettings(storage, settings) {
  try { storage?.setItem(STACKED_PLAYER_SETTINGS_KEY, JSON.stringify(settings)); return true; }
  catch { return false; }
}
