import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Container, Texture, TextureSource } from 'pixi.js';
import { createWorldV2RuntimeWorld } from '../apps/hmh-reboot/src/world-v2-runtime-world.mjs';
import { bindWorldV2AreaArt, AREA_ART_BINDING_ID } from '../apps/hmh-reboot/src/world-v2-area-art-binding.mjs';
import { worldToScreen } from '../apps/hmh-reboot/src/world-space.mjs';
import { worldDepthKey } from '../apps/hmh-reboot/src/world-depth.mjs';

const kit = JSON.parse(fs.readFileSync(new URL('../apps/portal/assets/generated/hmh-reboot-tripo-props-hd/hmh-tripo-props-hd.json', import.meta.url), 'utf8'));
const mainSource = fs.readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
const DISTRICTS = ['fork-fortress', 'halving-farms', 'hashwood-river', 'hollow-pines', 'ledger-ridge', 'litecoin-city', 'mweb-meadows', 'rugpull-woods', 'scrypt-bayou', 'silver-coast'];
const sizeFor = url => { const file = url.split('/').at(-1); if (file.startsWith('tripo-props-hd-')) return file.includes('@0.5x') ? [1024, 1024] : [2048, 2048]; if (file.startsWith('forest-ground-details')) return file.includes('@0.5x') ? [512,128] : [1024,256]; if (file.startsWith('ridge-cliff-kit')) return file.includes('@0.5x') ? [512, 256] : [1024, 512]; if (file.endsWith('-fringe.png')) return [512, 128]; if (file === 'ground-details.webp') return [256, 256]; return [512, 512]; };
function fixture({ resolution = 'full' } = {}) {
  const loaded = [], unloaded = [];
  const host = new Container(), before = new Container(), attached = new Set();
  host.addChild(new Container(), before, new Container());
  const depthLayer = { attach: node => attached.add(node), detach: node => attached.delete(node), destroyed: false };
  const fetchImpl = async () => ({ ok: true, json: async () => kit });
  const options = { world: createWorldV2RuntimeWorld(), host, depthLayer, before, resolution, worldToScreen, ContainerClass: Container, depthKey: worldDepthKey, fetchImpl, terrainFieldSize: 48,
    loadTexture: async url => { loaded.push(url); const [width, height] = sizeFor(url); return new Texture({ source: new TextureSource({ width, height }) }); }, unloadTexture: async url => { unloaded.push(url); } };
  return { options, host, before, attached, loaded, unloaded };
}

test('the binding reads the world hooks, loads every plan lazily, paints below the decal layer and attaches depth nodes to the RenderLayer', async () => {
  const f = fixture(), binding = await bindWorldV2AreaArt(f.options);
  assert.equal(binding.id, AREA_ART_BINDING_ID);
  assert.equal(f.host.getChildIndex(binding.root), f.host.getChildIndex(f.before) - 1, 'area art root sits directly below the decal layer');
  const snapshot = binding.snapshot();
  assert.deepEqual(snapshot.plans.map(p => p.areaId).sort(), [...DISTRICTS, 'world-masses', 'world-roads'], 'authored plans, generic terrain for the eight undressed districts, roads and closed masses');
  for (const plan of snapshot.plans) if (DISTRICTS.includes(plan.areaId)) { assert.equal(plan.terrain.materials.length, 3, plan.areaId); const [fw, fh] = plan.terrain.field.split('x').map(Number); assert.equal(fw, 48); assert.ok(fh >= 40 && fh <= 56, `${plan.areaId} field ${plan.terrain.field} spans the area plus its gap reach`); assert.equal(plan.terrain.splat, false, 'no document: the splat mesh is skipped and the flat fill paints'); }
  assert.ok(snapshot.blockerIds.includes('closed-mass-0') && snapshot.blockerIds.includes('halving-farms-barn'), 'closed masses and undressed buildings are drawn by the terrain plans');
  // The production renderer skips every id in blockerIds, so no old flat slab can draw under a rock bank.
  const authored = f.options.world.artPlans.authored, skip = new Set(snapshot.blockerIds);
  const closed = authored.pieces.filter(p => p.blocker && !p.visible.areaId);
  assert.ok(closed.length > 400 && closed.every(p => skip.has(p.blocker.id)), 'every closed-mass and world-guard blocker is drawn by area art and skipped by production');
  for (const blocker of f.options.world.blockers) if (blocker.id.startsWith('closed-mass-')) assert.ok(skip.has(blocker.id), blocker.id);
  assert.ok(snapshot.blockerIds.includes('mweb-meadows-garden-home') && snapshot.blockerIds.includes('rugpull-woods-supply-tent'), 'decorated solids report their collision blocker ids');
  assert.ok(!snapshot.blockerIds.includes('mweb-meadows-relay-equipment'), 'the relay keeps its production drawing');
  const pages = [...new Set(f.loaded.filter(u => u.includes('tripo-props-hd-')))];
  assert.equal(pages.length, 4, 'four distinct kit pages across the three plans');
  assert.ok(f.loaded.every(u => !u.includes('pickups')));
  assert.equal(f.attached.size, 0, 'solids build lazily: nothing is attached before the first camera update');
  const camera = { x: 17500, y: 11600, zoom: 0.8, groundZ: 0, shakeX: 0, shakeY: 0 }, view = { width: 1440, height: 900 };
  const visible = binding.update(camera, view, { x: 17500, y: 11600 });
  assert.ok(f.attached.size > 0 && f.attached.size < snapshot.blockerIds.length + 400, `${f.attached.size} depth nodes attached: only what is in view`);
  assert.ok([...f.attached].some(node => node.label?.startsWith('area-art-solid-rugpull-woods')), 'Woods solids in view are attached');
  assert.ok(![...f.attached].some(node => node.label === 'area-art-solid-closed-mass-0'), 'far closed masses stay out of the scene graph');
  assert.ok(visible > 5, `${visible} props visible at the Woods centre`);
  assert.equal(binding.root.scale.x, 0.8);
  const origin = worldToScreen({ x: 0, y: 0, z: 0 }, camera, view);
  assert.equal(binding.root.position.x, origin.x); assert.equal(binding.root.position.y, origin.y);
  for (const node of f.attached) { assert.equal(node.parent?.parent, binding.root, 'depth nodes live under the camera-transformed root'); assert.ok(Number.isFinite(node.zIndex)); }
  const beforeCount = f.attached.size;
  binding.update({ ...camera, x: 2500, y: 2500 }, view, null);
  assert.ok(f.attached.size < beforeCount, 'residency releases far props and detaches them');
  binding.dispose();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(binding.snapshot().disposed, true);
  assert.equal(f.attached.size, 0, 'every attached node is detached on dispose');
  assert.equal(binding.root.parent, null);
  assert.deepEqual([...new Set(f.unloaded)].sort(), [...new Set(f.loaded)].sort(), 'every loaded URL is unloaded once');
  assert.equal(binding.update(camera, view), 0);
});

test('the half tier loads @0.5x pages and tiles, and a world without authored hooks still gets generic terrain', async () => {
  const f = fixture({ resolution: 'half' }), binding = await bindWorldV2AreaArt(f.options);
  assert.ok(f.loaded.filter(u => u.includes('tripo-props-hd-')).every(u => u.includes('@0.5x')));
  assert.ok(f.loaded.filter(u => u.includes('hmh-terrain-tiles')).every(u => u.endsWith('@0.5x.webp')), 'phone tier loads the @0.5x tiles, fringes and rock face');
  binding.dispose();
  const bare = fixture();
  const world = bare.options.world;
  const stripped = { ...world, artPlans: { ...world.artPlans, districts: Object.fromEntries(Object.entries(world.artPlans.districts).map(([id, d]) => [id, { ...d, artTarget: null }])), roads: null } };
  const generic = await bindWorldV2AreaArt({ ...bare.options, world: stripped });
  assert.deepEqual(generic.snapshot().plans.map(p => p.areaId).sort(), [...DISTRICTS, 'world-masses']);
  generic.dispose();
  await assert.rejects(bindWorldV2AreaArt({ ...bare.options, depthLayer: {} }), /RenderLayer/);
});

test('main.mjs reaches the binding only through one lazy import on the ten-area path and disposes it with the run', () => {
  assert.ok(mainSource.includes("import('./world-v2-area-art-binding.mjs')"), 'lazy import');
  assert.ok(!/^import[^;]*world-v2-area-art/m.test(mainSource), 'no static import of area art');
  assert.ok(mainSource.includes("LEVEL_ONE_WORLD.artPlans?.authored && runtimeParams.get('areaArt') !== '0'"), 'gated on the ten-area world and an opt-out');
  assert.ok(mainSource.includes('areaArt?.update(camera, view, renderState)'), 'per-frame update');
  assert.ok(mainSource.includes('areaArt?.dispose(); areaArt = null;'), 'disposed on portal:dispose');
  assert.ok(mainSource.includes('...(areaArt?.blockerIds ?? [])'), 'decorated blockers skip the production kit drawing');
});
