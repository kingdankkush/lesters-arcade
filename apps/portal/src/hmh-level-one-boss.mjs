// Level 1 final-boss phase controller.
//
// WHY THIS EXISTS
// ---------------
// The handoff (§12.7) is explicit: "The Level 1 boss should be a real final
// encounter, not a regular enemy with more HP." Today the final boss is exactly
// that — a `finalBossProxy` flag on an otherwise-generic ranged enemy that runs
// the same attack loop as a FUD Goblin. Meanwhile buildLevelOneBossChoreographyPlan()
// (hmh-level-one-balance-pass.mjs) already defines a rich 3-phase encounter
// (gate-warning → panic-crossfire → extraction-break) with per-phase telegraph
// frames, add-wave suppression, and attack patterns — but nothing in the runtime
// consumes it.
//
// This PURE module bridges that gap. It maps the boss proxy's live HP fraction
// to the correct choreography phase and returns concrete, runtime-ready combat
// directives (telegraph frames, whether to suppress adds, the projectile FAN
// count/spread, shot-speed multiplier, and a phase-entry banner). main.js wires
// this into the enemy update loop's ranged-fire branch for the boss proxy, so
// the boss genuinely fights differently across its three phases.
//
// Pure (no DOM/RNG/chain) so it is fully unit-testable and could also drive a
// headless re-simulation. The choreography plan is the single source of phase
// truth; this module only derives runtime numbers from it.

import { buildLevelOneBossChoreographyPlan } from './hmh-level-one-balance-pass.mjs';

function clamp01(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

// Per-phase runtime combat shape. Keyed by the choreography phase id so the
// design plan stays the source of truth for hpPct thresholds + telegraph + add
// suppression, and this table only adds the concrete firing numbers the plan
// intentionally leaves to the runtime.
//
// - fanShots:        number of projectiles fired per volley (a fan spread)
// - fanSpreadRad:    total angular spread of the fan (radians)
// - shotSpeedMul:    multiplier on the base enemy shot speed for this phase
// - attackResetFrames: cooldown between volleys (lower = more aggressive)
// - summonAddsOnEntry: adds spawned when the phase begins (0 when suppressed)
export const LEVEL_ONE_BOSS_PHASE_COMBAT = Object.freeze({
  'gate-warning': Object.freeze({
    fanShots: 3, fanSpreadRad: 0.42, shotSpeedMul: 1.0, attackResetFrames: 78, summonAddsOnEntry: 0,
  }),
  'panic-crossfire': Object.freeze({
    fanShots: 5, fanSpreadRad: 0.72, shotSpeedMul: 1.12, attackResetFrames: 60, summonAddsOnEntry: 2,
  }),
  'extraction-break': Object.freeze({
    fanShots: 7, fanSpreadRad: 1.02, shotSpeedMul: 1.28, attackResetFrames: 92, summonAddsOnEntry: 0,
  }),
});

// Resolve the active phase for a given HP fraction (0..1) from the choreography
// plan. Phases declare hpPct as [highPct, lowPct] in descending 100..0 order;
// the active phase is the one whose [low, high] band contains the current HP%.
// The final phase owns 0 so a dead-but-not-yet-resolved boss still maps cleanly.
export function resolveLevelOneBossPhase(hpFraction, { plan = null } = {}) {
  const choreography = plan ?? buildLevelOneBossChoreographyPlan();
  const phases = choreography.finalBoss.phases;
  const hpPct = clamp01(hpFraction) * 100;

  let index = phases.length - 1;
  for (let i = 0; i < phases.length; i += 1) {
    const [high, low] = phases[i].hpPct;
    // Highest-HP band that still contains hpPct wins. Upper phase owns its top
    // edge (100), lower bands own everything strictly below their high edge.
    if (hpPct <= high && hpPct > low) { index = i; break; }
    if (i === 0 && hpPct >= high) { index = 0; break; }
  }
  const phase = phases[index];
  const combat = LEVEL_ONE_BOSS_PHASE_COMBAT[phase.id] ?? LEVEL_ONE_BOSS_PHASE_COMBAT['gate-warning'];

  return Object.freeze({
    index,
    id: phase.id,
    phaseNumber: index + 1,
    phaseCount: phases.length,
    telegraphFrames: phase.telegraphFrames,
    addWaveSuppression: Boolean(phase.addWaveSuppression),
    pattern: phase.pattern,
    counterplay: phase.counterplay,
    ...combat,
    isFinalPhase: index === phases.length - 1,
  });
}

// Build a full runtime directive for the boss proxy given its current + last
// phase. Detects a phase transition (for the entry banner + one-time add wave)
// and returns everything the update loop needs. `lastPhaseId` is the phase id
// recorded on the boss proxy from the previous frame (null on first evaluation).
export function buildLevelOneBossDirective({ hp, maxHp, lastPhaseId = null, plan = null } = {}) {
  const safeMax = Math.max(1, Number(maxHp) || 1);
  const fraction = clamp01((Number(hp) || 0) / safeMax);
  const phase = resolveLevelOneBossPhase(fraction, { plan });
  const changed = lastPhaseId !== phase.id;
  return Object.freeze({
    phase,
    hpFraction: Number(fraction.toFixed(3)),
    phaseChanged: changed,
    // Adds only spawn on a genuine phase ENTRY, and never when the phase's plan
    // suppresses add waves (so the extraction-break finale stays a clean duel).
    summonAdds: changed && !phase.addWaveSuppression ? phase.summonAddsOnEntry : 0,
    // The banner text runtime should surface on phase entry.
    banner: changed ? `${phase.pattern}`.toUpperCase() : null,
    nextLastPhaseId: phase.id,
  });
}

// Compute the projectile fan for a volley: `count` velocity vectors spread
// evenly across `spreadRad`, centered on the aim direction (dirX, dirY). Pure
// geometry so the runtime just pushes these into combat.enemyShots.
export function computeBossVolleyVectors({ dirX, dirY, baseSpeed, phase } = {}) {
  const count = Math.max(1, Math.round(phase?.fanShots ?? 1));
  const spread = Math.max(0, Number(phase?.fanSpreadRad ?? 0));
  const speed = (Number(baseSpeed) || 1) * (phase?.shotSpeedMul ?? 1);
  // NB: use ?? not || for the direction components — a legitimate 0 (e.g. aiming
  // straight along an axis) is falsy and must NOT be coerced to a fallback.
  const dx = Number.isFinite(dirX) ? dirX : 1;
  const dy = Number.isFinite(dirY) ? dirY : 0;
  const baseAngle = Math.atan2(dy, dx);
  const start = baseAngle - spread / 2;
  const step = count > 1 ? spread / (count - 1) : 0;
  const vectors = [];
  for (let i = 0; i < count; i += 1) {
    const a = start + step * i;
    vectors.push({ vx: Math.cos(a) * speed, vy: Math.sin(a) * speed });
  }
  return vectors;
}
