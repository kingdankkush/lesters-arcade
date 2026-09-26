// Objective rings, lamps, beams, the tracker pill and its chevron (package
// §3.3, slice S1.4). Projection only: the renderer reads mission state.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorldDesignLife, missionChevron, missionSafeBand, MISSION_RING_CAP, MISSION_BEAM_CAP } from '../apps/hmh-reboot/src/world-design-life.mjs';
import { MISSION_OBJECTIVES, createMissionState, stepMissionObjectives } from '../apps/hmh-reboot/src/mission-objectives.mjs';
import { createCollectibleState, stepCollectibles } from '../apps/hmh-reboot/src/collectible-system.mjs';
import { OBJECTIVE_REWARDS, objectiveRewardPlacements } from '../apps/hmh-reboot/src/objective-rewards.mjs';

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

// Priority 4 in the runtime: once a district's chain is done the pill tracks
// the station its machine opened, read from the real collectible state and
// the same capacity check the collection step uses.
const collectiblesFor = () => createCollectibleState({
  placements: Array.from({ length: 10 }, (_, index) => ({ id: `base:${index}`, assetId: 'bonus-life', x: 20000 + index * 200, y: 0 })),
  objectivePlacements: objectiveRewardPlacements(),
});
// Stands in a machine's ring until it completes, unlocking its rewards the
// way main does on a switch's objective-completed event.
function operate(mission, collectibles, id) {
  const node = row(id);
  const player = { x: node.operate.x, y: node.operate.y, groundZ: 0 };
  for (let guard = 0; guard < 600 && !mission.completed.has(id); guard += 1) {
    for (const event of stepMissionObjectives(mission, { tick: mission.lastTick + 1, player, queryGround: flat }).events) {
      if (event.objectiveClass === 'switch') collectibles.unlockedObjectives.add(event.objectiveId);
    }
  }
  assert.ok(mission.completed.has(id), `${id} completes`);
  return player;
}
const reward = (id) => OBJECTIVE_REWARDS.find((candidate) => candidate.id === id);

test('with the relay done the pill tracks the Silver Reserve, and hides once it is taken or cannot be taken', () => {
  const mission = createMissionState(1);
  const collectibles = collectiblesFor();
  const actor = { x: row('relay-power').operate.x, y: row('relay-power').operate.y, groundZ: 0 };
  const guidance = { districtId: 'frontier-relay', collectibles, canCollect: () => true };
  assert.equal(render({ mission, actor, guidance }).report.trackedId, 'relay-power', 'the chain comes first');
  operate(mission, collectibles, 'relay-power');
  const tick = mission.lastTick;
  const tracked = render({ mission, actor, guidance, tick });
  assert.equal(tracked.report.trackedId, 'reward:relay-reserve');
  assert.equal(tracked.tracker.visible, true);
  assert.match(tracked.tracker.text, /^Silver Reserve · Shotgun · \d+ m /);
  const full = render({ mission, actor, guidance: { ...guidance, canCollect: () => false }, tick });
  assert.equal(full.report.trackedId, null, 'a station the hero cannot take now is not tracked');
  assert.equal(full.tracker.visible, false);
  assert.equal(render({ mission, actor, guidance: { districtId: 'frontier-relay' }, tick }).tracker.visible, false, 'no collectible state, no station');
  const silver = reward('reward:relay-reserve');
  const [taken] = stepCollectibles(collectibles, { tick: tick + 1, player: silver }).events;
  assert.equal(taken.placementId, silver.id);
  const after = render({ mission, actor, guidance, tick: tick + 1 });
  assert.equal(after.report.trackedId, null, 'a first-clear cache is tracked until it is collected');
  assert.equal(after.tracker.visible, false);
});

test('a haven is tracked with the effect the collection step checks, hides while it restocks and returns on its ready tick', () => {
  const mission = createMissionState(1);
  const collectibles = collectiblesFor();
  const actor = operate(mission, collectibles, 'crossing-pump');
  const checked = [];
  const guidance = { districtId: 'liquidity-crossing', collectibles, canCollect: (effect, placement) => { checked.push([placement.id, effect.kind]); return true; } };
  const tick = mission.lastTick;
  assert.equal(render({ mission, actor, guidance, tick }).report.trackedId, 'reward:crossing-supply');
  assert.deepEqual(checked, [['reward:crossing-supply', 'ammo-refill']], 'the placement kind, as stepCollectibles sees it');
  const haven = reward('reward:crossing-supply');
  stepCollectibles(collectibles, { tick: tick + 1, player: haven });
  const readyTick = collectibles.readyTicks.get(haven.id);
  assert.equal(readyTick, tick + 1 + haven.respawnTicks);
  assert.equal(render({ mission, actor, guidance, tick: readyTick - 1 }).tracker.visible, false, 'no pill while the haven restocks');
  assert.equal(render({ mission, actor, guidance, tick: readyTick }).report.trackedId, haven.id);
});

// Slice S1.5: the Closing Bell's ring carries the boss palette, a red lamp
// with "Opens at M:SS" before it is ready, "SETTLED" once the Dark Pool owns
// the fight, and hides while a fight is live; a retreat ring shows only while
// armed, even inside the sealed floor.
test('the Closing Bell shows its readiness, its settlement, and hides during a fight; retreat rings show only when armed', () => {
  const mission = createMissionState(1);
  const bell = mission.zones.find((zone) => zone.id === 'liquidator-closing-bell');
  const actor = { x: bell.x - 150, y: bell.y, groundZ: 0 };
  const note = (life) => life.overlay.children[5];
  const waiting = render({ mission, actor });
  assert.equal(note(waiting.life).visible, true);
  assert.equal(note(waiting.life).text, 'Opens at 10:00');
  mission.bossZoneStatus.set(bell.id, { status: 'waiting', readyAt: 40_000 });
  assert.equal(note(render({ mission, actor }).life).text, 'Opens at 11:06');
  mission.bossZoneStatus.set(bell.id, { status: 'settled', readyAt: null });
  assert.equal(note(render({ mission, actor }).life).text, 'SETTLED');
  mission.bossZoneStatus.set(bell.id, { status: 'live', readyAt: null });
  const live = render({ mission, actor });
  assert.equal(note(live.life).visible, false);
  const bellDrawn = (life) => life.ground.commands.some((command) => command[0] === 'circle' && command[1] === desktop.width / 2 + 150 && command[3] === bell.ringRadius);
  assert.equal(bellDrawn(live.life), false);
  mission.bossZoneStatus.delete(bell.id);
  mission.bossZoneArmed.add(bell.id);
  const armed = render({ mission, actor });
  assert.equal(bellDrawn(armed.life), true);
  assert.equal(note(armed.life).visible, false, 'an armed bell needs no note');
  const retreat = mission.zones.find((zone) => zone.id === 'liquidator-retreat-margin-floor');
  const inside = { x: retreat.x + 100, y: retreat.y, groundZ: 0 };
  const arena = { x: 11_000, y: 2_400, radius: 700 };
  mission.bossZoneStatus.set(retreat.id, { status: 'hidden', readyAt: null });
  const retreatDrawn = (life) => life.ground.commands.some((command) => command[0] === 'circle' && command[1] === desktop.width / 2 - 100 && command[3] === retreat.ringRadius);
  assert.equal(retreatDrawn(render({ mission, actor: inside, bossArena: arena }).life), false);
  mission.bossZoneArmed.add(retreat.id);
  assert.equal(retreatDrawn(render({ mission, actor: inside, bossArena: arena }).life), true);
});
