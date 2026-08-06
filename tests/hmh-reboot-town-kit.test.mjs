import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const manifestUrl = new URL('../apps/hmh-reboot/assets/source/blender/hmh-authored-props.json', import.meta.url);
const metadataUrl = new URL('../apps/portal/assets/generated/hmh-reboot-authored-props/hmh-authored-props-atlas.json', import.meta.url);
const builderUrl = new URL('../scripts/hmh-blender/create-hmh-authored-props.py', import.meta.url);
const loadJson = async (url) => JSON.parse(await readFile(url, 'utf8'));

const TOWN_KIT_IDS = Object.freeze([
  'awning-shopfront',
  'ruined-tenement',
  'corrugated-lean-to',
  'market-stall',
  'water-tower',
  'fuel-pump-island',
  'town-billboard',
  'porch-stoop',
  'chain-fence-gate',
  'streetlamp',
  'mailbox',
  'stacked-crates',
]);

test('A6 owns a complete modular town kit with shared scale and proxy metadata', async () => {
  const manifest = await loadJson(manifestUrl);
  const byId = new Map(manifest.assets.map((asset) => [asset.assetId, asset]));
  for (const assetId of TOWN_KIT_IDS) {
    const asset = byId.get(assetId);
    assert.ok(asset, `town kit asset ${assetId} is missing`);
    assert.equal(asset.category, 'world-prop');
    assert.equal(asset.moduleFamily, 'town-kit-v1');
    assert.ok(asset.districts.includes('liquidation-yard'));
    assert.deepEqual(asset.frameSize, [256, 256]);
    assert.ok(asset.runtimeScale >= 0.7 && asset.runtimeScale <= 1.4, `${assetId} scale is unbounded`);
    assert.ok(['box', 'circle'].includes(asset.collisionProxy?.type), `${assetId} lacks a supported proxy`);
    assert.ok(asset.collisionProxy.width > 0 && asset.collisionProxy.depth > 0, `${assetId} proxy is invalid`);
  }
  assert.ok(manifest.assets.length >= 94, 'later asset waves must retain the complete A6 roster');
});

test('A6 town kit resolves through the authored manifest and deterministic Blender builder', async () => {
  const builder = await readFile(builderUrl, 'utf8');
  const ids = new Set((await loadJson(manifestUrl)).assets.map((asset) => asset.assetId));
  for (const assetId of TOWN_KIT_IDS) assert.ok(ids.has(assetId));
  for (const shape of TOWN_KIT_IDS) assert.match(builder, new RegExp(`shape == ['\"]${shape}['\"]`));
});

test('A6 generated atlas preserves town proxy provenance and projection-only authority', async () => {
  const metadata = await loadJson(metadataUrl);
  assert.ok(metadata.assetCount >= 94, 'later generated waves must retain A6 frames');
  assert.equal(metadata.runtimeAuthority, 'projection-only');
  const byId = new Map(metadata.frames.map((frame) => [frame.assetId, frame]));
  for (const assetId of TOWN_KIT_IDS) {
    const frame = byId.get(assetId);
    assert.ok(frame, `generated town frame ${assetId} is missing`);
    assert.equal(frame.moduleFamily, 'town-kit-v1');
    assert.ok(frame.sourcePixelSha256?.length === 64);
    assert.ok(frame.frame.w > 0 && frame.frame.h > 0);
    assert.ok(frame.anchor.x >= 0 && frame.anchor.x <= 1);
    assert.ok(frame.anchor.y >= 0 && frame.anchor.y <= 1);
    assert.ok(frame.collisionProxy?.width > 0 && frame.collisionProxy?.depth > 0);
  }
});
