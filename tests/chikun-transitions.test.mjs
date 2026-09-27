// Region transitions replace the 3 s double exposure: a short veil, layers
// swapped far to near, and spatial seams on the near ground that reach Chikun
// (x = 280) exactly at the switch tick. Everything is a pure function of the
// public schedule and the course distance, so replay seeks are exact.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CHIKUN_REGIONS, REGION_SCHEDULE, REGION_LOOP_SLOTS, courseRegionState, regionSwitchTick } from '../apps/portal/src/chikun-course-regions.mjs';
import { distanceAtTick } from '../apps/portal/src/chikun-ground-course.mjs';
import { transitionState, createTransition, seamX, TRANSITION, boundaryDistance } from '../apps/chikun/src/parallax.mjs';

const at = (tick, reduced = false) => {
  const state = courseRegionState(tick, {});
  return { state, t: transitionState(state, distanceAtTick(tick), reduced, createTransition()) };
};
const regionUnder = (t, distance, x = 280, rate = 1) => {
  if (Number.isFinite(t.Dprev) && x < seamX(t.Dprev, distance, rate)) return t.prev;
  return x < seamX(t.Dnext, distance, rate) ? t.cur : t.next;
};

test('seams are a pure function of the schedule and reach Chikun at the switch tick on every boundary', () => {
  assert.equal(seamX(1000, 1000, 0.6), 280);
  for (let lap = 0; lap < 2; lap++) REGION_SCHEDULE.forEach((seg, i) => {
    const slot = lap * REGION_LOOP_SLOTS + seg.startSlot;
    if (slot === 0) return;
    const S = regionSwitchTick(slot), Db = distanceAtTick(S);
    assert.equal(boundaryDistance(slot), Db);
    const before = at(S - 1), after = at(S);
    assert.equal(before.t.Dnext, Db, `${seg.id} lap ${lap + 1}: next boundary`);
    assert.equal(after.t.Dprev, Db, `${seg.id} lap ${lap + 1}: previous boundary`);
    assert.equal(regionUnder(before.t, distanceAtTick(S - 1)), (i + 6) % 7, `${seg.id} lap ${lap + 1}: old ground under Chikun before the switch`);
    assert.equal(regionUnder(after.t, distanceAtTick(S)), i, `${seg.id} lap ${lap + 1}: new ground under Chikun at the switch`);
    // Before the switch the seam is ahead (to the right) and converges toward the horizon.
    const mid = at(S - 120), d = distanceAtTick(S - 120);
    assert.ok(seamX(mid.t.Dnext, d, 1) > seamX(mid.t.Dnext, d, 0.6) && seamX(mid.t.Dnext, d, 0.6) > 280);
  });
  // No previous boundary at the very start of the run.
  assert.equal(at(0).t.Dprev, -Infinity);
  assert.equal(regionUnder(at(0).t, 0), 0);
});

test('the veil rises then falls around each switch and is zero elsewhere', () => {
  const slot = REGION_SCHEDULE[1].startSlot, S = regionSwitchTick(slot);
  const veils = [];
  for (let k = -420; k <= 180; k++) { const { t } = at(S + k); veils.push([t.s, t.after, t.veil]); }
  const inside = veils.filter(([s, after]) => (s >= TRANSITION.start && s <= 0) || after <= TRANSITION.end);
  const outside = veils.filter(([s, after]) => s < TRANSITION.start && after > TRANSITION.end);
  assert.ok(outside.length > 20 && outside.every(v => v[2] === 0));
  const peak = Math.max(...inside.map(v => v[2]));
  assert.ok(peak > 0.5 && peak <= TRANSITION.veil + 1e-9);
  const iPeak = veils.findIndex(v => v[2] === peak);
  for (let i = 1; i <= iPeak; i++) if (veils[i][2] > 0 && veils[i - 1][2] > 0) assert.ok(veils[i][2] >= veils[i - 1][2] - 1e-9, 'rises');
  for (let i = iPeak + 1; i < veils.length; i++) if (veils[i][2] > 0) assert.ok(veils[i][2] <= veils[i - 1][2] + 0.02, 'falls');
});

test('layers swap far to near under the veil, each in a short cross-fade', () => {
  const slot = REGION_SCHEDULE[2].startSlot, S = regionSwitchTick(slot);
  const done = {};
  for (let k = -360; k < 0; k++) {
    const { t } = at(S + k);
    for (const name of ['far', 'mid', 'near', 'bands']) if (t.mix[name] >= 1 && done[name] === undefined) done[name] = t.s;
  }
  assert.ok(done.far < done.mid && done.mid < done.near && done.near < done.bands, JSON.stringify(done));
  assert.ok(done.bands <= 0, 'every layer has swapped before the switch');
  const { t } = at(S - 400);
  assert.deepEqual({ ...t.mix }, { far: 0, mid: 0, near: 0, bands: 0 });
});

test('reduced motion: no seams, no veil, every layer follows the existing blend', () => {
  const S = regionSwitchTick(REGION_SCHEDULE[3].startSlot);
  for (const k of [-200, -90, -10, 5]) {
    const { state, t } = at(S + k, true);
    assert.equal(t.seams, false); assert.equal(t.veil, 0);
    for (const name of ['far', 'mid', 'near', 'bands']) assert.equal(t.mix[name], state.blend);
  }
});

test('the coast to farmland boundary wraps into the next lap', () => {
  const S = regionSwitchTick(REGION_LOOP_SLOTS);
  const before = at(S - 1), after = at(S);
  assert.equal(CHIKUN_REGIONS[before.t.cur].id, 'coast'); assert.equal(CHIKUN_REGIONS[before.t.next].id, 'farmland');
  assert.equal(CHIKUN_REGIONS[after.t.cur].id, 'farmland'); assert.equal(CHIKUN_REGIONS[after.t.prev].id, 'coast');
  assert.equal(after.t.Dprev, distanceAtTick(S));
});
