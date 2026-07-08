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
  // Path is relative to src/games/hmh/loader.mjs on disk → /src/games/hmh/loader.mjs on Vercel.
  // We need to climb 3 levels up to reach the portal root, then descend into assets/generated/:
  //   /src/games/hmh/ → /src/games/ → /src/ → /  → /assets/generated/...
  const [
    { HMH_PIXELLAB_LESTER_CALIBRATION_MANIFEST },
    { HMH_ISOMETRIC_PIXELLAB_WAVE_1 },
    { HMH_PRODUCTION_ART_PASS },
    { HMH_LEVEL_ENVIRONMENT },
    { HMH_ENVIRONMENT_PIXELLAB_WAVE_2 },
    { HMH_FX_POWERUPS_WAVE },
    { HMH_PICKUP_ICON_PACK },
    { HMH_VFX_UI_CHROME_PACK },
    { HMH_ENEMIES_WAVE },
    { HMH_ANIMATED_ROSTER },
    { HMH_COMPLETE_ANIMATIONS_READY },
    { HMH_FINAL_ANIMATION_COMPLETION_PACK },
    { HMH_FINAL_BOSS_ANIMATION_PACK },
    { HMH_WO110_BOSS_REDO },
    { HMH_WO117_POLISH_PACK },
  ] = await Promise.all([
    import('../../../assets/generated/pixellab-calibration/lester-hero-6d6e53e2/runtime-manifest.mjs'),
    import('../../../assets/generated/hmh-isometric-pixellab/hmh-isometric-pixellab-wave-1.mjs'),
    import('../../../assets/generated/hmh-production-art-pass/hmh-production-art-pass.mjs'),
    import('../../../assets/generated/hmh-level-environment/hmh-level-environment.mjs'),
    import('../../../assets/generated/hmh-environment-pixellab-wave-2/hmh-environment-pixellab-wave-2.mjs'),
    import('../../../assets/generated/hmh-fx-powerups-wave.mjs'),
    import('../../../assets/generated/hmh-pickup-icons/hmh-pickup-icons-manifest.mjs'),
    import('../../../assets/generated/hmh-vfx-ui-chrome/hmh-vfx-ui-chrome-manifest.mjs'),
    import('../../../assets/generated/hmh-enemies-wave/hmh-enemies-wave.mjs'),
    import('../../../assets/generated/hmh-animated-roster/hmh-animated-roster.mjs'),
    import('../../../assets/generated/hmh-complete-animations/hmh-complete-animations.mjs'),
    import('../../../assets/generated/hmh-final-animation-completion/hmh-final-animation-completion-manifest.mjs'),
    import('../../../assets/generated/hmh-final-boss-animations/hmh-final-boss-animations-manifest.mjs'),
    import('../../../assets/generated/hmh-wo110-boss-redo/hmh-wo110-boss-redo-manifest.mjs'),
    import('../../../assets/generated/hmh-wo117-polish-pack/hmh-wo117-polish-pack-manifest.mjs'),
  ]);

  return Object.freeze({
    HMH_PIXELLAB_LESTER_CALIBRATION_MANIFEST,
    HMH_ISOMETRIC_PIXELLAB_WAVE_1,
    HMH_PRODUCTION_ART_PASS,
    HMH_LEVEL_ENVIRONMENT,
    HMH_ENVIRONMENT_PIXELLAB_WAVE_2,
    HMH_FX_POWERUPS_WAVE,
    HMH_PICKUP_ICON_PACK,
    HMH_VFX_UI_CHROME_PACK,
    HMH_ENEMIES_WAVE,
    HMH_ANIMATED_ROSTER,
    HMH_COMPLETE_ANIMATIONS_READY,
    HMH_FINAL_ANIMATION_COMPLETION_PACK,
    HMH_FINAL_BOSS_ANIMATION_PACK,
    HMH_WO110_BOSS_REDO,
    HMH_WO117_POLISH_PACK,
  });
}
