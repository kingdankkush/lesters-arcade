// Objective rings, lamps, beams, the tracker pill and its chevron (package
// §3.3, slice S1.4). Projection only: the renderer reads mission state.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorldDesignLife, missionChevron, missionSafeBand, MISSION_RING_CAP, MISSION_BEAM_CAP } from '../apps/hmh-reboot/src/world-design-life.mjs';
import { MISSION_OBJECTIVES, createMissionState, stepMissionObjectives } from '../apps/hmh-reboot/src/mission-objectives.mjs';

class FakeGraphics {
  constructor() { this.commands = []; }
  clear() { this.commands = []; return this; }
}
for (const name of ['circle', 'rect', 'roundRect', 'moveTo', 'lineTo', 'stroke', 'fill']) FakeGraphics.prototype[name] = function (...args) { this.commands.push([name, ...args]); return this; };
class FakeContainer { constructor() { this.children = []; } addChild(...c) { this.children.push(...c); } }
class FakeText { constructor() { this.anchor = { set() {} }; this.position = { set: (x, y) => { this.x = x; this.y = y; } }; this.style = {}; this.text = ''; this.visible = false; } }

const flat = () => ({ groundZ: 0 });
const row = (id) => MISSION_OBJECTIVES.find((candidate) => candidate.id === id);
const desktop = { width: 1440, height: 900 };
// A camera centred on a point: screen = world - centre + half the view.
const render = ({ mission, actor, view = desktop, life = createWorldDesignLife({ ContainerClass: FakeContainer, GraphicsClass: FakeGraphics, TextClass: FakeText }), ...rest }) => {
  const worldToScreen = (p) => ({ x: p.x - actor.x + view.width / 2, y: p.y - actor.y + view.height / 2 - (p.z ?? 0) });
  const report = life.render({ mission, actor, camera: { zoom: 1 }, view, worldToScreen, queryGround: flat, tick: 10, ...rest });
  const [effects, pill, prompt, tracker, needs] = life.overlay.children;
  return { report, life, effects, pill, prompt, tracker, needs };
};
const synthetic = (count, mode = 'channel') => Object.freeze(Array.from({ length: count }, (_, index) => ({
  id: `node-${String(index).padStart(2, '0')}`, objectiveClass: mode === 'touch' ? 'item' : 'switch', districtId: 'frontier-relay', name: `Node ${index}`, task: `Task ${index}`,
  mode, clip: mode === 'touch' ? null : 'crank', fillTicks: 90, ringRadius: mode === 'touch' ? 56 : 64,
  anchor: { x: 1000 + index * 80, y: 1000 }, operate: mode === 'touch' ? null : { x: 1000 + index * 80, y: 1000, facing: 'east' }, effects: [], xpPerLevel: 18,
})));

test('a locked machine shows a grey ring, a red X and names the item it needs', () => {
  const winch = row('ravine-winch');
  const { report, needs } = render({ mission: createMissionState(1), actor: { x: winch.operate.x + 120, y: winch.operate.y, groundZ: 0 } });
  assert.ok(report.visibleSites >= 1);
  assert.equal(needs.visible, true);
  assert.equal(needs.text, 'Needs Winch Handle');
});

test('at most six rings and four beams (three on a phone) are drawn; rings inside a live boss arena hide', () => {
  const rings = createMissionState(1, { objectives: synthetic(10) });
  assert.equal(render({ mission: rings, actor: { x: 1360, y: 1000, groundZ: 0 } }).report.visibleSites, MISSION_RING_CAP);
  const items = createMissionState(1, { objectives: synthetic(6, 'touch') });
  const actor = { x: 1200, y: 1000, groundZ: 0 };
  assert.equal(render({ mission: items, actor }).report.beams, MISSION_BEAM_CAP.desktop);
  assert.equal(render({ mission: items, actor, mobile: true }).report.beams, MISSION_BEAM_CAP.mobile);
  assert.equal(render({ mission: rings, actor: { x: 1360, y: 1000, groundZ: 0 }, bossArena: { x: 1360, y: 1000, radius: 2000 } }).report.visibleSites, 0);
});

test('secrets carry no marker, and a pry spot shows only while the hero kneels there', () => {
  const secret = row('farmstead-hidden-supplies');
  const pry = secret.seal.pry;
  const mission = createMissionState(1);
  const actor = { x: pry.x, y: pry.y, groundZ: 0 };
  const before = render({ mission, actor });
  const spot = (commands) => commands.some((command) => command[0] === 'circle' && command[1] === desktop.width / 2 && command[2] === desktop.height / 2 && command[3] === 64);
  assert.equal(spot(before.life.ground.commands), false);
  for (let tick = 0; tick < 3; tick += 1) stepMissionObjectives(mission, { tick, player: actor, move: { x: 0, y: 0 }, queryGround: flat });
  assert.equal(spot(render({ mission, actor }).life.ground.commands), true);
});

test('the tracker pill shows the tracked task, keeps to the glyph and distance on a compact landscape, and hides under a boss bar', () => {
  const mission = createMissionState(1);
  const handle = row('ravine-winch-handle');
  const actor = { x: handle.anchor.x, y: handle.anchor.y - 1680, groundZ: 0 };
  const guidance = { districtId: 'rugpull-ravine' };
  const full = render({ mission, actor, guidance });
  assert.equal(full.tracker.visible, true);
  assert.equal(full.tracker.text, 'Find the Winch Handle · 42 m ↓');
  assert.equal(full.report.trackedId, 'ravine-winch-handle');
  const compact = render({ mission, actor, guidance, view: { width: 900, height: 420 } });
  assert.equal(compact.tracker.text, '42 m ↓');
  assert.equal(render({ mission, actor, guidance: { ...guidance, bossBarVisible: true } }).tracker.visible, false);
  assert.equal(render({ mission, actor }).tracker.visible, false, 'no guidance, no pill');
});

test('the chevron sits on the edge of the safe band toward an off-screen node and vanishes when it is on screen', () => {
  const view = desktop;
  const band = missionSafeBand(view);
  assert.deepEqual(band, { top: 185, bottom: view.height - 95 });
  assert.equal(missionChevron({ target: { x: 700, y: 500 }, view, band }), null);
  const east = missionChevron({ target: { x: 4000, y: (band.top + band.bottom) / 2 }, view, band });
  assert.equal(east.x, view.width - 36);
  assert.equal(east.angle, 0);
  const south = missionChevron({ target: { x: view.width / 2, y: 5000 }, view, band });
  assert.equal(south.y, band.bottom - 16);
  assert.deepEqual(missionSafeBand({ width: 390, height: 844 }), { top: 266, bottom: 604 });
  assert.deepEqual(missionSafeBand({ width: 900, height: 420 }), { top: 118, bottom: 140 });
});
