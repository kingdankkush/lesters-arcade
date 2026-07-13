// Level 1 final-boss phase controller.
//
// WHY THIS EXISTS
// ---------------
// The Level 1 signature boss is The Rug Pull Baron. Its three-phase encounter
// (gate-warning → panic-crossfire → extraction-break) uses per-phase telegraphs,
// add-wave suppression, and attack patterns from buildLevelOneBossChoreographyPlan().
//
// This PURE module maps the signature boss's live HP fraction
// to the correct choreography phase and returns concrete, runtime-ready combat
// directives (telegraph frames, whether to suppress adds, the projectile FAN
// count/spread, shot-speed multiplier, and a phase-entry banner). main.js wires
// this into the enemy update loop's ranged-fire branch for the signature boss, so
// the boss genuinely fights differently across its three phases.
//
// Pure (no DOM/RNG/chain) so it is fully unit-testable and could also drive a
// headless re-simulation. The choreography plan is the single source of phase
// truth; this module only derives runtime numbers from it.

import { buildLevelOneBossChoreographyPlan } from './hmh-level-one-balance-pass.mjs';
import {
  buildPhaseDirective,
  clamp01,
  computePhaseVolleyVectors,
  resolvePhaseFromHpFraction,
} from './boss-phase-controller.mjs';

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
  const phase = resolvePhaseFromHpFraction(hpFraction, choreography.finalBoss.phases, {
    combatByPhaseId: LEVEL_ONE_BOSS_PHASE_COMBAT,
    fallbackPhaseId: 'gate-warning',
  });
  return Object.freeze({
    ...phase,
    addWaveSuppression: Boolean(phase.addWaveSuppression),
  });
}

// Build a full runtime directive for the signature boss given its current + last
// phase. Detects a phase transition (for the entry banner + one-time add wave)
// and returns everything the update loop needs. `lastPhaseId` is the phase id
// recorded on the boss entity from the previous frame (null on first evaluation).
export function buildLevelOneBossDirective({ hp, maxHp, lastPhaseId = null, plan = null } = {}) {
  const choreography = plan ?? buildLevelOneBossChoreographyPlan();
  return buildPhaseDirective({
    hp,
    maxHp,
    lastPhaseId,
    phases: choreography.finalBoss.phases,
    combatByPhaseId: LEVEL_ONE_BOSS_PHASE_COMBAT,
    fallbackPhaseId: 'gate-warning',
    summonAddsForPhase: (phase) => (!phase.addWaveSuppression ? phase.summonAddsOnEntry : 0),
    bannerForPhase: (phase) => `${phase.pattern}`.toUpperCase(),
  });
}

// Compute the projectile fan for a volley: `count` velocity vectors spread
// evenly across `spreadRad`, centered on the aim direction (dirX, dirY). Pure
// geometry so the runtime just pushes these into combat.enemyShots.
export function computeBossVolleyVectors({ dirX, dirY, baseSpeed, phase } = {}) {
  return computePhaseVolleyVectors({ dirX, dirY, baseSpeed, phase });
}

// --- Mini-bosses ------------------------------------------------------------
// The three Level 1 mini-bosses (Claim-Jumper Sheriff, Scam Cult Zealot Alpha,
// Gas Beast Tank) each declare a 2-phase encounter in the choreography plan
// (`miniBosses[]`, keyed by POI id). Like the final boss before this pass, they
// otherwise run the generic enemy loop. A mini-boss is a shorter fight and may
// be melee OR ranged, so its phases are simpler than the final boss: phase 1 is
// baseline, phase 2 (below `enrageHpPct`) is an ENRAGE — tighter attack cadence,
// a telegraph banner, and (for ranged mini-bosses) a small 3-shot fan.
export const MINI_BOSS_ENRAGE_HP_PCT = 50;

export const MINI_BOSS_PHASE_COMBAT = Object.freeze({
  base: Object.freeze({ attackResetMul: 1.0, fanShots: 1, fanSpreadRad: 0, shotSpeedMul: 1.0 }),
  enraged: Object.freeze({ attackResetMul: 0.62, fanShots: 3, fanSpreadRad: 0.5, shotSpeedMul: 1.12 }),
});

// Look up the mini-boss choreography entry for a POI id, or null if none.
export function miniBossPlanForPoi(poiId, { plan = null } = {}) {
  if (!poiId) return null;
  const choreography = plan ?? buildLevelOneBossChoreographyPlan();
  return choreography.miniBosses.find((m) => m.poiId === poiId) ?? null;
}

// Resolve a mini-boss's phase from its live HP fraction. Returns null when the
// POI has no mini-boss plan (so the runtime cleanly falls back to generic AI).
export function resolveLevelOneMiniBossPhase(poiId, hpFraction, { plan = null } = {}) {
  const miniPlan = miniBossPlanForPoi(poiId, { plan });
  if (!miniPlan) return null;
  const enraged = clamp01(hpFraction) * 100 <= MINI_BOSS_ENRAGE_HP_PCT;
  const combat = enraged ? MINI_BOSS_PHASE_COMBAT.enraged : MINI_BOSS_PHASE_COMBAT.base;
  return Object.freeze({
    id: enraged ? 'enraged' : 'base',
    phaseNumber: enraged ? 2 : 1,
    phaseCount: miniPlan.phaseCount ?? 2,
    title: miniPlan.title,
    telegraphFrames: miniPlan.telegraphFrames,
    enraged,
    ...combat,
  });
}

// Build a per-frame mini-boss directive: current phase + whether it just entered
// the enrage phase (for a one-time banner). `lastPhaseId` is the phase id stored
// on the mini-boss enemy from the previous frame.
export function buildLevelOneMiniBossDirective({ poiId, hp, maxHp, lastPhaseId = null, plan = null } = {}) {
  const safeMax = Math.max(1, Number(maxHp) || 1);
  const fraction = clamp01((Number(hp) || 0) / safeMax);
  const phase = resolveLevelOneMiniBossPhase(poiId, fraction, { plan });
  if (!phase) return null;
  const changed = lastPhaseId !== phase.id;
  return Object.freeze({
    phase,
    hpFraction: Number(fraction.toFixed(3)),
    phaseChanged: changed,
    banner: changed && phase.enraged ? `${phase.title} ENRAGED`.toUpperCase() : null,
    nextLastPhaseId: phase.id,
  });
}
