import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  authoredPropItemUrl,
  buildAuthoredWorldPropPlacements,
  buildAuthoredDistrictLandmarkPlacements,
  buildAuthoredEncampmentPlacements,
  AUTHORED_CAMP_KIT,
} from '../apps/hmh-reboot/src/authored-prop-atlas.mjs';
import { LEVEL_ONE_WORLD } from '../apps/hmh-reboot/src/level-one-world.mjs';

const manifest = JSON.parse(readFileSync(
  fileURLToPath(new URL('../apps/hmh-reboot/assets/source/blender/hmh-authored-props.json', import.meta.url)),
  'utf8',
));
const builderSource = readFileSync(
  fileURLToPath(new URL('../scripts/hmh-blender/create-hmh-authored-props.py', import.meta.url)),
  'utf8',
);
const atlas = JSON.parse(readFileSync(
  fileURLToPath(new URL('../apps/portal/assets/generated/hmh-reboot-authored-props/hmh-authored-props-atlas.json', import.meta.url)),
  'utf8',
));

// A7 + W3. Enemies spawn in open ground, so an encounter reads as figures
// appearing on grass rather than as a place someone lives. This is the kit
// that gives spawn regions somewhere to come FROM.
//
// Strictly dressing: projection-only props and placement data. No spawn
// timing, no AI, no collision -- W3 attaches the kit to spawn regions that
// already exist.
const CAMP = Object.freeze({
  'campfire-ring': { shape: 'campfire-ring', minRatio: 0.62 },
  'bedroll-cluster': { shape: 'bedroll-cluster', minRatio: 0.60 },
  'sandbag-nest': { shape: 'sandbag-nest', minRatio: 0.62 },
  'scrap-barricade': { shape: 'scrap-barricade', minRatio: 0.80 },
  'watch-platform': { shape: 'watch-platform', minRatio: 1.20 },
  'faction-banner': { shape: 'faction-banner', minRatio: 1.60 },
});

test('every camp asset is on the world-prop roster', () => {
  for (const id of Object.keys(CAMP)) {
    assert.equal(manifest.assets.find((asset) => asset.assetId === id)?.category, 'world-prop', `${id} missing from the authored manifest`);
  }
});

test('every camp asset resolves to an item icon', () => {
  for (const id of Object.keys(CAMP)) {
    assert.doesNotThrow(() => authoredPropItemUrl(id), `${id} has no icon`);
  }
});

test('every camp asset is declared in the Blender manifest', () => {
  const byId = new Map(manifest.assets.map((asset) => [asset.assetId, asset]));
  for (const [id, spec] of Object.entries(CAMP)) {
    const asset = byId.get(id);
    assert.ok(asset, `${id} missing from the props manifest`);
    assert.equal(asset.category, 'world-prop');
    assert.equal(asset.shape, spec.shape);
    for (const key of ['primary', 'secondary', 'accent']) {
      assert.match(asset.palette[key], /^#[0-9a-f]{6}$/, `${id} palette.${key}`);
    }
    assert.deepEqual(asset.frameSize, [256, 256], `${id} needs the 256px detail frame`);
  }
});

test('every camp shape has a builder branch', () => {
  for (const spec of Object.values(CAMP)) {
    assert.ok(
      builderSource.includes(`elif shape == '${spec.shape}':`),
      `create-hmh-authored-props.py has no branch for ${spec.shape}`,
    );
  }
});

test('every camp silhouette holds its proportion in the rendered atlas', () => {
  const frames = new Map(atlas.frames.map((frame) => [frame.assetId, frame]));
  for (const [id, spec] of Object.entries(CAMP)) {
    const frame = frames.get(id);
    assert.ok(frame, `${id} is not in the packed atlas`);
    const ratio = frame.frame.h / frame.frame.w;
    assert.ok(
      ratio >= spec.minRatio,
      `${id} renders ${frame.frame.w}x${frame.frame.h} (h/w ${ratio.toFixed(2)}, needs ${spec.minRatio})`,
    );
    assert.ok(frame.opaquePixels > 400, `${id} has only ${frame.opaquePixels} opaque pixels`);
  }
});

// W3. The kit exists to mark where enemies come from, so it has to be
// attached to encounter regions, not sprinkled as generic dressing.
test('the camp kit declares encampments tied to encounter regions', () => {
  assert.ok(Array.isArray(AUTHORED_CAMP_KIT), 'camp kit must be exported as a list');
  assert.ok(AUTHORED_CAMP_KIT.length >= 4, `only ${AUTHORED_CAMP_KIT.length} encampments authored`);
  for (const camp of AUTHORED_CAMP_KIT) {
    assert.match(camp.id, /^camp:/);
    assert.ok(typeof camp.districtId === 'string' && camp.districtId.length > 0);
    assert.ok(Number.isFinite(camp.x) && Number.isFinite(camp.y), `${camp.id} has no anchor`);
    assert.ok(camp.x >= 0 && camp.x <= 12_000 && camp.y >= 0 && camp.y <= 4_800, `${camp.id} out of bounds`);
    assert.ok(Array.isArray(camp.propIds) && camp.propIds.length >= 3, `${camp.id} is too thin to read as a camp`);
    for (const id of camp.propIds) {
      assert.ok(atlas.frames.some((frame) => frame.assetId === id), `${camp.id} references unknown prop ${id}`);
    }
  }
});

test('encampments spread across districts rather than stacking in one', () => {
  const districts = new Set(AUTHORED_CAMP_KIT.map((camp) => camp.districtId));
  assert.ok(districts.size >= 3, `encampments only reach ${districts.size} districts`);
});

test('every camp prop is actually placed somewhere in the world', () => {
  const dressing = buildAuthoredWorldPropPlacements({ worldId: 'forked-frontier', seed: 'a7-camps' });
  const placed = new Set(dressing.map((placement) => placement.assetId));
  for (const camp of AUTHORED_CAMP_KIT) {
    for (const id of camp.propIds) placed.add(id);
  }
  for (const id of Object.keys(CAMP)) {
    assert.ok(placed.has(id), `${id} renders into the atlas but is never placed`);
  }
});

// A camp is a composition, not a pile. Every encampment needs at least one
// tall element or it reads as scattered ground clutter from the 55-degree
// camera -- the same failure mode the asset waves kept hitting.
test('every encampment carries a vertical element', () => {
  const tall = new Set(['watch-platform', 'faction-banner']);
  for (const camp of AUTHORED_CAMP_KIT) {
    assert.ok(
      camp.propIds.some((id) => tall.has(id)),
      `${camp.id} has no tall prop, so it reads as ground clutter`,
    );
  }
});

// The safety property for this slice. Camp dressing frames an encounter; it
// must not stand in the middle of one. Projection-only sprites carry no
// collision, but they can still occlude actors, and an arena is exactly where
// the player most needs to read what is happening.
test('encampment props ring the arena edge and stay off the fighting floor', async () => {
  const { buildAuthoredEncampmentPlacements } = await import('../apps/hmh-reboot/src/authored-prop-atlas.mjs');
  const placements = buildAuthoredEncampmentPlacements({ worldId: 'forked-frontier' });
  assert.ok(placements.length >= 16, `only ${placements.length} encampment placements`);
  assert.deepEqual(
    placements,
    buildAuthoredEncampmentPlacements({ worldId: 'forked-frontier' }),
    'encampment placement must be deterministic',
  );
  const campById = new Map(AUTHORED_CAMP_KIT.map((camp) => [camp.id, camp]));
  for (const placement of placements) {
    const camp = campById.get(placement.campId);
    assert.ok(camp, `${placement.id} has no camp`);
    const distance = Math.hypot(placement.x - camp.x, placement.y - camp.y);
    assert.ok(
      distance >= camp.radius * 0.7,
      `${placement.id} sits ${Math.round(distance)} from the arena centre (radius ${camp.radius}); that is on the fighting floor`,
    );
    assert.ok(distance <= camp.radius, `${placement.id} drifted outside its arena`);
    assert.equal(placement.category, 'encampment');
    assert.equal(placement.runtimeAuthority, 'projection-only');
  }
});

// An encampment that is built but never handed to the display is invisible
// work -- the same trap as a roster entry that is never placed.
test('encampments are wired into the runtime placement list', () => {
  const source = readFileSync(
    fileURLToPath(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url)),
    'utf8',
  );
  assert.match(source, /buildAuthoredEncampmentPlacements\(\{ worldId: LEVEL_ONE_WORLD\.id \}\)/);
});

// ---------------------------------------------------------------------------
// W-8 spawn-region camps (Cycle 073). The five arena camps above have been
// live since ff013b60; none of the twelve LEVEL_ONE_WORLD spawn points had a
// camp (nearest camp centre 1,000-2,482 units away), so enemies still walked
// out of empty grass at the map edges. One camp per spawn point, composed as
// a ring around the point the enemies actually emerge from, with the same
// projection-only authority. The arena camps stay byte-identical.
// ---------------------------------------------------------------------------

const ARENA_CAMPS = AUTHORED_CAMP_KIT.filter((camp) => camp.arenaId);
const SPAWN_CAMPS = AUTHORED_CAMP_KIT.filter((camp) => camp.spawnPointId);

// Snapshot of the five arena camps' placements at Cycle 072 production
// (104b01dc). Their scenes (hashwood-camp, frontier-relay x3, market,
// residential) keep their accepted baselines for this layer.
const ARENA_CAMP_SNAPSHOT = [
  ['camp:relay-picket:00', 'watch-platform', 1608.738, 3208.738], ['camp:relay-picket:01', 'sandbag-nest', 1191.262, 3208.738],
  ['camp:relay-picket:02', 'campfire-ring', 1191.262, 2791.262], ['camp:relay-picket:03', 'bedroll-cluster', 1608.738, 2791.262],
  ['camp:ravine-ambush:00', 'faction-banner', 2943.528, 2943.528], ['camp:ravine-ambush:01', 'scrap-barricade', 2456.472, 2943.528],
  ['camp:ravine-ambush:02', 'campfire-ring', 2456.472, 2456.472], ['camp:ravine-ambush:03', 'sandbag-nest', 2943.528, 2456.472],
  ['camp:hashwood-hunters:00', 'campfire-ring', 7416.721, 2766.721], ['camp:hashwood-hunters:01', 'bedroll-cluster', 6883.279, 2766.721],
  ['camp:hashwood-hunters:02', 'watch-platform', 6883.279, 2233.279], ['camp:hashwood-hunters:03', 'faction-banner', 7416.721, 2233.279],
  ['camp:mining-crew:00', 'scrap-barricade', 9139.914, 3339.914], ['camp:mining-crew:01', 'sandbag-nest', 8560.086, 3339.914],
  ['camp:mining-crew:02', 'watch-platform', 8560.086, 2760.086], ['camp:mining-crew:03', 'bedroll-cluster', 9139.914, 2760.086],
  ['camp:yard-holdouts:00', 'faction-banner', 11359.493, 2759.493], ['camp:yard-holdouts:01', 'scrap-barricade', 10640.507, 2759.493],
  ['camp:yard-holdouts:02', 'sandbag-nest', 10640.507, 2040.507], ['camp:yard-holdouts:03', 'campfire-ring', 11359.493, 2040.507],
];

test('the five arena camps are byte-identical to Cycle 072 production', () => {
  assert.equal(ARENA_CAMPS.length, 5);
  const placements = buildAuthoredEncampmentPlacements({ worldId: 'forked-frontier' })
    .filter((p) => p.arenaId)
    .map((p) => [p.id, p.assetId, p.x, p.y]);
  assert.deepEqual(placements, ARENA_CAMP_SNAPSHOT);
});

test('every spawn point has exactly one camp, close enough to read as where the enemies come from', () => {
  assert.equal(LEVEL_ONE_WORLD.spawnPoints.length, 12);
  for (const point of LEVEL_ONE_WORLD.spawnPoints) {
    const camps = SPAWN_CAMPS.filter((camp) => camp.spawnPointId === point.id);
    assert.equal(camps.length, 1, `${point.id} has ${camps.length} camps`);
    const [camp] = camps;
    assert.equal(camp.districtId, point.districtId, `${camp.id} is filed under the wrong district`);
    const distance = Math.hypot(camp.x - point.x, camp.y - point.y);
    assert.ok(distance <= 260, `${camp.id} centre sits ${Math.round(distance)} from its spawn point`);
    assert.ok(camp.radius >= 150 && camp.radius <= 240, `${camp.id} radius ${camp.radius} is out of the spawn-camp band`);
  }
  assert.equal(SPAWN_CAMPS.length, 12);
  assert.equal(AUTHORED_CAMP_KIT.length, 17);
});

// A spawn camp is built from the camp kit plus the junk satellites that
// already exist in the atlas. No tents exist in the roster; bedroll-cluster is
// the sleeping element.
const SPAWN_CAMP_SET = new Set([
  'campfire-ring', 'bedroll-cluster', 'sandbag-nest', 'scrap-barricade', 'watch-platform', 'faction-banner',
  'salvage-crate', 'stacked-crates', 'fuel-drum', 'loader-barrel', 'chain-fence', 'ruined-wall', 'streetlamp',
]);
test('every spawn camp is a composition of at least four camp-set props', () => {
  for (const camp of SPAWN_CAMPS) {
    assert.ok(camp.propIds.length >= 4, `${camp.id} has only ${camp.propIds.length} props`);
    for (const id of camp.propIds) assert.ok(SPAWN_CAMP_SET.has(id), `${camp.id} uses ${id}, which is not a camp prop`);
    assert.ok(camp.propIds.includes('campfire-ring'), `${camp.id} has no fire; a camp without a fire reads as storage`);
  }
});

function segmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}
function pointInPolygon(px, py, vertices) {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const a = vertices[i];
    const b = vertices[j];
    if ((a.y > py) !== (b.y > py) && px < ((b.x - a.x) * (py - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
function shapeClearance(shape, x, y) {
  if (shape.type === 'circle') return Math.hypot(x - shape.x, y - shape.y) - shape.radius;
  if (shape.type === 'capsule') return segmentDistance(x, y, shape.a.x, shape.a.y, shape.b.x, shape.b.y) - shape.radius;
  let edge = Infinity;
  for (let i = 0; i < shape.vertices.length; i += 1) {
    const a = shape.vertices[i];
    const b = shape.vertices[(i + 1) % shape.vertices.length];
    edge = Math.min(edge, segmentDistance(x, y, a.x, a.y, b.x, b.y));
  }
  return pointInPolygon(x, y, shape.vertices) ? -edge : edge;
}
const ROUTE_NODES = new Map(LEVEL_ONE_WORLD.routeGraph.nodes.map((node) => [node.id, node]));
function routeClearance(x, y) {
  let best = Infinity;
  for (const edge of LEVEL_ONE_WORLD.routeGraph.edges) {
    const a = ROUTE_NODES.get(edge.from);
    const b = ROUTE_NODES.get(edge.to);
    best = Math.min(best, segmentDistance(x, y, a.x, a.y, b.x, b.y) - edge.width / 2);
  }
  return best;
}

// Spawn camps sit in the shoulder bands beside cliffs, fences and tree lines.
// Four spawn points are tight (yard-south 120 from town-east-tenement,
// mining-south 180 from mining-south-fence, hashwood-south 186 from the south
// tree line, ravine-north 202 from the north cliff), which is what forces the
// authored centre offsets and radii.
test('spawn camp props clear every blocker, route, river, arena and set-piece', () => {
  const placements = buildAuthoredEncampmentPlacements({ worldId: 'forked-frontier' }).filter((p) => p.spawnPointId);
  assert.ok(placements.length >= 48, `only ${placements.length} spawn-camp placements (12 camps x >= 4 props)`);
  const setpieces = buildAuthoredDistrictLandmarkPlacements({ worldId: 'forked-frontier' }).filter((p) => p.anchorDistance === 0);
  const offenders = [];
  for (const p of placements) {
    for (const blocker of LEVEL_ONE_WORLD.collisionBlockers) {
      const clearance = shapeClearance(blocker.shape, p.x, p.y);
      if (clearance < 24) offenders.push(`${p.id} is ${Math.round(clearance)} from ${blocker.id}`);
    }
    const route = routeClearance(p.x, p.y);
    if (route < 24) offenders.push(`${p.id} is ${Math.round(route)} inside a route`);
    if (p.y > 1_700 && p.y < 3_100) offenders.push(`${p.id} sits in the central corridor band`);
    if (p.x >= 4_500 && p.x <= 5_000 && !(p.y >= 800 && p.y <= 1_150)) offenders.push(`${p.id} stands in deep water`);
    for (const arena of LEVEL_ONE_WORLD.encounterArenas) {
      if (Math.hypot(p.x - arena.anchor.x, p.y - arena.anchor.y) < arena.radius) offenders.push(`${p.id} is on ${arena.id}`);
    }
    for (const setpiece of setpieces) {
      if (Math.hypot(p.x - setpiece.x, p.y - setpiece.y) < 300) offenders.push(`${p.id} crowds ${setpiece.id}`);
    }
    if (p.x < 40 || p.x > 11_960 || p.y < 40 || p.y > 4_760) offenders.push(`${p.id} hangs off the world edge`);
  }
  assert.deepEqual(offenders, [], `${offenders.length} spawn-camp placement defects`);
});

// The town kit is placed from the atlas metadata at runtime, after the
// dressing and camps are already built, so the generator carries a mirror of
// the town positions. This pins the mirror to the real metadata (both ways)
// and keeps every dressing and spawn-camp base out of the town props' visual
// stack: a bedroll behind a mailbox reads as one broken sprite.
test('dressing and spawn camps keep clear of every town-kit placement', async () => {
  const { createAuthoredPropAtlasIndex, buildAuthoredTownPlacements, AUTHORED_TOWN_EXCLUSIONS } = await import('../apps/hmh-reboot/src/authored-prop-atlas.mjs');
  const town = buildAuthoredTownPlacements({ worldId: 'forked-frontier', index: createAuthoredPropAtlasIndex(atlas) });
  assert.ok(town.length >= 18, `only ${town.length} town placements`);
  assert.ok(Array.isArray(AUTHORED_TOWN_EXCLUSIONS), 'the generator must export its town mirror');
  const mirror = new Set(AUTHORED_TOWN_EXCLUSIONS.map(([x, y]) => `${x},${y}`));
  const truth = new Set(town.map((p) => `${p.x},${p.y}`));
  assert.deepEqual([...mirror].sort(), [...truth].sort(), 'the town mirror drifted from the atlas metadata');
  const props = [
    ...buildAuthoredWorldPropPlacements({ worldId: 'forked-frontier', seed: 0x484d4807 }),
    ...buildAuthoredEncampmentPlacements({ worldId: 'forked-frontier' }).filter((p) => p.spawnPointId),
  ];
  const offenders = [];
  for (const p of props) {
    for (const t of town) {
      const distance = Math.hypot(p.x - t.x, p.y - t.y);
      if (distance < 80) offenders.push(`${p.id} is ${Math.round(distance)} from ${t.id}`);
    }
  }
  assert.deepEqual(offenders, [], `${offenders.length} props stand in a town prop's stack`);
});

// The arena camps predate the blocker-clearance rule. One placement,
// camp:hashwood-hunters:01, sits 1 unit inside hashwood-clearing-edge-west
// and is left exactly where it is so the accepted hashwood-camp baseline
// holds; this pin stops it getting worse and documents the exemption.
test('arena camps keep their documented legacy clearance', () => {
  const placements = buildAuthoredEncampmentPlacements({ worldId: 'forked-frontier' }).filter((p) => p.arenaId);
  let worst = Infinity;
  for (const p of placements) {
    for (const blocker of LEVEL_ONE_WORLD.collisionBlockers) worst = Math.min(worst, shapeClearance(blocker.shape, p.x, p.y));
  }
  assert.ok(worst >= -2, `an arena camp prop is ${Math.round(worst)} inside a blocker`);
});

// Twelve identical stamps read as a tiling error. Each spawn camp carries
// deterministic angular and radial jitter seeded from the world constant, so
// the ring rule above still holds while no two camps share a silhouette.
test('spawn camps do not read as one repeated stamp', () => {
  assert.equal(SPAWN_CAMPS.length, 12, 'the stamp check needs all twelve spawn camps');
  const placements = buildAuthoredEncampmentPlacements({ worldId: 'forked-frontier' }).filter((p) => p.spawnPointId);
  const campById = new Map(SPAWN_CAMPS.map((camp) => [camp.id, camp]));
  const signatures = new Set();
  for (const camp of SPAWN_CAMPS) {
    const ring = placements.filter((p) => p.campId === camp.id);
    assert.equal(ring.length, camp.propIds.length, `${camp.id} placed ${ring.length} of ${camp.propIds.length} props`);
    const angles = ring.map((p) => Math.round((Math.atan2(p.y - camp.y, p.x - camp.x) * 180) / Math.PI));
    const radii = ring.map((p) => Math.round(Math.hypot(p.x - camp.x, p.y - camp.y) / camp.radius * 100));
    signatures.add(`${angles.join(',')}|${radii.join(',')}`);
    for (const p of ring) {
      const distance = Math.hypot(p.x - camp.x, p.y - camp.y);
      assert.ok(distance >= camp.radius * 0.7 && distance <= camp.radius, `${p.id} left the ring`);
      assert.equal(p.spawnPointId, campById.get(p.campId).spawnPointId);
    }
  }
  assert.equal(signatures.size, SPAWN_CAMPS.length, 'two spawn camps share the exact same silhouette');
});
