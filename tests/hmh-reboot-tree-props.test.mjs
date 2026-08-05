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

// A1. The first tree generation was four conifer-ish shapes (hashwood-pine,
// hashwood-tree, dead-pine, hashwood-stump), so a forest read as one species
// repeated. This wave adds silhouette variety: a pale multi-stem cluster, a
// low sapling thicket, a burned snag, an asymmetric canopy-edge tree for
// treelines, and a fallen trunk with a VERTICAL root plate.
//
// Trees are the tallest dressing in the world, so their minimums are higher
// than the rock wave's. fallen-trunk is the exception and carries the
// driftwood-log warning directly: a horizontal log is the shape that failed
// three passes, so its root plate has to do the vertical work.
const TREES = Object.freeze({
  'birch-cluster': { shape: 'birch-cluster', minRatio: 1.30 },
  'sapling-thicket': { shape: 'sapling-thicket', minRatio: 0.90 },
  'burned-snag': { shape: 'burned-snag', minRatio: 1.40 },
  'canopy-edge-tree': { shape: 'canopy-edge-tree', minRatio: 1.00 },
  'fallen-trunk': { shape: 'fallen-trunk', minRatio: 0.62 },
});

test('every tree asset is on the world-prop roster', () => {
  for (const id of Object.keys(TREES)) {
    assert.ok(AUTHORED_PROP_ASSETS.worldProps.includes(id), `${id} missing from worldProps`);
    assert.ok(AUTHORED_PROP_ASSET_IDS.includes(id), `${id} missing from the asset id list`);
  }
});

test('every tree asset resolves to an item icon', () => {
  for (const id of Object.keys(TREES)) {
    assert.doesNotThrow(() => authoredPropItemUrl(id), `${id} has no icon`);
  }
});

test('every tree asset is declared in the Blender manifest', () => {
  const byId = new Map(manifest.assets.map((asset) => [asset.assetId, asset]));
  for (const [id, spec] of Object.entries(TREES)) {
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

test('every tree shape has a builder branch', () => {
  for (const spec of Object.values(TREES)) {
    assert.ok(
      builderSource.includes(`elif shape == '${spec.shape}':`),
      `create-hmh-authored-props.py has no branch for ${spec.shape}`,
    );
  }
});

test('every tree asset is placed in a district', () => {
  const dressing = buildAuthoredWorldPropPlacements({ worldId: 'forked-frontier', seed: 'a1-trees' });
  const placed = new Set(dressing.map((placement) => placement.assetId));
  for (const id of Object.keys(TREES)) {
    assert.ok(placed.has(id), `${id} renders into the atlas but is never placed`);
  }
});

test('the forest district actually receives new tree species', () => {
  const dressing = buildAuthoredWorldPropPlacements({ worldId: 'forked-frontier', seed: 'a1-trees' });
  const hashwood = new Set(
    dressing.filter((placement) => placement.districtId === 'hashwood').map((placement) => placement.assetId),
  );
  const added = Object.keys(TREES).filter((id) => hashwood.has(id));
  assert.ok(added.length >= 2, `hashwood only received ${added.length} of the new tree species`);
});

test('every tree silhouette holds its proportion in the rendered atlas', () => {
  const frames = new Map(atlas.frames.map((frame) => [frame.assetId, frame]));
  for (const [id, spec] of Object.entries(TREES)) {
    const frame = frames.get(id);
    assert.ok(frame, `${id} is not in the packed atlas`);
    const ratio = frame.frame.h / frame.frame.w;
    assert.ok(
      ratio >= spec.minRatio,
      `${id} renders ${frame.frame.w}x${frame.frame.h} (h/w ${ratio.toFixed(2)}, needs ${spec.minRatio})`,
    );
    assert.ok(frame.opaquePixels > 500, `${id} has only ${frame.opaquePixels} opaque pixels`);
  }
});

// The point of this wave is variety. Two trees that share a silhouette read as
// the same tree at gameplay zoom however their materials differ.
//
// Aspect ratio alone is not enough to judge that, and using it alone produced
// a false failure: sapling-thicket (1.45) and canopy-edge-tree (1.52) are
// obviously different to the eye -- pointed conifers versus a crown on a bare
// trunk -- but sit 0.07 apart on ratio. So the pipeline now records
// massCentroidY, the vertical centre of the silhouette's mass, which is the
// cheapest measure that separates those two shapes: a conifer tapers to a
// point and carries its mass low (0.635), a canopy tree carries a crown over
// a thin trunk (0.458).
//
// A pair is distinct if it differs on EITHER axis. Requiring both would
// reject legitimately different trees that happen to agree on one measure.
const MIN_RATIO_GAP = 0.08;
const MIN_CENTROID_GAP = 0.06;

test('the new trees are silhouette-distinct from each other and the originals', () => {
  const frames = new Map(atlas.frames.map((frame) => [frame.assetId, frame]));
  const existing = ['hashwood-pine', 'hashwood-tree', 'dead-pine', 'hashwood-stump'];
  const shapes = new Map();
  for (const id of [...Object.keys(TREES), ...existing]) {
    const frame = frames.get(id);
    assert.ok(frame, `${id} missing from the atlas`);
    assert.equal(typeof frame.massCentroidY, 'number', `${id} has no massCentroidY`);
    shapes.set(id, { ratio: frame.frame.h / frame.frame.w, centroid: frame.massCentroidY });
  }
  for (const id of Object.keys(TREES)) {
    const mine = shapes.get(id);
    for (const [other, theirs] of shapes) {
      if (other === id) continue;
      const ratioGap = Math.abs(mine.ratio - theirs.ratio);
      const centroidGap = Math.abs(mine.centroid - theirs.centroid);
      assert.ok(
        ratioGap > MIN_RATIO_GAP || centroidGap > MIN_CENTROID_GAP,
        `${id} and ${other} share a silhouette: ratio gap ${ratioGap.toFixed(3)} `
        + `and mass-centroid gap ${centroidGap.toFixed(3)} are both too small`,
      );
    }
  }
});
