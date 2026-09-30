import test from 'node:test';
import assert from 'node:assert/strict';
import { Container, Graphics, Texture, TextureSource, TilingSprite } from 'pixi.js';
import { createAreaTextureLeases } from '../apps/hmh-reboot/src/area-texture-leases.mjs';
import { selectTerrainAreas, createOwnedProfileTextureLoader, detachTerrainPage, createTerrainAreaStreaming } from '../apps/hmh-reboot/src/terrain-area-streaming.mjs';
import { createTerrainTileRegistry } from '../apps/hmh-reboot/src/terrain-tile-atlas.mjs';
import { createStaticWorldBake } from '../apps/hmh-reboot/src/world-static-bake.mjs';
import { LEVEL_ONE_WORLD } from '../apps/hmh-reboot/src/level-one-world.mjs';
import { readFileSync } from 'node:fs';

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const page = (id, bytes = 64) => ({ id, reservedDecodedBytes: bytes });
function subject({ load, unload, maxInFlight = 2, maxDecodedBytes = 128 } = {}) {
  const events = [], errors = [];
  const leases = createAreaTextureLeases({ pages: [page('shared'), page('west'), page('east')], maxInFlight, maxDecodedBytes,
    load: load ?? (async value => ({ id: value.id, decodedBytes: 64 })),
    unload: unload ?? (async resource => { events.push(`unload:${resource.id}`); }),
    publish: (value, resource) => events.push(`publish:${value.id}`),
    detach: (value, resource) => events.push(`detach:${value.id}`), onError: error => errors.push(error) });
  return { leases, events, errors };
}

test('area leases share one real resource and detach before last-owner unload', async () => {
  const s = subject();
  s.leases.setAreas([{ id: 'a', pages: ['shared'] }, { id: 'b', pages: ['shared'] }]); await s.leases.idle();
  assert.equal(s.events.filter(value => value === 'publish:shared').length, 1);
  s.leases.setAreas([{ id: 'b', pages: ['shared'] }]); await s.leases.idle();
  assert.equal(s.events.includes('unload:shared'), false);
  s.leases.setAreas([]); await s.leases.idle();
  assert.deepEqual(s.events, ['publish:shared', 'detach:shared', 'unload:shared']);
  assert.equal(s.leases.snapshot().reservedDecodedBytes, 0);
});

test('cancelled pending area never publishes; delayed completion is disposed before re-entry reload', async () => {
  const gate = deferred(), signals = []; let calls = 0;
  const s = subject({ load: async (value, { signal }) => { signals.push(signal); if (++calls === 1) return gate.promise; return { id: value.id, decodedBytes: 64 }; } });
  s.leases.setAreas([{ id: 'a', pages: ['west'] }]); await Promise.resolve();
  s.leases.setAreas([]); assert.equal(signals[0].aborted, true);
  s.leases.setAreas([{ id: 'a', pages: ['west'] }]);
  gate.resolve({ id: 'west', decodedBytes: 64 }); await s.leases.idle();
  assert.deepEqual(s.events, ['unload:west', 'publish:west']);
  assert.equal(calls, 2);
  await s.leases.dispose();
});

test('pending and retiring bytes remain reserved and bounded during rapid area changes', async () => {
  const loadGate = deferred(), unloadGate = deferred(); let peak = 0, active = 0;
  const s = subject({ maxInFlight: 1, maxDecodedBytes: 64,
    load: async value => { peak = Math.max(peak, ++active); if (value.id === 'west') await loadGate.promise; active--; return { id: value.id, decodedBytes: 64 }; },
    unload: async resource => { s.events.push(`unload:${resource.id}`); if (resource.id === 'west') await unloadGate.promise; } });
  s.leases.setAreas([{ id: 'a', pages: ['west'] }]); await Promise.resolve();
  s.leases.setAreas([{ id: 'b', pages: ['east'] }]);
  assert.equal(s.leases.snapshot().reservedDecodedBytes, 64);
  loadGate.resolve(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(s.events.includes('publish:east'), false);
  assert.equal(s.leases.snapshot().reservedDecodedBytes, 64);
  unloadGate.resolve(); await s.leases.idle();
  assert.equal(peak, 1); assert.equal(s.leases.snapshot().reservedDecodedBytes, 64);
  await s.leases.dispose(); assert.equal(s.leases.snapshot().reservedDecodedBytes, 0);
});

test('dispose cancels pending work and keeps failed source disposal observable and charged', async () => {
  const gate = deferred(); let signal;
  const s = subject({ load: async (value, options) => { signal = options.signal; return gate.promise; }, unload: async () => { throw new Error('fixture disposal failed'); } });
  s.leases.setAreas([{ id: 'a', pages: ['shared'] }]); await Promise.resolve();
  const result = s.leases.dispose(); assert.equal(signal.aborted, true);
  gate.resolve({ id: 'shared', decodedBytes: 64 });
  await assert.rejects(result, /disposal failed/);
  assert.equal(s.events.some(value => value.startsWith('publish:')), false);
  assert.equal(s.leases.snapshot().reservedDecodedBytes, 64);
  assert.equal(s.leases.snapshot().failedDisposals, 1);
  assert.equal(s.errors.length, 1);
  assert.throws(() => s.leases.setAreas([{ id: 'new', pages: ['east'] }]), /disposed/);
});

test('camera interest uses detached viewport scale and retain hysteresis without changing world inputs', () => {
  const areas = [{ id: 'west', area: { minX: 0, minY: 0, maxX: 100, maxY: 100 } }, { id: 'east', area: { minX: 1000, minY: 0, maxX: 1100, maxY: 100 } }];
  const camera = { x: 220, y: 50, groundZ: 0, zoom: 1 }, view = { width: 100, height: 100 };
  const before = JSON.stringify({ areas, camera, view });
  assert.deepEqual(selectTerrainAreas({ areas, camera, view, retainedAreaIds: [], prefetchScreens: 1, retainScreens: 2 }), ['west']);
  assert.deepEqual(selectTerrainAreas({ areas, camera: { ...camera, x: 300 }, view, retainedAreaIds: [], prefetchScreens: 1, retainScreens: 2 }), []);
  assert.deepEqual(selectTerrainAreas({ areas, camera: { ...camera, x: 300 }, view, retainedAreaIds: ['west'], prefetchScreens: 1, retainScreens: 2 }), ['west']);
  assert.equal(JSON.stringify({ areas, camera, view }), before);
});

test('owned Pixi loader tracks actual mobile fallback URL and rejects foreign cache ownership', async () => {
  const cache = new Map(), calls = [], resource = { source: { pixelWidth: 512, pixelHeight: 512 }, destroyed: false };
  const Assets = { cache, async load(url) { calls.push(`load:${url}`); if (url.includes('@0.5x')) throw new Error('fixture half page absent'); cache.set(url, resource); return resource; }, async unload(url) { calls.push(`unload:${url}`); cache.delete(url); resource.destroyed = true; resource.source.destroyed = true; resource.source = null; } };
  const loader = createOwnedProfileTextureLoader({ Assets, profile: { id: 'mobile' }, scope: 'fixture-owner' });
  const loaded = await loader.load({ url: '../assets/generated/hmh-terrain-tiles/packed-earth.png?v=hmh-terrain-tiles-v5' }, { signal: new AbortController().signal });
  assert.equal(loaded.url.includes('@0.5x'), false);
  assert.equal(loaded.url.includes('hmhAreaLease=fixture-owner'), true);
  assert.equal(loaded.decodedBytes, 512 * 512 * 4);
  const foreign = { source: {} }; cache.set(loaded.url, foreign);
  await assert.rejects(loader.unload(loaded), /ownership/);
  assert.equal(calls.some(value => value.startsWith('unload:')), false);
  cache.set(loaded.url, resource); await loader.unload(loaded);
  assert.equal(calls.at(-1), `unload:${loaded.url}`);
});

test('actual Pixi terrain sprites and registry detach and bake invalidates before owned source unload', () => {
  const source = new TextureSource({ width: 32, height: 32 }), texture = new Texture({ source });
  const registry = createTerrainTileRegistry({ TilingSpriteClass: TilingSprite }); registry.register('packed-earth', texture);
  const pool = new Container(); const sprite = registry.createSprite('packed-earth', { width: 100, height: 100 }); pool.addChild(sprite);
  const root = new Container(); root.addChild(pool); let invalidated = 0; const before = registry.version;
  detachTerrainPage({ page: { kind: 'tile', materialId: 'packed-earth' }, resource: { texture }, registry, worldProduction: { root }, bake: { invalidate() { invalidated++; } } });
  assert.equal(registry.textureFor('packed-earth'), null); assert.ok(registry.version > before);
  assert.equal(invalidated, 1); assert.equal(pool.children.length, 0); assert.equal(sprite.destroyed, true);
  assert.equal(source.destroyed, false, 'only the owned loader unloads the source after detachment');
  root.destroy({ children: true }); texture.destroy(true);
});


test('explicit invalidation redraws the actual static-bake adapter at the unchanged camera', () => {
  const root = new Container(), ground = new Graphics(), cues = new Graphics(), landmarks = new Graphics(), townBlockers = new Graphics(); root.addChild(ground, townBlockers, cues, landmarks);
  const calls = [], world = { surfaces: [] }, production = { root, layers: { landmarks, townBlockers }, surfaceCues: cues };
  const bake = createStaticWorldBake({ worldProduction: production, world, ContainerClass: Container, GraphicsClass: Graphics, render: args => calls.push(args.pass) });
  const camera = { x: 0, y: 0, groundZ: 0, zoom: 1 }, view = { width: 100, height: 100 };
  const args = { world, camera, view, worldToScreen: (p, c, v) => ({ x: p.x - c.x + v.width / 2, y: p.y - c.y + v.height / 2 }) };
  bake.render(args); bake.render(args); assert.equal(bake.bakes, 1);
  bake.invalidate(); bake.render(args); assert.equal(bake.bakes, 2);
  assert.deepEqual(calls, ['static', 'dynamic', 'dynamic', 'static', 'dynamic']); root.destroy({ children: true });
});

test('actual current-map terrain adapter unloads obsolete Pixi sources, preserves shared pages and reports pinned props separately', async () => {
  const manifest = JSON.parse(readFileSync(new URL('../apps/portal/assets/generated/hmh-terrain-tiles/hmh-terrain-tiles.json', import.meta.url), 'utf8'));
  const cache = new Map(), unloaded = [], sourceBefore = JSON.stringify(LEVEL_ONE_WORLD), root = new Container(), pool = new Container(); root.addChild(pool);
  const registry = createTerrainTileRegistry({ TilingSpriteClass: TilingSprite }); let invalidated = 0;
  const Assets = { cache, async load(url) {
    const base = new URL(url, 'https://example.invalid/hmh-reboot/').pathname.split('/').at(-1).replace('@0.5x.webp', '.png');
    const strip = base.includes('fringe') || manifest.overlays.some(value => base === value.id + '.png');
    const texture = new Texture({ source: new TextureSource({ width: 512, height: strip ? 128 : 512, resolution: url.includes('@0.5x') ? .5 : 1 }) }); cache.set(url, texture); return texture;
  }, async unload(url) { const texture = cache.get(url); assert.ok(texture); assert.equal(pool.children.some(sprite => sprite.texture?.source === texture.source), false); unloaded.push(url); cache.delete(url); texture.destroy(true); } };
  const streaming = await createTerrainAreaStreaming({ world: LEVEL_ONE_WORLD, registry, worldProduction: { root }, bake: { invalidate() { invalidated++; } }, Assets,
    profile: { id: 'mobile' }, fetchImpl: async () => ({ ok: true, json: async () => manifest }) });
  const pinned = new Texture({ source: new TextureSource({ width: 128, height: 128 }) }); streaming.setPinnedTextures([pinned, pinned]);
  streaming.update({ camera: { x: 3050, y: 1500, groundZ: 0, zoom: 1 }, view: { width: 414, height: 896 } }); await streaming.idle();
  assert.equal(streaming.snapshot().ready, true); const old = registry.textureFor('red-rock'); assert.ok(old); const shared = registry.textureFor('road');
  pool.addChild(registry.createSprite('red-rock', { width: 100, height: 100 }));
  streaming.update({ camera: { x: 9000, y: 1600, groundZ: 0, zoom: 1 }, view: { width: 414, height: 896 } }); await streaming.idle();
  assert.equal(registry.textureFor('red-rock'), null); assert.equal(old.source, null); assert.ok(invalidated > 0); assert.ok(unloaded.length > 0);
  assert.equal(registry.textureFor('road'), shared); assert.equal(streaming.snapshot().ready, true);
  assert.deepEqual(streaming.snapshot().pinnedPropPages, { pageCount: 1, decodedRgbaEstimateBytes: 128 * 128 * 4 });
  assert.equal(JSON.stringify(LEVEL_ONE_WORLD), sourceBefore, 'world/surfaces/nav authority remain frozen and untouched');
  await streaming.dispose(); assert.equal(cache.size, 0); assert.equal(streaming.snapshot().reservedDecodedBytes, 0);
  root.destroy({ children: true }); pinned.destroy(true);
});


test('cancelled failed request cannot poison a later re-entry generation', async () => {
  const gate = deferred(); let calls = 0;
  const s = subject({ load: async value => { if (++calls === 1) return gate.promise; return { id: value.id, decodedBytes: 64 }; } });
  s.leases.setAreas([{ id: 'a', pages: ['west'] }]); await Promise.resolve();
  s.leases.setAreas([]); s.leases.setAreas([{ id: 'a', pages: ['west'] }]);
  gate.reject(new Error('cancelled variant failed')); await s.leases.idle();
  assert.equal(calls, 2); assert.deepEqual(s.leases.snapshot().readyPages, ['west']);
  assert.equal(s.errors.length, 1, 'actual failed attempt stays observable');
  await s.leases.dispose();
});


test('owned loader rejects a silently incomplete Pixi unload instead of releasing its reservation', async () => {
  const cache = new Map(), texture = { source: { pixelWidth: 4, pixelHeight: 4 }, destroyed: false };
  const Assets = { cache, async load(url) { cache.set(url, texture); return texture; }, async unload() {} };
  const loader = createOwnedProfileTextureLoader({ Assets, profile: { id: 'desktop' }, scope: 'incomplete-unload' });
  const leases = createAreaTextureLeases({ pages: [{ id: 'owned', url: '../assets/generated/hmh-terrain-tiles/packed-earth.png', reservedDecodedBytes: 64 }],
    load: loader.load, unload: loader.unload, publish() {}, detach() {} });
  leases.setAreas([{ id: 'visible', pages: ['owned'] }]); await leases.idle();
  await assert.rejects(leases.dispose(), error => error instanceof AggregateError && error.errors.some(value => /incomplete/.test(value.message)));
  const state = leases.snapshot(); assert.equal(state.failedDisposals, 1); assert.equal(state.reservedDecodedBytes, 64);
  assert.equal(cache.get(state.entries[0].actualUrl), texture); assert.equal(texture.destroyed, false);
});

test('owned loader retains the original actual Pixi source when only its Texture wrapper is destroyed', async () => {
  const cache = new Map(), original = new TextureSource({ width: 4, height: 4 }), texture = new Texture({ source: original });
  const Assets = { cache, async load(url) { cache.set(url, texture); return texture; }, async unload(url) { cache.delete(url); texture.destroy(false); } };
  const loader = createOwnedProfileTextureLoader({ Assets, profile: { id: 'desktop' }, scope: 'wrapper-only' });
  const failures = [], leases = createAreaTextureLeases({ pages: [{ id: 'wrapper-only', url: '../assets/generated/hmh-terrain-tiles/packed-earth.png', reservedDecodedBytes: 64 }],
    load: loader.load, unload: loader.unload, publish() {}, detach() {}, onError: error => failures.push(error), maxDecodedBytes: 64 });
  try {
    leases.setAreas([{ id: 'a', pages: ['wrapper-only'] }]); await leases.idle();
    await assert.rejects(leases.dispose(), error => error instanceof AggregateError && error.errors.some(inner => /incomplete/.test(inner.message)));
    assert.equal(cache.size, 0); assert.equal(texture.destroyed, true); assert.equal(texture.source, original);
    assert.equal(original.destroyed, false, 'the actual original source is still alive despite the destroyed wrapper');
    assert.equal(leases.snapshot().failedDisposals, 1); assert.equal(leases.snapshot().reservedDecodedBytes, 64); assert.equal(failures.length, 1);
  } finally { if (!original.destroyed) original.destroy(); }
});

test('owned loader rejects public source substitution during unload while its original actual Pixi source survives', async () => {
  const cache = new Map(), original = new TextureSource({ width: 4, height: 4 }), replacement = new TextureSource({ width: 4, height: 4 }), texture = new Texture({ source: original });
  const Assets = { cache, async load(url) { cache.set(url, texture); return texture; }, async unload(url) { cache.delete(url); texture.source = replacement; texture.destroy(true); } };
  const loader = createOwnedProfileTextureLoader({ Assets, profile: { id: 'desktop' }, scope: 'source-substitution' });
  const failures = [], leases = createAreaTextureLeases({ pages: [{ id: 'substitution', url: '../assets/generated/hmh-terrain-tiles/packed-earth.png', reservedDecodedBytes: 64 }],
    load: loader.load, unload: loader.unload, publish() {}, detach() {}, onError: error => failures.push(error), maxDecodedBytes: 64 });
  try {
    leases.setAreas([{ id: 'a', pages: ['substitution'] }]); await leases.idle();
    await assert.rejects(leases.dispose(), error => error instanceof AggregateError && error.errors.some(inner => /incomplete/.test(inner.message)));
    assert.equal(cache.size, 0); assert.equal(texture.destroyed, true); assert.equal(texture.source, null); assert.equal(replacement.destroyed, true);
    assert.equal(original.destroyed, false, 'destroying the replacement did not dispose the originally owned source');
    assert.equal(leases.snapshot().failedDisposals, 1); assert.equal(leases.snapshot().reservedDecodedBytes, 64); assert.equal(failures.length, 1);
  } finally { if (!original.destroyed) original.destroy(); if (!replacement.destroyed) replacement.destroy(); }
});

test('a throwing telemetry callback cannot interrupt actual partial-publication source cleanup', async () => {
  const cache = new Map(), sources = [], textures = [], events = [], root = new Container();
  const registry = createTerrainTileRegistry({ TilingSpriteClass: TilingSprite }); let publications = 0, callbackCalls = 0;
  const Assets = { cache, async load(url) {
    const source = new TextureSource({ width: 4, height: 4 }), texture = new Texture({ source });
    sources.push(source); textures.push(texture); cache.set(url, texture); events.push('load'); return texture;
  }, async unload(url) { events.push('unload'); const texture = cache.get(url); cache.delete(url); texture.destroy(true); } };
  const loader = createOwnedProfileTextureLoader({ Assets, profile: { id: 'desktop' }, scope: 'throwing-telemetry' });
  const page = { id: 'partial', kind: 'tile', materialId: 'packed-earth', url: '../assets/generated/hmh-terrain-tiles/packed-earth.png', reservedDecodedBytes: 64 };
  const leases = createAreaTextureLeases({ pages: [page], load: loader.load, unload: loader.unload, maxDecodedBytes: 64,
    publish(value, resource) {
      events.push('publish'); registry.register('packed-earth', resource.texture);
      root.addChild(registry.createSprite('packed-earth', { width: 4, height: 4 }));
      if (++publications === 1) throw new Error('fixture partial publisher failed');
    },
    detach(value, resource) { events.push('detach'); detachTerrainPage({ page: value, resource, registry, worldProduction: { root }, bake: { invalidate() {} } }); },
    onError() { callbackCalls++; throw new Error('fixture telemetry failed'); } });
  try {
    leases.setAreas([{ id: 'a', pages: ['partial'] }]); await leases.idle();
    assert.deepEqual(events, ['load', 'publish', 'detach', 'unload', 'load', 'publish']);
    assert.equal(sources.length, 2); assert.equal(sources[0].destroyed, true); assert.equal(sources[1].destroyed, false);
    assert.equal(callbackCalls, 1); assert.equal(leases.snapshot().errorCount, 2);
    assert.equal(leases.snapshot().errors[0], 'fixture partial publisher failed');
    assert.match(leases.snapshot().errors[1], /callback failed: fixture telemetry failed/);
    assert.equal(leases.snapshot().reservedDecodedBytes, 64); assert.deepEqual(leases.snapshot().readyPages, ['partial']);
    await leases.dispose(); assert.equal(leases.snapshot().reservedDecodedBytes, 0); assert.equal(cache.size, 0);
    assert.ok(sources.every(source => source.destroyed)); assert.equal(root.children.length, 0);
    assert.equal(leases.snapshot().errorCount, 2, 'cleanup success cannot erase either lifecycle or telemetry failure');
  } finally { root.destroy({ children: true }); for (const texture of textures) if (!texture.destroyed) texture.destroy(true); for (const source of sources) if (!source.destroyed) source.destroy(); }
});
