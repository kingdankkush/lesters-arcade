import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createGreyboxWorld } from '../apps/hmh-reboot/src/dev/greybox-world-v1.mjs';
import { validateAreaArtPlan, assertDecorativeTint, pointInPolygon, distanceToPolyline, distanceToSegment, resolveKitItem, AREA_ART_SHARED_KIT_PAGES } from '../apps/hmh-reboot/src/world-v2-area-art-schema.mjs';
import { createRugpullWoodsArtPlan, RUGPULL_WOODS_PAGES } from '../apps/hmh-reboot/src/world-v2-area-plans/rugpull-woods.mjs';
import { createMwebMeadowsArtPlan, MWEB_MEADOWS_PAGES } from '../apps/hmh-reboot/src/world-v2-area-plans/mweb-meadows.mjs';
import { createWorldRoadsArtPlan, ROAD_CLEARANCE_FRACTION } from '../apps/hmh-reboot/src/world-v2-area-plans/world-roads.mjs';
// Lane B area plans (briefs 06-09).
import { createHashwoodRiverArtPlan, HASHWOOD_RIVER_PAGES, RIVER_STONE_TINT } from '../apps/hmh-reboot/src/world-v2-area-plans/hashwood-river.mjs';
import { createHalvingFarmsArtPlan, HALVING_FARMS_PAGES } from '../apps/hmh-reboot/src/world-v2-area-plans/halving-farms.mjs';
import { createLitecoinCityArtPlan, LITECOIN_CITY_PAGES } from '../apps/hmh-reboot/src/world-v2-area-plans/litecoin-city.mjs';
import { CITY_BRAND_SLOTS, CITY_BRANDS, CITY_SIGN_PREFIX, CITY_SIGN_STYLE, signForProp, signForPiece } from '../apps/hmh-reboot/src/world-v2-area-plans/city-branding.mjs';

const kit = JSON.parse(fs.readFileSync(new URL('../apps/portal/assets/generated/hmh-reboot-tripo-props-hd/hmh-tripo-props-hd.json', import.meta.url), 'utf8'));
const world = createGreyboxWorld(), worldBefore = JSON.stringify(world);
const solids = world.pieces.filter(p => p.blocker);
const inSolid = (x, y) => solids.find(p => pointInPolygon(x, y, p.blocker.shape.vertices)) ?? null;
const areaPieceIds = areaId => world.pieces.filter(p => p.visible.areaId === areaId && p.blocker).map(p => p.id);
const routeSegments = areaId => world.areas.find(a => a.id === areaId).inspectionRoutes.flatMap(route => route.points.slice(1).map((b, i) => ({ a: route.points[i], b })));
const sites = areaId => world.sites.filter(s => s.areaId === areaId && ['objective', 'arena-exit', 'secret', 'height-option', 'area'].includes(s.kind));

// Shared lane-A clearance proof: every ground-standing prop is inside the area,
// outside blockers and water, off inspection routes, roads, sites and spawn;
// every lifted prop roots on a blocker of exactly its groundZ.
function assertAreaPlacements(areaId, summary, { routeClearance = 64, siteClearance = 140 } = {}) {
  const area = world.areas.find(a => a.id === areaId), segments = routeSegments(areaId), water = world.pieces.filter(p => p.kind === 'water');
  const guarded = world.sites.filter(s => s.areaId === areaId && ['objective', 'arena-exit', 'entrance', 'secret', 'height-option', 'area'].includes(s.kind));
  const inside = (x, y) => x >= area.bounds.minX && x <= area.bounds.maxX && y >= area.bounds.minY && y <= area.bounds.maxY;
  for (const prop of summary.props) {
    const support = inSolid(prop.x, prop.y);
    if (prop.groundZ > 0) { assert.ok(support && support.visible.height === prop.groundZ, `${prop.id} roots on a support of matching height`); continue; }
    assert.ok(inside(prop.x, prop.y), `${prop.id} inside ${areaId}`);
    assert.equal(support, null, `${prop.id} outside blockers`);
    for (const w of water) assert.ok(!pointInPolygon(prop.x, prop.y, w.visible.vertices), `${prop.id} out of the water`);
    for (const { a, b } of segments) assert.ok(distanceToSegment(prop.x, prop.y, a, b) >= routeClearance, `${prop.id} clears inspection routes`);
    for (const road of world.roads) assert.ok(distanceToPolyline(prop.x, prop.y, road.points) >= road.width / 2, `${prop.id} clears ${road.id}`);
    for (const site of guarded) assert.ok(Math.hypot(site.x - prop.x, site.y - prop.y) >= siteClearance, `${prop.id} clears ${site.id}`);
    assert.ok(Math.hypot(prop.x - world.spawn.x, prop.y - world.spawn.y) >= world.protectedSpawnRadius, `${prop.id} clears spawn`);
  }
  for (const zone of summary.zones) for (const v of zone.vertices) assert.ok(inside(v.x, v.y), `${zone.id} inside ${areaId}`);
  assert.ok(summary.terrain, `${areaId} carries the district terrain`);
  assert.ok(summary.budget.exclusiveKitPages <= 2 && summary.budget.kitPages <= 3, `${areaId} page budget`);
  assert.ok(summary.tiles.length <= 5 && summary.budget.tileDecodedBytes <= 8 * 1024 * 1024, `${areaId} ground pages ${summary.tiles.join(',')}`);
}

test('every authored plan validates against the HD kit, is deterministic and leaves the world untouched', () => {
  for (const [make, expected] of [[createRugpullWoodsArtPlan, 'rugpull-woods'], [createMwebMeadowsArtPlan, 'mweb-meadows'], [createWorldRoadsArtPlan, 'world-roads'], [createHashwoodRiverArtPlan, 'hashwood-river'], [createHalvingFarmsArtPlan, 'halving-farms'], [createLitecoinCityArtPlan, 'litecoin-city']]) {
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
  assert.equal(createHalvingFarmsArtPlan({ ...world, areas: [] }), null);
  assert.equal(createLitecoinCityArtPlan({ ...world, areas: [] }), null);
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

test('Litecoin City follows brief 02: asphalt streets, a stone exchange plaza, a skyline cluster on the north roof, kerb furniture and wrecks, and nineteen name-only brand sign slots', () => {
  const plan = createLitecoinCityArtPlan(world), summary = validateAreaArtPlan(plan, kit), city = world.areas.find(a => a.id === 'litecoin-city');
  assert.deepEqual(plan.pages, LITECOIN_CITY_PAGES);
  assertAreaPlacements('litecoin-city', summary);
  assert.deepEqual(summary.zones.filter(z => z.material === 'asphalt').map(z => z.id), ['high-street', 'river-street']);
  assert.ok(summary.zones.some(z => z.id === 'exchange-plaza' && z.material === 'masonry') && summary.zones.some(z => z.id === 'service-lane' && z.material === 'gravel'));
  const byPiece = Object.fromEntries(summary.solids.map(s => [s.pieceId.slice('litecoin-city-'.length), s]));
  assert.equal(byPiece['market-block'].card.source, 'b1-51');
  for (const name of ['north-commercial-block', 'exchange', 'river-housing']) { assert.equal(byPiece[name].style, 'mass'); assert.equal(byPiece[name].wall, 'masonry'); assert.equal(byPiece[name].roof, 'slate'); }
  assert.equal(byPiece['plaza-wall'].card.source, 'b2-49'); assert.equal(byPiece['river-service-shed'].card.source, 'b2-68');
  assert.equal(byPiece['gantry-deck'], undefined, 'the gantry deck keeps its greybox paint');
  // Skyline: the tallest cards in the plan stand on the north commercial roof.
  const north = world.pieces.find(p => p.id === 'litecoin-city-north-commercial-block');
  const roofTowers = summary.props.filter(p => p.groundZ === north.visible.height && pointInPolygon(p.x, p.y, north.blocker.shape.vertices));
  assert.ok(roofTowers.length >= 8 && roofTowers.every(p => ['b1-12', 'b1-52', 'b1-56'].includes(p.source)), `${roofTowers.length} roof towers`);
  const top = p => p.groundZ + p.height, tallest = Math.max(...summary.props.map(top));
  assert.ok(roofTowers.some(p => top(p) === tallest) && tallest >= 950, `skyline peaks at ${tallest}`);
  const edge = summary.props.filter(p => p.groundZ > 0 && !inSolid(p.x, p.y).visible.areaId);
  assert.ok(edge.length >= 20 && edge.every(p => p.y <= city.bounds.maxY), `${edge.length} edge buildings, none on the south band where they would rise over the exchange`);
  // Street furniture.
  for (const source of ['b2-52', 'b2-51', 'b2-53', 'b2-49', 'b1-19', 'b1-20', 'b1-13', 'b2-54', 'b2-56', 'b2-58']) assert.ok(summary.props.some(p => p.source === source), source);
  assert.ok(summary.props.filter(p => p.height < 150 && p.groundZ === 0).length >= 50, 'kerb density');
  const objective = world.sites.find(s => s.id === 'litecoin-city-objective'), plaza = world.encounterArenas?.find?.(a => a.id === 'litecoin-city-court') ?? { center: { x: city.center.x + 1000, y: city.center.y + 1000 } };
  assert.ok(summary.props.filter(p => p.groundZ === 0 && Math.hypot(p.x - plaza.center.x, p.y - plaza.center.y) < 350).length === 0, 'the Liquidator plaza centre stays open');
  assert.ok(summary.trails.some(t => t.material === 'paving' && t.width === 120 && t.points.some(p => p.x === objective.x && p.y === objective.y)), 'a strong approach axis to the bell');
  // Branding: the slot file names every brand once, names only, and every carrier exists.
  assert.deepEqual([...CITY_BRANDS].sort(), ['Arkada', 'Canary Capital', 'Dappit', 'Drunken Cats', 'Grayscale', 'Lester Labs', "Lester's Arcade", 'Lit Clinic', 'LitVM', 'LitVMSwap', 'LiteForge', 'Lite Strategy', 'Litecoin', 'Litescribe', 'Luxxfolio', 'MidasPredict', 'OmniHub', 'OnChainGM', 'WheelX'].sort());
  assert.equal(CITY_SIGN_STYLE.logos, false);
  assertDecorativeTint(CITY_SIGN_STYLE.panel, 'sign panel'); assertDecorativeTint(CITY_SIGN_STYLE.text, 'sign text');
  for (const slot of CITY_BRAND_SLOTS) {
    if (slot.pieceId) { assert.ok(summary.solids.some(s => s.pieceId === slot.pieceId), slot.slot); assert.equal(signForPiece(slot.pieceId).text, slot.brand); continue; }
    const carrier = summary.props.find(p => p.id === `${CITY_SIGN_PREFIX}${slot.slot}`);
    assert.ok(carrier && carrier.source === slot.source, `${slot.slot} carrier stands`);
    assert.equal(signForProp(carrier.id).text, slot.brand);
  }
  assert.equal(signForProp('litecoin-city-art-0'), null);
  assert.ok(!summary.sources.some(source => resolveKitItem(kit, source).class === 'plants'), 'City loads no foliage page');
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
