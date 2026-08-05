import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  AUTHORED_PROP_ASSETS,
  AUTHORED_PROP_ASSET_IDS,
  authoredPropItemUrl,
  buildAuthoredWorldPropPlacements,
} from '../apps/hmh-reboot/src/authored-prop-atlas.mjs';

const repoUrl = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const manifest = JSON.parse(readFileSync(repoUrl('apps/hmh-reboot/assets/source/blender/hmh-authored-props.json'), 'utf8'));
const builderSource = readFileSync(repoUrl('scripts/hmh-blender/create-hmh-authored-props.py'), 'utf8');
const atlas = JSON.parse(readFileSync(repoUrl('apps/portal/assets/generated/hmh-reboot-authored-props/hmh-authored-props-atlas.json'), 'utf8'));

// A5. The proof-of-work bridge was a walkable surface plus two rail blockers
// and one bollard, so the map's signature crossing had almost no authored
// structure on it. This is the kit that makes it read as built.
//
// Bridge parts split into two classes, and the first pass got this wrong by
// treating them all as upright.
//
// UPRIGHT parts (pier, sign) stand on their own and carry the high minimum the
// rest of the library uses. SPAN parts (truss, handrail, rope anchor, deck)
// carry load ACROSS a gap -- a truss with h/w >= 0.95 is a tower, not a truss,
// and a handrail whose rails do not run off the prop is a fencepost. Forcing
// the upright floor onto them would have meant authoring the wrong objects.
//
// The span floor is 0.62, which is not a number chosen to fit this wave: it is
// granite-boulder, the shipping reference this program has used since A3, and
// it sits well clear of driftwood-log's 0.30 failure. plank-deck-broken
// measured 0.36 on the first pass -- below the span floor and near the known
// failure -- so its GEOMETRY moved rather than its threshold.
const SPAN_FLOOR = 0.62;
const BRIDGE = Object.freeze({
  'bridge-pier': { shape: 'bridge-pier', minRatio: 1.05, kind: 'upright' },
  'bridge-warning-sign': { shape: 'bridge-warning-sign', minRatio: 1.20, kind: 'upright' },
  'bridge-truss': { shape: 'bridge-truss', minRatio: SPAN_FLOOR, kind: 'span' },
  'handrail-post': { shape: 'handrail-post', minRatio: SPAN_FLOOR, kind: 'span' },
  'rope-bridge-anchor': { shape: 'rope-bridge-anchor', minRatio: SPAN_FLOOR, kind: 'span' },
  'plank-deck-broken': { shape: 'plank-deck-broken', minRatio: SPAN_FLOOR, kind: 'span' },
});

test('no bridge part is allowed below the shipping reference proportion', () => {
  // Guards the classification itself: a future part cannot be filed as a span
  // to escape the floor, because the floor is the same for both classes.
  for (const spec of Object.values(BRIDGE)) {
    assert.ok(spec.minRatio >= SPAN_FLOOR, `${spec.shape} is allowed below the shipping reference`);
  }
});

test('every bridge asset is on the world-prop roster', () => {
  for (const id of Object.keys(BRIDGE)) {
    assert.ok(AUTHORED_PROP_ASSETS.worldProps.includes(id), `${id} missing from worldProps`);
    assert.ok(AUTHORED_PROP_ASSET_IDS.includes(id), `${id} missing from the asset id list`);
  }
});

test('every bridge asset resolves to an item icon', () => {
  for (const id of Object.keys(BRIDGE)) {
    assert.doesNotThrow(() => authoredPropItemUrl(id), `${id} has no icon`);
  }
});

test('every bridge asset is declared in the Blender manifest', () => {
  const byId = new Map(manifest.assets.map((asset) => [asset.assetId, asset]));
  for (const [id, spec] of Object.entries(BRIDGE)) {
    const asset = byId.get(id);
    assert.ok(asset, `${id} missing from the props manifest`);
    assert.equal(asset.category, 'world-prop');
    assert.equal(asset.shape, spec.shape);
    for (const key of ['primary', 'secondary', 'accent']) {
      assert.match(asset.palette[key], /^#[0-9a-f]{6}$/, `${id} palette.${key}`);
    }
    assert.deepEqual(asset.frameSize, [256, 256], `${id} needs the 256px detail frame`);
  }
});

test('every bridge shape has a builder branch', () => {
  for (const spec of Object.values(BRIDGE)) {
    assert.ok(
      builderSource.includes(`elif shape == '${spec.shape}':`),
      `create-hmh-authored-props.py has no branch for ${spec.shape}`,
    );
  }
});

test('every bridge asset is placed in a district', () => {
  const dressing = buildAuthoredWorldPropPlacements({ worldId: 'forked-frontier', seed: 'a5-bridges' });
  const placed = new Set(dressing.map((placement) => placement.assetId));
  for (const id of Object.keys(BRIDGE)) {
    assert.ok(placed.has(id), `${id} renders into the atlas but is never placed`);
  }
});

// The crossing is the district the bridge belongs to; the ravine is where the
// rope kit spans the drop. Both must actually receive parts or the kit is
// decoration filed in the wrong place.
test('the crossing and the ravine both receive bridge structure', () => {
  const dressing = buildAuthoredWorldPropPlacements({ worldId: 'forked-frontier', seed: 'a5-bridges' });
  const inDistrict = (districtId) => new Set(
    dressing.filter((placement) => placement.districtId === districtId).map((placement) => placement.assetId),
  );
  const crossing = inDistrict('liquidity-crossing');
  const ravine = inDistrict('rugpull-ravine');
  const bridgeIds = Object.keys(BRIDGE);
  assert.ok(bridgeIds.filter((id) => crossing.has(id)).length >= 3, 'the crossing carries too little bridge structure');
  assert.ok(bridgeIds.some((id) => ravine.has(id)), 'the ravine drop got no bridge structure');
});

test('every bridge silhouette holds its proportion in the rendered atlas', () => {
  const frames = new Map(atlas.frames.map((frame) => [frame.assetId, frame]));
  for (const [id, spec] of Object.entries(BRIDGE)) {
    const frame = frames.get(id);
    assert.ok(frame, `${id} is not in the packed atlas`);
    const ratio = frame.frame.h / frame.frame.w;
    assert.ok(
      ratio >= spec.minRatio,
      `${id} renders ${frame.frame.w}x${frame.frame.h} (h/w ${ratio.toFixed(2)}, needs ${spec.minRatio})`,
    );
    assert.ok(frame.opaquePixels > 400, `${id} has only ${frame.opaquePixels} opaque pixels`);
  }
});

// A pier, a truss and a post are all "upright grey structure" at a glance.
// If they share proportions AND mass distribution they read as one repeated
// object, which defeats the point of authoring a kit.
test('the bridge parts are silhouette-distinct from each other', () => {
  const frames = new Map(atlas.frames.map((frame) => [frame.assetId, frame]));
  const ids = Object.keys(BRIDGE);
  for (let i = 0; i < ids.length; i += 1) {
    for (let k = i + 1; k < ids.length; k += 1) {
      const a = frames.get(ids[i]);
      const b = frames.get(ids[k]);
      const ratioGap = Math.abs(a.frame.h / a.frame.w - b.frame.h / b.frame.w);
      const centroidGap = Math.abs(a.massCentroidY - b.massCentroidY);
      assert.ok(
        ratioGap > 0.08 || centroidGap > 0.06,
        `${ids[i]} and ${ids[k]} share a silhouette (ratio gap ${ratioGap.toFixed(3)}, centroid gap ${centroidGap.toFixed(3)})`,
      );
    }
  }
});
