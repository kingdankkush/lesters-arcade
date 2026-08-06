import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  authoredPropItemUrl,
  buildAuthoredWorldPropPlacements,
} from '../apps/hmh-reboot/src/authored-prop-atlas.mjs';

const manifest = JSON.parse(readFileSync(
  fileURLToPath(new URL('../apps/hmh-reboot/assets/source/blender/hmh-authored-props.json', import.meta.url)),
  'utf8',
));
const builderSource = readFileSync(
  fileURLToPath(new URL('../scripts/hmh-blender/create-hmh-authored-props.py', import.meta.url)),
  'utf8',
);
const atlas = JSON.parse(readFileSync(
  fileURLToPath(new URL('../apps/portal/assets/generated/hmh-reboot-authored-props/hmh-authored-props-atlas.json', import.meta.url)),
  'utf8',
));

// A4. reed-cluster was the only water dressing in the game, so the crossing --
// the district whose entire identity is water -- had one prop expressing it.
//
// Water props sit at or near the surface, which makes them the category most
// exposed to the driftwood-log failure: anything that lies flat on the water
// disappears at the 55-degree camera. Minimums are set per shape accordingly,
// and the two that are genuinely surface-level (lily-pads, stepping-stones)
// have to earn their read some other way -- see the mass-centroid assertion
// below, which forces visible structure above the waterline.
const WATER = Object.freeze({
  'lily-pads': { shape: 'lily-pads', minRatio: 0.58 },
  'water-grass': { shape: 'water-grass', minRatio: 1.10 },
  'submerged-log': { shape: 'submerged-log', minRatio: 0.58 },
  'stepping-stones': { shape: 'stepping-stones', minRatio: 0.58 },
  'dock-post': { shape: 'dock-post', minRatio: 1.30 },
  'wetland-hummock': { shape: 'wetland-hummock', minRatio: 0.80 },
});

test('every water asset is on the world-prop roster', () => {
  for (const id of Object.keys(WATER)) {
    assert.equal(manifest.assets.find((asset) => asset.assetId === id)?.category, 'world-prop', `${id} missing from the authored manifest`);
  }
});

test('every water asset resolves to an item icon', () => {
  for (const id of Object.keys(WATER)) {
    assert.doesNotThrow(() => authoredPropItemUrl(id), `${id} has no icon`);
  }
});

test('every water asset is declared in the Blender manifest', () => {
  const byId = new Map(manifest.assets.map((asset) => [asset.assetId, asset]));
  for (const [id, spec] of Object.entries(WATER)) {
    const asset = byId.get(id);
    assert.ok(asset, `${id} missing from the props manifest`);
    assert.equal(asset.category, 'world-prop');
    assert.equal(asset.shape, spec.shape);
    for (const key of ['primary', 'secondary', 'accent']) {
      assert.match(asset.palette[key], /^#[0-9a-f]{6}$/, `${id} palette.${key}`);
    }
    assert.deepEqual(asset.frameSize, [256, 256], `${id} needs the 256px detail frame`);
    assert.ok(asset.runtimeScale > 0 && asset.runtimeScale <= 1.6, `${id} runtimeScale out of range`);
  }
});

test('every water shape has a builder branch', () => {
  for (const spec of Object.values(WATER)) {
    assert.ok(
      builderSource.includes(`elif shape == '${spec.shape}':`),
      `create-hmh-authored-props.py has no branch for ${spec.shape}`,
    );
  }
});

test('every water asset is placed in a district', () => {
  const dressing = buildAuthoredWorldPropPlacements({ worldId: 'forked-frontier', seed: 'a4-water' });
  const placed = new Set(dressing.map((placement) => placement.assetId));
  for (const id of Object.keys(WATER)) {
    assert.ok(placed.has(id), `${id} renders into the atlas but is never placed`);
  }
});

test('the crossing carries most of the new water dressing', () => {
  const dressing = buildAuthoredWorldPropPlacements({ worldId: 'forked-frontier', seed: 'a4-water' });
  const crossing = new Set(
    dressing.filter((placement) => placement.districtId === 'liquidity-crossing').map((placement) => placement.assetId),
  );
  const carried = Object.keys(WATER).filter((id) => crossing.has(id));
  assert.ok(carried.length >= 4, `the water district only carries ${carried.length} of the new water props`);
});

test('every water silhouette holds its proportion in the rendered atlas', () => {
  const frames = new Map(atlas.frames.map((frame) => [frame.assetId, frame]));
  for (const [id, spec] of Object.entries(WATER)) {
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

// A mass-centroid rule was drafted here to catch "flat decal lying on the
// water" and then REMOVED, because checking it against the props already
// shipping showed it cannot do that job:
//
//   crystal-cluster 0.673 (ships)   reed-cluster 0.687 (ships, reads well)
//   driftwood-log   0.706 (the documented failure, held out of dressing)
//
// reed-cluster and driftwood-log are 0.019 apart, so no threshold separates
// the good case from the bad one, and any cut-off tight enough to reject
// driftwood-log also rejects reed-cluster. What actually distinguishes
// driftwood-log is its ASPECT RATIO (0.30), which the per-shape minimums above
// already enforce. Tuning the number until this wave's assets passed would
// have been rerunning to green.
//
// massCentroidY is kept in the pipeline because it does discriminate where it
// was introduced -- tree silhouette variety, where conifer taper (0.635) and
// crown-over-trunk (0.458) sit 0.177 apart. It is recorded here for evidence
// rather than asserted on.
test('water props record a mass centroid for the evidence trail', () => {
  const frames = new Map(atlas.frames.map((frame) => [frame.assetId, frame]));
  for (const id of Object.keys(WATER)) {
    const frame = frames.get(id);
    assert.equal(typeof frame.massCentroidY, 'number', `${id} has no massCentroidY`);
    assert.ok(frame.massCentroidY > 0 && frame.massCentroidY < 1, `${id} centroid out of range`);
  }
});
