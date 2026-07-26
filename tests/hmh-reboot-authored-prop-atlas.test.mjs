import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  AUTHORED_PROP_ASSETS,
  AUTHORED_PROP_PIPELINE_ID,
  authoredPropItemUrl,
  buildAuthoredPointOfInterestPlacements,
  buildAuthoredWorldPropPlacements,
  createAuthoredHeldWeaponDisplay,
  createAuthoredPropAtlasIndex,
  createAuthoredPropDisplay,
} from '../apps/hmh-reboot/src/authored-prop-atlas.mjs';
import { LEVEL_ONE_WORLD } from '../apps/hmh-reboot/src/level-one-world.mjs';

const metadataUrl = new URL('../apps/portal/assets/generated/hmh-reboot-authored-props/hmh-authored-props-atlas.json', import.meta.url);
const loadMetadata = async () => JSON.parse(await readFile(metadataUrl, 'utf8'));

class FakePoint {
  set(x, y = x) { this.x = x; this.y = y; }
}
class FakeContainer {
  constructor() { this.children = []; this.position = new FakePoint(); this.scale = new FakePoint(); this.visible = true; }
  addChild(...children) { this.children.push(...children); return children.at(-1); }
}
class FakeSprite {
  constructor({ texture }) { this.texture = texture; this.anchor = new FakePoint(); this.position = new FakePoint(); this.scale = new FakePoint(); this.visible = true; }
}
class FakeTexture { constructor(options) { Object.assign(this, options); } }
class FakeRectangle { constructor(x, y, width, height) { Object.assign(this, { x, y, width, height }); } }
const fakeAtlasTexture = { source: { id: 'authored-prop-source' } };

test('authored prop metadata is complete, projection-only, and provenance-bearing', async () => {
  const metadata = await loadMetadata();
  const index = createAuthoredPropAtlasIndex(metadata);
  assert.equal(index.pipelineId, AUTHORED_PROP_PIPELINE_ID);
  assert.equal(index.runtimeAuthority, 'projection-only');
  assert.equal(index.frameById.size, 29);
  for (const assetId of Object.values(AUTHORED_PROP_ASSETS).flat()) {
    const frame = index.frameFor(assetId);
    assert.equal(frame.assetId, assetId);
    assert.match(frame.sourcePixelSha256, /^[0-9a-f]{64}$/u);
    assert.ok(frame.runtimeScale > 0);
    assert.equal(authoredPropItemUrl(assetId), `/assets/generated/hmh-reboot-authored-props/items/${assetId}.png`);
  }
  assert.throws(() => authoredPropItemUrl('fake-prop'), /unknown authored prop/);
});

test('authored world dressing and gameplay POIs are deterministic and bounded', () => {
  const first = buildAuthoredWorldPropPlacements({ worldId: 'forked-frontier', seed: 0x484d4807, countPerDistrict: 8 });
  const second = buildAuthoredWorldPropPlacements({ worldId: 'forked-frontier', seed: 0x484d4807, countPerDistrict: 8 });
  assert.deepEqual(first, second);
  assert.equal(first.length, 48);
  assert.equal(new Set(first.map((placement) => placement.districtId)).size, 6);
  assert.ok(first.every((placement) => placement.x >= 0 && placement.x <= 12_000 && placement.y >= 0 && placement.y <= 4_800));
  const pointsOfInterest = buildAuthoredPointOfInterestPlacements(LEVEL_ONE_WORLD.pointsOfInterest);
  assert.equal(pointsOfInterest.length, 9);
  assert.deepEqual(new Set(pointsOfInterest.map((placement) => placement.assetId)), new Set([...AUTHORED_PROP_ASSETS.weapons, ...AUTHORED_PROP_ASSETS.pickups]));
  assert.deepEqual(pointsOfInterest.map(({ pointOfInterestId, hook, x, y }) => ({ pointOfInterestId, hook, x, y })), LEVEL_ONE_WORLD.pointsOfInterest.map((point) => ({ pointOfInterestId: point.id, hook: point.hook, x: point.anchor.x, y: point.anchor.y })));
  assert.ok(pointsOfInterest.every((placement) => placement.category === 'point-of-interest' && placement.runtimeAuthority === 'projection-only'));
});

test('authored prop display creates real sprites, culls, grounds, and never changes placement data', async () => {
  const index = createAuthoredPropAtlasIndex(await loadMetadata());
  const placements = Object.freeze([...buildAuthoredWorldPropPlacements({ worldId: 'forked-frontier', seed: 7, countPerDistrict: 1 }), ...buildAuthoredPointOfInterestPlacements(LEVEL_ONE_WORLD.pointsOfInterest)]);
  const before = JSON.stringify(placements);
  const display = createAuthoredPropDisplay({ index, atlasTexture: fakeAtlasTexture, placements, ContainerClass: FakeContainer, SpriteClass: FakeSprite, TextureClass: FakeTexture, RectangleClass: FakeRectangle });
  assert.equal(display.entries.length, 15);
  const report = display.render({
    camera: { zoom: 1 },
    view: { width: 12_000, height: 4_800 },
    worldToScreen: (point) => ({ x: point.x, y: point.y - point.z }),
    queryGround: () => ({ groundZ: 0 }),
    tick: 42,
  });
  assert.equal(report.placementCount, 15);
  assert.ok(report.visibleCount > 0);
  assert.equal(JSON.stringify(placements), before, 'render projection cannot mutate deterministic placements');
  assert.ok(display.entries.every((entry) => entry.sprite.productionAssetId === entry.placement.assetId));
});

test('held weapon display can select all four authored weapons', async () => {
  const index = createAuthoredPropAtlasIndex(await loadMetadata());
  const display = createAuthoredHeldWeaponDisplay({ index, atlasTexture: fakeAtlasTexture, ContainerClass: FakeContainer, SpriteClass: FakeSprite, TextureClass: FakeTexture, RectangleClass: FakeRectangle });
  for (const weaponId of AUTHORED_PROP_ASSETS.weapons) {
    const frame = display.container.applyWeapon({ weaponId, screen: { x: 100, y: 100 }, aimScreen: { x: 180, y: 140 }, cameraZoom: 1 });
    assert.equal(frame.assetId, weaponId);
    assert.equal(display.container.productionAssetId, weaponId);
    assert.equal(display.container.visible, true);
  }
  assert.equal(display.container.applyWeapon({ weaponId: 'fake' }), null);
  assert.equal(display.container.visible, false);
});
