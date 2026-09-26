// Mission core v2 (design package §3.1-3.6 and 3.9, slice S1.4). One pure
// module owns every objective node on the shipped map: the six machines, the
// court gates three of them open (as the contract's gate objectives), the
// Winch Handle, and the three secrets (a breakable or pryable seal, then a
// hidden volume). Layout v2 adds the rest of the 25 contract objectives.
//
// Interaction is contextual and automatic: the hero stands in a ring and there
// is no button (owner decision). Quick nodes commit after 12 ticks inside and
// then finish on their own; channel nodes fill only while the hero stands
// still, dock the hero onto the operate spot and stow the weapon; seal nodes
// (boss triggers, from the boss slice) are channels that wait for readyTick
// and drain at once. Progress is held when the hero moves or leaves, and a hit
// pauses it; it is never lost to a hit.
//
// Everything here is simulation: integer ticks, the simulated actor, sorted
// ids, no clock, camera or quality read. It is loaded by an awaited dynamic
// import before any session starts (main.mjs loadLazyRuntimeModules), so the
// fixed-step simulation only calls resident code.
import { freezeDeep } from './value-guards.mjs';
import { WORLD_DESIGN_SITES, WORLD_DESIGN_COURT_BLOCKERS } from './world-design-encounters.mjs';
import { WORLD_DESIGN_SECRETS, WORLD_DESIGN_SECRET_SEAL } from './world-design-secrets.mjs';
import { HMH_V7_OBJECTIVES, HMH_V7_RUN_RULES } from '../../../sdk/hmh-run-contract-v7.mjs';
import { HMH_RUN_SUMMARY_CATALOGS_V7 } from '../../../sdk/hmh-run-summary-schema-v7.mjs';

export const MISSION_RULES = freezeDeep({
  quick: { ringRadius: 72, commitTicks: 12 },
  channel: { ringRadius: 64, holdAfterLeaveTicks: 120, drainPerTick: 2 },
  seal: { ringRadius: 90, drainPerTick: 4 },
  // Input magnitude below this is "standing still" (a released joystick).
  stillMoveMagnitude: 0.2,
  heightBand: 8,
  hitPauseTicks: 12,
  dockAfterStillTicks: 6,
  dockStepUnits: 4,
  dockMaxTicks: 16,
  itemTouchRadius: 56,
  secretEnterRadius: 45,
  sealHitPoints: 60,
  pryTicks: 60,
  // Line of sight runs from the hero at z+24 to the operate spot at z+24.
  lineOfSightHeight: 24,
});

// Package §2.6: the verb each machine gets. The fill time is the site's
// authored holdTicks (button 30, lever 45, crank or valve 90).
const MACHINE_MODES = freezeDeep({
  'relay-power': { mode: 'quick', clip: 'press', task: 'Press the generator switch', gateObjective: ['relay-barn-doors', 'Supply court gate'] },
  'ravine-winch': { mode: 'channel', clip: 'crank', task: 'Crank the quarry winch', requires: 'ravine-winch-handle' },
  'crossing-pump': { mode: 'channel', clip: 'crank', task: 'Crank the reservoir pump', gateObjective: ['crossing-mill-storeroom', 'Liquidity Haven gate'] },
  'hashwood-shrine': { mode: 'channel', clip: 'crank', task: 'Crank the sanctuary lantern' },
  'mining-valve': { mode: 'channel', clip: 'crank', task: 'Turn the pressure valve' },
  'yard-warehouse': { mode: 'quick', clip: 'lever', task: 'Pull the warehouse lever', gateObjective: ['yard-warehouse-gate', 'Warehouse court gate'] },
});

// The Winch Handle (package §3.6) on an interim anchor in the Ravine's canyon
// lane, the package's own point; layout v2 (S2.3) keeps it there.
const WINCH_HANDLE = freezeDeep({ id: 'ravine-winch-handle', name: 'Winch Handle', x: 2350, y: 2900 });

// The farmstead seal can be pried from its west side, facing east (kneel).
const SEAL_PRY = freezeDeep({ [WORLD_DESIGN_SECRET_SEAL.id]: { x: 326, y: 3270, facing: 'east' } });

const XP_PER_LEVEL = HMH_V7_RUN_RULES.OBJECTIVE_XP_PER_LEVEL;
const byId = (left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
const rewardGrant = (reward) => (reward === 'heal' ? [{ type: 'grant', grant: 'heal', amount: 30 }] : reward === 'ammo' ? [{ type: 'grant', grant: 'ammo' }] : []);

function machineRow(site) {
  const spec = MACHINE_MODES[site.id];
  const contract = HMH_V7_OBJECTIVES[site.id];
  return {
    id: site.id,
    objectiveClass: contract.class,
    districtId: site.districtId,
    name: site.name,
    task: spec.task,
    kind: site.kind,
    mode: spec.mode,
    clip: spec.clip,
    fillTicks: site.holdTicks,
    ringRadius: MISSION_RULES[spec.mode].ringRadius,
    anchor: { x: site.x, y: site.y },
    operate: { x: site.x, y: site.y, facing: site.facing },
    propBlockerId: `${site.id}-control-body`,
    requires: spec.requires ?? null,
    xpPerLevel: XP_PER_LEVEL[contract.class],
    // Package §3.1: a switch grants its prop effect. The site heal and ammo
    // grants stay until the prisoners slice adds the Medic and Quartermaster
    // pools, so sustain changes once, not twice.
    effects: [
      { type: 'open-gate', gateId: site.gateId },
      ...(site.hazard ? [{ type: 'toggle-hazard', siteId: site.id }] : []),
      ...rewardGrant(site.reward),
    ],
  };
}

function gateRow(site) {
  const [id, name] = MACHINE_MODES[site.id].gateObjective;
  const blocker = WORLD_DESIGN_COURT_BLOCKERS.find((candidate) => candidate.id === site.gateId);
  return {
    id, objectiveClass: 'gate', districtId: site.districtId, name, task: null, kind: 'gate',
    mode: 'gate', clip: null, fillTicks: 0, ringRadius: 0,
    anchor: { x: blocker.anchor.x, y: blocker.anchor.y }, operate: null, propBlockerId: site.gateId,
    // Gates are never zones: the switch that opens the gate completes it.
    openedBy: site.id, gateId: site.gateId, requires: null,
    xpPerLevel: XP_PER_LEVEL.gate, effects: [],
  };
}

function secretRow(secret) {
  const pry = secret.sealId ? SEAL_PRY[secret.sealId] : null;
  return {
    id: secret.id, objectiveClass: 'secret', districtId: HMH_V7_OBJECTIVES[secret.id].district, name: secret.name, task: null, kind: 'secret',
    mode: 'enter', clip: null, fillTicks: 0, ringRadius: MISSION_RULES.secretEnterRadius,
    anchor: { x: secret.x, y: secret.y, groundZ: secret.groundZ }, operate: null, propBlockerId: null, requires: null,
    xpPerLevel: XP_PER_LEVEL.secret, lore: secret.lore,
    seal: pry ? {
      id: secret.sealId,
      anchor: secret.sealId === WORLD_DESIGN_SECRET_SEAL.id ? { ...WORLD_DESIGN_SECRET_SEAL.anchor } : { x: secret.x, y: secret.y },
      hitPoints: MISSION_RULES.sealHitPoints,
      pry: { ...pry, fillTicks: MISSION_RULES.pryTicks },
    } : null,
    effects: [{ type: 'grant', grant: 'silver', coins: HMH_V7_RUN_RULES.SILVER_PER_SECRET }, ...rewardGrant(secret.reward)],
  };
}

const itemRow = {
  id: WINCH_HANDLE.id, objectiveClass: 'item', districtId: HMH_V7_OBJECTIVES[WINCH_HANDLE.id].district, name: WINCH_HANDLE.name,
  task: `Find the ${WINCH_HANDLE.name}`, kind: 'item', mode: 'touch', clip: null, fillTicks: 0, ringRadius: MISSION_RULES.itemTouchRadius,
  anchor: { x: WINCH_HANDLE.x, y: WINCH_HANDLE.y }, operate: null, propBlockerId: null, requires: null,
  xpPerLevel: XP_PER_LEVEL.item, effects: [{ type: 'grant', grant: 'item', itemId: WINCH_HANDLE.id }],
};

export const MISSION_OBJECTIVES = freezeDeep([
  ...WORLD_DESIGN_SITES.map(machineRow),
  ...WORLD_DESIGN_SITES.filter((site) => MACHINE_MODES[site.id].gateObjective).map(gateRow),
  ...WORLD_DESIGN_SECRETS.map(secretRow),
  itemRow,
].sort(byId));

// Zones are what a hero can stand in: machine rings and seal pry spots.
function buildZones(objectives) {
  const zones = [];
  for (const row of objectives) {
    if (['quick', 'channel', 'seal'].includes(row.mode)) {
      zones.push({
        id: row.id, objectiveId: row.id, kind: 'machine', mode: row.mode, clip: row.clip, fillTicks: row.fillTicks,
        ringRadius: row.ringRadius, x: row.operate.x, y: row.operate.y, facing: row.operate.facing,
        blockerId: row.propBlockerId ?? null, requires: row.requires ?? null, readyTick: row.readyTick ?? 0, sealId: null,
      });
    }
    if (row.seal?.pry) {
      const pry = row.seal.pry;
      zones.push({
        id: `${row.id}:pry`, objectiveId: row.id, kind: 'pry', mode: 'channel', clip: 'kneel', fillTicks: pry.fillTicks,
        ringRadius: MISSION_RULES.channel.ringRadius, x: pry.x, y: pry.y, facing: pry.facing,
        blockerId: row.seal.id, requires: null, readyTick: 0, sealId: row.seal.id,
      });
    }
  }
  return freezeDeep(zones.sort(byId));
}

const freshZone = () => ({
  progress: 0, committed: false, commitTick: -1, commitStill: false, insideTicks: 0,
  stillTicks: 0, operatingSince: null, pausedUntil: -1, leftTick: null,
});

export function createMissionState(seed = 0, { objectives = MISSION_OBJECTIVES } = {}) {
  if (!Number.isInteger(seed)) throw new TypeError('mission seed must be an integer');
  const zones = buildZones(objectives);
  return {
    seed: seed >>> 0,
    objectives,
    rowsById: new Map(objectives.map((row) => [row.id, row])),
    zones,
    lastTick: -1,
    // objectiveId -> completion tick; the steam hazard reads the valve here.
    completed: new Map(),
    // objectiveId -> the level just before that node's own XP grant.
    levels: new Map(),
    // Opened blocker ids (court gates, seals, and broken cover added by main).
    openGates: new Set(),
    seals: new Map(objectives.filter((row) => row.seal).map((row) => [row.seal.id, row.seal.hitPoints])),
    zoneState: new Map(zones.map((zone) => [zone.id, freshZone()])),
    discovered: new Set(),
    activeZoneId: null,
    operating: null,
    dock: null,
    stowed: false,
  };
}

function zoneDone(state, zone) {
  return zone.kind === 'pry' ? !(state.seals.get(zone.sealId) > 0) || state.completed.has(zone.objectiveId) : state.completed.has(zone.objectiveId);
}

function zoneLocked(state, zone) {
  return Boolean(zone.requires) && !state.completed.has(zone.requires);
}

function zoneEligible(state, zone, tick) {
  return !zoneDone(state, zone) && !zoneLocked(state, zone) && tick >= zone.readyTick;
}

function completeObjective(state, row, tick, events) {
  if (state.completed.has(row.id)) return;
  state.completed.set(row.id, tick);
  for (const effect of row.effects) if (effect.type === 'open-gate') state.openGates.add(effect.gateId);
  events.push(freezeDeep({ type: 'objective-completed', objectiveId: row.id, objectiveClass: row.objectiveClass, xpPerLevel: row.xpPerLevel, tick, effects: row.effects }));
  // A gate objective completes right after the switch that opens it.
  for (const gate of state.objectives) if (gate.openedBy === row.id) completeObjective(state, gate, tick, events);
}

function openSeal(state, sealId, tick, via, events) {
  if (!(state.seals.get(sealId) > 0)) return;
  state.seals.set(sealId, 0);
  state.openGates.add(sealId);
  const row = state.objectives.find((candidate) => candidate.seal?.id === sealId);
  events.push(freezeDeep({ type: 'seal-opened', sealId, objectiveId: row.id, via, tick }));
}

// One fixed step. Order within the tick (package §3.2): movement has run; the
// mission step reads the previous tick's hit; main then applies the grants,
// gate changes and navgrid patches before the director, enemies and combat.
export function stepMissionObjectives(state, {
  tick,
  player,
  move = { x: 0, y: 0 },
  dashing = false,
  lastPlayerHitTick = -1,
  queryGround,
  lineClear = () => true,
  logicalView = null,
} = {}) {
  if (!Number.isInteger(tick) || tick < 0 || tick <= state.lastTick) throw new TypeError('mission ticks must be monotonic');
  if (![player?.x, player?.y].every(Number.isFinite)) throw new TypeError('finite player position required');
  if (typeof queryGround !== 'function') throw new TypeError('queryGround is required');
  state.lastTick = tick;
  const rules = MISSION_RULES;
  const playerZ = player.groundZ ?? 0;
  const still = !dashing && Math.hypot(move?.x ?? 0, move?.y ?? 0) < rules.stillMoveMagnitude;
  const hit = Number.isInteger(lastPlayerHitTick) && lastPlayerHitTick >= 0 && lastPlayerHitTick === tick - 1;
  const events = [];
  const from = { x: player.x, y: player.y, groundZ: playerZ };
  const reaches = (point, radius, exclude = null) => Math.hypot(player.x - point.x, player.y - point.y) <= radius
    && Math.abs(playerZ - queryGround(point.x, point.y).groundZ) <= rules.heightBand
    && lineClear(from, { x: point.x, y: point.y, groundZ: queryGround(point.x, point.y).groundZ }, exclude);

  // Discovery reads the logical view of the simulated actor, never the camera.
  if (logicalView) {
    for (const row of state.objectives) {
      if (row.objectiveClass === 'secret' || state.discovered.has(row.id)) continue;
      const { x, y } = row.anchor;
      if (x >= logicalView.minX && x <= logicalView.maxX && y >= logicalView.minY && y <= logicalView.maxY) state.discovered.add(row.id);
    }
  }

  // Items are touched and hidden volumes entered; a sealed volume waits for
  // its seal, which opens no earlier than the previous tick.
  for (const row of state.objectives) {
    if (state.completed.has(row.id)) continue;
    if (row.mode === 'touch' && reaches(row.anchor, rules.itemTouchRadius)) completeObjective(state, row, tick, events);
    if (row.mode === 'enter' && !(row.seal && state.seals.get(row.seal.id) > 0) && reaches(row.anchor, rules.secretEnterRadius)) {
      completeObjective(state, row, tick, events);
    }
  }

  // One zone is active: the nearest eligible ring containing the hero, on its
  // height and in sight of its operate spot. Zones are sorted by id, so a tie
  // keeps the lower id.
  let active = null;
  let activeDistance = Infinity;
  for (const zone of state.zones) {
    if (!zoneEligible(state, zone, tick)) continue;
    const distance = Math.hypot(player.x - zone.x, player.y - zone.y);
    if (distance > zone.ringRadius || distance >= activeDistance) continue;
    if (!reaches(zone, zone.ringRadius, zone.blockerId)) continue;
    active = zone;
    activeDistance = distance;
  }
  state.activeZoneId = active?.id ?? null;

  let operating = null;
  const filled = [];
  for (const zone of state.zones) {
    if (zoneDone(state, zone)) continue;
    const z = state.zoneState.get(zone.id);
    const isActive = zone === active;
    if (zone.mode === 'quick') {
      if (!z.committed) {
        z.insideTicks = isActive ? z.insideTicks + 1 : 0;
        if (z.insideTicks >= rules.quick.commitTicks) {
          z.committed = true;
          z.commitTick = tick;
          z.commitStill = isActive && still;
        }
      }
      if (z.committed) {
        z.progress += 1;
        // The press or lever clip plays only if the hero stood still at the
        // commit, and only until the hero moves.
        if (!(isActive && still)) z.commitStill = false;
        if (z.commitStill) operating = { zone, since: z.commitTick };
      }
    } else if (isActive) {
      if (hit) z.pausedUntil = Math.max(z.pausedUntil, tick + rules.hitPauseTicks);
      z.leftTick = null;
      if (still) {
        z.stillTicks += 1;
        z.operatingSince ??= tick;
        if (tick >= z.pausedUntil) z.progress += 1;
        operating = { zone, since: z.operatingSince };
      } else {
        z.stillTicks = 0;
        z.operatingSince = null;
      }
    } else {
      z.stillTicks = 0;
      z.operatingSince = null;
      z.insideTicks = 0;
      if (z.progress > 0) {
        if (zone.mode === 'seal') z.progress = Math.max(0, z.progress - rules.seal.drainPerTick);
        else {
          z.leftTick ??= tick;
          if (tick - z.leftTick >= rules.channel.holdAfterLeaveTicks) z.progress = Math.max(0, z.progress - rules.channel.drainPerTick);
        }
      }
    }
    if (z.progress >= zone.fillTicks) filled.push(zone);
  }

  for (const zone of filled) {
    if (zone.kind === 'pry') openSeal(state, zone.sealId, tick, 'pry', events);
    else completeObjective(state, state.rowsById.get(zone.objectiveId), tick, events);
    if (operating?.zone === zone) operating = null;
  }

  state.operating = operating ? Object.freeze({
    zoneId: operating.zone.id, objectiveId: operating.zone.objectiveId, mode: operating.zone.mode, clip: operating.zone.clip,
    facing: operating.zone.facing, x: operating.zone.x, y: operating.zone.y, sinceTick: operating.since,
  }) : null;
  // Auto-fire and the auto-knife pause while a clip plays; manual grenade and
  // dodge stay available (main).
  state.stowed = operating !== null;
  // Docking: after 6 still ticks the hero glides onto the operate spot, for at
  // most 16 ticks (package §3.2). The glide itself is applied by the next
  // tick's movement (missionDockStep), so any move input cancels it.
  state.dock = null;
  if (operating && operating.zone.mode !== 'quick') {
    const z = state.zoneState.get(operating.zone.id);
    const distance = Math.hypot(operating.zone.x - player.x, operating.zone.y - player.y);
    if (z.stillTicks >= rules.dockAfterStillTicks && z.stillTicks < rules.dockAfterStillTicks + rules.dockMaxTicks && distance > 1e-6) {
      state.dock = Object.freeze({ x: operating.zone.x, y: operating.zone.y, facing: operating.zone.facing });
    }
  }
  return Object.freeze({ tick, events: Object.freeze(events) });
}

// The dock glide for this tick's movement, or null. Pure: main applies it with
// swept collision in place of the hero's own movement.
export function missionDockStep(state, { player, move = { x: 0, y: 0 }, dashing = false } = {}) {
  if (!state?.dock || dashing || Math.hypot(move?.x ?? 0, move?.y ?? 0) >= MISSION_RULES.stillMoveMagnitude) return null;
  const dx = state.dock.x - player.x;
  const dy = state.dock.y - player.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= 1e-6) return null;
  const step = Math.min(MISSION_RULES.dockStepUnits, distance) / distance;
  return Object.freeze({ x: dx * step, y: dy * step, facing: state.dock.facing });
}

// Records the level a node was completed at (the level just before its own XP
// grant, after every earlier grant of the tick) and returns that grant.
export function settleMissionObjective(state, objectiveId, level) {
  if (!state.completed.has(objectiveId)) throw new Error(`objective ${objectiveId} is not completed`);
  if (state.levels.has(objectiveId)) throw new Error(`objective ${objectiveId} is already settled`);
  if (!Number.isInteger(level) || level < 1) throw new TypeError('level must be a positive integer');
  state.levels.set(objectiveId, level);
  return Object.freeze({ baseXp: state.rowsById.get(objectiveId).xpPerLevel * level });
}

export function missionActiveBlockers(state, blockers) {
  return Object.freeze(blockers.filter((blocker) => !state.openGates.has(blocker.id)));
}

// Combat targets for intact seals (breakables: the knife and every player
// weapon hit them; the nuke, world hazards and enemies never do).
export function missionSealTargets(state) {
  const targets = [];
  for (const row of state.objectives) {
    if (!row.seal || !(state.seals.get(row.seal.id) > 0)) continue;
    const { x, y } = row.seal.anchor;
    targets.push({ id: row.seal.id, x, y, previousX: x, previousY: y, groundZ: 0, previousGroundZ: 0, radius: 20, health: state.seals.get(row.seal.id), maxHealth: row.seal.hitPoints, active: true });
  }
  return targets;
}

export function applyMissionSealDamage(state, { sealId, health, tick }) {
  const events = [];
  if (!(state.seals.get(sealId) > 0) || !Number.isFinite(health)) return events;
  if (health > 0) state.seals.set(sealId, Math.min(state.seals.get(sealId), health));
  else openSeal(state, sealId, tick, 'break', events);
  return events;
}

export function missionHiddenSecretProps(state) {
  const hidden = new Set();
  for (const row of state.objectives) {
    if (row.objectiveClass !== 'secret') continue;
    if (row.seal) hidden.add(state.seals.get(row.seal.id) > 0 ? `secret-prop:${row.id}` : 'secret-seal-prop');
    // The logbook stays in place as lore; the other caches are taken.
    if (state.completed.has(row.id) && row.id !== 'warehouse-logbook') hidden.add(`secret-prop:${row.id}`);
  }
  return hidden;
}

// The v7 `objectives` rows (contract §4): dense, in catalogue order.
export function missionObjectiveRows(state) {
  return Object.freeze(HMH_RUN_SUMMARY_CATALOGS_V7.objectives.map((objectiveId) => {
    const done = state.completed.has(objectiveId);
    return Object.freeze({
      objectiveId,
      completed: done ? 1 : 0,
      tick: done ? state.completed.get(objectiveId) : 0,
      levelAtCompletion: done ? (state.levels.get(objectiveId) ?? 0) : 0,
    });
  }));
}

// Read-only view for rings, lamps, the tracker and the field map.
export function missionPresentation(state) {
  const zones = state.zones.map((zone) => {
    const z = state.zoneState.get(zone.id);
    const done = zoneDone(state, zone);
    const locked = !done && zoneLocked(state, zone);
    const filling = state.operating?.zoneId === zone.id || (zone.mode === 'quick' && z.committed && !done);
    const phase = done ? 'done' : locked ? 'locked' : filling ? 'filling' : z.progress > 0 ? 'held' : 'ready';
    return Object.freeze({
      zoneId: zone.id, objectiveId: zone.objectiveId, kind: zone.kind, mode: zone.mode, clip: zone.clip,
      x: zone.x, y: zone.y, facing: zone.facing, ringRadius: zone.ringRadius, requires: zone.requires,
      progress: done ? 1 : z.progress / zone.fillTicks, state: phase,
      paused: phase === 'filling' && state.lastTick < z.pausedUntil,
    });
  });
  return Object.freeze({
    tick: state.lastTick,
    activeZoneId: state.activeZoneId,
    operating: state.operating,
    stowed: state.stowed,
    zones: Object.freeze(zones),
  });
}
