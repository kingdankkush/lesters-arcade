#!/usr/bin/env node
// Collision templates for the Chikun obstacle art (slice 2 of the visual upgrade).
//
//   node scripts/build-chikun-hitbox-templates.mjs [--check]
//
// Samples the canonical course (buildCourseObstacle, read-only) across seeds,
// indices and the difficulty ramp and writes, per obstacle kind, the collision
// shapes relative to the obstacle's anchor plus the range of every size the
// course can produce. The Blender kits (scripts/chikun-blender/obstacles) frame
// each module from this file and the packer measures coverage against it, so
// the art is built to the hitboxes instead of guessing them. The legacy
// open-air tree and drone (obstacle-shapes.json via buildChikunObstacle) are
// included for the alignment receipts of their shipped v1 sprites.
//
// Anchors: grounded kinds use x relative to o.x and absolute screen y (the
// running line is 690); flyers use x relative to o.x and y relative to o.y;
// canopy and storm hang from y = 0.
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildCourseObstacle, GROUND_SKY_KINDS, obstacleDifficulty } from '../apps/portal/src/chikun-ground-course.mjs';
import { buildChikunObstacle } from '../apps/portal/src/chikun-obstacles.mjs';
import geometry from '../apps/chikun/assets/obstacle-shapes.json' with { type: 'json' };

const OUT = fileURLToPath(new URL('./chikun-blender/obstacle-templates.json', import.meta.url));
const SEEDS = [1, 7, 42, 1337, 90210, 424242];
const INDICES = [0, 5, 11, 12, 20, 30, 40, 47, 48, 60, 96, 200];
const round = v => Math.round(v * 1000) / 1000;

function relShapes(o) {
  const dx = o.x, dy = o.family === 'sky' && !['canopy', 'storm'].includes(o.kind) ? o.y : 0;
  return o.shapes.map(s => s.type === 'rect' ? { type: 'rect', x: round(s.x - dx), y: round(s.y - dy), width: round(s.width), height: round(s.height) }
    : s.type === 'circle' ? { type: 'circle', x: round(s.x - dx), y: round(s.y - dy), radius: round(s.radius) }
      : { type: 'capsule', ax: round(s.ax - dx), ay: round(s.ay - dy), bx: round(s.bx - dx), by: round(s.by - dy), radius: round(s.radius) });
}

function build() {
  const kinds = {};
  for (const kind of GROUND_SKY_KINDS) {
    const heights = [], samples = [];
    let width = null, family = null, route = null, flyY = [];
    for (const seed of SEEDS) for (const index of INDICES) for (const tick of [0, 60, 120, 180]) {
      const o = buildCourseObstacle({ seed, index, tick, x: 0, kind });
      width = o.width; family = o.family; route = o.route;
      heights.push(o.height);
      if (o.family === 'sky' && !['canopy', 'storm'].includes(kind)) flyY.push(o.y);
      if (tick === 0 && (index === 0 || index === 48) && seed === 1) samples.push({ index, difficulty: obstacleDifficulty(index), height: round(o.height), shapes: relShapes(o) });
    }
    const lo = buildCourseObstacle({ seed: 1, index: 0, x: 0, kind }), hi = buildCourseObstacle({ seed: 1, index: 48, x: 0, kind });
    kinds[kind] = {
      family, route, width,
      anchor: family === 'sky' && !['canopy', 'storm'].includes(kind) ? 'flyer' : ['canopy', 'storm'].includes(kind) ? 'ceiling' : 'ground',
      height: { min: round(Math.min(...heights)), max: round(Math.max(...heights)) },
      ...(flyY.length ? { y: { min: round(Math.min(...flyY)), max: round(Math.max(...flyY)) } } : {}),
      shapesAtMin: relShapes(lo), shapesAtMax: relShapes(hi), samples,
    };
  }
  // Closed-form extremes of the ramps (lerp(a, b, d) + r * lerp(c, e, d), r in [0, 1)).
  kinds.forest.height = { min: 250, max: 375 };
  kinds.town.height = { min: 220, max: 340 };
  kinds.pipe.height = { min: 120, max: 230 };
  for (const k of ['willow', 'cherry', 'maple', 'oak']) kinds[k].height = { min: 200, max: 415 };
  kinds.canopy.height = kinds.storm.height = { min: 440, max: 580 };
  const tree = buildChikunObstacle({ seed: 1, index: 1, x: 0 }), drone = buildChikunObstacle({ seed: 1, index: 2, x: 0 });
  const legacy = {
    source: 'apps/chikun/assets/obstacle-shapes.json',
    geometry,
    tree: { render: { x: round(tree.render.x), y: round(tree.render.y), width: round(tree.render.width), height: round(tree.render.height) }, shapes: relShapes({ ...tree, family: 'tree' }) },
    drone: { render: { x: round(drone.render.x), y: round(drone.render.y - drone.y), width: round(drone.render.width), height: round(drone.render.height) }, shapes: relShapes({ ...drone, family: 'sky', kind: 'drone' }) },
  };
  return { schema: 'chikun-obstacle-templates-v1', generatedBy: 'scripts/build-chikun-hitbox-templates.mjs', groundY: 690, kinds, legacy };
}

const text = JSON.stringify(build(), null, 1) + '\n';
if (process.argv.includes('--check')) {
  const same = existsSync(OUT) && readFileSync(OUT, 'utf8') === text;
  console.log(same ? 'obstacle templates up to date' : 'obstacle templates are stale: run node scripts/build-chikun-hitbox-templates.mjs');
  process.exit(same ? 0 : 1);
}
writeFileSync(OUT, text);
console.log('wrote', OUT);
