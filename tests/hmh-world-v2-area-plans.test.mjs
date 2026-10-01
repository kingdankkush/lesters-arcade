import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createGreyboxWorld } from '../apps/hmh-reboot/src/dev/greybox-world-v1.mjs';
import { validateAreaArtPlan, pointInPolygon, distanceToPolyline, distanceToSegment, resolveKitItem, AREA_ART_SHARED_KIT_PAGES } from '../apps/hmh-reboot/src/world-v2-area-art-schema.mjs';
import { createRugpullWoodsArtPlan, RUGPULL_WOODS_PAGES } from '../apps/hmh-reboot/src/world-v2-area-plans/rugpull-woods.mjs';
import { createMwebMeadowsArtPlan, MWEB_MEADOWS_PAGES } from '../apps/hmh-reboot/src/world-v2-area-plans/mweb-meadows.mjs';
import { createWorldRoadsArtPlan, ROAD_CLEARANCE_FRACTION } from '../apps/hmh-reboot/src/world-v2-area-plans/world-roads.mjs';
import { createHalvingFarmsArtPlan, HALVING_FARMS_PAGES } from '../apps/hmh-reboot/src/world-v2-area-plans/halving-farms.mjs';

const kit = JSON.parse(fs.readFileSync(new URL('../apps/portal/assets/generated/hmh-reboot-tripo-props-hd/hmh-tripo-props-hd.json', import.meta.url), 'utf8'));
const world = createGreyboxWorld(), worldBefore = JSON.stringify(world);
const solids = world.pieces.filter(p => p.blocker);
const inSolid = (x, y) => solids.find(p => pointInPolygon(x, y, p.blocker.shape.vertices)) ?? null;
const areaPieceIds = areaId => world.pieces.filter(p => p.visible.areaId === areaId && p.blocker).map(p => p.id);
const routeSegments = areaId => world.areas.find(a => a.id === areaId).inspectionRoutes.flatMap(route => route.points.slice(1).map((b, i) => ({ a: route.points[i], b })));
const sites = areaId => world.sites.filter(s => s.areaId === areaId && ['objective', 'arena-exit', 'secret', 'height-option', 'area'].includes(s.kind));

test('every authored plan validates against the HD kit, is deterministic and leaves the world untouched', () => {
  for (const [make, expected] of [[createRugpullWoodsArtPlan, 'rugpull-woods'], [createMwebMeadowsArtPlan, 'mweb-meadows'], [createHalvingFarmsArtPlan, 'halving-farms'], [createWorldRoadsArtPlan, 'world-roads']]) {
    const plan = make(world), again = make(createGreyboxWorld());
    assert.equal(plan.areaId, expected);
    assert.ok(Object.isFrozen(plan) && Object.isFrozen(plan.props));
    assert.equal(JSON.stringify(plan), JSON.stringify(again), `${expected} plan is deterministic`);
    const summary = validateAreaArtPlan(plan, kit);
    for (const source of summary.sources) assert.equal(resolveKitItem(kit, source).runtimeApproved, false, 'kit remains a candidate');
    assert.equal(summary.budget.exclusiveKitPages <= 2, true, `${expected} exclusive pages`);
    assert.equal(summary.budget.kitPages <= 3, true, `${expected} total kit pages`);
  }
  assert.equal(JSON.stringify(world), worldBefore);
  assert.equal(createRugpullWoodsArtPlan({ ...world, areas: [] }), null);
  assert.equal(createMwebMeadowsArtPlan({ ...world, areas: [] }), null);
  assert.equal(createHalvingFarmsArtPlan({ ...world, areas: [] }), null);
});

test('Rugpull Woods roots trees on matching-height banks, keeps understory off trails and dresses every camp solid with HD cards', () => {
  const plan = createRugpullWoodsArtPlan(world), summary = validateAreaArtPlan(plan, kit), woods = world.areas.find(a => a.id === 'rugpull-woods');
  assert.deepEqual(plan.pages, RUGPULL_WOODS_PAGES);
  assert.equal(summary.budget.decodedBytes, 3 * 16777216);
  assert.equal(summary.budget.halfDecodedBytes, 3 * 4194304);
  const trees = summary.props.filter(p => p.height > 160), low = summary.props.filter(p => ['b1-01', 'b1-04', 'b1-02'].includes(p.source));
  assert.ok(trees.length > 60 && trees.length < 220, `${trees.length} trees`);
  assert.ok(low.length > 150 && low.length < 270, `${low.length} understory`);
  for (const tree of trees) { const bank = inSolid(tree.x, tree.y); assert.ok(bank && bank.visible.height === tree.groundZ, `tree ${tree.id} roots on a matching-height bank`); }
  for (const plant of low) {
    assert.equal(inSolid(plant.x, plant.y), null);
    assert.equal(plant.groundZ, 0);
    for (const { a, b } of routeSegments('rugpull-woods')) assert.ok(distanceToSegment(plant.x, plant.y, a, b) >= 58 / 2 + 60, `understory ${plant.id} clears the trail`);
    for (const site of sites('rugpull-woods')) assert.ok(Math.hypot(site.x - plant.x, site.y - plant.y) >= 140);
  }
  assert.ok(low.filter(p => Math.abs(p.x - woods.center.x) < 550 && Math.abs(p.y - woods.center.y) < 480).length >= 60, 'centre framing keeps planted pockets');
  assert.ok(summary.trails.every(t => t.width >= 42 && t.width <= 58) && summary.trails.length === 30);
  const decorated = new Set(summary.solids.map(s => s.pieceId));
  for (const name of ['supply-tent', 'lookout-post', 'abandoned-store', 'abandoned-lean-to', 'east-palisade', 'south-windbreak', 'supply-stack']) assert.ok(decorated.has(`rugpull-woods-${name}`), name);
  const tent = summary.solids.find(s => s.pieceId === 'rugpull-woods-supply-tent');
  assert.equal(tent.card.source, 'b1-13');
  assert.equal(resolveKitItem(kit, 'b1-13').frameSize, 768, 'the camp card is the 768 px HD render, not the 256 px one');
  for (const id of areaPieceIds('rugpull-woods')) if (world.pieces.find(p => p.id === id).kind === 'cliff') assert.equal(summary.solids.find(s => s.pieceId === id)?.style, 'bank');
  assert.ok(summary.props.filter(p => ['b1-50', 'b1-55'].includes(p.source)).length > 20, 'teal species are used and tinted by the renderer rule');
});

test('MWEB Meadows follows brief 01 with homes, hedgerows, pickets, the old oak, wildflowers and grass detail clear of every route, road and blocker', () => {
  const plan = createMwebMeadowsArtPlan(world), summary = validateAreaArtPlan(plan, kit), meadows = world.areas.find(a => a.id === 'mweb-meadows');
  assert.deepEqual(plan.pages, MWEB_MEADOWS_PAGES);
  assert.deepEqual(summary.pages.filter(p => !AREA_ART_SHARED_KIT_PAGES.includes(p)).length, 2);
  const byPiece = Object.fromEntries(summary.solids.map(s => [s.pieceId.slice('mweb-meadows-'.length), s]));
  for (const home of ['garden-home', 'north-home', 'relay-home', 'south-home']) assert.equal(byPiece[home].card.source, 'b2-62', home);
  assert.equal(byPiece['garden-wall'].style, 'hedge'); assert.equal(byPiece['garden-wall'].card.source, 'b2-75');
  assert.equal(byPiece['garden-fence'].style, 'pickets');
  assert.equal(byPiece['old-oak-placeholder'].card.source, 'b1-55');
  assert.equal(byPiece['relay-equipment'], undefined, 'the relay objective keeps its readable greybox cue');
  for (const source of ['b2-80', 'b2-79', 'b2-71', 'b1-03', 'b1-06', 'b1-08', 'b1-10', 'b2-75']) assert.ok(summary.props.some(p => p.source === source), source);
  assert.ok(summary.props.length >= 70, `${summary.props.length} props`);
  assert.ok(summary.decals.length >= 120 && summary.decals.filter(d => d.source === 'detail:grass').length >= 100, 'meadow grass detail');
  const segments = routeSegments('mweb-meadows'), roads = world.roads.filter(r => r.fromAreaId === 'mweb-meadows' || r.toAreaId === 'mweb-meadows');
  for (const prop of [...summary.props, ...summary.decals]) {
    assert.ok(prop.x >= meadows.bounds.minX && prop.x <= meadows.bounds.maxX && prop.y >= meadows.bounds.minY && prop.y <= meadows.bounds.maxY);
    assert.equal(inSolid(prop.x, prop.y), null, `${prop.id} outside blockers`);
    for (const { a, b } of segments) assert.ok(distanceToSegment(prop.x, prop.y, a, b) >= 60, `${prop.id} clears inspection routes`);
    for (const road of roads) assert.ok(distanceToPolyline(prop.x, prop.y, road.points) >= road.width / 2, `${prop.id} clears the road`);
    assert.ok(Math.hypot(prop.x - world.spawn.x, prop.y - world.spawn.y) >= world.protectedSpawnRadius, `${prop.id} clears spawn`);
    for (const site of sites('mweb-meadows')) assert.ok(Math.hypot(site.x - prop.x, site.y - prop.y) >= 150, `${prop.id} clears ${site.id}`);
  }
  for (const zone of summary.zones) for (const v of zone.vertices) assert.ok(v.x >= meadows.bounds.minX && v.x <= meadows.bounds.maxX && v.y >= meadows.bounds.minY && v.y <= meadows.bounds.maxY);
});

test('Halving Farms follows brief 03: furrowed crop fields, hedgerow and picket boundaries, barn cards, the watermill landmark, a rutted barn track and woodland rooted beyond the field edges', () => {
  const plan = createHalvingFarmsArtPlan(world), summary = validateAreaArtPlan(plan, kit), farms = world.areas.find(a => a.id === 'halving-farms');
  assert.deepEqual(plan.pages, HALVING_FARMS_PAGES);
  assert.equal(summary.budget.exclusiveKitPages, 2);
  assert.equal(summary.budget.decodedBytes, 3 * 16777216);
  const byPiece = Object.fromEntries(summary.solids.map(s => [s.pieceId.slice('halving-farms-'.length), s]));
  assert.equal(byPiece.barn.card.source, 'b2-63'); assert.equal(byPiece.barn.card.fit, 'width');
  assert.equal(byPiece['windmill-base'].card.source, 'b2-69', 'the stone watermill stands in for the windmill landmark');
  assert.equal(byPiece['windmill-base'].card.fit, 'height', 'the landmark card rises with the 400-unit base, not the 220-unit footprint');
  assert.equal(byPiece.silo.card.source, 'b2-67');
  assert.equal(byPiece['west-storage'].card.source, 'b2-68'); assert.equal(byPiece['east-storage'].card.source, 'b2-63');
  for (const name of ['north-hedge', 'east-field-edge']) { assert.equal(byPiece[name].style, 'hedge'); assert.equal(byPiece[name].card.source, 'b2-75'); }
  for (const name of ['west-field-row', 'east-field-row']) assert.equal(byPiece[name].style, 'pickets');
  assert.equal(byPiece['yard-timber'].card.source, 'b2-79'); assert.equal(byPiece['yard-wall'].style, 'stakes');
  assert.equal(byPiece['loading-deck'], undefined, 'elevated surfaces keep their greybox paint');
  // Furrows: four fields, parallel dirt lines spaced 115 apart, never touching a route.
  const furrows = summary.trails.filter(t => t.id.startsWith('furrow-'));
  assert.ok(furrows.length >= 14 && furrows.every(t => t.material === 'dirt' && t.width === 34), `${furrows.length} furrows`);
  for (const field of ['east', 'north', 'southeast', 'southwest']) assert.ok(furrows.filter(t => t.id.startsWith(`furrow-${field}-`)).length >= 2, field);
  const segments = routeSegments('halving-farms');
  for (const furrow of furrows) for (const p of furrow.points) for (const { a, b } of segments) assert.ok(distanceToSegment(p.x, p.y, a, b) >= 64, `${furrow.id} clears the routes`);
  // The barn track is a rutted dirt lane ending at the barn door; the farm road continues as gravel into the yard.
  const tracks = summary.trails.filter(t => t.id.startsWith('track-'));
  assert.ok(tracks.some(t => t.material === 'gravel' && t.width === 150));
  const objective = world.sites.find(s => s.id === 'halving-farms-objective');
  assert.ok(tracks.some(t => t.material === 'dirt' && t.width === 120 && t.points.some(p => p.x === objective.x && p.y === objective.y)), 'the rutted track reaches the barn threshold');
  // Crops, hedgerows, fallow flowers, clutter and woodland.
  const crops = summary.props.filter(p => ['b1-09', 'b1-07', 'b1-06'].includes(p.source)), low = summary.props.filter(p => p.height < 150 && p.groundZ === 0);
  assert.ok(crops.length >= 120 && crops.length <= 220, `${crops.length} crop plants`);
  assert.ok(low.length >= 220, `${low.length} low plants and clutter`);
  assert.ok(summary.props.filter(p => p.source === 'b2-75').length >= 8, 'free hedgerow boundaries');
  for (const source of ['b2-80', 'b2-79', 'b2-71', 'b1-03', 'b2-54', 'b1-10']) assert.ok(summary.props.some(p => p.source === source), source);
  assert.ok(summary.decals.length >= 50 && summary.decals.every(d => d.source === 'detail:grass'));
  const woodland = summary.props.filter(p => p.groundZ > 0);
  assert.ok(woodland.length >= 60, `${woodland.length} edge trees`);
  for (const tree of woodland) {
    const mass = inSolid(tree.x, tree.y);
    assert.ok(mass && mass.visible.height === tree.groundZ && !mass.visible.areaId, `${tree.id} roots on a closed world mass`);
    assert.ok(tree.x < farms.bounds.minX || tree.x > farms.bounds.maxX || tree.y < farms.bounds.minY || tree.y > farms.bounds.maxY, `${tree.id} stands beyond the field edge`);
  }
  const roads = world.roads.filter(r => r.fromAreaId === 'halving-farms' || r.toAreaId === 'halving-farms');
  for (const prop of summary.props.filter(p => p.groundZ === 0)) {
    assert.ok(prop.x >= farms.bounds.minX && prop.x <= farms.bounds.maxX && prop.y >= farms.bounds.minY && prop.y <= farms.bounds.maxY, `${prop.id} inside the area`);
    assert.equal(inSolid(prop.x, prop.y), null, `${prop.id} outside blockers`);
    for (const { a, b } of segments) assert.ok(distanceToSegment(prop.x, prop.y, a, b) >= 64, `${prop.id} clears inspection routes`);
    for (const road of roads) assert.ok(distanceToPolyline(prop.x, prop.y, road.points) >= road.width / 2, `${prop.id} clears the road`);
    for (const site of sites('halving-farms')) assert.ok(Math.hypot(site.x - prop.x, site.y - prop.y) >= 140, `${prop.id} clears ${site.id}`);
  }
  for (const decal of summary.decals) { assert.equal(inSolid(decal.x, decal.y), null); for (const { a, b } of segments) assert.ok(distanceToSegment(decal.x, decal.y, a, b) >= 64); }
  for (const zone of summary.zones) for (const v of zone.vertices) assert.ok(v.x >= farms.bounds.minX && v.x <= farms.bounds.maxX && v.y >= farms.bounds.minY && v.y <= farms.bounds.maxY, zone.id);
  assert.ok(summary.zones.filter(z => z.id.startsWith('field-')).length === 4 && summary.zones.some(z => z.id === 'working-yard' && z.material === 'earth'));
});

test('the world roads plan ribbons all fourteen authored roads by kind and keeps road-side props on the shoulders', () => {
  const plan = createWorldRoadsArtPlan(world), summary = validateAreaArtPlan(plan, kit);
  assert.equal(summary.roads.length, 14);
  assert.deepEqual(summary.pages, ['tripo-props-hd-props-00.webp']);
  const surfaceIds = new Set(world.surfaces.map(s => s.id));
  for (const road of summary.roads) {
    const authored = world.roads.find(r => r.id === road.roadId);
    assert.ok(authored);
    assert.equal(road.kind, { paved: 'paved', gravel: 'gravel', path: 'dirt' }[authored.kind]);
    assert.deepEqual(road.points, authored.points);
    assert.equal(road.width, authored.width);
    assert.ok(road.surfaceIds.length === authored.points.length - 1 + Math.max(0, authored.points.length - 2));
    for (const id of road.surfaceIds) assert.ok(surfaceIds.has(id), id);
    if (road.kind === 'paved') assert.ok(road.cracks.length >= 3, `${road.id} cracked asphalt`); else assert.equal(road.cracks.length, 0);
    for (const crack of road.cracks) assert.ok(distanceToPolyline(crack.x, crack.y, road.points) < road.width / 2 * 0.5);
  }
  assert.ok(summary.props.length >= 40, `${summary.props.length} road props`);
  for (const source of ['b2-48', 'b2-49', 'b2-51', 'b2-52', 'b2-54', 'b2-55', 'b2-58', 'b2-61']) assert.ok(summary.props.some(p => p.source === source), source);
  const paved = world.roads.filter(r => r.kind === 'paved');
  for (const prop of summary.props) {
    const road = world.roads.reduce((best, r) => { const d = distanceToPolyline(prop.x, prop.y, r.points); return !best || d < best.d ? { r, d } : best; }, null);
    assert.ok(road.d <= road.r.width / 2, `${prop.id} stands on the road surface`);
    assert.ok(road.d >= road.r.width / 2 * ROAD_CLEARANCE_FRACTION, `${prop.id} stays outside the travel clearance`);
    for (const other of world.roads) if (other !== road.r) assert.ok(distanceToPolyline(prop.x, prop.y, other.points) >= other.width / 2 * ROAD_CLEARANCE_FRACTION);
    assert.equal(inSolid(prop.x, prop.y), null, `${prop.id} outside blockers`);
    assert.ok(Math.hypot(prop.x - world.spawn.x, prop.y - world.spawn.y) >= world.protectedSpawnRadius);
    if (['b2-48', 'b2-51', 'b2-52'].includes(prop.source)) assert.ok(paved.some(r => r.id === road.r.id), `${prop.source} only on the paved spine`);
  }
  const guardrails = summary.props.filter(p => p.source === 'b2-48');
  assert.ok(guardrails.length >= 30 && guardrails.every(p => p.height === 40 && p.shadow === false));
});

test('page budgets stay within two exclusive kit pages plus the shared road page and the ground tiles', () => {
  const rows = [createRugpullWoodsArtPlan, createMwebMeadowsArtPlan, createHalvingFarmsArtPlan, createWorldRoadsArtPlan].map(make => validateAreaArtPlan(make(world), kit));
  for (const summary of rows) {
    assert.ok(summary.budget.exclusiveKitPages <= 2, summary.areaId);
    assert.ok(summary.budget.kitPages <= 3, summary.areaId);
    assert.ok(summary.budget.decodedBytes <= 3 * 16777216, summary.areaId);
    assert.ok(summary.budget.halfDecodedBytes <= 3 * 4194304, summary.areaId);
    assert.ok(summary.tiles.length <= 4, `${summary.areaId} tiles ${summary.tiles.join(',')}`);
  }
  const resident = new Set(rows.flatMap(s => s.pages));
  assert.ok(resident.size <= 4, 'Meadows + Woods + Farms + roads together never exceed four distinct kit pages');
});
