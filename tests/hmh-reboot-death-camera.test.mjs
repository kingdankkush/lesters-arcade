// Design package 7.2 #1-2 and S1.1: the death camera. The defeat tick freezes
// the simulation and builds the run's result there, unchanged; the renderer
// keeps drawing for 72 presentation ticks (1.2 s) so the hero's death clip
// plays with the weapon hidden, and only then does the child hand the result
// to the parent. The delay is child-side; score and evidence do not move.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'acorn';
import { FIXED_STEP_MS } from '../apps/hmh-reboot/src/simulation.mjs';
import {
  DEATH_CAMERA_BACKSTOP_MS,
  DEATH_CAMERA_TICKS,
  createDeathCamera,
} from '../apps/hmh-reboot/src/death-camera.mjs';

function fakeTimers() {
  const timers = new Map();
  let next = 1;
  return {
    timers,
    setTimer: (callback, ms) => { const id = next++; timers.set(id, { callback, ms }); return id; },
    clearTimer: (id) => { timers.delete(id); },
    fire() { for (const [id, { callback }] of [...timers]) { timers.delete(id); callback(); } },
  };
}

test('the death camera holds the result for 72 presentation ticks, then releases it once, in order', () => {
  assert.equal(DEATH_CAMERA_TICKS, 72);
  const released = [];
  const clock = fakeTimers();
  const camera = createDeathCamera({ release: (messages, reason) => released.push([messages, reason]), ...clock });
  const messages = Object.freeze({ gameOver: { score: 10 } });
  assert.equal(camera.active, false);
  camera.begin({ messages });
  assert.equal(camera.active, true);
  assert.equal(camera.ticks, 0);
  for (let frame = 1; frame < DEATH_CAMERA_TICKS; frame += 1) {
    assert.equal(camera.advance(FIXED_STEP_MS), frame);
    assert.deepEqual(released, [], `still held at presentation tick ${frame}`);
  }
  assert.equal(camera.advance(FIXED_STEP_MS), DEATH_CAMERA_TICKS);
  assert.deepEqual(released, [[messages, 'complete']]);
  assert.equal(camera.active, false);
  assert.equal(clock.timers.size, 0, 'completion clears the backstop');
  // The final pose holds after release (a resize re-render stays on it) and
  // nothing is ever released twice.
  assert.equal(camera.advance(500), DEATH_CAMERA_TICKS);
  assert.equal(camera.flush('late'), false);
  assert.equal(released.length, 1);
});

test('the presentation clock is wall time from the render loop, not frame count', () => {
  const released = [];
  const camera = createDeathCamera({ release: (messages) => released.push(messages) });
  camera.begin({ messages: 'result' });
  // A 120 Hz display draws twice per tick; the clip still takes 1.2 s.
  for (let frame = 0; frame < 143; frame += 1) camera.advance(FIXED_STEP_MS / 2);
  assert.equal(camera.ticks, 71);
  assert.deepEqual(released, []);
  camera.advance(FIXED_STEP_MS / 2);
  assert.deepEqual(released, ['result']);
  // Slow frames (a stalled phone) release on time, and bad deltas are ignored.
  const slow = createDeathCamera({ release: (messages) => released.push(messages) });
  slow.begin({ messages: 'slow' });
  for (const delta of [Number.NaN, -40, Number.POSITIVE_INFINITY]) assert.equal(slow.advance(delta), 0);
  slow.advance(600);
  assert.equal(slow.ticks, 36);
  slow.advance(600);
  assert.deepEqual(released, ['result', 'slow']);
});

test('a flush releases at once; the backstop releases when no frame is drawn; reset starts clean', () => {
  const released = [];
  const clock = fakeTimers();
  const camera = createDeathCamera({ release: (messages, reason) => released.push([messages, reason]), ...clock });
  camera.begin({ messages: 'hidden-tab' });
  const [{ ms }] = clock.timers.values();
  assert.equal(ms, DEATH_CAMERA_BACKSTOP_MS);
  assert.ok(DEATH_CAMERA_BACKSTOP_MS > DEATH_CAMERA_TICKS * FIXED_STEP_MS, 'the backstop never beats a drawing camera');
  clock.fire();
  assert.deepEqual(released, [['hidden-tab', 'backstop']]);
  assert.equal(camera.ticks, DEATH_CAMERA_TICKS, 'a released camera shows the final pose');

  camera.begin({ messages: 'exit' });
  assert.equal(camera.ticks, 0);
  camera.advance(FIXED_STEP_MS * 10);
  assert.equal(camera.flush('exit'), true);
  assert.deepEqual(released.at(-1), ['exit', 'exit']);
  assert.equal(clock.timers.size, 0);

  camera.begin({ messages: null });
  assert.throws(() => camera.begin({ messages: null }), /already running/);
  camera.reset();
  assert.equal(camera.active, false);
  assert.equal(camera.ticks, 0);
  assert.equal(clock.timers.size, 0);
  assert.equal(released.length, 2, 'reset never releases');
  assert.throws(() => createDeathCamera({}), /release/);
});

// --- main.mjs wiring --------------------------------------------------------

const mainSource = readFileSync(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
const mainAst = parse(mainSource, { sourceType: 'module', ecmaVersion: 'latest' });

function find(node, predicate) {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  for (const value of Object.values(node)) {
    if (!value || typeof value !== 'object') continue;
    const found = Array.isArray(value) ? value.map((child) => find(child, predicate)).find(Boolean) : find(value, predicate);
    if (found) return found;
  }
  return null;
}

test('main.mjs: the defeat tick freezes the simulation, builds the result and starts the camera; the ticker keeps drawing', () => {
  const defeat = find(mainAst, (node) => node.type === 'IfStatement' && node.test.type === 'Identifier' && node.test.name === 'defeatTransition');
  assert.ok(defeat, 'the defeat branch exists');
  const branch = mainSource.slice(defeat.consequent.start, defeat.consequent.end);
  assert.match(branch, /simulation\.gameOver\(\)/);
  assert.doesNotMatch(branch, /app\.ticker\.stop\(\)/, 'the ticker keeps running for the death camera');
  assert.doesNotMatch(branch, /bridge\.send\(/, 'nothing reaches the parent on the defeat tick');
  assert.match(branch, /finalizeRunSummary\(runSummaryAccumulator, \{\s*endTick: simulation\.tick,/, 'the result is the defeat tick\'s');
  assert.match(branch, /statePayload\('game-over'\)/, 'the state payload is captured on the defeat tick');
  assert.match(branch, /deathCamera\.begin\(\{ messages: /);
  // The release sends the four result messages in the 1.8.1 order.
  const release = mainSource.slice(mainSource.indexOf('const deathCamera = createDeathCamera('));
  const order = ['game:state', 'game:run-summary', 'game:score-result', 'game:game-over'].map((type) => release.indexOf(`bridge.send('${type}'`));
  assert.ok(order.every((index, i) => index > 0 && (i === 0 || index > order[i - 1])), `release order ${order}`);
  assert.match(release.slice(0, order[3] + 200), /app\.ticker\.stop\(\)/, 'the release stops the ticker');
});

test('main.mjs: the ticker draws the death camera, flushes it on exit, hidden tab and session end, and plays the clip on its clock', () => {
  assert.match(mainSource, /if \(simulation\?\.state === 'game-over' && deathCamera\.active[\s\S]{0,60}\) \{\s*deathCamera\.advance\(ticker\.deltaMS\);[\s\S]{0,200}renderWorld\(actor\);\s*return;/);
  assert.match(mainSource, /const handleVisibilityChange = \(\) => \{\s*if \(document\.visibilityState === 'hidden'\) \{\s*deathCamera\.flush\('visibility'\);/);
  assert.match(mainSource, /const stopCurrentSession = \(\) => \{\s*deathCamera\.flush\('session-end'\);\s*deathCamera\.reset\(\);/);
  assert.match(mainSource, /if \(shiftExit && bridge\?\.initialized\) \{\s*deathCamera\.flush\('exit'\);\s*bridge\.send\('game:exit', \{ reason: 'menu' \}\);/);
  // The existing 6-frame death clip advances on the camera's presentation ticks.
  assert.match(mainSource, /productionAction === 'death'\s*\? Math\.max\(0, visualTick \+ deathCamera\.ticks - \(lastPlayerHit\?\.tick \?\? visualTick\)\)/);
});

test('main.mjs: the weapon layer is hidden during death (package 7.2 #2)', () => {
  assert.match(mainSource, /productionHeroDisplay\.setLayerVisible\('weapon', productionAction !== 'interact' && productionAction !== 'death' && !externalWeaponAuthoritative\)/);
  assert.match(mainSource, /const actionOwnsWeaponLayer = \['melee', 'grenade', 'death', 'interact'\]\.includes\(productionAction\)/, 'the external prop overlay stays hidden too');
});

test('main.mjs: the death camera draws no aim reticle and no rail charge line over the dead hero', () => {
  // The death camera keeps drawing for 1.2 s. The weapon is gone, so the aim
  // reticle and the Settler Rail's charge line go with it (projection only).
  const reticle = mainSource.indexOf('aimLine.clear();');
  assert.ok(reticle > 0);
  assert.match(mainSource.slice(reticle, reticle + 80), /aimLine\.clear\(\);\s*if \(aimIntent && playerHealth > 0\) \{/);
  assert.match(mainSource, /if \(playerHealth > 0 && heldWeapon\.id === 'hash-rail' && heldWeapon\.chargeStartedTick !== null\) \{/);
});
