import { finite, freezeDeep } from './value-guards.mjs';
import { ENEMY_CAPACITY } from './enemy-simulation.mjs';
import { selectEncounterArchetype } from './encounter-director.mjs';

function nonNegativeInteger(value, name) {
  if (!Number.isInteger(value) || value < 0) throw new TypeError(`${name} must be a non-negative integer`);
  return value;
}

// Builds placement-safe candidates for browser/runtime pressure certification.
// Insertion still goes through attemptScheduledEnemyInsertion, so this helper
// cannot bypass body, threat, visual-completeness, or duplicate-id authority.
// The first 17 candidates deliberately cover every attack-token family at a
// useful reserve distance; the remainder form deterministic concentric rings.
export function buildEnduranceEncounterCandidates({
  count = 128,
  seed = 0,
  origin,
  bounds,
  queryGround,
  isBlocked,
} = {}) {
  if (!Number.isInteger(count) || count < 100 || count > ENEMY_CAPACITY) {
    throw new TypeError(`count must be an integer from 100 to ${ENEMY_CAPACITY}`);
  }
  nonNegativeInteger(seed, 'seed');
  const originX = finite(origin?.x, 'origin.x');
  const originY = finite(origin?.y, 'origin.y');
  if (!bounds || ![bounds.minX, bounds.minY, bounds.maxX, bounds.maxY].every(Number.isFinite)) {
    throw new TypeError('finite bounds are required');
  }
  if (bounds.minX >= bounds.maxX || bounds.minY >= bounds.maxY) throw new TypeError('bounds must have positive area');
  if (typeof queryGround !== 'function' || typeof isBlocked !== 'function') {
    throw new TypeError('queryGround and isBlocked callbacks are required');
  }

  const roleSlots = Object.freeze([
    ...Array.from({ length: 6 }, () => 'rusher'),
    ...Array.from({ length: 5 }, () => 'suppressor'),
    ...Array.from({ length: 4 }, () => 'demolition'),
    ...Array.from({ length: 2 }, () => 'support'),
  ]);
  const roleRadii = Object.freeze({ rusher: 112, suppressor: 280, demolition: 360, support: 440 });
  const roleCounts = Object.freeze({ rusher: 6, suppressor: 5, demolition: 4, support: 2 });
  const roleOrdinals = Object.create(null);
  const seedPhase = (seed % 4096) / 4096 * Math.PI * 2;
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const candidates = [];

  for (let index = 0; index < count; index += 1) {
    const requestedRole = roleSlots[index] ?? null;
    const roleOrdinal = requestedRole === null ? 0 : (roleOrdinals[requestedRole] ?? 0);
    if (requestedRole !== null) roleOrdinals[requestedRole] = roleOrdinal + 1;
    let accepted = null;
    for (let placementAttempt = 0; placementAttempt < 128 && accepted === null; placementAttempt += 1) {
      const enduranceIndex = Math.max(0, index - roleSlots.length);
      const ring = Math.floor(enduranceIndex / 24);
      const slot = enduranceIndex % 24;
      const baseRadius = requestedRole === null ? 520 + ring * 170 : roleRadii[requestedRole];
      const baseAngle = requestedRole === null
        ? seedPhase + slot / 24 * Math.PI * 2
        : seedPhase + roleOrdinal / roleCounts[requestedRole] * Math.PI * 2;
      const radius = baseRadius + Math.floor(placementAttempt / 16) * 24;
      const angle = baseAngle + placementAttempt * goldenAngle;
      const x = Number((originX + Math.cos(angle) * radius).toFixed(3));
      const y = Number((originY + Math.sin(angle) * radius).toFixed(3));
      if (x < bounds.minX || x > bounds.maxX || y < bounds.minY || y > bounds.maxY) continue;
      const point = { x, y };
      if (isBlocked(point)) continue;
      const ground = queryGround(x, y);
      if (!ground || !Number.isFinite(ground.groundZ) || ground.kind === 'deep-water') continue;
      accepted = { x, y, groundZ: ground.groundZ };
    }
    if (!accepted) throw new Error(`unable to place endurance candidate ${index}`);
    const selection = selectEncounterArchetype({
      districtId: 'mining-camp',
      bandId: 'endurance',
      spawnOrdinal: index,
      seed,
      requestedRole,
    });
    candidates.push(freezeDeep({
      id: `endurance-evidence-${String(index).padStart(3, '0')}`,
      archetypeId: selection.archetypeId,
      requestedRole: selection.requestedRole,
      ...accepted,
    }));
  }
  return freezeDeep(candidates);
}
