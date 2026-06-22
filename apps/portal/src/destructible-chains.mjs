// Hard Money Heroes — Destructible chain detonation (Level Design Bible §6.6/§10 slice #3).
//
// When an explosive barrel (or destructible) is destroyed, it should chain to other
// nearby explosive props, reshaping the arena dynamically. Pure + deterministic so a
// replay re-sims the same chain reaction. No DOM, no RNG.

// Given a list of destructible props and the index/id of the one that just detonated,
// compute the full chain of props caught in the blast. Each detonating prop expands
// the blast to its chain radius, catching any other explosive prop whose bounds overlap.
//
// Props are { id, x, y, w, h, explosive, hp } objects. Returns an ordered list of
// additional prop ids that should detonate (excludes the trigger prop itself).
export function computeChainDetonation({ props = [], triggerId = null, chainRadius = 70 } = {}) {
  if (!triggerId) return { detonated: [], damageZones: [] };
  const detonated = new Set([triggerId]);
  const queue = [triggerId];
  const damageZones = [];
  // The trigger prop's blast zone.
  const trigger = props.find((p) => p.id === triggerId);
  if (!trigger) return { detonated: [], damageZones: [] };
  damageZones.push(propBlastZone(trigger, chainRadius));

  while (queue.length > 0) {
    const currentId = queue.shift();
    const current = props.find((p) => p.id === currentId);
    if (!current) continue;
    const zone = propBlastZone(current, chainRadius);
    for (const p of props) {
      if (detonated.has(p.id) || !p.explosive || (p.hp ?? 0) > 0) continue;
      // Overlap test between this prop's bounds and the current blast zone.
      if (rectsOverlap(zone, { x: p.x, y: p.y, w: p.w, h: p.h })) {
        detonated.add(p.id);
        queue.push(p.id);
        damageZones.push(propBlastZone(p, chainRadius));
      }
    }
  }
  return { detonated: [...detonated].filter((id) => id !== triggerId), damageZones };
}

function propBlastZone(prop, chainRadius = 70) {
  return {
    x: prop.x - chainRadius,
    y: prop.y - chainRadius * 0.6,
    w: prop.w + chainRadius * 2,
    h: prop.h + chainRadius * 1.2,
  };
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Validates chain detonation invariants (called during npm test).
export function validateChainDetonation() {
  const errors = [];
  const props = [
    { id: 'a', x: 0, y: 0, w: 20, h: 20, explosive: true, hp: 0 },
    { id: 'b', x: 50, y: 0, w: 20, h: 20, explosive: true, hp: 0 },
    { id: 'c', x: 500, y: 500, w: 20, h: 20, explosive: true, hp: 0 },
    { id: 'd', x: 0, y: 0, w: 20, h: 20, explosive: false, hp: 0 },
  ];
  const result = computeChainDetonation({ props, triggerId: 'a', chainRadius: 70 });
  if (!result.detonated.includes('b')) errors.push('chain should detonate nearby barrel b');
  if (result.detonated.includes('c')) errors.push('chain should NOT reach distant barrel c');
  if (result.detonated.includes('d')) errors.push('chain should NOT detonate non-explosive d');
  if (result.detonated.includes('a')) errors.push('trigger prop should not be in detonated list');
  if (result.damageZones.length < 2) errors.push('should have damage zones for trigger + chained');
  return { ok: errors.length === 0, errors };
}
