// Generic boss phase-controller primitives.
//
// This module is intentionally pure: no DOM, no runtime state, no RNG. Boss- or
// level-specific modules provide the choreography data and combat tables; this
// module owns the repeatable mechanics every authored boss needs:
//
// - map live HP percentage into an authored phase band,
// - merge the phase's design metadata with runtime combat numbers,
// - derive phase-entry directives (banner, one-shot summons, next phase id),
// - compute projectile fan vectors without corrupting legitimate zero aim axes.
//
// Level 1's current boss/mini-boss controller consumes this now. Future Level 2+
// bosses should build on these helpers instead of cloning HP-band and fan logic.

export function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function hpBandForPhase(phase = {}) {
  const band = Array.isArray(phase.hpPct) ? phase.hpPct : [100, 0];
  const high = Number.isFinite(Number(band[0])) ? Number(band[0]) : 100;
  const low = Number.isFinite(Number(band[1])) ? Number(band[1]) : 0;
  return { high, low };
}

// Resolve the active authored phase for a live HP fraction. Phases are expected
// to be declared in descending HP order with hpPct bands like [100, 66],
// [66, 33], [33, 0]. The first phase owns full HP; shared threshold
// boundaries fall into the lower phase, which makes phase-entry transitions fire
// immediately when HP reaches the design threshold. Zero HP always falls into the final phase.
export function resolvePhaseFromHpFraction(hpFraction, phases = [], { combatByPhaseId = {}, fallbackPhaseId = null } = {}) {
  if (!Array.isArray(phases) || phases.length === 0) {
    throw new TypeError('resolvePhaseFromHpFraction requires a non-empty phases array');
  }

  const hpPct = clamp01(hpFraction) * 100;
  let index = phases.length - 1;
  for (let i = 0; i < phases.length; i += 1) {
    const { high, low } = hpBandForPhase(phases[i]);
    if (hpPct <= high && hpPct > low) { index = i; break; }
    if (i === 0 && hpPct >= high) { index = 0; break; }
  }

  const phase = phases[index];
  const fallbackCombat = fallbackPhaseId ? combatByPhaseId[fallbackPhaseId] : null;
  const combat = combatByPhaseId[phase.id] ?? fallbackCombat ?? {};
  return Object.freeze({
    index,
    id: phase.id,
    phaseNumber: index + 1,
    phaseCount: phases.length,
    isFinalPhase: index === phases.length - 1,
    ...phase,
    ...combat,
  });
}

export function phaseFractionFromHp({ hp, maxHp } = {}) {
  const safeMax = Math.max(1, Number(maxHp) || 1);
  return clamp01((Number(hp) || 0) / safeMax);
}

// Build a per-frame directive around the resolved phase. The optional callbacks
// keep boss-specific semantics in the boss module: e.g. final boss summons adds
// on phase entry, while mini-bosses only emit an enrage banner.
export function buildPhaseDirective({
  hp,
  maxHp,
  lastPhaseId = null,
  phases = [],
  combatByPhaseId = {},
  fallbackPhaseId = null,
  bannerForPhase = null,
  summonAddsForPhase = null,
} = {}) {
  const fraction = phaseFractionFromHp({ hp, maxHp });
  const phase = resolvePhaseFromHpFraction(fraction, phases, { combatByPhaseId, fallbackPhaseId });
  const changed = lastPhaseId !== phase.id;
  const summonAdds = changed && typeof summonAddsForPhase === 'function'
    ? Number(summonAddsForPhase(phase)) || 0
    : 0;
  const banner = changed && typeof bannerForPhase === 'function'
    ? bannerForPhase(phase)
    : null;

  return Object.freeze({
    phase,
    hpFraction: Number(fraction.toFixed(3)),
    phaseChanged: changed,
    summonAdds,
    banner: banner || null,
    nextLastPhaseId: phase.id,
  });
}

// Compute a velocity fan centered on the aim direction. Use Number.isFinite
// rather than `||` fallback so legitimate zero components are preserved.
export function computeVolleyVectors({ dirX, dirY, baseSpeed, fanShots = 1, fanSpreadRad = 0, shotSpeedMul = 1 } = {}) {
  const count = Math.max(1, Math.round(Number(fanShots) || 1));
  const spread = Math.max(0, Number(fanSpreadRad) || 0);
  const speed = (Number(baseSpeed) || 1) * (Number(shotSpeedMul) || 1);
  const dx = Number.isFinite(dirX) ? dirX : 1;
  const dy = Number.isFinite(dirY) ? dirY : 0;
  const baseAngle = Math.atan2(dy, dx);
  const start = baseAngle - spread / 2;
  const step = count > 1 ? spread / (count - 1) : 0;
  const vectors = [];
  for (let i = 0; i < count; i += 1) {
    const a = start + step * i;
    vectors.push(Object.freeze({ vx: Math.cos(a) * speed, vy: Math.sin(a) * speed }));
  }
  return Object.freeze(vectors);
}

export function computePhaseVolleyVectors({ dirX, dirY, baseSpeed, phase } = {}) {
  return computeVolleyVectors({
    dirX,
    dirY,
    baseSpeed,
    fanShots: phase?.fanShots ?? 1,
    fanSpreadRad: phase?.fanSpreadRad ?? 0,
    shotSpeedMul: phase?.shotSpeedMul ?? 1,
  });
}
