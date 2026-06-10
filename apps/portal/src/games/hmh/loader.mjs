// HMH Game Loader — lazy boundary for Hard Money Heroes.
//
// This module is the ONLY place that imports the 10 heavy HMH art + data
// manifests directly. Main.js imports `loadHMHGame()` and calls it from
// the cabinet-selection handler before entering mode-select. This cuts the
// eager homepage payload from 1.65 MB (43 modules) down to the platform
// shell + shared gameplay core (~950 KB).
//
// Adding a new game = create a sibling file, e.g. games/chikun/loader.mjs,
// and wire its loadChikunGame() into the cabinet selection handler the
// same way. The portal shell stays tiny regardless of how many cabinets
// get onboarded.

export async function loadHMHGame() {
  const [
    { HMH_PIXELLAB_LESTER_CALIBRATION_MANIFEST },
    { HMH_ISOMETRIC_PIXELLAB_WAVE_1 },
    { HMH_PRODUCTION_ART_PASS },
    { HMH_LEVEL_ENVIRONMENT },
    { HMH_ENVIRONMENT_PIXELLAB_WAVE_2 },
    { HMH_FX_POWERUPS_WAVE },
    { HMH_ENEMIES_WAVE },
    { HMH_ANIMATED_ROSTER },
    { HMH_COMPLETE_ANIMATIONS_READY },
  ] = await Promise.all([
    import('../../assets/generated/pixellab-calibration/lester-hero-6d6e53e2/runtime-manifest.mjs'),
    import('../../assets/generated/hmh-isometric-pixellab/hmh-isometric-pixellab-wave-1.mjs'),
    import('../../assets/generated/hmh-production-art-pass/hmh-production-art-pass.mjs'),
    import('../../assets/generated/hmh-level-environment/hmh-level-environment.mjs'),
    import('../../assets/generated/hmh-environment-pixellab-wave-2/hmh-environment-pixellab-wave-2.mjs'),
    import('../../assets/generated/hmh-fx-powerups-wave.mjs'),
    import('../../assets/generated/hmh-enemies-wave/hmh-enemies-wave.mjs'),
    import('../../assets/generated/hmh-animated-roster/hmh-animated-roster.mjs'),
    import('../../assets/generated/hmh-complete-animations/hmh-complete-animations.mjs'),
  ]);

  return Object.freeze({
    HMH_PIXELLAB_LESTER_CALIBRATION_MANIFEST,
    HMH_ISOMETRIC_PIXELLAB_WAVE_1,
    HMH_PRODUCTION_ART_PASS,
    HMH_LEVEL_ENVIRONMENT,
    HMH_ENVIRONMENT_PIXELLAB_WAVE_2,
    HMH_FX_POWERUPS_WAVE,
    HMH_ENEMIES_WAVE,
    HMH_ANIMATED_ROSTER,
    HMH_COMPLETE_ANIMATIONS_READY,
  });
}
