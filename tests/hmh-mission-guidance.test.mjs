// The tracker pill and the pause field map's objective list (package §3.3,
// slice S1.4): priorities, hysteresis, text and discovery. Projection only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MISSION_OBJECTIVES, createMissionState, stepMissionObjectives } from '../apps/hmh-reboot/src/mission-objectives.mjs';
import {
  MISSION_TRACK_HYSTERESIS_UNITS,
  missionDistrictChain,
  selectMissionTrack,
  missionClaimableStations,
  missionFieldMapNodes,
} from '../apps/hmh-reboot/src/mission-guidance.mjs';
import { OBJECTIVE_REWARDS } from '../apps/hmh-reboot/src/objective-rewards.mjs';

const flat = () => ({ groundZ: 0 });
const row = (id) => MISSION_OBJECTIVES.find((candidate) => candidate.id === id);
const step = (state, player, move = { x: 0, y: 0 }, logicalView = null) => stepMissionObjectives(state, { tick: state.lastTick + 1, player: { ...player, groundZ: 0 }, move, queryGround: flat, logicalView });

test('a district chain lists its switches and items, each after the node it needs', () => {
  assert.deepEqual(missionDistrictChain(MISSION_OBJECTIVES, 'rugpull-ravine').map((entry) => entry.id), ['ravine-winch-handle', 'ravine-winch']);
  assert.deepEqual(missionDistrictChain(MISSION_OBJECTIVES, 'frontier-relay').map((entry) => entry.id), ['relay-power']);
  for (const districtId of ['liquidity-crossing', 'hashwood', 'mining-camp', 'liquidation-yard']) {
    assert.equal(missionDistrictChain(MISSION_OBJECTIVES, districtId).length, 1, districtId);
  }
});

test('the pill tracks the next chain step even undiscovered, then the machine it unlocks, with metres and an arrow', () => {
  const state = createMissionState(1);
  const handle = row('ravine-winch-handle');
  const player = { x: handle.anchor.x, y: handle.anchor.y - 1680 };
  const first = selectMissionTrack(state, { player, districtId: 'rugpull-ravine' });
  assert.equal(first.id, 'ravine-winch-handle');
  assert.equal(first.priority, 3);
  assert.equal(first.text, 'Find the Winch Handle · 42 m ↓');
  assert.equal(first.compactText, '42 m ↓');
  step(state, handle.anchor);
  const next = selectMissionTrack(state, { player: handle.anchor, districtId: 'rugpull-ravine' });
  assert.equal(next.id, 'ravine-winch');
  assert.match(next.text, /^Crank the quarry winch · \d+ m .$/);
  assert.equal(selectMissionTrack(state, { player, districtId: 'rugpull-ravine', bossBarVisible: true }), null, 'a boss bar hides the pill');
});

test('an active channel outranks everything, and secrets are never tracked', () => {
  const state = createMissionState(1);
  const pump = row('crossing-pump');
  step(state, pump.operate);
  const track = selectMissionTrack(state, { player: pump.operate, districtId: 'rugpull-ravine' });
  assert.deepEqual([track.id, track.priority], ['crossing-pump', 1]);
  const pry = row('farmstead-hidden-supplies').seal.pry;
  const kneeling = createMissionState(1);
  step(kneeling, pry);
  assert.equal(kneeling.operating.objectiveId, 'farmstead-hidden-supplies');
  const quiet = selectMissionTrack(kneeling, { player: pry, districtId: 'frontier-relay' });
  assert.equal(quiet.id, 'relay-power', 'prying a secret never lights the tracker');
});

test('with its chain done, a district tracks the nearest claimable station, holding it until another is 10 m closer', () => {
  const state = createMissionState(1);
  state.completed.set('hashwood-shrine', 1);
  const rewards = OBJECTIVE_REWARDS.filter((reward) => reward.objectiveId === 'hashwood-shrine');
  const stations = missionClaimableStations({ mission: state, rewards: OBJECTIVE_REWARDS, rewardState: () => 'reward-available' });
  assert.deepEqual(stations.map((station) => station.id), rewards.map((reward) => reward.id));
  assert.equal(missionClaimableStations({ mission: state, rewards: OBJECTIVE_REWARDS, rewardState: () => 'cooldown' }).length, 0);
  assert.equal(missionClaimableStations({ mission: state, rewards: OBJECTIVE_REWARDS, rewardState: () => 'reward-available', canClaim: () => false }).length, 0);
  const [left, right] = [...stations].sort((a, b) => a.x - b.x);
  const nearLeft = { x: left.x - 100, y: left.y };
  const first = selectMissionTrack(state, { player: nearLeft, districtId: 'hashwood', stations });
  assert.deepEqual([first.id, first.priority], [left.id, 4]);
  // The two havens stand 60 apart: the pill stays on the first one.
  const nearRight = { x: right.x + 20, y: right.y };
  assert.equal(selectMissionTrack(state, { player: nearRight, districtId: 'hashwood', stations, previous: first }).id, left.id);
  assert.equal(selectMissionTrack(state, { player: nearRight, districtId: 'hashwood', stations }).id, right.id);
  const far = [{ id: 'far', x: nearLeft.x + MISSION_TRACK_HYSTERESIS_UNITS + 500, y: nearLeft.y, task: 'Far' }, { id: 'near', x: nearLeft.x + 10, y: nearLeft.y, task: 'Near' }];
  assert.equal(selectMissionTrack(state, { player: nearLeft, districtId: 'hashwood', stations: far, previous: { id: 'far' } }).id, 'near');
});

test('the field map lists discovered nodes by state, names what a locked node needs, and shows secrets only once found', () => {
  const state = createMissionState(1);
  const winch = row('ravine-winch');
  const view = { minX: winch.operate.x - 720, maxX: winch.operate.x + 720, minY: winch.operate.y - 450, maxY: winch.operate.y + 450 };
  step(state, { x: winch.operate.x + 300, y: winch.operate.y }, { x: 1, y: 0 }, view);
  const nodes = missionFieldMapNodes(state);
  assert.deepEqual(nodes.find((node) => node.id === 'ravine-winch'), {
    id: 'ravine-winch', name: winch.name, objectiveClass: 'switch', x: winch.operate.x, y: winch.operate.y, state: 'locked', task: winch.task, needs: 'Winch Handle',
  });
  assert.equal(nodes.some((node) => node.id === 'yard-warehouse'), false);
  assert.equal(nodes.some((node) => node.objectiveClass === 'secret'), false);
  state.completed.set('warehouse-logbook', 5);
  const logbook = missionFieldMapNodes(state).find((node) => node.id === 'warehouse-logbook');
  assert.equal(logbook.state, 'done');
  assert.match(logbook.lore, /real books/);
});

// Slice S1.5: priority 2 is the Closing Bell while its slot arms it, and the
// Liquidator Vault becomes a claimable station once he falls.
test('a ready, armed Closing Bell is tracked at priority 2 in the Yard, and only while armed', () => {
  const state = createMissionState(1);
  const player = { x: 10_600, y: 2_900 };
  const before = selectMissionTrack(state, { player, districtId: 'liquidation-yard' });
  assert.equal(before.id, 'yard-warehouse', 'a disarmed bell is not tracked');
  state.bossZoneArmed.add('liquidator-closing-bell');
  const track = selectMissionTrack(state, { player, districtId: 'liquidation-yard' });
  assert.deepEqual([track.id, track.priority, track.glyph], ['liquidator-closing-bell', 2, 'boss']);
  assert.match(track.text, /^Ring the Closing Bell · \d+ m .$/);
  assert.equal(selectMissionTrack(state, { player, districtId: 'mining-camp' })?.id === 'liquidator-closing-bell', false, 'only in its own district');
});

test('the Liquidator Vault is claimable once the boss unlock is recorded, like a finished machine', () => {
  const state = createMissionState(1);
  const vault = OBJECTIVE_REWARDS.find((reward) => reward.objectiveId === 'liquidator-defeated');
  const claim = (unlocked) => missionClaimableStations({ mission: state, rewards: OBJECTIVE_REWARDS, rewardState: () => 'reward-available', unlocked });
  assert.equal(claim(new Set()).some((station) => station.id === vault.id), false);
  assert.equal(claim(new Set(['liquidator-defeated'])).some((station) => station.id === vault.id), true);
});
