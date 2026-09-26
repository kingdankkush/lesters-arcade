// Prints the Chikun light rig for each region at the review keys, as JSON, so
// the Python review plates (scripts/build-chikun-review-plates.py) composite
// with exactly the runtime's lighting numbers.
import { CHIKUN_REGIONS } from '../../apps/portal/src/chikun-course-regions.mjs';
import { chikunSkyState, computeLightRig } from '../../apps/chikun/src/light-rig.mjs';
import { buildChikunViewport } from '../../apps/chikun/src/viewport.mjs';

export const REVIEW_KEYS = Object.freeze({ noon: 8, golden: 39, night: 90, dawn: 136 });
const views = { landscape: buildChikunViewport(1280, 720, 1), portrait: buildChikunViewport(405, 720, 1) };
const out = {};
CHIKUN_REGIONS.forEach((region, index) => {
  out[region.id] = {};
  for (const [key, seconds] of Object.entries(REVIEW_KEYS)) {
    const state = { index, nextIndex: (index + 1) % 7, region, next: CHIKUN_REGIONS[(index + 1) % 7], blend: 0 };
    const sky = chikunSkyState(seconds);
    out[region.id][key] = {};
    for (const [name, view] of Object.entries(views)) {
      const rig = computeLightRig(sky, state, view);
      out[region.id][key][name] = JSON.parse(JSON.stringify({ ...rig, view: { left: view.left, width: view.width } }));
    }
  }
});
process.stdout.write(JSON.stringify(out));
