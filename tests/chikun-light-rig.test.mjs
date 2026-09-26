// The light rig is pure, continuous through the 180 s day, keeps the sun and
// moon in the upper-left third, freezes under reduced motion and never grades
// the backdrop into illegibility.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CHIKUN_REGIONS } from '../apps/portal/src/chikun-course-regions.mjs';
import { chikunSkyState, computeLightRig, createLightRig, RIG_KEYS, RIG_KEY_NAMES, applyGrade, luminance, rgba, PHASE_BUCKETS } from '../apps/chikun/src/light-rig.mjs';
import { buildChikunViewport } from '../apps/chikun/src/viewport.mjs';

const regionState = (index, blend = 0) => ({ index, nextIndex: (index + 1) % 7, region: CHIKUN_REGIONS[index], next: CHIKUN_REGIONS[(index + 1) % 7], blend });
const VIEWS = [buildChikunViewport(1280, 720, 1), buildChikunViewport(390, 844, 3), buildChikunViewport(844, 390, 3)];

test('all seven regions have every key, and the key weights always sum to one', () => {
  assert.deepEqual(RIG_KEY_NAMES, ['noon', 'golden', 'night', 'dawn']);
  for (const name of RIG_KEY_NAMES) assert.ok(RIG_KEYS[name]);
  for (let i = 0; i < 7; i++) for (let t = 0; t < 180; t += 0.75) {
    const rig = computeLightRig(chikunSkyState(t), regionState(i), VIEWS[0]);
    const sum = Object.values(rig.weights).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9, `${CHIKUN_REGIONS[i].id} t=${t}`);
    for (const k of ['far', 'mid', 'near']) assert.ok(rig.fog[k] >= 0 && rig.fog[k] <= 0.8);
    assert.ok(rig.grade.w >= 0 && rig.grade.w <= 0.35 && rig.grade.a >= 0 && rig.grade.a <= 0.55);
  }
  // Lap-1 exposure: forest and town are seen at night, farmland at noon.
  assert.ok(computeLightRig(chikunSkyState(8), regionState(0), VIEWS[0]).weights.noon > 0.9);
  assert.ok(computeLightRig(chikunSkyState(100), regionState(2), VIEWS[0]).weights.night > 0.9);
  assert.ok(computeLightRig(chikunSkyState(44), regionState(0), VIEWS[0]).weights.golden > 0.9);
  assert.ok(computeLightRig(chikunSkyState(136), regionState(3), VIEWS[0]).weights.dawn > 0.9);
});

test('pure and continuous: no pops between frames anywhere in the day or a region blend', () => {
  const a = computeLightRig(chikunSkyState(61.5), regionState(3, 0.4), VIEWS[1]);
  const b = computeLightRig(chikunSkyState(61.5), regionState(3, 0.4), VIEWS[1], createLightRig());
  assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
  let prev = null;
  for (let tick = 0; tick <= 180 * 60; tick += 1) {
    const rig = computeLightRig(chikunSkyState(tick / 60), regionState(1), VIEWS[0]);
    if (prev) {
      for (let c = 0; c < 3; c++) {
        assert.ok(Math.abs(rig.fogColor[c] - prev.fog[c]) < 3, `fog colour jump at tick ${tick}`);
        assert.ok(Math.abs(rig.horizon[c] - prev.horizon[c]) < 3, `horizon jump at tick ${tick}`);
      }
      assert.ok(Math.abs(rig.grade.a - prev.a) < 0.01 && Math.abs(rig.grade.w - prev.w) < 0.01, `grade jump at tick ${tick}`);
      assert.ok(Math.abs(rig.lightsOn - prev.lightsOn) < 0.02, `lights jump at tick ${tick}`);
    }
    prev = { fog: [...rig.fogColor], horizon: [...rig.horizon], a: rig.grade.a, w: rig.grade.w, lightsOn: rig.lightsOn };
  }
  assert.ok(PHASE_BUCKETS >= 360, 'gradient buckets are at most half a second of the day');
});

test('sun and moon stay in the upper-left third of every view', () => {
  for (const view of VIEWS) for (let t = 0; t < 180; t += 1) {
    const rig = computeLightRig(chikunSkyState(t), regionState(0), view);
    for (const body of [rig.sun, rig.moon]) {
      if (body.alpha <= 0.05) continue;
      assert.ok(body.x >= view.left && body.x <= view.left + view.width / 3 + 1, `x ${body.x} in ${view.left}..${view.left + view.width / 3}`);
      assert.ok(body.y < 560, `y ${body.y} stays above the horizon while visible`);
      if (body.alpha > 0.6) assert.ok(body.y < 420, `y ${body.y} is high while bright`);
    }
  }
});

test('never two suns: the sun has set before the moon appears, and it rises only after the moon has gone', () => {
  for (const view of VIEWS) {
    let prev = null;
    for (let tick = 0; tick <= 180 * 60; tick++) {
      const rig = computeLightRig(chikunSkyState(tick / 60), regionState(2), view);
      assert.ok(Math.min(rig.sun.alpha, rig.moon.alpha) <= 1e-6, `t=${(tick / 60).toFixed(2)}: sun ${rig.sun.alpha.toFixed(2)} and moon ${rig.moon.alpha.toFixed(2)} both visible`);
      if (prev) assert.ok(Math.abs(rig.sun.alpha - prev.sun) < 0.03 && Math.abs(rig.moon.alpha - prev.moon) < 0.03, `tick ${tick}: sun or moon pops`);
      prev = { sun: rig.sun.alpha, moon: rig.moon.alpha };
    }
  }
  // A full sun through the day and a full moon through the night.
  assert.equal(computeLightRig(chikunSkyState(0), regionState(0), VIEWS[0]).sun.alpha, 1);
  assert.equal(computeLightRig(chikunSkyState(90), regionState(0), VIEWS[0]).moon.alpha, 1);
  // The golden-hour sun keeps its 1.8.2 strength (the rays and glows were tuned on it).
  const golden = computeLightRig(chikunSkyState(44), regionState(0), VIEWS[0]);
  assert.ok(golden.sun.alpha > 0.35, `golden-hour sun ${golden.sun.alpha.toFixed(2)}`);
});

test('reduced motion freezes the light at noon', () => {
  const a = computeLightRig(chikunSkyState(15, true), regionState(4), VIEWS[0]);
  const b = computeLightRig(chikunSkyState(120, true), regionState(4), VIEWS[0], createLightRig());
  assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
  assert.ok(a.weights.noon > 0.99);
});

test('readability floors: the grade keeps backdrop detail visible and bright art bright', () => {
  for (let i = 0; i < 7; i++) for (let t = 0; t < 180; t += 3) {
    const rig = computeLightRig(chikunSkyState(t), regionState(i), VIEWS[0]);
    const white = applyGrade([235, 235, 230], rig.grade), black = applyGrade([30, 30, 34], rig.grade);
    const ratio = (luminance(white) + 0.05) / (luminance(black) + 0.05);
    assert.ok(ratio >= 3, `${CHIKUN_REGIONS[i].id} t=${t}: graded contrast ${ratio.toFixed(2)} keeps silhouettes readable`);
    assert.ok(luminance(white) > 0.12, 'highlights never drop to mud');
  }
});

test('colour strings are cached', () => {
  assert.equal(rgba([1, 2, 3], 0.5), 'rgba(1,2,3,0.5)');
  assert.equal(rgba([1, 2, 3], 0.5), rgba([1.2, 2.1, 2.9], 0.5001));
});
