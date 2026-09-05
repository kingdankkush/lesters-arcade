import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  AUTHORED_LANDMARK_TOTAL,
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
  assert.equal(manifest.assets.length, 107);
  assert.equal(generated.assetCount, 107);
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

// W-6 (Cycle 074): a set-piece is composed, not a centre with six props 500
// units away. Satellites live INSIDE the 300-unit breathing ring (100-270 from
// the anchor); the ring is dressing-free, not landmark-free.
const SATELLITES = Object.freeze({ 'frontier-relay': 6, 'rugpull-ravine': 5, 'liquidity-crossing': 7, hashwood: 5, 'mining-camp': 6, 'liquidation-yard': 6 });

test('A9/W-6 centers set-pieces and composes their satellites inside the breathing ring', () => {
  const placements = buildAuthoredDistrictLandmarkPlacements({ worldId: 'forked-frontier' });
  assert.equal(placements.length, 41);
  assert.equal(AUTHORED_LANDMARK_TOTAL, 41);
  for (const [districtId, assetId] of SETPIECES) {
    const district = placements.filter((placement) => placement.districtId === districtId);
    assert.equal(district.length, 1 + SATELLITES[districtId], `${districtId} composition size`);
    const center = district.find((placement) => placement.assetId === assetId);
    assert.equal(center?.anchorDistance, 0);
    assert.equal(center?.scale, 1);
    assert.equal(center?.runtimeAuthority, 'projection-only');
    const satellites = district.filter((placement) => placement !== center);
    assert.equal(satellites.length, SATELLITES[districtId]);
    assert.ok(satellites.every((placement) => placement.anchorDistance >= 100 && placement.anchorDistance <= 270), `${districtId} satellites must sit inside the 300 ring`);
  }
});

test('A9 retains procedural landmarks until authored atlas creation succeeds', async () => {
  const main = await readFile(mainUrl, 'utf8');
  const creation = main.indexOf('createAuthoredPropDisplay({');
  const attachment = main.indexOf('authoredPropLayer.addChild(display.container)', creation);
  const handoff = main.indexOf('worldProduction.layers.landmarks.visible = false', creation);
  assert.ok(creation >= 0 && attachment > creation && handoff > attachment, 'fallback landmark layer may hide only after authored display attachment');
});
