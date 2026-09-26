// Prints, as JSON, a lineup of every obstacle kind a region can spawn, laid out
// with the runtime's own layoutObstacleArt() and tintRects(), so the Python
// review plates (scripts/build-chikun-obstacle-review.py) composite exactly the
// draws the game makes. Obstacles use full-difficulty geometry (lap 2).
import { CHIKUN_REGIONS, REGION_START_SLOTS } from '../../apps/portal/src/chikun-course-regions.mjs';
import { buildCourseObstacle } from '../../apps/portal/src/chikun-ground-course.mjs';
import { layoutObstacleArt, tintRects } from '../../apps/chikun/src/obstacle-art.mjs';

const TICK = 1234;
const out = {};
CHIKUN_REGIONS.forEach((region, r) => {
  const kinds = [...new Set([...region.passages.flat(), ...region.low.kinds])];
  // ground kinds first in passage order, flyers placed over the ground props
  const ground = kinds.filter(k => !['drone', 'plane', 'hawk', 'eagle', 'pelican'].includes(k));
  const flyers = kinds.filter(k => ['drone', 'plane', 'hawk', 'eagle', 'pelican'].includes(k));
  const items = [];
  let x = 380;
  for (const kind of ground) {
    const o = buildCourseObstacle({ seed: 3, index: REGION_START_SLOTS[r] + 48 + items.length, tick: TICK, x, kind });
    items.push({ o, ops: layoutObstacleArt(o, { tick: TICK }).map(p => ({ ...p })), tint: tintRects(o).map(t => [...t]) });
    x += o.width + (o.family === 'gap' ? 90 : 70);
  }
  const width = Math.ceil(x + 60);
  flyers.forEach((kind, i) => {
    const fx = 420 + (i + 0.5) * (width - 600) / flyers.length;
    const o = buildCourseObstacle({ seed: 3, index: REGION_START_SLOTS[r] + 60 + i, tick: TICK, x: fx, kind });
    items.push({ o, ops: layoutObstacleArt(o, { tick: TICK + i * 17 }).map(p => ({ ...p })), tint: [] });
  });
  out[region.id] = {
    width,
    obstacles: items.map(({ o, ops, tint }) => ({ kind: o.kind, variant: o.variant, family: o.family, x: o.x, y: o.y, width: o.width, height: o.height, shapes: o.shapes, ops, tint })),
  };
});
process.stdout.write(JSON.stringify(out));
