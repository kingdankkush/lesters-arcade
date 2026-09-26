// Chikun child stock view (Weekly Jackpot design §B.4, §D.3, Appendix K AC2; not flag-gated): a CSS
// edit that widens the frame must not reveal more of the course. The landscape camera is capped at the
// stock 1,280 view (a wider box letterboxes) and the draw loop skips obstacles past the view edge plus
// 40 px. The stock 16:9 frame and every portrait size keep exactly the viewport they had.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { CHIKUN_DRAW_MARGIN_PX, CHIKUN_STOCK_VIEW_WIDTH, buildChikunViewport, chikunForkInView } from '../apps/chikun/src/viewport.mjs';
import { createChikunRuntime } from '../apps/portal/src/chikun-cabinet.mjs';
import { routePilot } from '../scripts/chikun-course-pilot.mjs';

// buildChikunViewport before the cap (apps/chikun/src/viewport.mjs at the jackpot-contracts merge).
function uncappedViewport(cssWidth, cssHeight, dpr = 1) {
  const height = 720;
  const width = height * Math.max(1, cssWidth) / Math.max(1, cssHeight);
  const portrait = width < height;
  const density = Math.min(2, Math.max(.5, cssHeight / height * Math.min(2, dpr)));
  return Object.freeze({ width, height, portrait, left: portrait ? 280 - width * .26 : 0,
    density, pixelWidth: Math.round(width * density), pixelHeight: Math.round(height * density) });
}

const BOXES = Object.freeze({
  '16:9': [1920, 1080],
  '21:9': [2520, 1080],
  '32:9': [3840, 1080],
  '4:3': [1440, 1080],
});

// Snapshots from real runs that hold obstacles far past the screen (the runtime keeps them out to
// about 1,850 px and more at speed).
function courseSnapshots() {
  const snapshots = [];
  for (const seed of [1, 7, 42]) {
    const run = createChikunRuntime({ seed, maxTicks: 60 * 60 * 3 });
    let snapshot = run.snapshot();
    for (let tick = 0; tick < 60 * 90 && !run.terminal; tick += 1) {
      snapshot = run.step({ flap: routePilot(snapshot) });
      if (tick % 15 === 0) snapshots.push(snapshot);
    }
  }
  return snapshots;
}

test('chikun child never draws obstacles beyond the stock view', () => {
  assert.equal(CHIKUN_STOCK_VIEW_WIDTH, 1280);
  assert.equal(CHIKUN_DRAW_MARGIN_PX, 40);
  const snapshots = courseSnapshots();
  const farthest = Math.max(...snapshots.flatMap((snapshot) => snapshot.forks.map((fork) => fork.x)));
  assert.ok(farthest > 1600, `the runtime holds obstacles past the screen (${Math.round(farthest)} px)`);
  for (const [name, [width, height]] of Object.entries(BOXES)) {
    for (const dpr of [1, 2]) {
      const view = buildChikunViewport(width, height, dpr);
      assert.equal(view.portrait, false, name);
      assert.equal(view.left, 0, name);
      assert.ok(view.width <= CHIKUN_STOCK_VIEW_WIDTH, `${name}: the camera never widens past the stock view`);
      assert.ok(view.pixelWidth / view.pixelHeight <= 16 / 9 + 0.01, `${name}: the canvas bitmap is at most 16:9 (a wider box letterboxes)`);
      let drawn = 0;
      for (const snapshot of snapshots) {
        for (const fork of snapshot.forks) {
          if (!chikunForkInView(fork, view)) continue;
          drawn += 1;
          assert.ok(fork.x <= 1320, `${name}: a fork at ${fork.x} px would be drawn`);
          assert.ok(fork.x <= view.left + view.width + CHIKUN_DRAW_MARGIN_PX);
        }
      }
      assert.ok(drawn > 50, `${name}: obstacles inside the view are still drawn`);
    }
  }
  // Without the cap a 32:9 box would have been a 2,560 px camera: 2x the look-ahead.
  assert.equal(uncappedViewport(3840, 1080).width, 2560);
  assert.equal(buildChikunViewport(3840, 1080).width, 1280);
  // Portrait culls at its own edge.
  const portrait = buildChikunViewport(390, 844, 1);
  assert.equal(chikunForkInView({ x: portrait.left + portrait.width + CHIKUN_DRAW_MARGIN_PX }, portrait), true);
  assert.equal(chikunForkInView({ x: portrait.left + portrait.width + CHIKUN_DRAW_MARGIN_PX + 1 }, portrait), false);

  // The child's draw loop draws obstacles only through the cull, and the canvas letterboxes.
  const main = readFileSync(new URL('../apps/chikun/src/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /for \(const fork of snapshot\?\.forks \?\? \[\]\) if \(chikunForkInView\(fork, flightViewport\)\) drawFork\(fork\);/);
  assert.equal((main.match(/drawFork\(/g) ?? []).length, 2, 'drawFork is defined once and called only from the culled loop');
  assert.match(main, /canvas\.style\.objectFit = 'contain';/);
});

test('buildChikunViewport is unchanged for the stock 16:9 frame and every portrait size', () => {
  const stock = [[1280, 720], [1920, 1080], [640, 360], [960, 540], [2560, 1440], [1024, 576]];
  const portraits = [[390, 844], [405, 720], [360, 640], [414, 896], [375, 667], [768, 1024], [720, 1280], [1080, 1920], [320, 568]];
  const landscapeNarrow = [[1024, 768], [1280, 800], [800, 600]];
  for (const [width, height] of [...stock, ...portraits, ...landscapeNarrow]) {
    for (const dpr of [1, 1.5, 2, 3]) {
      assert.deepEqual(buildChikunViewport(width, height, dpr), uncappedViewport(width, height, dpr), `${width}x${height}@${dpr}`);
    }
  }
  // Only boxes wider than 16:9 change, and only to the stock width.
  for (const [width, height] of [[2520, 1080], [3440, 1440], [1366, 700]]) {
    const view = buildChikunViewport(width, height, 1);
    assert.equal(view.width, 1280);
    assert.equal(view.height, 720);
    assert.equal(view.density, uncappedViewport(width, height, 1).density, 'density still follows the box height');
  }
});
