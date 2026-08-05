// T2. Ground decals.
//
// The ground carried terrain material and nothing else, so a route that 25
// nodes of traffic supposedly run along looked identical to untouched ground,
// and an arena where fights happen looked like a field. Decals are the
// cheapest layer that makes a world look used.
//
// Strictly projection-only. They draw beneath props and actors, never become
// collision, and are anchored to the world contract rather than scattered --
// a mark that drifts away from the thing it marks is just noise.
//
// The placement list is built ONCE per session. Recomputing a hundred-odd
// decals every frame would allocate inside the render loop for no gain: none
// of this moves.

export const DECAL_KINDS = Object.freeze({
  // Footpath wear where the authored route runs.
  'route-wear': Object.freeze({ color: '#6b5a3f', alpha: 0.22, shape: 'ellipse', stretch: 2.4 }),
  // Wheel ruts: paired, long and narrow, along road-ish stretches.
  'tire-rut': Object.freeze({ color: '#4a3f2e', alpha: 0.26, shape: 'rut', stretch: 4.2 }),
  // Scorching around the hazard the world contract already marks.
  scorch: Object.freeze({ color: '#241c18', alpha: 0.30, shape: 'ellipse', stretch: 1.15 }),
  // Dried spill at encounter arenas.
  'arena-stain': Object.freeze({ color: '#3a1f22', alpha: 0.24, shape: 'ellipse', stretch: 1.4 }),
  // Cracked mud where water meets land.
  'shore-crack': Object.freeze({ color: '#5a4d38', alpha: 0.20, shape: 'crack', stretch: 1.0 }),
});

// Hard cap so the layer cannot grow without limit as the world contract does.
// Every draw is a filled path, and this is the budget the render pass is
// measured against.
export const MAX_WORLD_DECALS = 220;

// Where the baked placements live. buildWorldDecals below runs at BUILD time
// (scripts/build-hmh-world-decals.mjs) and is tree-shaken out of the child,
// which only imports drawWorldDecals and this URL.
export const WORLD_DECAL_URL = '/assets/generated/hmh-world-decals/hmh-world-decals.json';

function seededUnit(seed, key) {
  let hash = (Number(seed) >>> 0) ^ 0x811c9dc5;
  const text = String(key);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  hash ^= hash << 13;
  hash ^= hash >>> 17;
  hash ^= hash << 5;
  return (hash >>> 0) / 0x1_0000_0000;
}

function districtAt(world, x) {
  for (const district of world.districts) {
    if (x >= district.minX && x <= district.maxX) return district.id;
  }
  return null;
}

function freezeDecal(decal) {
  return Object.freeze({ ...decal, runtimeAuthority: 'projection-only' });
}

export function buildWorldDecals({ world, seed = 0x484d4432 } = {}) {
  if (!world?.routeGraph?.nodes) throw new TypeError('a level-one world contract is required');
  const decals = [];
  const push = (decal) => {
    if (decals.length >= MAX_WORLD_DECALS) return;
    decals.push(freezeDecal(decal));
  };

  // --- footpath wear along the route -------------------------------------
  // Placed on the EDGES rather than the nodes, so wear reads as a path
  // between places instead of a ring around each waypoint.
  const nodeById = new Map(world.routeGraph.nodes.map((node) => [node.id, node]));
  const edges = world.routeGraph.edges ?? [];
  edges.forEach((edge, edgeIndex) => {
    const from = nodeById.get(edge.from ?? edge.a);
    const to = nodeById.get(edge.to ?? edge.b);
    if (!from || !to) return;
    const span = Math.hypot(to.x - from.x, to.y - from.y);
    // One patch per ~340 units of route, so a long leg carries more wear than
    // a short one rather than every leg getting the same treatment.
    const patches = Math.max(1, Math.min(4, Math.round(span / 340)));
    for (let index = 0; index < patches; index += 1) {
      const key = `wear:${edgeIndex}:${index}`;
      const t = (index + 0.5) / patches;
      const jitter = (seededUnit(seed, `${key}:j`) - 0.5) * 46;
      const x = from.x + (to.x - from.x) * t + jitter;
      const y = from.y + (to.y - from.y) * t + jitter * 0.6;
      push({
        id: `decal:route-wear:${edgeIndex}:${index}`,
        kind: 'route-wear',
        anchorId: `${from.id}->${to.id}`,
        districtId: districtAt(world, x),
        x: Number(x.toFixed(2)),
        y: Number(y.toFixed(2)),
        radius: 34 + seededUnit(seed, `${key}:r`) * 26,
        rotation: Math.atan2(to.y - from.y, to.x - from.x),
      });
    }
  });

  // --- tire ruts on the long east-west legs -------------------------------
  // Ruts only make sense where something drives, so they follow the straighter
  // legs rather than every footpath.
  edges.forEach((edge, edgeIndex) => {
    const from = nodeById.get(edge.from ?? edge.a);
    const to = nodeById.get(edge.to ?? edge.b);
    if (!from || !to) return;
    const dx = Math.abs(to.x - from.x);
    const dy = Math.abs(to.y - from.y);
    if (dx < 420 || dy > dx * 0.5) return;
    const rotation = Math.atan2(to.y - from.y, to.x - from.x);
    for (const side of [-1, 1]) {
      const key = `rut:${edgeIndex}:${side}`;
      const t = 0.35 + seededUnit(seed, `${key}:t`) * 0.3;
      const offset = side * 26;
      const x = from.x + (to.x - from.x) * t - Math.sin(rotation) * offset;
      const y = from.y + (to.y - from.y) * t + Math.cos(rotation) * offset;
      push({
        id: `decal:tire-rut:${edgeIndex}:${side > 0 ? 'r' : 'l'}`,
        kind: 'tire-rut',
        anchorId: `${from.id}->${to.id}`,
        districtId: districtAt(world, x),
        x: Number(x.toFixed(2)),
        y: Number(y.toFixed(2)),
        radius: 30 + seededUnit(seed, `${key}:r`) * 14,
        rotation,
      });
    }
  });

  // Arena stains, hazard scorching and shoreline cracking are all "scatter N
  // marks around an anchor"; only the anchor set and the radius policy differ,
  // so they share one pass. This is also why the module fits: the child bundle
  // is against a hard cap and five near-duplicate loops did not.
  const scatter = ({ kind, anchorId, districtId, x, y, count, spread, minRadius, radiusRange, inset = 0 }) => {
    for (let index = 0; index < count; index += 1) {
      const key = `${kind}:${anchorId}:${index}`;
      const angle = seededUnit(seed, `${key}:a`) * Math.PI * 2;
      const distance = inset + seededUnit(seed, `${key}:d`) * spread;
      const px = x + Math.cos(angle) * distance;
      const py = y + Math.sin(angle) * distance;
      if (px < 0 || px > world.bounds.maxX || py < 0 || py > world.bounds.maxY) continue;
      push({
        id: `decal:${kind}:${anchorId}:${index}`,
        kind,
        anchorId,
        districtId: districtId ?? districtAt(world, px),
        x: Number(px.toFixed(2)),
        y: Number(py.toFixed(2)),
        radius: minRadius + seededUnit(seed, `${key}:r`) * radiusRange,
        rotation: angle,
      });
    }
  };

  for (const arena of world.encounterArenas) {
    // Kept well inside the radius so a stain cannot escape its arena.
    scatter({
      kind: 'arena-stain', anchorId: arena.id, districtId: arena.districtId,
      x: arena.anchor.x, y: arena.anchor.y, count: 4,
      inset: arena.radius * 0.15, spread: arena.radius * 0.55,
      minRadius: 26, radiusRange: 34,
    });
  }

  for (const point of world.pointsOfInterest) {
    if (point.hook !== 'hazard' && point.hook !== 'reward') continue;
    scatter({
      kind: 'scorch', anchorId: point.id, districtId: point.districtId,
      x: point.anchor.x, y: point.anchor.y, count: 2,
      inset: 40, spread: 90, minRadius: 22, radiusRange: 26,
    });
  }

  // Shoreline cracking sits on the BANKS, just outside each water rect.
  for (const surface of world.surfaces) {
    if (surface.kind !== 'water' && surface.kind !== 'shallow-water') continue;
    const { minX, maxX, minY, maxY } = surface.area;
    for (const [side, edgeX] of [['w', minX], ['e', maxX]]) {
      const outward = side === 'w' ? -1 : 1;
      for (let index = 0; index < 5; index += 1) {
        const key = `crack:${surface.id}:${side}:${index}`;
        const y = minY + ((index + 0.5) / 5) * (maxY - minY) + (seededUnit(seed, `${key}:y`) - 0.5) * 120;
        const x = edgeX + outward * (18 + seededUnit(seed, `${key}:x`) * 70);
        if (x < 0 || x > world.bounds.maxX || y < 0 || y > world.bounds.maxY) continue;
        push({
          id: `decal:shore-crack:${surface.id}:${side}:${index}`,
          kind: 'shore-crack',
          anchorId: surface.id,
          districtId: districtAt(world, x),
          x: Number(x.toFixed(2)),
          y: Number(y.toFixed(2)),
          radius: 20 + seededUnit(seed, `${key}:r`) * 22,
          rotation: seededUnit(seed, `${key}:rot`) * Math.PI,
        });
      }
    }
  }

  return Object.freeze(decals);
}

/**
 * Draw the decal layer. Called per frame with a cleared Graphics target, the
 * same pattern the other world-production layers use: no allocation beyond the
 * path commands themselves, and culled to the viewport.
 */
export function drawWorldDecals({ target, decals, camera, view, project, cullPadding = 160 }) {
  if (!target || typeof project !== 'function') throw new TypeError('a draw target and projection are required');
  let drawn = 0;
  for (const decal of decals) {
    const centre = project({ x: decal.x, y: decal.y, z: 0 }, camera, view);
    if (centre.x < -cullPadding || centre.x > view.width + cullPadding) continue;
    if (centre.y < -cullPadding || centre.y > view.height + cullPadding) continue;
    const spec = DECAL_KINDS[decal.kind];
    const color = Number.parseInt(spec.color.replace('#', ''), 16);
    const radius = decal.radius * camera.zoom;
    if (spec.shape === 'rut') {
      const long = radius * spec.stretch;
      const short = Math.max(1.5, radius * 0.16);
      target.ellipse(centre.x, centre.y, long, short).fill({ color, alpha: spec.alpha });
    } else if (spec.shape === 'crack') {
      // A few short strokes read as cracked mud; a filled blob does not.
      for (let arm = 0; arm < 3; arm += 1) {
        const angle = decal.rotation + (arm / 3) * Math.PI;
        target.moveTo(centre.x - Math.cos(angle) * radius, centre.y - Math.sin(angle) * radius * 0.5)
          .lineTo(centre.x + Math.cos(angle) * radius, centre.y + Math.sin(angle) * radius * 0.5)
          .stroke({ color, width: Math.max(1, radius * 0.09), alpha: spec.alpha });
      }
    } else {
      // Ground marks are seen at 55 degrees, so they are squashed in screen Y
      // to sit flat rather than reading as a sphere on the surface.
      target.ellipse(centre.x, centre.y, radius * spec.stretch, radius * 0.52).fill({ color, alpha: spec.alpha });
    }
    drawn += 1;
  }
  return drawn;
}
