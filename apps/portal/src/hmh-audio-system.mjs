export const HMH_SFX_CUE_REGISTRY = Object.freeze({
  'wallet-connect': Object.freeze({ family: 'ui', priority: 3, cooldownMs: 110, tone: Object.freeze([523, 659, 784]), synth: 'triangle', gainMul: 1.0, samplePreferred: true }),
  'menu-click': Object.freeze({ family: 'ui', priority: 1, cooldownMs: 70, tone: Object.freeze([392, 523]), synth: 'triangle', gainMul: 0.75, samplePreferred: true }),
  'hero-select': Object.freeze({ family: 'ui', priority: 3, cooldownMs: 160, tone: Object.freeze([523, 659, 784, 1047]), synth: 'triangle', gainMul: 1.1, samplePreferred: false }),
  'level-start': Object.freeze({ family: 'state', priority: 4, cooldownMs: 260, tone: Object.freeze([330, 494, 660]), synth: 'triangle', gainMul: 1.05, samplePreferred: true }),
  jump: Object.freeze({ family: 'movement', priority: 2, cooldownMs: 90, tone: Object.freeze([420, 630]), synth: 'triangle', gainMul: 0.78, samplePreferred: true }),
  dash: Object.freeze({ family: 'movement', priority: 3, cooldownMs: 140, tone: Object.freeze([260, 520, 780]), synth: 'square', gainMul: 0.72, samplePreferred: false }),
  land: Object.freeze({ family: 'movement', priority: 2, cooldownMs: 120, tone: Object.freeze([120]), synth: 'sine', gainMul: 0.7, samplePreferred: true }),
  'weapon-fire': Object.freeze({ family: 'weapon', priority: 2, cooldownMs: 42, tone: Object.freeze([180, 900]), synth: 'square', gainMul: 0.68, samplePreferred: true }),
  melee: Object.freeze({ family: 'weapon', priority: 2, cooldownMs: 85, tone: Object.freeze([760, 420]), synth: 'square', gainMul: 0.82, samplePreferred: true }),
  grenade: Object.freeze({ family: 'weapon', priority: 3, cooldownMs: 180, tone: Object.freeze([110, 220]), synth: 'square', gainMul: 1.0, samplePreferred: true }),
  'grenade-boom': Object.freeze({ family: 'impact', priority: 5, cooldownMs: 260, tone: Object.freeze([72, 110, 220, 82]), synth: 'square', gainMul: 1.25, samplePreferred: false }),
  pickup: Object.freeze({ family: 'reward', priority: 3, cooldownMs: 95, tone: Object.freeze([660, 880, 990]), synth: 'triangle', gainMul: 0.95, samplePreferred: true }),
  'xp-pickup': Object.freeze({ family: 'reward', priority: 1, cooldownMs: 38, tone: Object.freeze([880, 1175]), synth: 'triangle', gainMul: 0.46, samplePreferred: false }),
  'level-up': Object.freeze({ family: 'reward', priority: 5, cooldownMs: 420, tone: Object.freeze([523, 784, 1047, 1568]), synth: 'triangle', gainMul: 1.25, samplePreferred: false }),
  'enemy-hit': Object.freeze({ family: 'impact', priority: 2, cooldownMs: 38, tone: Object.freeze([220, 165]), synth: 'square', gainMul: 0.7, samplePreferred: true }),
  'enemy-death': Object.freeze({ family: 'impact', priority: 3, cooldownMs: 90, tone: Object.freeze([196, 146, 98]), synth: 'square', gainMul: 0.9, samplePreferred: false }),
  'player-hit': Object.freeze({ family: 'damage', priority: 5, cooldownMs: 260, tone: Object.freeze([90, 70]), synth: 'square', gainMul: 1.2, samplePreferred: true }),
  'boss-warning': Object.freeze({ family: 'boss', priority: 5, cooldownMs: 360, tone: Object.freeze([70, 140, 70]), synth: 'square', gainMul: 1.25, samplePreferred: true }),
  'game-over': Object.freeze({ family: 'state', priority: 5, cooldownMs: 800, tone: Object.freeze([196, 146, 98]), synth: 'triangle', gainMul: 1.1, samplePreferred: true }),
  'level1-cache-open': Object.freeze({ family: 'level1-interactive', priority: 3, cooldownMs: 180, tone: Object.freeze([659, 784, 988, 1319]), synth: 'triangle', gainMul: 1.0, samplePreferred: false }),
  'level1-gas-pump-warning': Object.freeze({ family: 'level1-interactive', priority: 4, cooldownMs: 360, tone: Object.freeze([110, 82, 110]), synth: 'square', gainMul: 1.0, samplePreferred: false }),
  'level1-gas-pump-detonate': Object.freeze({ family: 'level1-interactive', priority: 5, cooldownMs: 300, tone: Object.freeze([80, 55, 120, 220]), synth: 'square', gainMul: 1.25, samplePreferred: false }),
  'level1-cover-break': Object.freeze({ family: 'level1-interactive', priority: 3, cooldownMs: 110, tone: Object.freeze([180, 120, 95]), synth: 'square', gainMul: 0.95, samplePreferred: false }),
  'level1-mushroom-pulse': Object.freeze({ family: 'level1-interactive', priority: 2, cooldownMs: 220, tone: Object.freeze([247, 370, 494]), synth: 'triangle', gainMul: 0.68, samplePreferred: false }),
  'level1-gate-unlock': Object.freeze({ family: 'level1-interactive', priority: 4, cooldownMs: 420, tone: Object.freeze([196, 392, 784]), synth: 'triangle', gainMul: 1.05, samplePreferred: false }),
  'level1-extraction-flare': Object.freeze({ family: 'level1-interactive', priority: 4, cooldownMs: 420, tone: Object.freeze([523, 784, 1175]), synth: 'triangle', gainMul: 1.05, samplePreferred: false }),
});

export const HMH_AUDIO_MIX = Object.freeze({
  version: 'wo-41-audio-system-v1',
  familyCaps: Object.freeze({ ui: 4, movement: 5, weapon: 16, impact: 14, damage: 4, reward: 12, boss: 4, state: 3, 'level1-interactive': 8 }),
  accessibility: Object.freeze({ reduceMotionVolumeMul: 0.82, maxSynthVolume: 0.16, minAudibleVolume: 0.008 }),
});

export function hmhSfxCueSpec(cue) {
  return HMH_SFX_CUE_REGISTRY[cue] ?? Object.freeze({ family: 'fallback', priority: 0, cooldownMs: 110, tone: Object.freeze([440]), synth: 'triangle', gainMul: 0.6, samplePreferred: false });
}

export function hmhSfxToneFor(cue) {
  return hmhSfxCueSpec(cue).tone;
}

function clampVolume(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0.05;
  return Math.max(0, Math.min(1, n));
}

export function resolveHmhSfxCuePlan(cue, {
  requestedVolume = 0.05,
  now = 0,
  lastPlayedAt = -Infinity,
  sfxEnabled = true,
  reduceMotion = false,
} = {}) {
  const spec = hmhSfxCueSpec(cue);
  if (!sfxEnabled) return Object.freeze({ cue, allowed: false, reason: 'sfx-disabled', spec });
  const elapsed = Number(now) - Number(lastPlayedAt);
  const cooldownMs = spec.cooldownMs ?? 110;
  if (Number.isFinite(elapsed) && elapsed >= 0 && elapsed < cooldownMs) {
    return Object.freeze({ cue, allowed: false, reason: 'cooldown', cooldownMs, elapsedMs: elapsed, spec });
  }
  const accessibilityMul = reduceMotion && (spec.family === 'impact' || spec.family === 'boss' || spec.family === 'damage')
    ? HMH_AUDIO_MIX.accessibility.reduceMotionVolumeMul
    : 1;
  const volume = Math.max(
    HMH_AUDIO_MIX.accessibility.minAudibleVolume,
    Math.min(HMH_AUDIO_MIX.accessibility.maxSynthVolume, clampVolume(requestedVolume) * (spec.gainMul ?? 1) * accessibilityMul),
  );
  return Object.freeze({
    cue,
    allowed: true,
    reason: 'ok',
    family: spec.family,
    priority: spec.priority,
    cooldownMs,
    volume: Number(volume.toFixed(4)),
    tone: spec.tone,
    synth: spec.synth,
    samplePreferred: Boolean(spec.samplePreferred),
    spec,
  });
}

export function validateHmhAudioSystem({ manifestCues = [], runtimeCues = [] } = {}) {
  const gaps = [];
  for (const cue of manifestCues) {
    if (!HMH_SFX_CUE_REGISTRY[cue]) gaps.push(`manifest cue missing registry entry: ${cue}`);
  }
  for (const cue of runtimeCues) {
    if (!HMH_SFX_CUE_REGISTRY[cue]) gaps.push(`runtime cue missing registry entry: ${cue}`);
  }
  for (const [cue, spec] of Object.entries(HMH_SFX_CUE_REGISTRY)) {
    if (!Array.isArray(spec.tone) || spec.tone.length === 0) gaps.push(`${cue} has no synth tone`);
    if (!Number.isFinite(spec.cooldownMs) || spec.cooldownMs < 0) gaps.push(`${cue} has invalid cooldown`);
    if (!Number.isFinite(spec.priority) || spec.priority < 0 || spec.priority > 5) gaps.push(`${cue} priority out of range`);
    if (!HMH_AUDIO_MIX.familyCaps[spec.family]) gaps.push(`${cue} family ${spec.family} has no mix cap`);
  }
  return Object.freeze({ ok: gaps.length === 0, gaps: Object.freeze(gaps), cueCount: Object.keys(HMH_SFX_CUE_REGISTRY).length });
}
