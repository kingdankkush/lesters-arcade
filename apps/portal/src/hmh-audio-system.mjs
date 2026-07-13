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
  'menu-hover': Object.freeze({ family: 'ui', priority: 1, cooldownMs: 61, tone: Object.freeze([294]), synth: 'sine', gainMul: 0.42, samplePreferred: false }),
  'menu-confirm': Object.freeze({ family: 'ui', priority: 3, cooldownMs: 123, tone: Object.freeze([440, 659, 880]), synth: 'triangle', gainMul: 0.82, samplePreferred: false }),
  'menu-back': Object.freeze({ family: 'ui', priority: 2, cooldownMs: 137, tone: Object.freeze([587, 440]), synth: 'triangle', gainMul: 0.7, samplePreferred: false }),
  'modal-open': Object.freeze({ family: 'ui', priority: 2, cooldownMs: 149, tone: Object.freeze([330, 494]), synth: 'sine', gainMul: 0.62, samplePreferred: false }),
  'modal-close': Object.freeze({ family: 'ui', priority: 2, cooldownMs: 157, tone: Object.freeze([494, 330]), synth: 'sine', gainMul: 0.6, samplePreferred: false }),
  'setting-toggle': Object.freeze({ family: 'ui', priority: 2, cooldownMs: 173, tone: Object.freeze([740, 988]), synth: 'square', gainMul: 0.58, samplePreferred: false }),
  'error-denied': Object.freeze({ family: 'ui', priority: 4, cooldownMs: 311, tone: Object.freeze([196, 185, 174]), synth: 'square', gainMul: 0.88, samplePreferred: false }),
  'profile-save': Object.freeze({ family: 'ui', priority: 3, cooldownMs: 331, tone: Object.freeze([392, 587, 784]), synth: 'triangle', gainMul: 0.8, samplePreferred: false }),
  'footstep-dirt': Object.freeze({ family: 'movement', priority: 1, cooldownMs: 181, tone: Object.freeze([86, 73]), synth: 'sine', gainMul: 0.32, samplePreferred: false }),
  'footstep-road': Object.freeze({ family: 'movement', priority: 1, cooldownMs: 193, tone: Object.freeze([118, 96]), synth: 'square', gainMul: 0.28, samplePreferred: false }),
  'dodge-start': Object.freeze({ family: 'movement', priority: 3, cooldownMs: 239, tone: Object.freeze([310, 620, 930]), synth: 'sawtooth', gainMul: 0.66, samplePreferred: false }),
  'dodge-end': Object.freeze({ family: 'movement', priority: 2, cooldownMs: 251, tone: Object.freeze([620, 310]), synth: 'sine', gainMul: 0.46, samplePreferred: false }),
  'splash-step': Object.freeze({ family: 'movement', priority: 2, cooldownMs: 263, tone: Object.freeze([102, 136, 92]), synth: 'sine', gainMul: 0.4, samplePreferred: false }),
  'brush-rustle': Object.freeze({ family: 'movement', priority: 1, cooldownMs: 277, tone: Object.freeze([154, 181, 147]), synth: 'sawtooth', gainMul: 0.25, samplePreferred: false }),
  'settler-fire': Object.freeze({ family: 'weapon', priority: 2, cooldownMs: 43, tone: Object.freeze([170, 820]), synth: 'square', gainMul: 0.66, samplePreferred: false }),
  'auto-miner-fire': Object.freeze({ family: 'weapon', priority: 2, cooldownMs: 47, tone: Object.freeze([145, 690]), synth: 'square', gainMul: 0.5, samplePreferred: false }),
  'hash-rail-charge': Object.freeze({ family: 'weapon', priority: 3, cooldownMs: 353, tone: Object.freeze([110, 220, 440, 880]), synth: 'sawtooth', gainMul: 0.72, samplePreferred: false }),
  'hash-rail-fire': Object.freeze({ family: 'weapon', priority: 4, cooldownMs: 367, tone: Object.freeze([82, 330, 1320]), synth: 'square', gainMul: 1.05, samplePreferred: false }),
  'spread-ltc-fire': Object.freeze({ family: 'weapon', priority: 3, cooldownMs: 79, tone: Object.freeze([155, 233, 349]), synth: 'square', gainMul: 0.78, samplePreferred: false }),
  'litecoin-blade-swing': Object.freeze({ family: 'weapon', priority: 2, cooldownMs: 97, tone: Object.freeze([920, 610, 390]), synth: 'sawtooth', gainMul: 0.72, samplePreferred: false }),
  'litecoin-blade-hit': Object.freeze({ family: 'impact', priority: 3, cooldownMs: 103, tone: Object.freeze([260, 130, 520]), synth: 'square', gainMul: 0.86, samplePreferred: false }),
  'grenade-prime': Object.freeze({ family: 'weapon', priority: 2, cooldownMs: 283, tone: Object.freeze([220, 233, 247]), synth: 'sine', gainMul: 0.55, samplePreferred: false }),
  'grenade-throw': Object.freeze({ family: 'weapon', priority: 3, cooldownMs: 293, tone: Object.freeze([330, 220, 165]), synth: 'triangle', gainMul: 0.68, samplePreferred: false }),
  'reload-start': Object.freeze({ family: 'weapon', priority: 2, cooldownMs: 307, tone: Object.freeze([260, 195]), synth: 'square', gainMul: 0.48, samplePreferred: false }),
  'reload-complete': Object.freeze({ family: 'weapon', priority: 3, cooldownMs: 317, tone: Object.freeze([390, 585]), synth: 'triangle', gainMul: 0.62, samplePreferred: false }),
  'empty-clip': Object.freeze({ family: 'weapon', priority: 3, cooldownMs: 229, tone: Object.freeze([120, 108]), synth: 'square', gainMul: 0.54, samplePreferred: false }),
  'bullet-wall': Object.freeze({ family: 'impact', priority: 1, cooldownMs: 53, tone: Object.freeze([310, 205]), synth: 'square', gainMul: 0.42, samplePreferred: false }),
  'bullet-armor': Object.freeze({ family: 'impact', priority: 2, cooldownMs: 59, tone: Object.freeze([430, 215]), synth: 'square', gainMul: 0.58, samplePreferred: false }),
  'critical-hit': Object.freeze({ family: 'impact', priority: 4, cooldownMs: 107, tone: Object.freeze([740, 1110, 1480]), synth: 'triangle', gainMul: 0.95, samplePreferred: false }),
  'shield-hit': Object.freeze({ family: 'damage', priority: 3, cooldownMs: 127, tone: Object.freeze([880, 660, 990]), synth: 'sine', gainMul: 0.72, samplePreferred: false }),
  'shield-break': Object.freeze({ family: 'damage', priority: 5, cooldownMs: 401, tone: Object.freeze([990, 660, 330, 165]), synth: 'square', gainMul: 1.12, samplePreferred: false }),
  'enemy-spawn': Object.freeze({ family: 'state', priority: 1, cooldownMs: 337, tone: Object.freeze([147, 196]), synth: 'sine', gainMul: 0.38, samplePreferred: false }),
  'elite-spawn': Object.freeze({ family: 'state', priority: 4, cooldownMs: 557, tone: Object.freeze([98, 196, 294]), synth: 'square', gainMul: 0.86, samplePreferred: false }),
  'enemy-melee-tell': Object.freeze({ family: 'impact', priority: 3, cooldownMs: 347, tone: Object.freeze([210, 315]), synth: 'sawtooth', gainMul: 0.64, samplePreferred: false }),
  'enemy-ranged-tell': Object.freeze({ family: 'impact', priority: 3, cooldownMs: 359, tone: Object.freeze([520, 390]), synth: 'triangle', gainMul: 0.6, samplePreferred: false }),
  'boss-phase': Object.freeze({ family: 'boss', priority: 5, cooldownMs: 911, tone: Object.freeze([65, 130, 260, 520]), synth: 'sawtooth', gainMul: 1.18, samplePreferred: false }),
  'boss-hit': Object.freeze({ family: 'boss', priority: 3, cooldownMs: 131, tone: Object.freeze([105, 157]), synth: 'square', gainMul: 0.76, samplePreferred: false }),
  'boss-death': Object.freeze({ family: 'boss', priority: 5, cooldownMs: 1201, tone: Object.freeze([82, 123, 196, 392, 784]), synth: 'triangle', gainMul: 1.28, samplePreferred: false }),
  'health-pickup': Object.freeze({ family: 'reward', priority: 3, cooldownMs: 163, tone: Object.freeze([523, 698, 1047]), synth: 'sine', gainMul: 0.88, samplePreferred: false }),
  'ammo-pickup': Object.freeze({ family: 'reward', priority: 2, cooldownMs: 167, tone: Object.freeze([330, 440, 550]), synth: 'square', gainMul: 0.7, samplePreferred: false }),
  'shield-pickup': Object.freeze({ family: 'reward', priority: 4, cooldownMs: 179, tone: Object.freeze([659, 988, 1319]), synth: 'sine', gainMul: 0.96, samplePreferred: false }),
  'one-up-pickup': Object.freeze({ family: 'reward', priority: 5, cooldownMs: 613, tone: Object.freeze([523, 659, 784, 1047, 1319]), synth: 'triangle', gainMul: 1.2, samplePreferred: false }),
  'upgrade-offer': Object.freeze({ family: 'reward', priority: 4, cooldownMs: 431, tone: Object.freeze([392, 587, 880]), synth: 'triangle', gainMul: 0.92, samplePreferred: false }),
  'upgrade-pick': Object.freeze({ family: 'reward', priority: 5, cooldownMs: 443, tone: Object.freeze([587, 880, 1175]), synth: 'triangle', gainMul: 1.05, samplePreferred: false }),
  'upgrade-reroll': Object.freeze({ family: 'reward', priority: 3, cooldownMs: 457, tone: Object.freeze([880, 659, 988]), synth: 'sine', gainMul: 0.78, samplePreferred: false }),
  'achievement-unlock': Object.freeze({ family: 'reward', priority: 5, cooldownMs: 1301, tone: Object.freeze([523, 784, 1047, 1568, 2093]), synth: 'triangle', gainMul: 1.25, samplePreferred: false }),
  'combo-tier': Object.freeze({ family: 'reward', priority: 3, cooldownMs: 211, tone: Object.freeze([440, 660, 990]), synth: 'square', gainMul: 0.75, samplePreferred: false }),
  'rare-drop': Object.freeze({ family: 'reward', priority: 5, cooldownMs: 701, tone: Object.freeze([784, 1175, 1568]), synth: 'sine', gainMul: 1.12, samplePreferred: false }),
  pause: Object.freeze({ family: 'state', priority: 2, cooldownMs: 223, tone: Object.freeze([392, 294]), synth: 'sine', gainMul: 0.52, samplePreferred: false }),
  resume: Object.freeze({ family: 'state', priority: 2, cooldownMs: 227, tone: Object.freeze([294, 392]), synth: 'sine', gainMul: 0.54, samplePreferred: false }),
  'low-health': Object.freeze({ family: 'damage', priority: 5, cooldownMs: 1703, tone: Object.freeze([88, 88, 110]), synth: 'square', gainMul: 0.78, samplePreferred: false }),
  'wave-start': Object.freeze({ family: 'state', priority: 4, cooldownMs: 1009, tone: Object.freeze([196, 294, 392]), synth: 'square', gainMul: 0.9, samplePreferred: false }),
  'wave-clear': Object.freeze({ family: 'state', priority: 4, cooldownMs: 1013, tone: Object.freeze([392, 587, 784]), synth: 'triangle', gainMul: 0.94, samplePreferred: false }),
  checkpoint: Object.freeze({ family: 'state', priority: 4, cooldownMs: 1031, tone: Object.freeze([330, 494, 740]), synth: 'sine', gainMul: 0.88, samplePreferred: false }),
  'extraction-ready': Object.freeze({ family: 'state', priority: 5, cooldownMs: 1103, tone: Object.freeze([262, 523, 1047]), synth: 'triangle', gainMul: 1.05, samplePreferred: false }),
  'extraction-complete': Object.freeze({ family: 'state', priority: 5, cooldownMs: 1601, tone: Object.freeze([523, 784, 1047, 1568]), synth: 'sine', gainMul: 1.2, samplePreferred: false }),
  victory: Object.freeze({ family: 'state', priority: 5, cooldownMs: 2003, tone: Object.freeze([392, 523, 659, 784, 1047]), synth: 'triangle', gainMul: 1.3, samplePreferred: false }),
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
