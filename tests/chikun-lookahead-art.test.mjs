// Look-ahead guard for the scenery: the portrait viewport clamp closes a cheat
// where a wider render would show upcoming obstacles. Backdrops, atmosphere and
// the light rig must therefore never read the obstacle list, and anything the
// ground draws for an obstacle must wait until that obstacle is inside the view.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecordingCanvas, createRecordingContext, summariseLog } from './chikun-recording-ctx.mjs';
import { buildChikunViewport } from '../apps/chikun/src/viewport.mjs';

globalThis.document ??= { createElement: () => createRecordingCanvas(1, 1) };
const { createChikunWorld } = await import('../apps/chikun/src/world.mjs');
const { drawGround } = await import('../apps/chikun/src/ground-world.mjs');

const VIEWS = { landscape: buildChikunViewport(1280, 720, 1), portrait: buildChikunViewport(390, 693, 3) };
const obstacle = (x, extra = {}) => ({ index: 7, kind: 'pit', family: 'gap', variant: 'pit', x, y: 690, width: 420, height: 30, passed: false, shapes: [], coin: { x: x + 200, y: 500, radius: 18, collected: false }, ...extra });
const snapshotAt = (tick, forks) => ({ tick, distancePixels: tick * 2.4 * 1.1, terrain: 'grass', chikun: { x: 280, y: 690, velocityY: 0, locomotion: 'run' }, forks, groundCoins: [] });

function worldLog(world, view, snapshot) {
  const canvas = createRecordingCanvas(view.pixelWidth, view.pixelHeight);
  const ctx = createRecordingContext(canvas, { transform: [view.density, 0, 0, view.density, -view.left * view.density, 0] });
  world.draw(ctx, snapshot, { view, mode: 'free', idleTime: 0 });
  return summariseLog(ctx.log);
}

test('the backdrop never depends on the obstacle list, in portrait or landscape', () => {
  for (const [name, view] of Object.entries(VIEWS)) {
    for (const tick of [0, 900, 2600, 2750, 6100, 16400]) {
      const world = createChikunWorld();
      worldLog(world, view, snapshotAt(tick, [])); // warm the sprite and gradient caches
      const bare = worldLog(world, view, snapshotAt(tick, []));
      const busy = worldLog(world, view, snapshotAt(tick, [obstacle(900), obstacle(1500, { kind: 'storm', family: 'sky', width: 280, height: 520 }), obstacle(3000)]));
      assert.deepEqual(busy, bare, `${name} tick ${tick}: world.draw read the obstacle list`);
      world.dispose();
    }
  }
});

test('the ground draws nothing for an obstacle that is still beyond the right edge of the view', () => {
  for (const [name, view] of Object.entries(VIEWS)) {
    const right = view.left + view.width;
    const log = forks => {
      const canvas = createRecordingCanvas(view.pixelWidth, view.pixelHeight);
      const ctx = createRecordingContext(canvas, { transform: [view.density, 0, 0, view.density, -view.left * view.density, 0] });
      drawGround(ctx, snapshotAt(3000, forks), { view });
      return summariseLog(ctx.log);
    };
    assert.deepEqual(log([obstacle(right + 1)]), log([]), `${name}: a gap just past the view edge changed the ground`);
    assert.deepEqual(log([obstacle(right + 700)]), log([]), `${name}: a far gap changed the ground`);
  }
});
