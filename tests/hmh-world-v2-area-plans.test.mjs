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
import { createHollowPinesArtPlan, HOLLOW_PINES_PAGES, GIANT_DEAD_TREE_HEIGHT, PINES_STONE_TINT } from '../apps/hmh-reboot/src/world-v2-area-plans/hollow-pines.mjs';
import { createLedgerRidgeArtPlan, LEDGER_RIDGE_PAGES } from '../apps/hmh-reboot/src/world-v2-area-plans/ledger-ridge.mjs';
import { createForkFortressArtPlan, FORK_FORTRESS_PAGES } from '../apps/hmh-reboot/src/world-v2-area-plans/fork-fortress.mjs';
import { DISTRICT_TERRAIN } from '../apps/hmh-reboot/src/world-v2-area-art-schema.mjs';
import { CANOPY_HEIGHTS } from '../apps/hmh-reboot/src/world-v2-area-plans/plan-support.mjs';
import { createHalvingFarmsArtPlan, HALVING_FARMS_PAGES } from '../apps/hmh-reboot/src/world-v2-area-plans/halving-farms.mjs';
import { createScryptBayouArtPlan, SCRYPT_BAYOU_PAGES, BAYOU_STILT_TOWER_HEIGHT } from '../apps/hmh-reboot/src/world-v2-area-plans/scrypt-bayou.mjs';
import { createSilverCoastArtPlan, SILVER_COAST_PAGES } from '../apps/hmh-reboot/src/world-v2-area-plans/silver-coast.mjs';
import { createLitecoinCityArtPlan, LITECOIN_CITY_PAGES } from '../apps/hmh-reboot/src/world-v2-area-plans/litecoin-city.mjs';
import { CITY_BRAND_SLOTS, CITY_BRANDS, CITY_SIGN_PREFIX, CITY_SIGN_STYLE, signForProp, signForPiece } from '../apps/hmh-reboot/src/world-v2-area-plans/city-branding.mjs';

const kit = JSON.parse(fs.readFileSync(new URL('../apps/portal/assets/generated/hmh-reboot-tripo-props-hd/hmh-tripo-props-hd.json', import.meta.url), 'utf8'));
const world = createGreyboxWorld(), worldBefore = JSON.stringify(world);
// Layout solids only: a prop blocker (dev/greybox-prop-blockers.mjs) stands
// under its own plan card by design (tests/hmh-ten-area-collision-art.test.mjs
// proves every one matches its card), and an edge guard
// (dev/greybox-edge-guards.mjs) is a low collider on a water or deck edge.
const solids = world.pieces.filter(p => p.blocker && !p.visible.artPlanId && !p.visible.guardOf);
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
    assert.ok(Math.hypot(prop.x - world.spawn.x, prop.y - world.spawn.y) >= (prop.id.startsWith('mweb-meadows-centre-') ? 150 : world.protectedSpawnRadius), `${prop.id} clears spawn`);
  }
  for (const zone of summary.zones) for (const v of zone.vertices) assert.ok(inside(v.x, v.y), `${zone.id} inside ${areaId}`);
  assert.ok(summary.terrain, `${areaId} carries the district terrain`);
  assert.ok(summary.budget.exclusiveKitPages <= 2 && summary.budget.kitPages <= 3, `${areaId} page budget`);
  assert.ok(summary.tiles.length <= 5 && summary.budget.tileDecodedBytes <= 8 * 1024 * 1024, `${areaId} ground pages ${summary.tiles.join(',')}`);
}

test('every authored plan validates against the HD kit, is deterministic and leaves the world untouched', () => {
  for (const [make, expected] of [[createRugpullWoodsArtPlan, 'rugpull-woods'], [createMwebMeadowsArtPlan, 'mweb-meadows'], [createWorldRoadsArtPlan, 'world-roads'], [createHashwoodRiverArtPlan, 'hashwood-river'], [createHalvingFarmsArtPlan, 'halving-farms'], [createScryptBayouArtPlan, 'scrypt-bayou'], [createSilverCoastArtPlan, 'silver-coast'], [createLitecoinCityArtPlan, 'litecoin-city']]) {
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
  assert.equal(createScryptBayouArtPlan({ ...world, areas: [] }), null);
  assert.equal(createSilverCoastArtPlan({ ...world, areas: [] }), null);
  assert.equal(createLitecoinCityArtPlan({ ...world, areas: [] }), null);
});

test('Rugpull Woods roots trees on matching-height banks, keeps understory off trails and dresses every camp solid with HD cards', () => {
  const plan = createRugpullWoodsArtPlan(world), summary = validateAreaArtPlan(plan, kit), woods = world.areas.find(a => a.id === 'rugpull-woods');
  assert.deepEqual(plan.pages, RUGPULL_WOODS_PAGES);
  assert.equal(summary.budget.decodedBytes, 3 * 16777216);
  assert.equal(summary.budget.halfDecodedBytes, 3 * 4194304);
  const trees = summary.props.filter(p => p.height > 160), low = summary.props.filter(p => ['b1-01', 'b1-04', 'b1-02'].includes(p.source));
  assert.ok(trees.length > 60 && trees.length < 220, `${trees.length} trees`);
  const floor=summary.decals.filter(d=>d.source.startsWith('detail:forest-'));
  assert.ok(low.length+floor.length>250&&low.length+floor.length<400, `${low.length} upright + ${floor.length} low forest patches`);
  for (const tree of trees) { const bank = inSolid(tree.x, tree.y); assert.ok(bank && bank.visible.height === tree.groundZ, `tree ${tree.id} roots on a matching-height bank`); }
  for (const plant of low) {
    assert.equal(inSolid(plant.x, plant.y), null);
    assert.equal(plant.groundZ, 0);
    for (const { a, b } of routeSegments('rugpull-woods')) assert.ok(distanceToSegment(plant.x, plant.y, a, b) >= 58 / 2 + 60, `understory ${plant.id} clears the trail`);
    for (const site of sites('rugpull-woods')) assert.ok(Math.hypot(site.x - plant.x, site.y - plant.y) >= 140);
  }
  assert.ok([...low,...floor].filter(p => Math.abs(p.x - woods.center.x) < 550 && Math.abs(p.y - woods.center.y) < 480).length >= 60, 'centre framing keeps planted pockets');
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
    const arrivalGround = prop.id.startsWith('mweb-meadows-centre-arrival-');
    if(arrivalGround) assert.ok(prop.source.startsWith('detail:meadow-'),'the near-spawn exception is only for nonblocking native ground patches');
    assert.ok(prop.x >= meadows.bounds.minX && prop.x <= meadows.bounds.maxX && prop.y >= meadows.bounds.minY && prop.y <= meadows.bounds.maxY);
    assert.equal(inSolid(prop.x, prop.y), null, `${prop.id} outside blockers`);
    for (const { a, b } of segments) assert.ok(distanceToSegment(prop.x, prop.y, a, b) >= 60, `${prop.id} clears inspection routes`);
    for (const road of roads) assert.ok(distanceToPolyline(prop.x, prop.y, road.points) >= road.width / 2, `${prop.id} clears the road`);
    assert.ok(Math.hypot(prop.x - world.spawn.x, prop.y - world.spawn.y) >= (arrivalGround ? 60 : prop.id.startsWith('mweb-meadows-centre-') ? 150 : world.protectedSpawnRadius), `${prop.id} clears spawn`);
    for (const site of sites('mweb-meadows')) assert.ok(Math.hypot(site.x - prop.x, site.y - prop.y) >= (arrivalGround && site.kind==='area' ? 60 : 150), `${prop.id} clears ${site.id}`);
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
  // Hedgerow cards run east-west (each on its own collider); the north-south west margin is a walk-through shrub line.
  assert.ok(summary.props.filter(p => p.source === 'b2-75').length >= 5, 'free hedgerow boundaries');
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

test('Silver Coast follows brief 04: chalk banks with sandstone and driftwood, the rock arch landmark on the headland, cliff-foot rubble, beached jetties, beach grass and villas beyond the edges', () => {
  const plan = createSilverCoastArtPlan(world), summary = validateAreaArtPlan(plan, kit);
  assert.deepEqual(plan.pages, SILVER_COAST_PAGES);
  assertAreaPlacements('silver-coast', summary);
  const byPiece = Object.fromEntries(summary.solids.map(s => [s.pieceId.slice('silver-coast-'.length), s]));
  for (const name of ['headland-cliff', 'shore-cliff']) assert.equal(byPiece[name].style, 'bank');
  assert.equal(byPiece.lighthouse.card.source, 'b2-67'); assert.equal(byPiece.lighthouse.card.fit, 'height');
  for (const name of Object.keys(byPiece).filter(n => n.startsWith('mansion-'))) assert.equal(byPiece[name].style, 'mass');
  assert.equal(Object.keys(byPiece).filter(n => n.startsWith('mansion-')).length, 6);
  assert.equal(byPiece['terrace-wall'].card.source, 'b1-42');
  assert.equal(byPiece['overlook-deck'], undefined);
  const headland = world.pieces.find(p => p.id === 'silver-coast-headland-cliff');
  const arch = summary.props.filter(p => p.source === 'b2-76');
  assert.equal(arch.length, 1);
  assert.ok(pointInPolygon(arch[0].x, arch[0].y, headland.blocker.shape.vertices) && arch[0].groundZ === headland.visible.height && arch[0].height >= 400, 'the rock arch stands on the headland top');
  const bankProps = summary.props.filter(p => p.groundZ > 0 && inSolid(p.x, p.y).visible.areaId === 'silver-coast');
  assert.ok(bankProps.filter(p => p.source === 'b1-42').length >= 15 && bankProps.some(p => p.source === 'b1-53'), 'layered sandstone and driftwood on the banks');
  assert.ok(summary.props.filter(p => p.source === 'b2-46').length >= 2, 'jetty sections');
  assert.ok(summary.props.filter(p => ['b1-09', 'b1-10'].includes(p.source) && p.groundZ === 0).length >= 120, 'beach grass');
  assert.ok(summary.props.every(p => p.groundZ > 0 || p.height < 150 || ['b2-71', 'b1-53'].includes(p.source)), 'planting stays low on the shelf');
  const view = world.sites.find(s => s.id === 'silver-coast-landmark-view');
  assert.equal(summary.props.filter(p => p.groundZ === 0 && p.height >= 150 && Math.hypot(p.x - view.x, p.y - view.y) < 700).length, 0, 'nothing tall blocks the lighthouse view');
  const villas = summary.props.filter(p => p.source === 'b2-64');
  assert.ok(villas.length >= 4 && villas.every(p => p.groundZ > 0 && !inSolid(p.x, p.y).visible.areaId), 'villas stand on closed land beyond the edges');
  assert.ok(!summary.trails.some(t => t.material === 'shallows'), 'no water is painted on walkable ground');
});

test('Scrypt Bayou follows brief 05: reeds on both channel banks, cypress on the root banks and beyond the edges, plank walks on the crossings, a timber lock apron and the stilted guard tower landmark', () => {
  const plan = createScryptBayouArtPlan(world), summary = validateAreaArtPlan(plan, kit), bayou = world.areas.find(a => a.id === 'scrypt-bayou');
  assert.deepEqual(plan.pages, SCRYPT_BAYOU_PAGES);
  assertAreaPlacements('scrypt-bayou', summary);
  const byPiece = Object.fromEntries(summary.solids.map(s => [s.pieceId.slice('scrypt-bayou-'.length), s]));
  assert.equal(byPiece['stilt-store'].card.source, 'b1-15'); assert.equal(byPiece['stilt-store'].height, BAYOU_STILT_TOWER_HEIGHT);
  assert.equal(byPiece['wheel-tower'].card.source, 'b1-47'); assert.equal(byPiece['control-house'].card.source, 'b2-45');
  for (const name of ['northwest-root-bank', 'southwest-root-foot']) { assert.equal(byPiece[name].style, 'bank'); assert.equal(byPiece[name].roof, 'moss'); }
  assert.equal(byPiece['lock-bridge'], undefined, 'bridges keep their greybox deck');
  const channel = world.pieces.find(p => p.id === 'scrypt-bayou-channel');
  const reeds = summary.props.filter(p => p.source === 'b1-09');
  assert.ok(reeds.length >= 120, `${reeds.length} reeds`);
  const banked = reeds.filter(p => distanceToPolyline(p.x, p.y, [...channel.visible.vertices, channel.visible.vertices[0]]) < 120);
  assert.ok(banked.filter(p => p.x < bayou.center.x + 450).length >= 20 && banked.filter(p => p.x > bayou.center.x + 450).length >= 20, 'reeds line both banks');
  const cypress = summary.props.filter(p => ['b2-70', 'b2-71', 'b1-53'].includes(p.source));
  assert.ok(cypress.length >= 80 && cypress.filter(p => p.groundZ > 0).length >= 60, `${cypress.length} cypress`);
  const plank = summary.trails.filter(t => t.material === 'boardwalk');
  assert.ok(plank.length >= 8 && summary.zones.some(z => z.id === 'lock-apron' && z.material === 'boardwalk'), 'plank walks and the lock apron');
  const court = world.sites.find(s => s.id === 'scrypt-bayou-area'), arena = { x: bayou.center.x - 950, y: bayou.center.y + 650 };
  assert.equal(summary.props.filter(p => p.groundZ === 0 && Math.hypot(p.x - arena.x, p.y - arena.y) < 400).length, 0, 'the Lockkeeper court centre stays calm');
  assert.ok(court);
  assert.ok(summary.props.filter(p => p.groundZ === 0 && p.height < 150).length >= 250, 'marsh understory density');
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
  // 2.1 QA: a verge rail stands only where the corridor's closed land is right
  // behind it (that land holds a body, so the rail needs no collider).
  assert.ok(guardrails.length >= 16 && guardrails.every(p => p.height === 40 && p.shadow === false));
  for (const rail of guardrails) {
    const road = world.roads.reduce((best, r) => (distanceToPolyline(rail.x, rail.y, r.points) < distanceToPolyline(rail.x, rail.y, best.points) ? r : best));
    assert.ok([0, 1, 2, 3].some(k => { const a = k * Math.PI / 2, x = rail.x + Math.cos(a) * 24, y = rail.y + Math.sin(a) * 24; return distanceToPolyline(x, y, road.points) > distanceToPolyline(rail.x, rail.y, road.points) && !world.queryGround(x, y).walkable; }), `${rail.id} is backed by closed land`);
  }
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
  assert.ok(summary.tiles.length <= 5 && summary.budget.tileDecodedBytes <= 8 * 1024 * 1024, summary.tiles.join(',')); // terrain extras add at most one tile pair
  assert.ok(!summary.sources.includes('b2-42') && !summary.sources.includes('b2-44'), 'structures-00 bridge cards stay out of the two-page budget');
  const water = world.pieces.filter(p => p.kind === 'water').map(p => p.visible.vertices);
  const segments = routeSegments('hashwood-river'), areaSites = sites('hashwood-river');
  // Both authored crossings are drawn by the renderer from their surfaces, so no arch card stands in for them.
  assert.equal(summary.props.filter(p => p.source === 'b2-41').length, 0);
  for (const name of ['city', 'woods']) assert.equal(world.pieces.find(p => p.id === `hashwood-river-${name}-north-ramp`).surface.axis, 'y', 'the crossing is authored north-south');
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
  assert.ok(summary.trails.length >= 20 && summary.zones.length >= 4);
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

// ---- Lane B: Hollow Pines, Ledger Ridge, Fork Fortress (briefs 07-09) ----
function assertGuardedProps(areaId, summary, plan, exempt = []) {
  const water = world.pieces.filter(p => p.kind === 'water').map(p => p.visible.vertices);
  const segments = routeSegments(areaId), areaSites = sites(areaId);
  for (const prop of summary.props) {
    if (exempt.includes(prop.source)) continue;
    assert.ok(prop.x >= plan.bounds.minX && prop.x <= plan.bounds.maxX && prop.y >= plan.bounds.minY && prop.y <= plan.bounds.maxY, `${prop.id} in bounds`);
    const support = inSolid(prop.x, prop.y);
    if (prop.groundZ > 0) { assert.ok(support && support.visible.height === prop.groundZ, `${prop.id} roots on a matching-height solid`); continue; }
    assert.equal(support, null, `${prop.id} outside blockers`);
    for (const vertices of water) assert.equal(pointInPolygon(prop.x, prop.y, vertices), false, `${prop.id} out of water`);
    for (const { a, b } of segments) assert.ok(distanceToSegment(prop.x, prop.y, a, b) >= 64, `${prop.id} clears inspection routes`);
    for (const road of world.roads) assert.ok(distanceToPolyline(prop.x, prop.y, road.points) >= road.width / 2, `${prop.id} clears the road`);
    for (const site of areaSites) assert.ok(Math.hypot(site.x - prop.x, site.y - prop.y) >= 140, `${prop.id} clears ${site.id}`);
    assert.ok(Math.hypot(prop.x - world.spawn.x, prop.y - world.spawn.y) >= world.protectedSpawnRadius);
  }
}
const laneB = [[createHollowPinesArtPlan, 'hollow-pines', HOLLOW_PINES_PAGES], [createLedgerRidgeArtPlan, 'ledger-ridge', LEDGER_RIDGE_PAGES], [createForkFortressArtPlan, 'fork-fortress', FORK_FORTRESS_PAGES]];

test('lane B plans are deterministic, carry their district terrain, stay within two exclusive pages and the ground memory budget, and leave the world untouched', () => {
  const before = JSON.stringify(world);
  for (const [make, areaId, pages] of laneB) {
    const plan = make(world), summary = validateAreaArtPlan(plan, kit);
    assert.equal(plan.areaId, areaId);
    assert.ok(Object.isFrozen(plan) && Object.isFrozen(plan.props));
    assert.equal(JSON.stringify(plan), JSON.stringify(make(createGreyboxWorld())), `${areaId} deterministic`);
    assert.deepEqual(plan.pages, pages);
    assert.deepEqual(plan.ground.terrain, { ...DISTRICT_TERRAIN[areaId] });
    assert.equal(summary.budget.exclusiveKitPages, 2, areaId);
    assert.equal(summary.budget.decodedBytes, 3 * 16777216, areaId);
    assert.equal(summary.budget.halfDecodedBytes, 3 * 4194304, areaId);
    assert.ok(summary.tiles.length <= 5 && summary.budget.tileDecodedBytes <= 8 * 1024 * 1024, `${areaId} tiles ${summary.tiles.join(',')}`);
    for (const source of summary.sources) assert.notEqual(resolveKitItem(kit, source).class, 'pickups');
    assert.equal(make({ ...world, areas: [] }), null);
  }
  assert.equal(JSON.stringify(world), before);
});

test('Hollow Pines follows brief 07: a giant dead tree on its root volume, burial rows behind the public walk, a chapel crypt, dead groves and no lantern masts', () => {
  const plan = createHollowPinesArtPlan(world), summary = validateAreaArtPlan(plan, kit);
  const byPiece = Object.fromEntries(summary.solids.map(s => [s.pieceId.slice('hollow-pines-'.length), s]));
  const tree = byPiece['dead-tree-roots'];
  assert.equal(tree.card.source, 'b2-70'); assert.equal(tree.card.fit, 'height'); assert.equal(tree.height, GIANT_DEAD_TREE_HEIGHT); assert.equal(tree.massAlpha, 0);
  assert.ok(GIANT_DEAD_TREE_HEIGHT > 2 * CANOPY_HEIGHTS['b2-70'], 'the landmark tree is at least twice an ordinary dead oak');
  assert.equal(byPiece.crypt.card.source, 'b2-65'); assert.equal(byPiece['maintenance-house'].card.source, 'b2-68'); assert.equal(byPiece['stone-monument'].style, 'mass'); assert.equal(byPiece['stone-monument'].wall, 'masonry');
  assert.equal(byPiece['low-boundary'].style, 'hedge'); assert.equal(byPiece['low-boundary'].card.source, 'b2-49');
  for (const name of ['north-west-wall', 'north-east-wall', 'west-upper-wall', 'west-lower-wall', 'east-upper-wall', 'east-lower-wall', 'south-wall']) assert.equal(byPiece[name].wall, 'masonry', name);
  for (const name of ['southwest-grove', 'northeast-grove']) assert.equal(byPiece[name].style, 'bank', name);
  assert.ok(!summary.sources.includes('b2-52'), 'traffic masts are not used as cemetery lanterns');
  const headstones = summary.props.filter(p => p.source === 'b2-49' && p.tint === PINES_STONE_TINT);
  assert.ok(headstones.length >= 80, `${headstones.length} headstones`);
  const area = world.areas.find(a => a.id === 'hollow-pines');
  for (const stone of headstones) {
    assert.ok(stone.height <= 30, 'headstones are low slabs');
    assert.ok(Math.abs(stone.x - area.center.x) <= 760 && Math.abs(stone.y - area.center.y) <= 700, `${stone.id} inside the cemetery walls`);
    assert.ok(Math.abs(stone.y - area.center.y) >= 400 || Math.abs(stone.x - area.center.x) >= 700, `${stone.id} keeps the clearing open`);
  }
  assert.ok(summary.props.filter(p => p.source === 'b2-80').length >= 4, 'tombs');
  const dead = summary.props.filter(p => ['b2-70', 'b1-53'].includes(p.source)), burnt = summary.props.filter(p => p.source === 'b1-05');
  assert.ok(dead.length >= 60, `${dead.length} dead trees`); assert.ok(burnt.length >= 50, `${burnt.length} burnt shrubs`);
  assert.ok(!summary.sources.includes('b1-42'), 'no warm sandstone rubble in the blue-grey cemetery');
  for (const source of ['b2-72', 'b2-73', 'b2-74']) assert.ok(summary.props.some(p => p.source === source), source);
  assert.ok(summary.props.length >= 300 && summary.props.length <= 600, `${summary.props.length} props`);
  assertGuardedProps('hollow-pines', summary, plan);
});

test('Ledger Ridge follows brief 08: banked rock cuts with strata and sparse pines, the headframe card, mine entrance and rail spur, and heavy plant at the landing edges', () => {
  const plan = createLedgerRidgeArtPlan(world), summary = validateAreaArtPlan(plan, kit), area = world.areas.find(a => a.id === 'ledger-ridge');
  const byPiece = Object.fromEntries(summary.solids.map(s => [s.pieceId.slice('ledger-ridge-'.length), s]));
  for (const name of ['west-buttress', 'lower-cut', 'upper-cut', 'north-cap', 'east-buttress']) { assert.equal(byPiece[name].style, 'bank', name); assert.equal(byPiece[name].roof, 'rock'); }
  assert.equal(byPiece.headframe.card.source, 'b1-11'); assert.equal(byPiece['quarry-store'].card.source, 'b2-68');
  assert.equal(byPiece['landing-barrier'].card.source, 'b2-49'); assert.equal(byPiece['landing-wall'].card.source, 'b1-42');
  const count = source => summary.props.filter(p => p.source === source).length;
  assert.equal(count('b2-76'), 1); assert.ok(count('b2-77') >= 1); assert.ok(count('b2-78') >= 8); assert.ok(count('b1-16') >= 3);
  assert.ok(count('b2-59') >= 1 && count('b2-60') >= 2, 'excavator and haul trucks');
  assert.ok(count('b1-42') >= 80 && count('b2-79') >= 5 && count('b1-49') >= 5, 'strata, timber and stump spoil');
  assert.ok(summary.props.filter(p => p.source === 'b1-42' && p.groundZ === 0).every(p => p.height >= 90), 'sandstone only at full strata height (small cards read as barrels)');
  const pines = summary.props.filter(p => ['b2-72', 'b1-50'].includes(p.source));
  assert.ok(pines.length >= 40 && pines.length <= 120, `${pines.length} sparse pines`);
  assert.ok(pines.every(p => p.groundZ > 0), 'pines only on stable shelves');
  const arena = world.arenas.find(a => a.areaId === 'ledger-ridge');
  for (const plant of summary.props.filter(p => ['b2-59', 'b2-60'].includes(p.source))) assert.ok(Math.hypot(plant.x - arena.center.x, plant.y - arena.center.y) >= 450, `${plant.id} parks at the landing edge`);
  assert.ok(summary.props.length >= 200, `${summary.props.length} props`);
  assertGuardedProps('ledger-ridge', summary, plan);
  assert.ok(area);
});

test('Fork Fortress follows brief 09: guard towers on the gatehouses, container ramparts, a masonry keep with a sealed bunker door, courtyard buildings on collision and Foreman machinery at the court edge', () => {
  const plan = createForkFortressArtPlan(world), summary = validateAreaArtPlan(plan, kit);
  const byPiece = Object.fromEntries(summary.solids.map(s => [s.pieceId.slice('fork-fortress-'.length), s]));
  for (const name of ['north-gatehouse', 'south-gatehouse']) assert.equal(byPiece[name].card.source, 'b1-15', name);
  for (const name of ['west-curtain', 'east-curtain']) { assert.equal(byPiece[name].style, 'hedge'); assert.equal(byPiece[name].card.source, 'b1-43'); }
  assert.equal(byPiece.keep.style, 'mass'); assert.equal(byPiece.keep.wall, 'masonry');
  assert.equal(byPiece['service-store'].card.source, 'b2-63'); assert.equal(byPiece['yard-tall-wall'].card.source, 'b1-46'); assert.equal(byPiece['yard-low-barrier'].card.source, 'b2-49');
  assert.equal(byPiece['ridge-foot'].style, 'bank');
  const keep = world.pieces.find(p => p.id === 'fork-fortress-keep');
  const door = summary.props.find(p => p.source === 'b2-66');
  assert.ok(door && door.y > keep.visible.bounds.maxY && door.y - keep.visible.bounds.maxY <= 12 && inSolid(door.x, door.y) === null, 'the bunker door stands against the keep south face');
  for (const building of summary.props.filter(p => ['b2-68', 'b2-63'].includes(p.source))) { const support = inSolid(building.x, building.y); assert.ok(support && support.visible.height === building.groundZ, `${building.id} stands on closed high ground`); }
  const count = source => summary.props.filter(p => p.source === source).length;
  assert.ok(count('b1-17') >= 4 && count('b1-18') >= 6 && count('b2-49') >= 15 && count('b1-43') >= 6, 'rampart fill');
  const machinery = summary.props.filter(p => ['b1-41', 'b1-19'].includes(p.source)), arena = world.arenas.find(a => a.areaId === 'fork-fortress');
  assert.ok(machinery.length >= 15, `${machinery.length} machinery`);
  for (const unit of machinery) assert.ok(Math.hypot(unit.x - arena.center.x, unit.y - arena.center.y) >= 600, `${unit.id} stays at the court perimeter`);
  assert.ok(!summary.sources.some(source => resolveKitItem(kit, source).class === 'plants'), 'no vegetation page inside the compound');
  assert.ok(summary.props.length >= 150, `${summary.props.length} props`);
  assertGuardedProps('fork-fortress', summary, plan, ['b2-66']);
});
