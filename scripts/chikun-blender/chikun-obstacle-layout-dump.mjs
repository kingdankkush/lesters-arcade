// Prints, as JSON, a lineup of every obstacle kind a region can spawn, laid out
// with the runtime's own layoutObstacleArt() and tintRects(), so the Python
// review plates (scripts/build-chikun-obstacle-review.py) composite exactly the
// draws the game makes. Obstacles use full-difficulty geometry (lap 2).
// Each op also carries its value separation (obstacle-separation.mjs, via the
// runtime's separationOf()) at the four review light keys (the landscape rig of
// chikun-rig-dump.mjs), as [mode, amount, wash colour, ratio, exposure, wash, deepen, deep colour].
import { CHIKUN_REGIONS, REGION_START_SLOTS, REGION_LOOP_SLOTS, regionForObstacle } from '../../apps/portal/src/chikun-course-regions.mjs';
import { buildCourseObstacle } from '../../apps/portal/src/chikun-ground-course.mjs';
import { layoutObstacleArt, tintRects, separationOf, separationDirection, obstacleRegion } from '../../apps/chikun/src/obstacle-art.mjs';
import { chikunSkyState, computeLightRig } from '../../apps/chikun/src/light-rig.mjs';
import { buildChikunViewport } from '../../apps/chikun/src/viewport.mjs';

// The same keys as chikun-rig-dump.mjs (seconds into the 180 s day).
const REVIEW_KEYS = { noon: 8, golden: 39, night: 90, dawn: 136 };
const landscape = buildChikunViewport(1280, 720, 1);
const rigs = CHIKUN_REGIONS.map((region, index) => Object.fromEntries(Object.entries(REVIEW_KEYS).map(([key, seconds]) => {
  const state = { index, nextIndex: (index + 1) % 7, region, next: CHIKUN_REGIONS[(index + 1) % 7], blend: 0 };
  return [key, JSON.parse(JSON.stringify(computeLightRig(chikunSkyState(seconds), state, landscape)))];
})));
function withSeparation(o, ops) {
  const region = obstacleRegion(o), r = CHIKUN_REGIONS.findIndex(x => x.id === region);
  return ops.map(p => ({ ...p, sep: Object.fromEntries(Object.entries(rigs[r]).map(([key, rig]) => {
    const s = separationOf(p, region, rig, {}, [...separationDirection(ops, region, rig)]);
    // [mode, amount, wash colour, modelled ratio, exposure alpha ('lighter' self-add), wash alpha, deepen alpha, deep colour]
    return [key, [s.mode, s.s, s.colour ? [...s.colour].map(v => Math.round(v)) : null, Math.round(s.ratio * 100) / 100, s.exposure, s.fill, s.deepen, [...s.deep]]];
  })) }));
}

const TICK = 1234;
// An obstacle index inside region r on lap 2 (full difficulty): the k-th of its
// slots, wrapping, so every lineup obstacle belongs to the region it is shown
// in (its art variant and its value separation follow the obstacle's region).
const slotIn = (r, k) => REGION_LOOP_SLOTS + REGION_START_SLOTS[r] + (k % CHIKUN_REGIONS[r].slots);
const out = {};
CHIKUN_REGIONS.forEach((region, r) => {
  const kinds = [...new Set([...region.passages.flat(), ...region.low.kinds])];
  // ground kinds first in passage order, flyers placed over the ground props
  const ground = kinds.filter(k => !['drone', 'plane', 'hawk', 'eagle', 'pelican'].includes(k));
  const flyers = kinds.filter(k => ['drone', 'plane', 'hawk', 'eagle', 'pelican'].includes(k));
  const items = [];
  let x = 380;
  for (const kind of ground) {
    const o = buildCourseObstacle({ seed: 3, index: slotIn(r, items.length), tick: TICK, x, kind });
    items.push({ o, ops: withSeparation(o, layoutObstacleArt(o, { tick: TICK })), tint: tintRects(o).map(t => [...t]) });
    x += o.width + (o.family === 'gap' ? 90 : 70);
  }
  const width = Math.ceil(x + 60);
  flyers.forEach((kind, i) => {
    const fx = 420 + (i + 0.5) * (width - 600) / flyers.length;
    const o = buildCourseObstacle({ seed: 3, index: slotIn(r, 12 + i), tick: TICK, x: fx, kind });
    items.push({ o, ops: withSeparation(o, layoutObstacleArt(o, { tick: TICK + i * 17 })), tint: [] });
  });
  out[region.id] = {
    width,
    obstacles: items.map(({ o, ops, tint }) => ({ kind: o.kind, variant: o.variant, region: regionForObstacle(o.index).region.id, family: o.family, x: o.x, y: o.y, width: o.width, height: o.height, shapes: o.shapes, ops, tint })),
  };
});
for (const [id, v] of Object.entries(out)) for (const o of v.obstacles) if (o.region !== id) throw new Error(`${id} lineup holds a ${o.region} obstacle`);
process.stdout.write(JSON.stringify(out));
