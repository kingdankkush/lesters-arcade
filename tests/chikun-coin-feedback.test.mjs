import test from 'node:test';
import assert from 'node:assert/strict';
const module = await import('../apps/chikun/src/coin-feedback.mjs').catch(() => ({}));
const dom = await import('../apps/chikun/src/coin-feedback-dom.mjs').catch(() => ({}));
const { planChikunVfx, updateChikunVfxMotion } = await import('../apps/chikun/src/vfx.mjs');
const event = (coinsCollected, tick = 1) => ({ coinsCollected, tick, chikun: { x: 280, y: 360 } });

test('positive pickup is on by default and retains an explicit legacy fallback', () => {
  assert.equal(typeof module.isChikunCoinFeedbackEnabled, 'function');
  assert.equal(module.isChikunCoinFeedbackEnabled(new URLSearchParams()), true);
  for (const query of ['coinFeedback=off', 'coinFeedback=1', 'coinFeedback=positive-v1x'])
    assert.equal(module.isChikunCoinFeedbackEnabled(new URLSearchParams(query)), false);
  assert.equal(module.isChikunCoinFeedbackEnabled(new URLSearchParams('coinFeedback=positive-v1')), true);
});

test('coin reactions are positive, duplicate-free, bounded in pitch and reset on gaps or rewind', () => {
  const tracker = module.createChikunCoinFeedback();
  const snapshot = Object.freeze({ coinsCollected: 1, tick: 10, chikun: Object.freeze({ x: 280, y: 360 }) });
  const first = tracker.observe(snapshot);
  assert.equal(first.pitch, 1); assert.equal(first.shake, 0); assert.equal(first.flash, 0);
  assert.ok(Object.isFrozen(first)); assert.equal(tracker.observe(snapshot), null);
  const second = tracker.observe(event(2, 20)); assert.ok(second.pitch > first.pitch);
  for (let i = 3; i < 30; i++) assert.ok(tracker.observe(event(i, 20 + i)).pitch <= Math.SQRT2);
  assert.equal(tracker.observe(event(30, 600)).pitch, 1, 'long gap starts a new audible streak');
  assert.equal(tracker.observe(event(0, 0)), null, 'rewind resets without inventing a pickup');
  assert.equal(tracker.observe(event(1, 2)).pitch, 1);
  tracker.reset(); assert.equal(tracker.observe(event(1, 1)).pitch, 1);
  assert.equal(tracker.observe({ coinsCollected: Infinity, tick: 3, chikun: { x: 1, y: 2 } }), null);
});

test('sparkles never shake or flash and reduced motion stays restrained', () => {
  for (const reduceMotion of [false, true]) {
    const plan = planChikunVfx({ event: 'coin-positive', tick: 10, reduceMotion });
    assert.equal(plan.shake, 0); assert.equal(plan.flash, 0);
    assert.ok(plan.particles.length <= (reduceMotion ? 2 : 8));
  }
});

test('a simultaneous pickup preserves hazard feedback while later hazards still replace it', () => {
  assert.equal(typeof updateChikunVfxMotion, 'function');
  const hazard = Object.freeze({ shake: Object.freeze({ amount: 5, bornFrame: 7, lifeTicks: 30 }), flash: Object.freeze({ alpha: .2, bornFrame: 7, lifeTicks: 18 }) });
  const positive = planChikunVfx({ event: 'coin-positive', tick: 10 });
  assert.equal(updateChikunVfxMotion(hazard, positive, 8), hazard);
  const crash = updateChikunVfxMotion(hazard, planChikunVfx({ event: 'crash', tick: 10 }), 9);
  assert.equal(crash.shake.amount, 9); assert.equal(crash.shake.bornFrame, 9); assert.equal(crash.flash.alpha, .3);
  assert.equal(hazard.shake.bornFrame, 7, 'existing feedback was not mutated');
  assert.deepEqual(updateChikunVfxMotion(crash, planChikunVfx({ event: 'crash', reduceMotion: true }), 10), { shake: null, flash: null });
});

test('coin origin projection handles DPR-independent portrait crop and contain letterboxing', () => {
  const frameRect = { left: 10, top: 20 }, canvasRect = { left: 10, top: 20, width: 400, height: 800 };
  const view = { left: 200, width: 360, height: 720, density: 2 };
  assert.deepEqual(module.chikunCoinOriginToFrame({ x: 280, y: 360 }, view, canvasRect, frameRect), { x: 800 / 9, y: 400 });
  const wide = module.chikunCoinOriginToFrame({ x: 0, y: 0 }, { left: 0, width: 1280, height: 720 },
    { left: 10, top: 20, width: 1600, height: 720 }, frameRect);
  assert.deepEqual(wide, { x: 160, y: 0 }, 'stock landscape view remains centered inside wide CSS canvas');
});

test('small coin arc starts at the pickup, leaves the lane upward and ends exactly at the counter', () => {
  const from = { x: 100, y: 400 }, to = { x: 300, y: 30 };
  const start = module.sampleChikunCoinFlight(from, to, 0), middle = module.sampleChikunCoinFlight(from, to, .5), end = module.sampleChikunCoinFlight(from, to, 1);
  assert.equal(start.x, from.x); assert.equal(start.y, from.y); assert.equal(end.x, to.x); assert.equal(end.y, to.y);
  assert.ok(middle.y < from.y - 100); assert.ok(middle.size <= 20); assert.equal(end.visible, false);
});

function fakeDom() {
  const nodes = [];
  const make = tag => ({ tag, style: {}, dataset: {}, children: [], parent: null, clientLeft: 0, clientTop: 0,
    setAttribute() {}, appendChild(child) { child.parent = this; this.children.push(child); },
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); this.parent = null; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 1280, height: 720 }; } });
  const frame = make('frame'), canvas = make('canvas'), counter = make('counter');
  counter.getBoundingClientRect = () => ({ left: 500, top: 20, width: 20, height: 20 });
  return { frame, canvas, counter, documentRef: { createElement(tag) { const node = make(tag); nodes.push(node); return node; } }, nodes };
}

test('DOM pickup pool bounds simultaneous flights, retargets resize and removes every owned node', () => {
  const surface = fakeDom(), feedback = dom.createChikunCoinOverlay(surface), view = { left: 0, width: 1280, height: 720 };
  const plan = { x: 280, y: 360, coins: 1 };
  for (let i = 0; i < 1000; i++) feedback.collect(plan, view);
  assert.ok(feedback.activeCount <= 4); assert.ok(surface.frame.children.length <= 4);
  surface.counter.getBoundingClientRect = () => ({ left: 200, top: 20, width: 20, height: 20 });
  feedback.render(.1, view);
  const x = Number(surface.frame.children[0].style.transform.match(/translate\(([^p]+)px,/)[1]);
  assert.ok(Math.abs(x - 267.2) < 1e-9, 'flight follows the new counter target, not the old position');
  for (let i = 0; i < 5; i++) feedback.render(.1, view);
  assert.equal(feedback.activeCount, 0); assert.equal(surface.frame.children.length, 0);
  assert.ok(feedback.arrivals > 0); feedback.collect(plan, view); feedback.reset();
  assert.equal(surface.frame.children.length, 0); feedback.collect(plan, view); feedback.dispose();
  assert.equal(surface.frame.children.length, 0); feedback.collect(plan, view); assert.equal(feedback.activeCount, 0);
});

test('reduced motion stops active travel immediately and later pickups create no flying nodes', () => {
  const surface = fakeDom(), feedback = dom.createChikunCoinOverlay(surface), view = { left: 0, width: 1280, height: 720 };
  feedback.collect({ x: 280, y: 360, coins: 1 }, view); assert.equal(feedback.activeCount, 1);
  feedback.render(.1, view, { reduceMotion: true }); assert.equal(feedback.activeCount, 0);
  feedback.collect({ x: 280, y: 360, coins: 1 }, view, { reduceMotion: true });
  assert.equal(feedback.activeCount, 0); assert.equal(surface.frame.children.length, 0); feedback.dispose();
});
