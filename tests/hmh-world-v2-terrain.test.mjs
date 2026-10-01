import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Container, Texture, TextureSource } from 'pixi.js';
import { createGreyboxWorld } from '../apps/hmh-reboot/src/dev/greybox-world-v1.mjs';
import { AREA_ART_MATERIALS, AREA_ART_TILE_MEANS, DISTRICT_TERRAIN, AREA_ART_GRAIN_SIZE, validateAreaArtPlan, createAreaArtPlanShell } from '../apps/hmh-reboot/src/world-v2-area-art-schema.mjs';
import { buildTerrainField, latticeHash, fbm, TERRAIN_FIELD_ID } from '../apps/hmh-reboot/src/world-v2-terrain-field.mjs';
import { createDistrictTerrainArtPlan, createWorldMassesArtPlan } from '../apps/hmh-reboot/src/world-v2-area-plans/district-terrain.mjs';
import { createMwebMeadowsArtPlan } from '../apps/hmh-reboot/src/world-v2-area-plans/mweb-meadows.mjs';
import { createRugpullWoodsArtPlan } from '../apps/hmh-reboot/src/world-v2-area-plans/rugpull-woods.mjs';
import { createAreaArt, createAreaArtTextureCache, triangulatePolygon } from '../apps/hmh-reboot/src/world-v2-area-art.mjs';
import { createWorldRoadsArtPlan } from '../apps/hmh-reboot/src/world-v2-area-plans/world-roads.mjs';
import { ROAD_RECIPES } from '../apps/hmh-reboot/src/world-v2-area-art-schema.mjs';

const kit = JSON.parse(fs.readFileSync(new URL('../apps/portal/assets/generated/hmh-reboot-tripo-props-hd/hmh-tripo-props-hd.json', import.meta.url), 'utf8'));
const tileManifest = JSON.parse(fs.readFileSync(new URL('../apps/portal/assets/generated/hmh-terrain-tiles/hmh-terrain-tiles.json', import.meta.url), 'utf8'));
const tileRoot = new URL('../apps/portal/assets/generated/hmh-terrain-tiles/', import.meta.url);
const world = createGreyboxWorld();
const sizeFor = url => { const file = url.split('/').at(-1); if (file.startsWith('tripo-props-hd-')) return file.includes('@0.5x') ? [1024, 1024] : [2048, 2048]; if (file.includes('-fringe') || file.includes('rock-face')) return file.includes('@0.5x') ? [256, 64] : [512, 128]; return file.includes('@0.5x') ? [256, 256] : [512, 512]; };
const loader = log => async url => { log.push(url); const [width, height] = sizeFor(url); return new Texture({ source: new TextureSource({ width, height }) }); };

test('every district has a two-material ground pair whose grain tiles exist at full and half resolution with measured means', () => {
  const areaIds = world.areas.map(a => a.id).sort();
  assert.deepEqual(Object.keys(DISTRICT_TERRAIN).sort(), areaIds, 'all ten districts are assigned');
  const manifestTiles = new Set(tileManifest.materials.map(m => m.id));
  for (const [areaId, terrain] of Object.entries(DISTRICT_TERRAIN)) {
    assert.ok(terrain.materials.length >= 2 && terrain.materials.length <= 3, areaId);
    assert.equal(new Set(terrain.materials).size, terrain.materials.length, `${areaId} materials are distinct`);
    for (const id of terrain.materials) {
      const m = AREA_ART_MATERIALS[id];
      assert.ok(m, `${areaId} uses known material ${id}`);
      assert.ok(m.grain.length >= 1 && m.grain.length <= 2, `${id} has one or two grain layers`);
      for (const layer of m.grain) {
        assert.ok(manifestTiles.has(layer.tile), `${id} grain tile ${layer.tile} is a manifest material`);
        assert.ok(fs.existsSync(new URL(`${layer.tile}.png`, tileRoot)) && fs.existsSync(new URL(`${layer.tile}@0.5x.webp`, tileRoot)) && fs.existsSync(new URL(`${layer.tile}-fringe.png`, tileRoot)) && fs.existsSync(new URL(`${layer.tile}-fringe@0.5x.webp`, tileRoot)), `${layer.tile} full, half and fringe files exist`);
        assert.ok(AREA_ART_TILE_MEANS[layer.tile], `${layer.tile} has a measured mean`);
        assert.ok(layer.size >= 120 && layer.size <= 640 && layer.gain >= 0 && layer.gain <= 6, `${id} layer ${layer.tile} density/gain within range`);
      }
      // Fine grain repeats at 160 world units (128 texels per metre, 40 units per metre).
      assert.ok(Math.abs(m.grain[0].size - AREA_ART_GRAIN_SIZE) <= 60, `${id} fine layer near 128 texels per metre`);
      const color = m.color; assert.ok(Number.isInteger(color) && color > 0 && color <= 0xffffff);
    }
  }
  assert.ok(fs.existsSync(new URL('rock-face.png', tileRoot)) && fs.existsSync(new URL('rock-face@0.5x.webp', tileRoot)));
});

test('ground.terrain validates its materials, the generic district plans and the closed-mass plan stay inside the ground page budget', () => {
  const shell = createAreaArtPlanShell({ areaId: 'mweb-meadows', bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 }, pages: [] });
  assert.throws(() => validateAreaArtPlan({ ...shell, ground: { ...shell.ground, terrain: { materials: ['meadow'] } } }, kit), /two or three materials/);
  assert.throws(() => validateAreaArtPlan({ ...shell, ground: { ...shell.ground, terrain: { materials: ['meadow', 'lava'] } } }, kit), /known material/);
  assert.throws(() => validateAreaArtPlan({ ...shell, ground: { ...shell.ground, terrain: { materials: ['meadow', 'meadow'] } } }, kit), /repeat/);
  const ok = validateAreaArtPlan({ ...shell, ground: { ...shell.ground, terrain: { materials: ['meadow', 'earth'], blend: 0.4 } } }, kit);
  assert.deepEqual(ok.terrain, { materials: ['meadow', 'earth'], seed: 'mweb-meadows', blend: 0.4, patch: 800, value: 0.14, extras: [], slots: {} });
  assert.deepEqual(ok.tiles, ['crushed-ore', 'forest-floor', 'ledge-top', 'packed-earth']);
  for (const area of world.areas) {
    const plan = createDistrictTerrainArtPlan(world, area.id), again = createDistrictTerrainArtPlan(createGreyboxWorld(), area.id);
    assert.equal(JSON.stringify(plan), JSON.stringify(again), `${area.id} terrain plan is deterministic`);
    const summary = validateAreaArtPlan(plan, kit);
    assert.deepEqual(summary.terrain.materials, DISTRICT_TERRAIN[area.id].materials);
    assert.equal(summary.pages.length, 0, 'terrain-only plans load no kit page');
    assert.ok(summary.budget.tileDecodedBytes <= 8 * 1024 * 1024, `${area.id} ground pages ${summary.budget.tileDecodedBytes} B <= 8 MB`);
    assert.ok(summary.tiles.length <= 5, `${area.id} tiles ${summary.tiles.join(',')}`);
    const buildings = world.pieces.filter(p => p.visible.areaId === area.id && p.blocker && p.kind === 'mass');
    for (const piece of buildings) assert.ok(summary.solids.some(s => s.pieceId === piece.id && s.style === 'mass' && s.wall && s.roof), `${piece.id} gets wall and roof materials`);
    for (const piece of world.pieces.filter(p => p.visible.areaId === area.id && p.blocker && p.kind === 'cliff')) assert.equal(summary.solids.find(s => s.pieceId === piece.id)?.style, 'bank');
    assert.deepEqual(summary.overlays, buildings.length || summary.solids.length ? ['rock-face'] : []);
  }
  for (const make of [createMwebMeadowsArtPlan, createRugpullWoodsArtPlan]) { const summary = validateAreaArtPlan(make(world), kit); assert.ok(summary.terrain, 'authored plans carry terrain'); assert.ok(summary.budget.tileDecodedBytes <= 8 * 1024 * 1024, `${summary.areaId} ${summary.budget.tileDecodedBytes}`); }
  const masses = validateAreaArtPlan(createWorldMassesArtPlan(world), kit);
  assert.equal(masses.counts.solids, world.pieces.filter(p => p.blocker && p.kind === 'cliff' && !p.visible.areaId).length);
  assert.ok(masses.solids.every(s => s.style === 'bank'));
  assert.equal(JSON.stringify(createWorldMassesArtPlan(world)), JSON.stringify(createWorldMassesArtPlan(createGreyboxWorld())));
});

test('the control field is deterministic hash noise with feathered zones, worn trails, road verges and contact darkening', () => {
  assert.equal(latticeHash(3, 4, 5), latticeHash(3, 4, 5));
  assert.notEqual(latticeHash(3, 4, 5), latticeHash(4, 3, 5));
  const n = fbm(1234.5, 678.9, 900, 3, 11); assert.ok(n >= 0 && n <= 1);
  const summary = validateAreaArtPlan(createMwebMeadowsArtPlan(world), kit);
  const field = buildTerrainField({ summary, world, size: 128 }), again = buildTerrainField({ summary, world, size: 128 });
  assert.equal(field.id, TERRAIN_FIELD_ID);
  assert.equal(field.width, 128); assert.equal(field.height, 128); assert.equal(field.data.length, 128 * 128 * 4);
  assert.ok(Buffer.compare(Buffer.from(field.data), Buffer.from(again.data)) === 0, 'identical bytes on every build');
  assert.ok(field.counts.blockers > 10 && field.counts.trails >= 10 && field.counts.roads === 14);
  const at = (x, y) => { const i = Math.floor((x - field.minX) / field.unitsPerTexel), j = Math.floor((y - field.minY) / field.unitsPerTexel); const o = (j * field.width + i) * 4; return { b: field.data[o], c: field.data[o + 1], v: field.data[o + 2], l: field.data[o + 3] }; };
  const meadows = world.areas.find(a => a.id === 'mweb-meadows'), { x: cx, y: cy } = meadows.center;
  // Relay court earth zone is solid inside and fades over its feather.
  assert.ok(at(cx + 600, cy - 500).b > 150, 'earth inside the relay court');
  // Gravel entry apron (accent slot) reads in the accent channel.
  assert.ok(at(cx - 500, cy).c > 150, 'gravel on the entry apron');
  // Contact darkening at the foot of an authored home versus open ground.
  const home = world.pieces.find(p => p.id === 'mweb-meadows-garden-home').visible.bounds;
  assert.ok(at((home.minX + home.maxX) / 2, home.maxY + 12).l < at(cx - 1700, cy + 1700).l - 40, 'darker at the base of a mass than in the open');
  // Secondary coverage lands near the authored blend and the whole field varies in value.
  let bSum = 0, vMin = 255, vMax = 0; for (let o = 0; o < field.data.length; o += 4) { bSum += field.data[o]; vMin = Math.min(vMin, field.data[o + 2]); vMax = Math.max(vMax, field.data[o + 2]); }
  const coverage = bSum / 255 / (field.width * field.height); assert.ok(coverage > 0.15 && coverage < 0.7, `secondary coverage ${coverage.toFixed(2)}`);
  assert.ok(vMax - vMin >= 20, 'broad value variation present');
  assert.throws(() => buildTerrainField({ summary: { ...summary, terrain: null }, world }), /terrain summary/);
  assert.equal(JSON.stringify(world), JSON.stringify(createGreyboxWorld()), 'the world is untouched');
});

test('the renderer builds one splat mesh per terrain plan from an injected control texture and keeps every hook projection-only', async () => {
  const urls = [], cache = createAreaArtTextureCache({ loadTexture: loader(urls) }), fields = [];
  const art = createAreaArt({ world, areaId: 'halving-farms', plan: createDistrictTerrainArtPlan(world, 'halving-farms'), kit, textureCache: cache, terrainFieldSize: 32, createTerrainProgram: () => ({ name: 'test-terrain-program' }), createControlTexture: field => { fields.push(field); return new Texture({ source: new TextureSource({ width: field.width, height: field.height }) }); } });
  await art.ready;
  assert.equal(fields.length, 1); assert.equal(fields[0].width, 32);
  assert.ok(urls.includes('/assets/generated/hmh-terrain-tiles/rock-face.png'), 'rock face overlay loads for bank/mass solids');
  const ground = new Container();
  art.paintGround(ground);
  const mesh = ground.children.find(child => child.label === 'area-terrain-halving-farms');
  assert.ok(mesh && mesh.shader && mesh.geometry, 'one mesh carries the whole area ground');
  assert.equal(ground.children.filter(child => child.label?.startsWith('area-terrain-')).length, 1);
  const snapshot = art.snapshot();
  assert.equal(snapshot.terrain.splat, true); assert.equal(snapshot.terrain.field, '32x32'); assert.equal(snapshot.runtimeAuthority, 'projection-only');
  const barn = world.pieces.find(p => p.id === 'halving-farms-barn'), node = art.createSolid(barn);
  assert.ok(node?.areaArtDecorated && node.children.length >= 2, 'barn gets shadow plus textured walls and roof');
  const half = createAreaArt({ world, areaId: 'silver-coast', plan: createDistrictTerrainArtPlan(world, 'silver-coast'), kit, textureCache: cache, resolution: 'half', terrainFieldSize: 16, createControlTexture: () => null });
  await half.ready;
  assert.ok(urls.filter(u => u.includes('hmh-terrain-tiles') && !u.includes('rock-face')).some(u => u.endsWith('@0.5x.webp')), 'half tier reads the @0.5x tiles');
  const flat = new Container(); half.paintGround(flat);
  assert.equal(flat.children.some(child => child.label?.startsWith('area-terrain-')), false, 'without a control texture the flat fill paints instead');
  assert.equal(half.snapshot().terrain.splat, false);
  art.dispose(); half.dispose();
  assert.equal(cache.snapshot().references, 0);
  assert.equal(JSON.stringify(world), JSON.stringify(createGreyboxWorld()));
});

test('roads paint as one mesh each in dirt, gravel, paved order with opaque eroded cores, shoulders, ruts and a chalk centre line on paved roads', async () => {
  assert.ok(ROAD_RECIPES.dirt.rank < ROAD_RECIPES.gravel.rank && ROAD_RECIPES.gravel.rank < ROAD_RECIPES.paved.rank);
  assert.equal(ROAD_RECIPES.paved.centreLine, true); assert.equal(ROAD_RECIPES.gravel.centreLine, false);
  for (const recipe of Object.values(ROAD_RECIPES)) assert.ok(recipe.coreFraction > 0.4 && recipe.coreFraction < 0.9 && recipe.rutAlpha > 0 && recipe.shoulderOut > 0);
  const urls = [], programs = [], cache = createAreaArtTextureCache({ loadTexture: loader(urls) });
  const plan = createWorldRoadsArtPlan(world);
  const art = createAreaArt({ world, areaId: 'world-roads', plan, kit, textureCache: cache, createProgram: kind => { programs.push(kind); return { name: `test-${kind}` }; } });
  await art.ready;
  const ground = new Container(); art.paintGround(ground);
  const meshes = ground.children.filter(child => child.label?.startsWith('area-road-'));
  assert.equal(meshes.length, 14, 'one mesh per authored road');
  const kinds = meshes.map(mesh => plan.roads.find(road => `area-road-${road.roadId}` === mesh.label).kind);
  for (let i = 1; i < kinds.length; i++) assert.ok(ROAD_RECIPES[kinds[i - 1]].rank <= ROAD_RECIPES[kinds[i]].rank, 'overlaps resolve dirt under gravel under paved');
  const paved = meshes.find(mesh => mesh.label === 'area-road-city-meadows'), uniforms = paved.shader.resources.roadUniforms.uniforms;
  assert.equal(uniforms.uWear[2], 1, 'paved roads carry the centre line');
  assert.equal(uniforms.uShape[0], 300 * ROAD_RECIPES.paved.coreFraction);
  assert.equal(uniforms.uShape[2], 3200, 'along coordinate spans the road length');
  const crackCards = ground.children.filter(child => !child.label?.startsWith('area-road-'));
  assert.equal(crackCards.length, plan.roads.reduce((n, road) => n + road.cracks.length, 0), 'b2-47 crack cards stay on the paved roads');
  assert.ok(crackCards.every(card => ground.children.indexOf(card) > ground.children.indexOf(meshes.at(-1))), 'cracks draw over every road core');
  assert.ok(programs.includes('road'));
  art.dispose(); assert.equal(cache.snapshot().references, 0);
});

test('bank and mass solids roof through the grain shader and face only camera-facing edges', async () => {
  assert.deepEqual(triangulatePolygon([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]).length, 6);
  const concave = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }, { x: 10, y: 8 }, { x: 0, y: 20 }];
  assert.equal(triangulatePolygon(concave).length, 9, 'concave outlines triangulate fully');
  const urls = [], cache = createAreaArtTextureCache({ loadTexture: loader(urls) });
  const art = createAreaArt({ world, areaId: 'world-masses', plan: createWorldMassesArtPlan(world), kit, textureCache: cache, createProgram: kind => ({ name: `test-${kind}` }) });
  await art.ready;
  const piece = world.pieces.find(p => p.id === 'closed-mass-1'), node = art.createSolid(piece);
  const mass = node.children.at(-1), roof = mass.children.find(child => child.label === 'area-solid-roof');
  assert.ok(roof, 'roof is a grain-shaded mesh, not a plain tile rectangle');
  const indices = roof.geometry.indexBuffer.data, b = piece.visible.bounds;
  assert.ok(indices.length > 6 && indices.length % 3 === 0, 'authored outline plus ragged-edge fans');
  // Ragged rock edge: roof points stay within -8..+26 units of the authored outline.
  const positions = roof.geometry.getAttribute('aPosition').buffer.data, h = piece.visible.height;
  for (let i = 0; i < positions.length; i += 2) assert.ok(positions[i] >= b.minX - 27 && positions[i] <= b.maxX + 27 && positions[i + 1] + h >= b.minY - 27 && positions[i + 1] + h <= b.maxY + 27);
  // Faces only where the ragged edge turns toward the camera: the south run plus small jogs on the
  // side runs, never the north run. Three fills (face + two foot bands) per facing segment.
  const faces = mass.children[1], fills = faces.context.instructions.filter(i => i.action === 'fill').length, width = b.maxX - b.minX, height = b.maxY - b.minY;
  const southSegments = Math.round(width / 40), allSegments = 2 * southSegments + 2 * Math.round(height / 40);
  assert.ok(fills % 3 === 0 && fills / 3 >= southSegments * 0.8 && fills / 3 < allSegments / 2, `${fills / 3} facing segments of ${allSegments}`);
  art.dispose(); assert.equal(cache.snapshot().references, 0);
});

test('Litecoin City letters every placed carrier and facade from the branding table, off the cue palette', async () => {
  const { createLitecoinCityArtPlan } = await import('../apps/hmh-reboot/src/world-v2-area-plans/litecoin-city.mjs');
  const { CITY_BRAND_SLOTS, CITY_SIGN_PREFIX } = await import('../apps/hmh-reboot/src/world-v2-area-plans/city-branding.mjs');
  const plan = createLitecoinCityArtPlan(world), summary = validateAreaArtPlan(plan, kit);
  const carriers = summary.props.filter(p => p.id.startsWith(CITY_SIGN_PREFIX));
  assert.ok(carriers.length >= 15, `${carriers.length} carriers placed`);
  for (const carrier of carriers) assert.ok(summary.signs.some(s => s.propId === carrier.id), `${carrier.id} is lettered`);
  for (const sign of summary.signs) assert.ok(CITY_BRAND_SLOTS.some(slot => slot.brand === sign.text), `${sign.text} comes from the branding table`);
  assert.ok(summary.signs.some(s => s.pieceId === 'litecoin-city-exchange' && s.text === 'Litecoin') || !summary.solids.some(s => s.pieceId === 'litecoin-city-exchange'));
  const made = [];
  const urls = [], cache = createAreaArtTextureCache({ loadTexture: loader(urls) });
  const art = createAreaArt({ world, areaId: 'litecoin-city', plan, kit, textureCache: cache, createProgram: kind => ({ name: kind }), createControlTexture: () => null, createSignTexture: (text, sign) => { made.push(text); return new Texture({ source: new TextureSource({ width: Math.round(sign.height * 4 * 4), height: Math.round(sign.height * 4) }) }); } });
  await art.ready;
  const depth = new Container(); art.mount(depth, new Container());
  const tower = summary.props.find(p => p.id === `${CITY_SIGN_PREFIX}tower-1`) ?? carriers[0];
  art.update({ x: tower.x, y: tower.y, zoom: 1, groundZ: 0, shakeX: 0, shakeY: 0 }, { width: 1280, height: 800 });
  const panels = depth.children.flatMap(node => node.children).filter(child => child.label?.startsWith('area-sign-'));
  assert.ok(panels.length >= 1 && made.length >= 1, 'visible carriers get a baked panel');
  assert.throws(() => validateAreaArtPlan({ ...plan, signs: [{ id: 'x', propId: carriers[0].id, text: 'Buy <now>!' }] }, kit), /plain characters/);
  assert.throws(() => validateAreaArtPlan({ ...plan, signs: [{ id: 'x', propId: carriers[0].id, text: 'Ok', panel: 0xff3300 }] }, kit), /reserved cue colour/);
  assert.throws(() => validateAreaArtPlan({ ...plan, signs: [{ id: 'x', propId: 'nope', text: 'Ok' }] }, kit), /not a plan prop/);
  art.dispose(); assert.equal(cache.snapshot().references, 0);
});

test('Scrypt Bayou lays faint low fog cards under the actors that hold still under reduced motion', async () => {
  const { createScryptBayouArtPlan } = await import('../apps/hmh-reboot/src/world-v2-area-plans/scrypt-bayou.mjs');
  const plan = createScryptBayouArtPlan(world), summary = validateAreaArtPlan(plan, kit);
  assert.ok(summary.fog.length >= 12 && summary.fog.every(card => card.alpha <= 0.25), 'faint fog');
  assert.equal(JSON.stringify(createScryptBayouArtPlan(createGreyboxWorld()).ground.fog), JSON.stringify(plan.ground.fog), 'deterministic');
  let reduce = true;
  const cache = createAreaArtTextureCache({ loadTexture: loader([]) });
  const art = createAreaArt({ world, areaId: 'scrypt-bayou', plan, kit, textureCache: cache, createProgram: kind => ({ name: kind }), createControlTexture: () => null, createFogTexture: () => new Texture({ source: new TextureSource({ width: 128, height: 128 }) }), reducedMotion: () => reduce });
  await art.ready;
  const ground = new Container(), depth = new Container(); art.paintGround(ground); art.mount(depth, ground);
  const fog = ground.children.filter(child => child.label?.startsWith('area-fog-'));
  assert.equal(fog.length, summary.fog.length);
  assert.ok(ground.getChildIndex(fog[0]) > 0, 'fog paints over the ground, inside the ground layer under every actor');
  const camera = { x: 2500, y: 11600, zoom: 1, groundZ: 0, shakeX: 0, shakeY: 0 }, view = { width: 1280, height: 800 };
  for (let i = 0; i < 200; i++) art.update(camera, view);
  assert.ok(fog.every((sprite, i) => sprite.x === summary.fog[i].x), 'reduced motion: static');
  reduce = false; for (let i = 0; i < 200; i++) art.update(camera, view);
  assert.ok(fog.some((sprite, i) => sprite.x !== summary.fog[i].x), 'otherwise a slow drift');
  art.dispose(); assert.equal(cache.snapshot().references, 0);
});

test('every zone and trail material lands in a splat slot, so no straight-edged polygon fill is left under the splat', async () => {
  const plans = await Promise.all(['mweb-meadows', 'litecoin-city', 'halving-farms', 'silver-coast', 'scrypt-bayou', 'hashwood-river', 'rugpull-woods'].map(async id => {
    const name = id.replace(/-([a-z])/g, (_, c) => c.toUpperCase()), module = await import(`../apps/hmh-reboot/src/world-v2-area-plans/${id}.mjs`);
    return module[`create${name[0].toUpperCase()}${name.slice(1)}ArtPlan`](world);
  }));
  for (const plan of plans) {
    const summary = validateAreaArtPlan(plan, kit), t = summary.terrain;
    assert.ok(t.extras.length <= 2, `${summary.areaId} extras`);
    for (const entry of [...summary.zones, ...summary.trails]) assert.ok(Number.isInteger(t.slots[entry.material]) && t.slots[entry.material] >= 0 && t.slots[entry.material] <= 4, `${summary.areaId} ${entry.material} has a slot`);
    assert.ok(summary.budget.tileDecodedBytes <= 8 * 1024 * 1024, `${summary.areaId} ${summary.budget.tileDecodedBytes}`);
    const field = buildTerrainField({ summary, world, size: 48 });
    assert.equal(field.extra.length, 48 * field.height * 2);
    if (t.extras.length) assert.ok(field.extra.some(v => v > 0), `${summary.areaId} extra material reaches the field`);
  }
  const cache = createAreaArtTextureCache({ loadTexture: loader([]) }), coast = plans[3];
  const art = createAreaArt({ world, areaId: 'silver-coast', plan: coast, kit, textureCache: cache, terrainFieldSize: 32, createProgram: kind => ({ name: kind }), createControlTexture: field => new Texture({ source: new TextureSource({ width: field.width, height: field.height }) }) });
  await art.ready; const ground = new Container(); art.paintGround(ground);
  assert.equal(ground.children.filter(c => c.constructor.name === 'Graphics').length, 0, 'no Graphics zone fills when the splat paints');
  art.dispose();
});

test('Litecoin City keeps tall cards off the walked street centrelines and masts at human-relative height', async () => {
  const { createLitecoinCityArtPlan, TALL_CARD_HEIGHT, TALL_STREET_CLEARANCE, MAST_MAX_HEIGHT, CITY_STREET_CENTRELINES } = await import('../apps/hmh-reboot/src/world-v2-area-plans/litecoin-city.mjs');
  const { distanceToPolyline } = await import('../apps/hmh-reboot/src/world-v2-area-art-schema.mjs');
  const plan = createLitecoinCityArtPlan(world), summary = validateAreaArtPlan(plan, kit), city = world.areas.find(a => a.id === 'litecoin-city');
  assert.ok(MAST_MAX_HEIGHT <= 180 && TALL_STREET_CLEARANCE >= 120 && TALL_CARD_HEIGHT <= 100);
  const streets = [...world.roads.map(r => r.points), ...CITY_STREET_CENTRELINES.map(line => line.map(p => ({ x: city.center.x + p.x, y: city.center.y + p.y })))];
  const tall = summary.props.filter(p => p.height > TALL_CARD_HEIGHT && p.groundZ === 0);
  assert.ok(tall.length > 0);
  for (const prop of tall) for (const line of streets) assert.ok(distanceToPolyline(prop.x, prop.y, line) >= TALL_STREET_CLEARANCE, `${prop.id} (${prop.source}, ${prop.height}) clears the street centreline`);
  const masts = summary.props.filter(p => p.source === 'b2-52');
  assert.ok(masts.length >= 4 && masts.every(p => p.height <= MAST_MAX_HEIGHT && p.fade), 'masts are human-relative and fade over the hero');
  assert.ok(summary.signs.length >= 15, 'sign carriers survive the rule');
});
