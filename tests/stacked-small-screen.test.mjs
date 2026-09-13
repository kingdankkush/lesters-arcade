import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutMatch, computeBoardRects } from '../apps/portal/src/stacked-layout.mjs';
test('real small viewports contain every full board instead of clamping scale to one', () => {
  for (const [width, height, count] of [[320,568,1],[900,500,2],[375,667,1]]) {
    const rects = computeBoardRects(layoutMatch({ viewportWidth: width, viewportHeight: height, boardCount: count }));
    for (const r of rects) assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.width <= width + .01 && r.y + r.height <= height + .01, JSON.stringify(r));
  }
});
