import { STACKED_EFFECTS_PRESETS, expandStackedEffectsPreset, stackedEffectsPresetFromLegacy } from '../../portal/src/stacked-player-settings.mjs';

// Deploy skew (settings review 2026-09-25). An arcade tab that loaded a 1.8.1-1.8.3
// (pre-preset) host before a deploy keeps its exact-key validator in memory and loads
// this child. That validator rejects `effectsPreset`, `scene` and
// `reactiveBoard`, and the rejection happens before the host advances its
// message sequence, so every later child message (including `game:result`)
// fails as out of order and a Ranked run ends "Not saved".
//
// A parent that understands presets says so by putting a valid `effectsPreset`
// in the init settings. Only that parent is sent the three preset keys. Any
// other parent gets the pre-preset key set, which the current host classifies back
// to the same preset exactly (0 → off, minimal → calm, 0.7 → standard, 1 → full).
export const stackedParentKnowsPresets = settings => STACKED_EFFECTS_PRESETS.includes(settings?.video?.effectsPreset);

// Settings from a pre-preset parent carry no preset, scene or reactive board.
// The nearest preset is expanded into this child-local copy so the radios, the
// backdrop and the board glow agree. Settings that already carry a preset are
// left as the parent sent them: the parent is the authority.
export function withStackedEffectsPreset(settings) {
  if (!settings?.video || stackedParentKnowsPresets(settings)) return settings;
  Object.assign(settings.video, expandStackedEffectsPreset(stackedEffectsPresetFromLegacy(settings.video)));
  // One volume, as readStackedSettings reads it: a 1.8.1-1.8.3 host keeps a
  // disabled toggle beside the old volume. Without this the slider shows 35%
  // while muted, and changing any other setting (which derives sfxEnabled from
  // the slider) turns game sound back on.
  if (settings.audio?.sfxEnabled === false) settings.audio.sfxVolume = 0;
  return settings;
}

export function stackedPreferencesRequest(settings, { presets }) {
  const { video, audio, accessibility, controls } = settings;
  return {
    reduceMotion: accessibility.reduceMotion, reducedEffects: video.reducedEffects, audioReactive: video.audioReactive,
    ghostPiece: video.ghostPiece, gridLines: video.gridLines, sfxEnabled: audio.sfxEnabled,
    ...(presets ? { effectsPreset: video.effectsPreset, scene: video.scene, reactiveBoard: video.reactiveBoard } : {}),
    effectsIntensity: video.effectsIntensity, visualizer: video.visualizer, sfxVolume: audio.sfxVolume,
    colorblindPieces: accessibility.colorblindPieces, reduceFlash: accessibility.reduceFlash, touchLeftHanded: controls.touchLeftHanded,
  };
}
