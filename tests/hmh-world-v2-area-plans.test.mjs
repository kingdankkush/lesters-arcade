import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createGreyboxWorld } from '../apps/hmh-reboot/src/dev/greybox-world-v1.mjs';
import { validateAreaArtPlan, pointInPolygon, distanceToPolyline, distanceToSegment, resolveKitItem, AREA_ART_SHARED_KIT_PAGES } from '../apps/hmh-reboot/src/world-v2-area-art-schema.mjs';
import { createRugpullWoodsArtPlan, RUGPULL_WOODS_PAGES } from '../apps/hmh-reboot/src/world-v2-area-plans/rugpull-woods.mjs';
import { createMwebMeadowsArtPlan, MWEB_MEADOWS_PAGES } from '../apps/hmh-reboot/src/world-v2-area-plans/mweb-meadows.mjs';
import { createWorldRoadsArtPlan, ROAD_CLEARANCE_FRACTION } from '../apps/hmh-reboot/src/world-v2-area-plans/world-roads.mjs';
// Lane B area plans (briefs 06-09).
import { createHashwoodRiverArtPlan, HASHWOOD_RIVER_PAGES, RIVER_STONE_TINT } from '../apps/hmh-reboot/src/world-v2-area-plans/hashwood-river.mjs';

const kit = JSON.parse(fs.readFileSync(new URL('../apps/portal/assets/generated/hmh-reboot-tripo-props-hd/hmh-tripo-props-hd.json', import.meta.url), 'utf8'));
const world = createGreyboxWorld(), worldBefore = JSON.stringify(world);
const solids = world.pieces.filter(p => p.blocker);
const inSolid = (x, y) => solids.find(p => pointInPolygon(x, y, p.blocker.shape.vertices)) ?? null;
const areaPieceIds = areaId => world.pieces.filter(p => p.visible.areaId === areaId && p.blocker).map(p => p.id);
const routeSegments = areaId => world.areas.find(a => a.id === areaId).inspectionRoutes.flatMap(route => route.points.slice(1).map((b, i) => ({ a: route.points[i], b })));
const sites = areaId => world.sites.filter(s => s.areaId === areaId && ['objective', 'arena-exit', 'secret', 'height-option', 'area'].includes(s.kind));

test('every authored plan validates against the HD kit, is deterministic and leaves the world untouched', () => {
  for (const [make, expected] of [[createRugpullWoodsArtPlan, 'rugpull-woods'], [createMwebMeadowsArtPlan, 'mweb-meadows'], [createWorldRoadsArtPlan, 'world-roads'], [createHashwoodRiverArtPlan, 'hashwood-river']]) {
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
  assert.equal(createHashwoodRiverArtPlan({ ...world, areas: [] }), null);
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
  const rows = [createRugpullWoodsArtPlan, createMwebMeadowsArtPlan, createWorldRoadsArtPlan].map(make => validateAreaArtPlan(make(world), kit));
  for (const summary of rows) {
    assert.ok(summary.budget.exclusiveKitPages <= 2, summary.areaId);
    assert.ok(summary.budget.kitPages <= 3, summary.areaId);
    assert.ok(summary.budget.decodedBytes <= 3 * 16777216, summary.areaId);
    assert.ok(summary.budget.halfDecodedBytes <= 3 * 4194304, summary.areaId);
    assert.ok(summary.tiles.length <= 4, `${summary.areaId} tiles ${summary.tiles.join(',')}`);
  }
  const resident = new Set(rows.flatMap(s => s.pages));
  assert.ok(resident.size <= 4, 'Meadows + Woods + roads together never exceed four distinct kit pages');
});

test('Hashwood River follows brief 06: conifers on closed banks, iris on the damp channel edges, stone arches on both north-south crossings, a rock shelf landmark and a worn marquee clearing', () => {
  const plan = createHashwoodRiverArtPlan(world), summary = validateAreaArtPlan(plan, kit), river = world.areas.find(a => a.id === 'hashwood-river');
  assert.deepEqual(plan.pages, HASHWOOD_RIVER_PAGES);
  assert.equal(summary.budget.exclusiveKitPages, 2);
  assert.equal(summary.budget.decodedBytes, 3 * 16777216);
  assert.ok(summary.tiles.length <= 4, summary.tiles.join(','));
  assert.ok(!summary.sources.includes('b2-42') && !summary.sources.includes('b2-44'), 'structures-00 bridge cards stay out of the two-page budget');
  const water = world.pieces.filter(p => p.kind === 'water').map(p => p.visible.vertices);
  const segments = routeSegments('hashwood-river'), areaSites = sites('hashwood-river');
  // Both authored crossings run north-south, so the vertical-span stone arch stands on each deck.
  const arches = summary.props.filter(p => p.source === 'b2-41');
  assert.equal(arches.length, 2);
  for (const [name, arch] of [['city', arches[0]], ['woods', arches[1]]]) {
    const bridge = world.pieces.find(p => p.id === `hashwood-river-${name}-bridge`), b = bridge.visible.bounds;
    const ramp = world.pieces.find(p => p.id === `hashwood-river-${name}-north-ramp`);
    assert.equal(ramp.surface.axis, 'y', 'the crossing is authored north-south');
    assert.equal(arch.x, (b.minX + b.maxX) / 2); assert.equal(arch.y, b.maxY + 10); assert.equal(arch.fade, true); assert.equal(arch.shadow, false);
    assert.ok(arch.height >= 400 && arch.height <= 460);
  }
  const conifers = summary.props.filter(p => ['b2-72', 'b1-50'].includes(p.source)), iris = summary.props.filter(p => p.source === 'b1-09');
  assert.ok(conifers.length >= 120 && conifers.length <= 220, `${conifers.length} conifers`);
  assert.ok(conifers.every(p => p.source !== 'b2-72' || p.tint === 0xd6dcc0), 'conifer trio tinted toward the bible green through the plan');
  assert.ok(iris.length >= 30, `${iris.length} iris`);
  for (const plant of iris) assert.ok(water.some(vertices => vertices.some((a, i) => distanceToSegment(plant.x, plant.y, a, vertices[(i + 1) % vertices.length]) < 130)), `${plant.id} hugs the channel edge`);
  const shelf = world.pieces.find(p => p.id === 'hashwood-river-waterfall-shelf');
  const arch = summary.props.find(p => p.source === 'b2-76');
  assert.ok(arch && pointInPolygon(arch.x, arch.y, shelf.blocker.shape.vertices) && arch.groundZ === shelf.visible.height && arch.tint === RIVER_STONE_TINT, 'the rock arch crowns the waterfall shelf');
  assert.ok(summary.props.filter(p => p.source === 'b1-42').length >= 5, 'sandstone stacks');
  const byPiece = Object.fromEntries(summary.solids.map(s => [s.pieceId.slice('hashwood-river-'.length), s]));
  assert.equal(byPiece['marquee-backing'].card.source, 'b1-13'); assert.equal(byPiece['court-low-stack'].card.source, 'b2-79'); assert.equal(byPiece['capstan-house'].card.source, 'b2-67');
  assert.equal(byPiece['waterfall-shelf'].style, 'bank'); assert.equal(byPiece['waterfall-shelf'].roof, 'rock');
  for (const name of ['marquee-west-post', 'marquee-east-post', 'court-tall-screen']) assert.equal(byPiece[name].style, 'stakes', name);
  assert.ok(summary.props.some(p => p.source === 'b2-79'), 'log piles frame the clearing');
  assert.ok(summary.trails.length >= 20 && summary.zones.length >= 8);
  // Every placement outside the two documented bridge silhouettes honours the guard.
  for (const prop of summary.props) {
    if (prop.source === 'b2-41') continue;
    assert.ok(prop.x >= plan.bounds.minX && prop.x <= plan.bounds.maxX && prop.y >= plan.bounds.minY && prop.y <= plan.bounds.maxY);
    const bank = inSolid(prop.x, prop.y);
    if (prop.groundZ > 0) { assert.ok(bank && bank.visible.height === prop.groundZ, `${prop.id} roots on a matching-height bank`); continue; }
    assert.equal(bank, null, `${prop.id} outside blockers`);
    for (const vertices of water) assert.equal(pointInPolygon(prop.x, prop.y, vertices), false, `${prop.id} out of water`);
    for (const { a, b } of segments) assert.ok(distanceToSegment(prop.x, prop.y, a, b) >= 64, `${prop.id} clears inspection routes`);
    for (const road of world.roads) assert.ok(distanceToPolyline(prop.x, prop.y, road.points) >= road.width / 2, `${prop.id} clears the road`);
    for (const site of areaSites) assert.ok(Math.hypot(site.x - prop.x, site.y - prop.y) >= 140, `${prop.id} clears ${site.id}`);
    assert.ok(Math.hypot(prop.x - world.spawn.x, prop.y - world.spawn.y) >= world.protectedSpawnRadius);
  }
  const centre = summary.props.filter(p => Math.abs(p.x - river.center.x) < 700 && Math.abs(p.y - river.center.y) < 700 && p.source !== 'b2-41');
  assert.ok(centre.every(p => p.height <= 60 || Math.abs(p.y - river.center.y) > 300), 'the lower bank centre keeps its sightlines');
});
