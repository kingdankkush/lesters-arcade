import { freezeDeep } from './value-guards.mjs';

// Tuning lives here rather than on the authored rows so level-one-world keeps
// its {id, districtId, anchor, kind} shape (the production-art kit test keys on
// kind alone). Every phase is a pure function of the integer tick and the
// frozen anchors: no RNG stream, no per-run state, no camera or input, so a
// same-seed replay meets the same rockfall on the same tick.
export const WORLD_HAZARD_RULES = freezeDeep({
  rockfall: { radius: 110, periodTicks: 300, warningTicks: 66, damage: 24, weaponId: 'world-rockfall' },
  'damage-zone': { radius: 150, periodTicks: 240, warningTicks: 48, damage: 14, weaponId: 'world-grid' },
  'area-slow': { radius: 120, speedMultiplier: 0.55 },
  'moving-hazard': { halfLength: 160, halfWidth: 70, axis: { x: 1, y: 0 }, push: 150 },
  // The crossing current is already simulated by traversal (deep water blocks entry).
  'deep-water': null,
});

// Environmental attributions retire bodies without XP, official kills or a
// run-summary weapon row; none of these ids may reach the weapon catalog.
export const WORLD_ENVIRONMENT_WEAPON_IDS = new Set(['world-steam', 'world-rockfall', 'world-grid']);

const HEIGHT_BAND = 8;

export function worldHazardPhase(hazard, tick) {
  const rule = WORLD_HAZARD_RULES[hazard.kind];
  if (!rule?.periodTicks) return { phase: 'idle', progress: 0, cycle: 0 };
  const cycle = Math.floor(tick / rule.periodTicks), phaseTick = tick % rule.periodTicks;
  // Impact lands on the period boundary, never on the spawn tick itself.
  if (phaseTick === 0 && tick >= rule.periodTicks) return { phase: 'impact', progress: 1, cycle };
  const warnStart = rule.periodTicks - rule.warningTicks;
  if (phaseTick >= warnStart) return { phase: 'warning', progress: (phaseTick - warnStart) / rule.warningTicks, cycle };
  return { phase: 'idle', progress: 0, cycle };
}

// Movement field at a point: spore beds multiply speed, conveyors add drift.
// A ledge 64 units above a bed is outside its band, like the steam vent.
export function worldHazardField(hazards, { x, y, groundZ = 0 }) {
  let speed = 1, driftX = 0, driftY = 0;
  for (const hazard of hazards) {
    const rule = WORLD_HAZARD_RULES[hazard.kind];
    if (!rule || Math.abs(groundZ - (hazard.anchor.z ?? 0)) > HEIGHT_BAND) continue;
    const dx = x - hazard.anchor.x, dy = y - hazard.anchor.y;
    if (rule.speedMultiplier !== undefined && Math.hypot(dx, dy) <= rule.radius) speed *= rule.speedMultiplier;
    if (rule.push !== undefined && Math.abs(dx) <= rule.halfLength && Math.abs(dy) <= rule.halfWidth) {
      driftX += rule.axis.x * rule.push;
      driftY += rule.axis.y * rule.push;
    }
  }
  return { speed, drift: { x: driftX, y: driftY } };
}

// Same intent shape as the steam vent so resolveCombatHits validates and
// orders it unchanged. Rockfall and the grid arrive from above, so no line
// of sight; dash i-frames still dodge them through filterDashInvulnerableHits.
export function buildWorldHazardHits(hazards, { tick, targets, queryGround }) {
  const hits = [];
  for (const hazard of hazards) {
    const rule = WORLD_HAZARD_RULES[hazard.kind];
    if (!rule?.damage || worldHazardPhase(hazard, tick).phase !== 'impact') continue;
    const { x, y } = hazard.anchor, z = queryGround(x, y).groundZ;
    for (const target of targets) {
      const groundZ = target.groundZ ?? 0;
      if (target.active === false || Math.hypot(target.x - x, target.y - y) > rule.radius || Math.abs(groundZ - z) > HEIGHT_BAND) continue;
      hits.push({ id: `${hazard.id}:${tick}:${target.id}`, tick, time: 0, targetId: target.id, sourceId: hazard.id, weaponId: rule.weaponId, damage: rule.damage, criticalChance: 0, criticalMultiplier: 1, armorPiercing: false, direction: { x: 0, y: 1 }, knockback: 0, point: { x: target.x, y: target.y, z: groundZ + 16 } });
    }
  }
  return hits;
}
