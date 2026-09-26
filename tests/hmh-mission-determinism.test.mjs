// Mission-core slice (design package S1.4) same-seed evidence check. A
// headless run of the real kernel, the real Level 1 collision, ground and line
// of sight, the mission step, the dock glide, the weapon loadout (stowed while
// a channel plays) and run progression (objective XP at the settled level).
// The hero walks a scripted route: the generator (quick), the supply court,
// the seal (kneel), the hidden supplies, the Winch Handle, the winch (channel,
// left mid-fill and resumed, hit on a seeded schedule) and the steam valve.
// Two runs of one seed give one digest for every render partition; the
// per-tick input stream reproduces the run fed back one tick per frame; and a
// different seed changes the digest.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { FIXED_STEP_MS, DeterministicSimulation } from '../apps/hmh-reboot/src/simulation.mjs';
import { LEVEL_ONE_WORLD, createLevelOneGroundQuery } from '../apps/hmh-reboot/src/level-one-world.mjs';
import { createCollisionBody, resolveSweptCircleMotion } from '../apps/hmh-reboot/src/collision.mjs';
import { traceHeightAwareLineOfSight } from '../apps/hmh-reboot/src/elevation.mjs';
import { directorViewBounds } from '../apps/hmh-reboot/src/encounter-director.mjs';
import { seededUnit } from '../apps/hmh-reboot/src/deterministic-hash.mjs';
import { createRunProgression, getRunProgressionSnapshot, grantRunSilver, grantRunXp } from '../apps/hmh-reboot/src/run-progression.mjs';
import { HMH_WEAPON_ORDER, createWeaponLoadout, refillWeaponLoadout, stepWeaponLoadout } from '../apps/hmh-reboot/src/weapon-system.mjs';
import {
  MISSION_OBJECTIVES,
  createMissionState,
  missionActiveBlockers,
  missionDockStep,
  missionObjectiveRows,
  settleMissionObjective,
  stepMissionObjectives,
} from '../apps/hmh-reboot/src/mission-objectives.mjs';

const RUN_TICKS = 2_400;
const queryGround = createLevelOneGroundQuery();
const body = createCollisionBody({ id: 'player', kind: 'player', radius: LEVEL_ONE_WORLD.player.radius, minZ: 0, maxZ: 56 });
const row = (id) => MISSION_OBJECTIVES.find((candidate) => candidate.id === id);
const at = (id) => row(id).operate ?? row(id).anchor;

// The route: [tick the leg starts (a teleport when `jump`), target, ticks to
// hold still once there]. The winch leg walks off mid-fill and comes back.
const relay = at('relay-power');
const pry = row('farmstead-hidden-supplies').seal.pry;
const winch = at('ravine-winch');
const valve = at('mining-valve');
const ROUTE = Object.freeze([
  { tick: 0, jump: { x: relay.x, y: relay.y + 140 } },
  { tick: 0, target: relay, hold: 60 },
  { tick: 150, target: { x: 340, y: 3480 } },
  { tick: 260, target: { x: 340, y: 3330 } },
  { tick: 320, target: pry, hold: 90 },
  { tick: 460, target: { x: 370, y: 3270 } },
  { tick: 520, jump: { x: row('ravine-winch-handle').anchor.x - 120, y: row('ravine-winch-handle').anchor.y } },
  { tick: 520, target: row('ravine-winch-handle').anchor },
  { tick: 600, jump: { x: winch.x - 60, y: winch.y } },
  { tick: 600, target: winch, hold: 40 },
  { tick: 700, target: { x: winch.x - 220, y: winch.y } },
  { tick: 780, target: winch, hold: 200 },
  { tick: 1_100, jump: { x: valve.x, y: valve.y + 100 } },
  { tick: 1_100, target: valve, hold: 400 },
]);

function headlessRun({ seed, partition = 1, replay = null }) {
  const simulation = new DeterministicSimulation({ seed, maxFrameDeltaMs: 100 });
  const mission = createMissionState(seed);
  const progression = createRunProgression({ seed });
  const loadout = createWeaponLoadout({ weaponIds: HMH_WEAPON_ORDER, activeWeaponId: HMH_WEAPON_ORDER[0], seed });
  const actor = { x: 0, y: 0, groundZ: 0 };
  let blockers = LEVEL_ONE_WORLD.collisionBlockers;
  const without = new Map();
  const blockersWithout = (id) => {
    if (!id) return blockers;
    const cached = without.get(id);
    if (cached?.source === blockers) return cached.list;
    const list = Object.freeze(blockers.filter((blocker) => blocker.id !== id));
    without.set(id, { source: blockers, list });
    return list;
  };
  const openBlocker = (id) => { mission.openGates.add(id); blockers = missionActiveBlockers(mission, LEVEL_ONE_WORLD.collisionBlockers); };
  const evidence = { events: [], fires: [], stowedTicks: 0, stowedAt: new Set(), glides: 0, health: 70, inputs: [], heldWinch: null };
  let leg = -1;
  let heldSince = null;
  let lastHitTick = -1;
  simulation.onStep(({ tick, input: kernelInput }) => {
    while (leg + 1 < ROUTE.length && ROUTE[leg + 1].tick <= tick) {
      leg += 1;
      heldSince = null;
      if (ROUTE[leg].jump) Object.assign(actor, ROUTE[leg].jump, { groundZ: queryGround(ROUTE[leg].jump.x, ROUTE[leg].jump.y).groundZ });
    }
    // Input: toward the leg's target, released once there (a released stick).
    let move = { x: 0, y: 0 };
    if (replay) move = kernelInput.move;
    else {
      const target = ROUTE[leg].target;
      const dx = target.x - actor.x;
      const dy = target.y - actor.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 6 && (heldSince === null)) move = { x: dx / distance, y: dy / distance };
      else heldSince ??= tick;
    }
    evidence.inputs.push(move);
    // Movement: the dock glide replaces the hero's own step (swept either way).
    const glide = missionDockStep(mission, { player: actor, move });
    const delta = glide ? { x: glide.x, y: glide.y } : { x: move.x * 4, y: move.y * 4 };
    if (glide) evidence.glides += 1;
    const swept = resolveSweptCircleMotion({ body, start: { x: actor.x, y: actor.y, z: actor.groundZ }, delta, blockers, bounds: LEVEL_ONE_WORLD.bounds });
    actor.x = swept.position.x;
    actor.y = swept.position.y;
    actor.groundZ = queryGround(actor.x, actor.y).groundZ;
    const frame = stepMissionObjectives(mission, {
      tick,
      player: actor,
      move,
      lastPlayerHitTick: lastHitTick,
      queryGround,
      lineClear: (from, to, exclude) => traceHeightAwareLineOfSight({ from: { x: from.x, y: from.y, z: from.groundZ + 24 }, to: { x: to.x, y: to.y, z: to.groundZ + 24 }, blockers: blockersWithout(exclude) }).clear,
      logicalView: directorViewBounds(actor),
    });
    for (const event of frame.events) {
      evidence.events.push([tick, event.type, event.objectiveId, event.sealId ?? null]);
      if (event.type === 'seal-opened') { openBlocker(event.sealId); continue; }
      const { baseXp } = settleMissionObjective(mission, event.objectiveId, progression.level);
      grantRunXp(progression, baseXp, tick);
      for (const effect of event.effects) {
        if (effect.type === 'open-gate') openBlocker(effect.gateId);
        else if (effect.grant === 'heal') evidence.health = Math.min(100, evidence.health + effect.amount);
        else if (effect.grant === 'ammo') refillWeaponLoadout(loadout, { tick });
        else if (effect.grant === 'silver') grantRunSilver(progression, effect.coins, tick);
      }
    }
    if (mission.stowed) { evidence.stowedTicks += 1; evidence.stowedAt.add(tick); }
    if (tick === 780) evidence.heldWinch = mission.zoneState.get('ravine-winch').progress;
    const weapon = stepWeaponLoadout(loadout, { tick, fire: true, stowed: mission.stowed, direction: { x: 1, y: 0 } });
    for (const event of weapon.events) if (event.type === 'weapon:fire') evidence.fires.push(tick);
    // Combat writes the hit the next mission step reads: a seeded schedule.
    if (seededUnit(seed, `hit:${tick}`) < 0.03) lastHitTick = tick;
  });
  simulation.start();
  let frameIndex = 0;
  while (simulation.tick < RUN_TICKS) {
    const steps = replay ? 1 : typeof partition === 'number' ? partition : 1 + Math.floor(seededUnit(partition.seed, `frame:${frameIndex}`) * 4);
    const input = replay ? { move: replay[simulation.tick], aim: { x: 0, y: 0, active: false } } : null;
    frameIndex += 1;
    simulation.update(FIXED_STEP_MS * Math.min(steps, RUN_TICKS - simulation.tick), input);
  }
  const snapshot = getRunProgressionSnapshot(progression);
  const digest = createHash('sha256').update(JSON.stringify({
    events: evidence.events, rows: missionObjectiveRows(mission), fires: evidence.fires, stowed: evidence.stowedTicks, glides: evidence.glides,
    health: evidence.health, xp: snapshot.xp, level: snapshot.level, score: snapshot.score, silver: snapshot.silverCollected,
    actor, openGates: [...mission.openGates].sort(), zones: [...mission.zoneState],
  })).digest('hex');
  return { digest, evidence, mission, snapshot };
}

test('the scripted route completes the relay, the secret, the handle, the winch and the valve, with the channels stowing the weapon', () => {
  const { evidence, mission, snapshot } = headlessRun({ seed: 0x5eed });
  const completed = evidence.events.filter((event) => event[1] === 'objective-completed').map((event) => event[2]);
  assert.deepEqual(completed, ['relay-power', 'relay-barn-doors', 'farmstead-hidden-supplies', 'ravine-winch-handle', 'ravine-winch', 'mining-valve']);
  assert.deepEqual(evidence.events.filter((event) => event[1] === 'seal-opened').map((event) => event[3]), ['farmstead-cache-seal']);
  assert.ok(evidence.glides > 0, 'the hero docked onto an operate spot');
  assert.ok(evidence.stowedTicks >= 90 * 2 + 60, 'the kneel and both channels stowed the weapon');
  // The weapon never fired on a stowed tick, and the winch kept its fill
  // while the hero walked away (held, not lost).
  assert.ok(evidence.fires.length > 0 && evidence.fires.every((tick) => !evidence.stowedAt.has(tick)));
  assert.ok(evidence.heldWinch > 0, `winch fill held at ${evidence.heldWinch}`);
  const rows = missionObjectiveRows(mission).filter((entry) => entry.completed);
  assert.ok(rows.every((entry) => entry.levelAtCompletion >= 1));
  assert.ok(snapshot.silverCollected === 20 && snapshot.xp > 0);
});

test('two runs of one seed give one digest for every render partition, catch-up included', () => {
  const reference = headlessRun({ seed: 1234 }).digest;
  assert.equal(headlessRun({ seed: 1234 }).digest, reference);
  for (const partition of [2, 3, 4, { seed: 7 }, { seed: 99 }]) {
    assert.equal(headlessRun({ seed: 1234, partition }).digest, reference, `partition ${JSON.stringify(partition)}`);
  }
});

test('the per-tick input stream reproduces the run fed back one tick per frame, and another seed differs', () => {
  const recorded = headlessRun({ seed: 77, partition: { seed: 3 } });
  const replayed = headlessRun({ seed: 77, replay: recorded.evidence.inputs });
  assert.equal(replayed.digest, recorded.digest);
  assert.notEqual(headlessRun({ seed: 78, partition: { seed: 3 } }).digest, recorded.digest, 'the seeded hit schedule moves the evidence');
});
