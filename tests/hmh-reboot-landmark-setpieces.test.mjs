import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  buildAuthoredDistrictLandmarkPlacements,
  createAuthoredPropAtlasIndex,
} from '../apps/hmh-reboot/src/authored-prop-atlas.mjs';

const root = new URL('../', import.meta.url);
const sourceManifestUrl = new URL('apps/hmh-reboot/assets/source/blender/hmh-authored-props.json', root);
const generatedManifestUrl = new URL('apps/portal/assets/generated/hmh-reboot-authored-props/hmh-authored-props-atlas.json', root);
const mainUrl = new URL('apps/hmh-reboot/src/main.mjs', root);

const SETPIECES = Object.freeze([
  ['frontier-relay', 'relay-tower-setpiece'],
  ['rugpull-ravine', 'forked-spire-setpiece'],
  ['liquidity-crossing', 'proof-bridge-setpiece'],
  ['hashwood', 'hashwood-beacon-setpiece'],
  ['mining-camp', 'mining-headframe-setpiece'],
  ['liquidation-yard', 'liquidation-tower-setpiece'],
]);

const readJson = async (url) => JSON.parse(await readFile(url, 'utf8'));

test('A9 authors one deterministic multi-part Blender set-piece per district', async () => {
  const manifest = await readJson(sourceManifestUrl);
  const generated = await readJson(generatedManifestUrl);
  assert.equal(manifest.assets.length, 101);
  assert.equal(generated.assetCount, 101);
  const index = createAuthoredPropAtlasIndex(generated);
  const sourceById = new Map(manifest.assets.map((asset) => [asset.assetId, asset]));
  for (const [landmarkId, assetId] of SETPIECES) {
    const asset = sourceById.get(assetId);
    assert.equal(asset?.shape, assetId);
    assert.equal(asset?.moduleFamily, 'landmark-setpiece');
    assert.equal(asset?.landmarkId, landmarkId);
    assert.equal(asset?.runtimeAuthority, 'projection-only');
    assert.equal(asset?.category, 'world-prop');
    const frame = index.frameById.get(assetId);
    assert.equal(frame?.moduleFamily, 'landmark-setpiece');
    assert.equal(frame?.landmarkId, landmarkId);
  }
});

test('A9 centers set-pieces and preserves an outer dressing-free breathing ring', () => {
  const placements = buildAuthoredDistrictLandmarkPlacements({ worldId: 'forked-frontier' });
  assert.equal(placements.length, 42);
  for (const [districtId, assetId] of SETPIECES) {
    const district = placements.filter((placement) => placement.districtId === districtId);
    assert.equal(district.length, 7);
    const center = district.find((placement) => placement.assetId === assetId);
    assert.equal(center?.anchorDistance, 0);
    assert.equal(center?.scale, 1);
    assert.equal(center?.runtimeAuthority, 'projection-only');
    const satellites = district.filter((placement) => placement !== center);
    assert.equal(satellites.length, 6);
    assert.ok(satellites.every((placement) => placement.anchorDistance >= 400));
  }
});

test('A9 retains procedural landmarks until authored atlas creation succeeds', async () => {
  const main = await readFile(mainUrl, 'utf8');
  const creation = main.indexOf('createAuthoredPropDisplay({');
  const attachment = main.indexOf('authoredPropLayer.addChild(display.container)', creation);
  const handoff = main.indexOf('worldProduction.layers.landmarks.visible = false', creation);
  assert.ok(creation >= 0 && attachment > creation && handoff > attachment, 'fallback landmark layer may hide only after authored display attachment');
});
