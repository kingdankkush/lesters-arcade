import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createAuthoredPropAtlasIndex } from '../apps/hmh-reboot/src/authored-prop-atlas.mjs';

const moduleUrl = new URL('../apps/hmh-reboot/src/tripo-prop-appearance.mjs', import.meta.url);
async function load() {
  assert.ok(existsSync(fileURLToPath(moduleUrl)), 'native prop runtime appearance mapping is not implemented');
  return import(moduleUrl.href);
}
function metadata() {
  return {
    schemaVersion: 1, pipelineId: 'hmh-tripo-static-props/v1', classification: 'production-art',
    runtimeAuthority: 'projection-only', assetCount: 56,
    pages: [0, 1].map(page => ({ image: `tripo-props-0${page}.webp`, width: 2048, height: 2048, lossless: true, exact: true, sha256: 'a'.repeat(64), decodedRgbaSha256: 'b'.repeat(64) })),
    frames: Array.from({ length: 56 }, (_, i) => {
      const id = String(i + 1).padStart(2, '0'); const cell = i % 49;
      return { assetId: `tripo-${id}`, sourceId: id, name: `${id} - Unit fixture`,
        category: i >= 20 && i < 40 ? 'power-up' : 'environment', page: Math.floor(i / 49),
        frame: { x: 4 + (cell % 7) * 260, y: 4 + Math.floor(cell / 7) * 260, w: 256, h: 256 },
        anchor: { x: 0.5, y: 0.8 }, alphaBounds: { x: 25, y: 20, w: 195, h: 200 },
        sourcePixelSha256: 'c'.repeat(64), sourceModelSha256: 'd'.repeat(64) };
    }),
  };
}
const textures = () => [0, 1].map(id => ({ source: { id, width: 2048, height: 2048 } }));
async function legacyIndex() {
  const value = JSON.parse(await readFile(new URL('../apps/portal/assets/generated/hmh-reboot-authored-props/hmh-authored-props-atlas.json', import.meta.url), 'utf8'));
  return createAuthoredPropAtlasIndex(value);
}

test('the runtime entry imports and wires native prop appearance, not just its metadata', async () => {
  const { buildSync } = await import('esbuild');
  const source = await readFile(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
  const built = buildSync({ stdin: { contents: source, sourcefile: 'main.mjs', loader: 'js' }, bundle: false, write: false, metafile: true, format: 'esm', logLevel: 'silent' });
  const imports = Object.values(built.metafile.outputs).flatMap(output => output.imports.map(item => item.path));
  assert.ok(imports.some(path => path.endsWith('/tripo-prop-appearance.mjs')), 'no real native appearance import');
  assert.match(source, /renderAssets:\s*candidateAppearance/);
  assert.match(source, /tripoPropAppearance = candidateAppearance/);
  assert.ok(source.indexOf('tripoPropAppearance = candidateAppearance') > source.indexOf('authoredPropLayer.addChild(display.container)'), 'native appearance is published only after the staged display mounts');
  assert.match(source, /nativePropOnscreenCount/);
  assert.match(source, /propIconUrl:/);
});

test('native appearance maps all twenty power-ups onto existing gameplay IDs, without new gameplay authority', async () => {
  const { createTripoPropAppearance } = await load(); const index = await legacyIndex(); const m = metadata(); const t = textures();
  const result = createTripoPropAppearance(m, t, index);
  const ids = ['block-reward','cold-storage','compound-interest','diamond-hands','gas-optimization','hard-fork-rounds','hardened-wallet','hot-wallet','layer-two','precision-ledger','proof-of-work','validator-training','bonus-life','berserk-candle','time-dilation','nuke-liquidation','hash-rail-core','lightning-ledger-cache','bear-market-burner-cache','forked-standard-cache'];
  for (const [i, id] of ids.entries()) {
    const item = result.get(id); assert.ok(item, id);
    assert.equal(item.sourceAssetId, `tripo-${String(i + 21).padStart(2, '0')}`);
    assert.equal(item.frame.assetId, item.sourceAssetId);
    const legacy = index.frameFor(id);
    assert.ok(Math.abs(item.frame.runtimeScale * item.frame.alphaBounds.w - legacy.runtimeScale * legacy.frame.w) < 1e-8, id);
    assert.equal(item.texture, t[m.frames[i + 20].page]);
    assert.equal(item.frame.damage, undefined); assert.equal(item.frame.collisionProxy, undefined);
  }
  assert.equal(result.has('coin-blaster'), false, 'held weapons must retain their independent existing contract');
});

test('native appearance caps tall silhouettes instead of stretching narrow views across the screen', async () => {
  const { createTripoPropAppearance } = await load(); const index = await legacyIndex(); const m = metadata();
  m.frames[32].alphaBounds = { x: 100, y: 20, w: 5, h: 200 };
  const item = createTripoPropAppearance(m, textures(), index).get('bonus-life'); const legacy = index.frameFor('bonus-life');
  assert.ok(item.frame.runtimeScale * item.frame.alphaBounds.h <= 2 * Math.max(legacy.frame.w, legacy.frame.h) * legacy.runtimeScale);
});

test('native appearance supplies validated per-item images for upgrade cards', async () => {
  const { createTripoPropAppearance } = await load(); const index = await legacyIndex(); const m = metadata();
  m.frames[32].itemImage = 'tripo-33.webp'; m.frames[32].itemSha256 = 'e'.repeat(64);
  assert.equal(createTripoPropAppearance(m, textures(), index).get('bonus-life').itemUrl, '/assets/generated/hmh-reboot-tripo-props/items/tripo-33.webp');
  m.frames[32].itemImage = 'tripo-34.webp'; assert.throws(() => createTripoPropAppearance(m, textures(), index));
});

test('native loader fetches the real atlas pages and rejects unsafe paths before texture loading', async () => {
  const { loadTripoPropAppearance } = await load(); assert.equal(typeof loadTripoPropAppearance, 'function');
  const index = await legacyIndex(); const m = metadata(); const calls = [];
  const fetcher = async (url) => { calls.push(url); return { ok: true, json: async () => m }; };
  const textureLoader = async (url) => { calls.push(url); return textures()[0]; };
  const result = await loadTripoPropAppearance(index, textureLoader, fetcher);
  assert.ok(result.has('bonus-life')); assert.deepEqual(calls, ['/assets/generated/hmh-reboot-tripo-props/hmh-tripo-props.json', '/assets/generated/hmh-reboot-tripo-props/tripo-props-00.webp', '/assets/generated/hmh-reboot-tripo-props/tripo-props-01.webp']);
  calls.length = 0; m.pages[0].image = '../outside.webp';
  await assert.rejects(loadTripoPropAppearance(index, textureLoader, fetcher)); assert.equal(calls.length, 1);
});

test('native appearance keeps mappings and coordinates immutable after caller metadata changes', async () => {
  const { createTripoPropAppearance } = await load(); const m = metadata();
  const map = createTripoPropAppearance(m, textures(), await legacyIndex()); const item = map.get('bonus-life');
  const original = item.frame.frame.w; m.frames[32].frame.w = 1; m.frames[32].anchor.y = 0;
  assert.equal(item.frame.frame.w, original); assert.equal(item.frame.anchor.y, 0.8);
  assert.ok(Object.isFrozen(item.frame)); assert.ok(Object.isFrozen(item.frame.frame)); assert.ok(Object.isFrozen(item.frame.anchor));
});

test('native appearance rejects candidates, incomplete rosters and cross-owned source IDs', async () => {
  const { createTripoPropAppearance } = await load(); const index = await legacyIndex();
  for (const mutate of [m => { m.classification = 'native-render-candidate'; }, m => { m.frames.pop(); }, m => { m.frames[0].assetId = 'tripo-02'; }, m => { m.frames[0].sourceId = '1'; }, m => { m.frames[0] = m.frames[1]; }]) {
    const m = metadata(); mutate(m); assert.throws(() => createTripoPropAppearance(m, textures(), index));
  }
});

test('native appearance rejects missing textures, page traversal, cropped-out pivots and invalid geometry', async () => {
  const { createTripoPropAppearance } = await load(); const index = await legacyIndex();
  for (const mutate of [m => { m.pages[0].image = '../outside.webp'; }, m => { m.frames[0].frame.x = 2040; }, m => { m.frames[0].page = 2; }, m => { m.frames[0].anchor.y = 1.1; }, m => { m.frames[0].alphaBounds.w = 0; }, m => { m.frames[0].sourcePixelSha256 = 'bad'; }]) {
    const m = metadata(); mutate(m); assert.throws(() => createTripoPropAppearance(m, textures(), index));
  }
  assert.throws(() => createTripoPropAppearance(metadata(), [], index));
  assert.throws(() => createTripoPropAppearance(metadata(), [{ source: { width: 1024, height: 2048 } }, textures()[1]], index));
});
