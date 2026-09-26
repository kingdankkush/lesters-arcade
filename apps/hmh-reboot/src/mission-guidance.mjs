// Objective guidance without a minimap (design package §3.3, slice S1.4): the
// tracker pill's choice, its one line of text and the pause field map's node
// list. Projection only: it reads mission state and never writes it, so the
// tracker's own memory (hysteresis) can never reach the simulation.

export const MISSION_UNITS_PER_METRE = 40;
// A tracked node keeps the pill until a node of the same priority is at least
// this much closer (10 m), so the pill does not flicker between neighbours.
export const MISSION_TRACK_HYSTERESIS_UNITS = 400;
const ARROWS = Object.freeze(['→', '↘', '↓', '↙', '←', '↖', '↑', '↗']);

const byDistance = (player) => (left, right) => Math.hypot(left.x - player.x, left.y - player.y) - Math.hypot(right.x - player.x, right.y - player.y)
  || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0);

// A district's chain: its switches and items, each after the node it needs.
export function missionDistrictChain(objectives, districtId) {
  const rows = objectives.filter((row) => row.districtId === districtId && (row.objectiveClass === 'switch' || row.objectiveClass === 'item'));
  const ordered = [];
  const place = (row) => {
    if (ordered.includes(row)) return;
    const needed = rows.find((candidate) => candidate.id === row.requires);
    if (needed) place(needed);
    ordered.push(row);
  };
  for (const row of rows) place(row);
  return ordered;
}

const trackOf = (priority, id, x, y, task, glyph) => ({ priority, id, x, y, task, glyph });

// Candidates in priority order (package §3.3): 1 an active channel; 2 a ready
// boss trigger in the current district; 3 the next step of the current
// district's chain, even undiscovered; 4 the nearest discovered prisoner or
// claimable station; 5 the nearest discovered ready strongbox. Secrets are
// never tracked.
function trackCandidates(mission, { districtId, stations }) {
  const rows = mission.rowsById;
  const operating = mission.operating;
  if (operating && operating.mode !== 'quick') {
    const row = rows.get(operating.objectiveId);
    if (row.objectiveClass !== 'secret') return [trackOf(1, row.id, operating.x, operating.y, row.task, row.objectiveClass)];
  }
  // A boss trigger counts only while its slot arms it (ready, unsettled, no
  // fight live); the armed set already folds in its readyTick.
  const ready = mission.zones.filter((zone) => zone.mode === 'seal' && zone.bossZone?.kind === 'trigger' && mission.bossZoneArmed?.has(zone.id)
    && rows.get(zone.objectiveId)?.districtId === districtId);
  if (ready.length) return ready.map((zone) => trackOf(2, zone.objectiveId, zone.x, zone.y, rows.get(zone.objectiveId).task, 'boss'));
  const next = missionDistrictChain(mission.objectives, districtId).find((row) => !mission.completed.has(row.id));
  if (next) {
    const point = next.operate ?? next.anchor;
    return [trackOf(3, next.id, point.x, point.y, next.task, next.objectiveClass)];
  }
  return stations.map((station) => trackOf(4, station.id, station.x, station.y, station.task, 'station'));
}

// The node the pill tracks this frame, or null (a boss bar hides the pill).
export function selectMissionTrack(mission, { player, districtId, stations = [], previous = null, bossBarVisible = false } = {}) {
  if (!mission || bossBarVisible) return null;
  const candidates = trackCandidates(mission, { districtId, stations }).sort(byDistance(player));
  if (!candidates.length) return null;
  const best = candidates[0];
  const kept = previous && candidates.find((candidate) => candidate.id === previous.id && candidate.priority === best.priority);
  const chosen = kept && Math.hypot(kept.x - player.x, kept.y - player.y) - Math.hypot(best.x - player.x, best.y - player.y) < MISSION_TRACK_HYSTERESIS_UNITS ? kept : best;
  const dx = chosen.x - player.x;
  const dy = chosen.y - player.y;
  const metres = Math.round(Math.hypot(dx, dy) / MISSION_UNITS_PER_METRE);
  // World +y is south on screen, so the world bearing is the screen bearing.
  const arrow = ARROWS[((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8];
  return Object.freeze({
    ...chosen,
    metres,
    arrow,
    bearing: Math.atan2(dy, dx),
    text: `${chosen.task} · ${metres} m ${arrow}`,
    compactText: `${metres} m ${arrow}`,
  });
}

// Havens and first-clear caches whose machine is done (or, for the Liquidator
// Vault, whose owner the collectible state has unlocked) and whose reward can
// be taken now (package §3.3 priority 4).
export function missionClaimableStations({ mission, rewards, rewardState, canClaim = () => true, unlocked = null }) {
  const stations = [];
  for (const reward of rewards) {
    if (!mission.completed.has(reward.objectiveId) && !unlocked?.has(reward.objectiveId)) continue;
    if (rewardState(reward.id) !== 'reward-available' || !canClaim(reward)) continue;
    stations.push({ id: reward.id, x: reward.x, y: reward.y, task: `${reward.name} · ${reward.rewardName}` });
  }
  return stations;
}

// The pause field map's objective list: discovered nodes by state, found
// secrets with their lore. Never an undiscovered secret.
export function missionFieldMapNodes(mission) {
  const nodes = [];
  for (const row of mission.objectives) {
    const done = mission.completed.has(row.id);
    if (row.objectiveClass === 'secret') {
      if (done) nodes.push({ id: row.id, name: row.name, objectiveClass: row.objectiveClass, state: 'done', x: row.anchor.x, y: row.anchor.y, lore: row.lore ?? '' });
      continue;
    }
    if (!done && !mission.discovered.has(row.id)) continue;
    const locked = !done && row.requires && !mission.completed.has(row.requires);
    const zone = mission.zoneState?.get(row.id);
    const point = row.operate ?? row.anchor;
    nodes.push({
      id: row.id, name: row.name, objectiveClass: row.objectiveClass, x: point.x, y: point.y,
      state: done ? 'done' : locked ? 'locked' : zone?.progress > 0 ? 'started' : 'ready',
      task: row.task ?? null,
      needs: locked ? mission.rowsById.get(row.requires).name : null,
    });
  }
  return nodes;
}
