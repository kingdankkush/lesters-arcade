import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateAreaArtPlan, createAreaArtPlanShell, assertDecorativeTint, ribbonPolygon, offsetPolygon, pointInPolygon, createPlacementGuard, stableUnit, AREA_ART_SCHEMA, AREA_ART_MATERIALS, AREA_ART_SHARED_KIT_PAGES, WORLD_ROADS_PLAN_ID } from '../apps/hmh-reboot/src/world-v2-area-art-schema.mjs';
import { createGreyboxWorld } from '../apps/hmh-reboot/src/dev/greybox-world-v1.mjs';

const kit = JSON.parse(fs.readFileSync(new URL('../apps/portal/assets/generated/hmh-reboot-tripo-props-hd/hmh-tripo-props-hd.json', import.meta.url), 'utf8'));
const bounds = { minX: 0, minY: 0, maxX: 4000, maxY: 4000 };
const shell = (pages = ['tripo-props-hd-plants-00.webp']) => createAreaArtPlanShell({ areaId: 'test-area', bounds, pages });
const withProp = (plan, prop) => { plan.props.push({ id: 'p0', source: 'b1-04', x: 100, y: 100, height: 40, ...prop }); return plan; };

test('a minimal valid plan validates to a frozen summary with page and byte budgets', () => {
  const plan = withProp(shell(), {});
  plan.ground.base = { surfaceId: 'test-area-floor', material: 'grass' };
  const summary = validateAreaArtPlan(plan, kit);
  assert.ok(Object.isFrozen(summary));
  assert.equal(summary.schema, AREA_ART_SCHEMA);
  assert.deepEqual(summary.pages, ['tripo-props-hd-plants-00.webp']);
  assert.deepEqual(summary.sources, ['b1-04']);
  assert.deepEqual(summary.tiles, ['forest-floor']);
  assert.equal(summary.budget.decodedBytes, 16777216);
  assert.equal(summary.budget.halfDecodedBytes, 4194304);
  assert.equal(summary.budget.encodedBytes, kit.pages.find(p => p.image === 'tripo-props-hd-plants-00.webp').encodedBytes);
  assert.equal(summary.props[0].fade, false);
  assert.equal(summary.props[0].shadow, true);
});

test('authority, schema, page and source errors are rejected with named reasons', () => {
  assert.throws(() => validateAreaArtPlan({ ...withProp(shell(), {}), schema: 'other' }, kit), /schema must be/);
  assert.throws(() => validateAreaArtPlan({ ...withProp(shell(), {}), artAccepted: true }, kit), /artAccepted false/);
  assert.throws(() => validateAreaArtPlan({ ...withProp(shell(), {}), runtimeAuthority: 'gameplay' }, kit), /projection-only/);
  assert.throws(() => validateAreaArtPlan(withProp(shell(['nope.webp']), {}), kit), /unknown kit page/);
  assert.throws(() => validateAreaArtPlan(shell(), kit), /unused kit page/);
  assert.throws(() => validateAreaArtPlan(withProp(shell(), { source: 'b1-99' }), kit), /does not exist/);
  assert.throws(() => validateAreaArtPlan(withProp(shell(), { source: 'b2-62' }), kit), /does not load/);
  assert.throws(() => validateAreaArtPlan(withProp(shell(['tripo-props-hd-pickups-00.webp']), { source: 'b1-21' }), kit), /pickup card/);
  assert.throws(() => validateAreaArtPlan(withProp(shell(), { x: 9000 }), kit), /outside plan bounds/);
  assert.throws(() => validateAreaArtPlan(withProp(shell(), { height: 0 }), kit), /must be positive/);
  assert.throws(() => validateAreaArtPlan(withProp(shell(), {}), { ...kit, artAccepted: true }), /unaccepted/);
});

test('the exclusive kit page budget is two, the shared props page rides free, and the roads plan may only load it', () => {
  const three = withProp(shell(['tripo-props-hd-plants-00.webp', 'tripo-props-hd-structures-00.webp', 'tripo-props-hd-structures-01.webp']), {});
  three.props.push({ id: 'p1', source: 'b2-62', x: 1, y: 1, height: 300 }, { id: 'p2', source: 'b1-48', x: 1, y: 1, height: 300 });
  assert.throws(() => validateAreaArtPlan(three, kit), /budget is 2/);
  const shared = withProp(shell(['tripo-props-hd-plants-00.webp', 'tripo-props-hd-structures-00.webp', ...AREA_ART_SHARED_KIT_PAGES]), {});
  shared.props.push({ id: 'p1', source: 'b2-62', x: 1, y: 1, height: 300 }, { id: 'p2', source: 'b2-80', x: 1, y: 1, height: 90 });
  const summary = validateAreaArtPlan(shared, kit);
  assert.equal(summary.budget.exclusiveKitPages, 2);
  assert.equal(summary.budget.kitPages, 3);
  const roads = createAreaArtPlanShell({ areaId: WORLD_ROADS_PLAN_ID, bounds, pages: ['tripo-props-hd-plants-00.webp'] });
  roads.props.push({ id: 'p0', source: 'b1-04', x: 1, y: 1, height: 30 });
  assert.throws(() => validateAreaArtPlan(roads, kit), /shared props page/);
  const areaRoads = shell(); areaRoads.roads.push({ id: 'r', roadId: 'x', kind: 'paved', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], width: 100 });
  assert.throws(() => validateAreaArtPlan(withProp(areaRoads, {}), kit), /only the world roads plan/);
});

test('decorative tints may not borrow the reserved cue colours', () => {
  assert.equal(assertDecorativeTint(0xd8d5c6, 'pale'), 0xd8d5c6);
  assert.equal(assertDecorativeTint(0x65735a, 'foliage'), 0x65735a);
  assert.throws(() => assertDecorativeTint(0xff2a10, 'red'), /red\/orange/);
  assert.throws(() => assertDecorativeTint(0xff8c1a, 'orange'), /red\/orange/);
  assert.throws(() => assertDecorativeTint(0xf4c430, 'gold'), /gold|red/);
  assert.throws(() => assertDecorativeTint(0x22e0ff, 'cyan'), /cyan/);
  const plan = withProp(shell(), { tint: 0xff3010 });
  assert.throws(() => validateAreaArtPlan(plan, kit), /reserved cue colour/);
  for (const material of Object.values(AREA_ART_MATERIALS)) { assertDecorativeTint(material.base, 'base'); assertDecorativeTint(material.tint, 'tint'); }
});

test('ground zones, trails, decals and solids validate their materials, sources and styles', () => {
  const plan = withProp(shell(['tripo-props-hd-plants-00.webp']), {});
  plan.ground.zones.push({ id: 'z', material: 'earth', vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }], feather: 40 });
  plan.ground.trails.push({ id: 't', material: 'dirt', points: [{ x: 0, y: 0 }, { x: 300, y: 300 }], width: 50 });
  plan.ground.decals.push({ id: 'd', source: 'detail:grass', x: 10, y: 10 });
  plan.solids.push({ pieceId: 'test-area-home', style: 'card', source: 'b2-75', fit: 'width' }, { pieceId: 'test-area-fence', style: 'pickets' });
  const summary = validateAreaArtPlan(plan, kit);
  assert.deepEqual(summary.materials, ['dirt', 'earth']);
  assert.equal(summary.detailPage, true);
  assert.equal(summary.solids[0].massAlpha, 0.32);
  assert.equal(summary.solids[1].massAlpha, 0);
  assert.equal(summary.budget.tilePages, 3);
  assert.throws(() => validateAreaArtPlan({ ...plan, ground: { ...plan.ground, zones: [{ id: 'z', material: 'lava', vertices: plan.ground.zones[0].vertices }] } }, kit), /known material/);
  assert.throws(() => validateAreaArtPlan({ ...plan, ground: { ...plan.ground, trails: [{ id: 't', material: 'dirt', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], width: 400 }] } }, kit), /worn trail/);
  assert.throws(() => validateAreaArtPlan({ ...plan, ground: { ...plan.ground, decals: [{ id: 'd', source: 'b1-04', x: 1, y: 1 }] } }, kit), /ground detail frame/);
  assert.throws(() => validateAreaArtPlan({ ...plan, solids: [{ pieceId: 'x', style: 'neon' }] }, kit), /style must be/);
  assert.throws(() => validateAreaArtPlan({ ...plan, solids: [{ pieceId: 'x', style: 'card', source: 'b1-21' }] }, kit), /does not load|pickup/);
});

test('ribbon and offset polygons are single non-overlapping outlines and the hash is stable', () => {
  const ribbon = ribbonPolygon([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }], 20);
  assert.equal(ribbon.length, 6);
  assert.ok(pointInPolygon(50, 0, ribbon) && pointInPolygon(100, 50, ribbon) && !pointInPolygon(50, 50, ribbon));
  assert.ok(pointInPolygon(0, 9, ribbon) && !pointInPolygon(0, 11, ribbon), 'square ends at half width');
  const grown = offsetPolygon([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }], 10);
  assert.ok(grown.every(p => Math.abs(p.x - 50) > 59.9 && Math.abs(p.y - 50) > 59.9));
  const shrunk = offsetPolygon([{ x: 0, y: 0 }, { x: 0, y: 100 }, { x: 100, y: 100 }, { x: 100, y: 0 }], 10);
  assert.ok(shrunk.every(p => Math.abs(p.x - 50) > 59.9), 'orientation-independent');
  assert.equal(stableUnit('a', 1), stableUnit('a', 1));
  assert.notEqual(stableUnit('a', 1), stableUnit('a', 2));
  assert.ok(stableUnit('x') >= 0 && stableUnit('x') < 1);
});

test('the placement guard refuses blockers, water, road corridors, routes, sites and spawn clearance', () => {
  const world = createGreyboxWorld(), guard = createPlacementGuard({ world, areaId: 'mweb-meadows' });
  const meadows = world.areas.find(a => a.id === 'mweb-meadows'), c = meadows.center;
  assert.equal(guard.clear(c.x, c.y), false, 'spawn clearance');
  assert.equal(guard.clear(c.x - 1220, c.y - 1400, 0), false, 'inside garden home');
  assert.equal(guard.clear(c.x - 1220, c.y - 1400 - 170 - 10, 20), false, 'within radius of the home');
  assert.equal(guard.clear(11000, 6700), false, 'paved road corridor');
  assert.equal(guard.clear(c.x - 1350, c.y - 300, 0), false, 'garden-out inspection route');
  assert.equal(guard.clear(c.x + 520, c.y - 491, 0), false, 'relay objective site');
  assert.equal(guard.clear(c.x + 1500, c.y + 1500, 24), true, 'open south-east lawn');
  assert.equal(guard.blockedAt(c.x - 1220, c.y - 1400), true);
  const bayou = createPlacementGuard({ world, areaId: 'scrypt-bayou' });
  const water = world.pieces.find(p => p.kind === 'water' && p.visible.areaId === 'scrypt-bayou');
  assert.ok(water, 'bayou water fixture');
  const b = water.visible.bounds;
  assert.equal(bayou.clear((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, 0), false, 'water');
});
