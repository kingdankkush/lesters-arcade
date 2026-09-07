import assert from 'node:assert/strict';
import test from 'node:test';
import { ROOT_LOGICAL_HEIGHT, applyRootFit, fitRootToViewport } from '../apps/stacked/src/render/root-fit.mjs';

test('root fit is uniform, full-height and resize changes only transform fields', () => {
  const first = fitRootToViewport({ widthPx: 1280, heightPx: 720 });
  assert.equal(first.logicalHeight, ROOT_LOGICAL_HEIGHT);
  assert.equal(first.scale, 0.72);
  assert.equal(first.logicalWidth, 1280 / 0.72);
  assert(Object.isFrozen(first) && Object.isFrozen(first.originPx));
  const root = { scale: { set(x, y) { this.x = x; this.y = y; } }, position: { set(x, y) { this.x = x; this.y = y; } }, untouched: 7 };
  applyRootFit(root, first);
  assert.deepEqual([root.scale.x, root.scale.y, root.position.x, root.position.y, root.untouched], [0.72,0.72,640,360,7]);
});

