// Visualizer governor (1.9.0). Presentation only: it watches the frame clock
// and caps the tier the music scene (atmosphere) draws at, never the board,
// the player's saved preset, input or the simulation.
//
// Hysteresis: a sustained slow window (average under SLOW_FPS for
// SLOW_WINDOW_MS) steps down one level; a much longer fast window (over
// FAST_FPS for FAST_WINDOW_MS, doubled after every step down) steps back up.
// Levels run full -> standard -> calm, and only once the scene is at calm does
// the governor touch resolution (RESOLUTION_STEP of the starting resolution,
// and only while frames stay under CRITICAL_FPS). Each change starts a
// cooldown so the new cost is measured before the next decision.
//
// The starting tier comes from a one-time device micro-benchmark, cached on
// this device; the player's own preset still caps it from above.
import { STACKED_EFFECTS_PRESETS, expandStackedEffectsPreset } from '../../../portal/src/stacked-player-settings.mjs';

export const GOVERNOR_TIERS = Object.freeze(['calm', 'standard', 'full']);
export const GOVERNOR = Object.freeze({ SLOW_FPS: 50, FAST_FPS: 57, CRITICAL_FPS: 45, SLOW_WINDOW_MS: 2000, FAST_WINDOW_MS: 8000, COOLDOWN_MS: 2500, RESOLUTION_STEP: .75, MAX_FRAME_MS: 250 });
export const DEVICE_TIER_KEY = 'stacked-device-tier-v1';

// levels: 0 = scaled resolution at calm, 1 = calm, 2 = standard, 3 = full.
const levelForTier = tier => Math.max(0, GOVERNOR_TIERS.indexOf(tier)) + 1;

export function createVisualizerGovernor({ startTier = 'full' } = {}) {
  let level = levelForTier(startTier), slowMs = 0, fastMs = 0, frames = 0, spent = 0, last = null, cooldownUntil = -Infinity, downSteps = 0, changes = 0;
  const change = (next, now) => { level = next; slowMs = fastMs = frames = spent = 0; cooldownUntil = now + GOVERNOR.COOLDOWN_MS; changes += 1; };
  // Feed one rAF timestamp; judged over rolling half-second buckets.
  const sample = now => {
    const dt = last === null ? 0 : now - last; last = now;
    if (!(dt > 0) || dt > GOVERNOR.MAX_FRAME_MS || now < cooldownUntil) return level;
    frames += 1; spent += dt;
    if (spent < 500) return level;
    const fps = frames * 1000 / spent;
    if (fps < GOVERNOR.SLOW_FPS && (level > 1 || fps < GOVERNOR.CRITICAL_FPS)) { slowMs += spent; fastMs = 0; }
    else if (fps > GOVERNOR.FAST_FPS) { fastMs += spent; slowMs = 0; }
    else { slowMs = 0; fastMs = 0; }
    frames = spent = 0;
    if (slowMs >= GOVERNOR.SLOW_WINDOW_MS && level > 0) { downSteps += 1; change(level - 1, now); }
    else if (fastMs >= GOVERNOR.FAST_WINDOW_MS * 2 ** Math.min(3, downSteps) && level < 3) change(level + 1, now);
    return level;
  };
  // The settings the music scene draws with: the lower of the player's preset and the cap.
  const cap = settings => {
    const chosen = settings?.video?.effectsPreset;
    const allowed = GOVERNOR_TIERS[Math.max(0, level - 1)];
    if (!STACKED_EFFECTS_PRESETS.includes(chosen) || STACKED_EFFECTS_PRESETS.indexOf(chosen) <= STACKED_EFFECTS_PRESETS.indexOf(allowed)) return settings;
    // Built per call: the frame loop edits settings in place, so a cached copy would go stale.
    return { ...settings, video: { ...settings.video, ...expandStackedEffectsPreset(allowed) } };
  };
  return {
    sample, cap,
    get tier() { return GOVERNOR_TIERS[Math.max(0, level - 1)]; },
    get resolutionScale() { return level === 0 ? GOVERNOR.RESOLUTION_STEP : 1; },
    get level() { return level; },
    get changes() { return changes; },
  };
}

// A fixed few-millisecond workload, timed once. Faster devices start at full.
export function benchmarkDeviceTier({ clock = () => globalThis.performance?.now?.() ?? Date.now(), cores = globalThis.navigator?.hardwareConcurrency, memory = globalThis.navigator?.deviceMemory } = {}) {
  const data = new Float32Array(4096);
  let checksum = 0;
  const start = clock();
  for (let pass = 0; pass < 24; pass += 1) for (let i = 0; i < 4096; i += 1) { data[i] = Math.sin(i * .01 + pass) * data[(i * 7) & 4095] + 1; checksum += data[i]; }
  const ms = clock() - start;
  let tier = ms < 4 ? 'full' : ms < 10 ? 'standard' : 'calm';
  if ((cores && cores <= 2) || (memory && memory <= 1)) tier = 'calm';
  else if (tier === 'full' && ((cores && cores <= 4) || (memory && memory <= 2))) tier = 'standard';
  return { tier, ms, checksum };
}

// The cached benchmark tier for this device, measuring once when absent.
export function deviceStartTier({ storage = (() => { try { return globalThis.localStorage; } catch { return null; } })(), benchmark = benchmarkDeviceTier } = {}) {
  try { const saved = storage?.getItem(DEVICE_TIER_KEY); if (GOVERNOR_TIERS.includes(saved)) return saved; } catch {}
  const { tier } = benchmark();
  try { storage?.setItem(DEVICE_TIER_KEY, tier); } catch {}
  return tier;
}
