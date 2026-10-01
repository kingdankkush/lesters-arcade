// Honest pilots for the 2.1.0 child on its ten-area Level 1
// (docs/2.0/slices/HMH-RANKED-V8-TEN-AREA.md). Like pilot.mjs, a pilot only
// reads state a player can see (positions, pickups, machines, courts, its
// own health, charges and weapons, the cover and ledge prompt rings) and
// answers with a virtual gamepad: left stick move, right stick aim, LB
// grenade, RB weapon-next. Firing, melee and dodges stay automatic. Pilots
// never write simulation state; they plan on their own copy of the world.
//
// pilot.mjs (the legacy map's pilots) is left untouched so the legacy
// real-child corpus keeps its exact runs.
import { createWorldV2GroundQuery, createWorldV2RuntimeWorld, getWorldV2DistrictAt } from '../../apps/hmh-reboot/src/world-v2-runtime-world.mjs';
import { createWorldV2Gameplay } from '../../apps/hmh-reboot/src/world-v2-gameplay.mjs';
import { createWorldV2NavGrid } from '../../apps/hmh-reboot/src/world-v2-navgrid.mjs';
import { computeEnemyFlowField, sampleFlowDirection } from '../../apps/hmh-reboot/src/enemy-navgrid.mjs';
import { HMH_V7_BOSSES } from '../../sdk/hmh-run-contract-v7.mjs';
import { HMH_V8_TRAVEL } from '../../sdk/hmh-run-contract-v8.mjs';
import { collectibleIsAvailable } from '../../apps/hmh-reboot/src/objective-rewards.mjs';
import { canAcceptCollectible } from '../../apps/hmh-reboot/src/collectible-capacity.mjs';
import { progressionByWeapon } from '../../apps/hmh-reboot/src/weapon-system.mjs';

let WORLD = null;
function tenArea() {
  if (WORLD) return WORLD;
  const world = createWorldV2RuntimeWorld({ official: true });
  const queryGround = createWorldV2GroundQuery(world);
  WORLD = { world, queryGround, gameplay: createWorldV2Gameplay(world), grid: createWorldV2NavGrid({ world, queryGround }) };
  return WORLD;
}

function rng(seed) {
  let state = (seed >>> 0) || 0x9e3779b9;
  return () => {
    state ^= state << 13; state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5; state >>>= 0;
    return state / 0x1_0000_0000;
  };
}

const THREAT_WEIGHT = {
  'bagholder-rusher': 1, forkrunner: 1.1, 'liquidator-agent': 1.2, 'whale-enforcer': 1.8, 'gas-bomber': 1.4, 'validator-cultist': 1.3,
  'rug-puller': 1.1, 'pump-and-dump-bloater': 1.8, tollkeeper: 1.8, 'hodl-revenant': 1, 'money-printer': 1.4, 'oracle-marksman': 1.2,
};
const BOSS_IDS = ['rug-pull-baron', 'lockkeeper', 'fifty-one-percent-foreman', 'liquidator'];

// The tour of the ten areas over the travel graph, from the Meadows: a
// depth-first walk that comes back through the areas it crossed, so every
// leg is one road.
function areaTour(startId, random) {
  const neighbours = new Map();
  for (const [a, b] of HMH_V8_TRAVEL.edges) {
    neighbours.set(a, [...(neighbours.get(a) ?? []), b]);
    neighbours.set(b, [...(neighbours.get(b) ?? []), a]);
  }
  const seen = new Set([startId]);
  const order = [startId];
  const visit = (id) => {
    const next = [...(neighbours.get(id) ?? [])].sort().sort(() => random() - 0.5);
    for (const other of next) {
      if (seen.has(other)) continue;
      seen.add(other);
      order.push(other);
      visit(other);
      order.push(id);
    }
  };
  visit(startId);
  return order;
}

export const TEN_AREA_STYLE_DEFAULTS = Object.freeze({
  suicide: { kite: 0, pickups: false, sites: false, grenades: false, swaps: false, explore: false },
  idle: { still: true },
  brawler: { kite: 0.6, pickups: true, grenades: true, swaps: true, hunt: true, localRadius: 1200 },
  camper: { kite: 2, pickups: true, grenades: true, swaps: true, camper: true, healAt: 0.6, localRadius: 700, upgrades: ['proof-of-work', 'diamond-hands', 'hardened-wallet', 'compound-interest'] },
  grenadier: { kite: 1.2, pickups: true, sites: true, grenades: true, grenadeCooldown: 45, swaps: true, favour: ['nuke-liquidation', 'launcher-rig-cache', 'bonus-life'], upgrades: ['cold-storage', 'diamond-hands', 'proof-of-work', 'hot-wallet'], localRadius: 2500 },
  hunter: { kite: 1.3, pickups: true, sites: true, grenades: true, swaps: true, cycleSwaps: true, pickupFirst: true, upgrades: ['validator-training', 'block-reward', 'hot-wallet', 'diamond-hands'] },
  explorer: { kite: 1.2, pickups: true, sites: true, grenades: true, swaps: true, explore: true, healAt: 0.6, upgrades: ['hot-wallet', 'diamond-hands', 'gas-optimization', 'proof-of-work', 'hardened-wallet'] },
  turtle: { kite: 2.2, pickups: true, sites: true, grenades: true, swaps: true, orbit: true, orbitRadius: 700, healAt: 0.7, localRadius: 1600, upgrades: ['proof-of-work', 'diamond-hands', 'hot-wallet', 'gas-optimization', 'compound-interest', 'hardened-wallet'] },
  // Cover user: walks to the nearest wall face when the crowd closes in,
  // pushes into it (the prompt ring shows where) and fights from cover, then
  // steps out when the area is quiet or it needs a heal.
  cover: { kite: 1, pickups: true, sites: true, grenades: true, swaps: true, cover: true, healAt: 0.5, localRadius: 1600, upgrades: ['diamond-hands', 'proof-of-work', 'hardened-wallet', 'hot-wallet'] },
  // Ledge runner: climbs and drops at every ledge the prompt rings show
  // (mantles and drops), touring the areas between them.
  ledge: { kite: 1.2, pickups: true, sites: true, grenades: true, swaps: true, explore: true, ledges: true, healAt: 0.6, upgrades: ['diamond-hands', 'hot-wallet', 'gas-optimization', 'proof-of-work'] },
  // Boss seekers: survive and tour until a lead before the boss is ready,
  // walk to its court (the district bosses start at the court threshold, the
  // Liquidator at the Closing Bell in the City), and fight it orbiting the
  // court; after a defeat they move on to the next ready boss.
  baron: { kite: 1.4, pickups: true, sites: true, grenades: true, swaps: true, explore: true, bosses: ['rug-pull-baron', 'lockkeeper', 'fifty-one-percent-foreman', 'liquidator'], bossLead: 2_400, healAt: 0.7, upgrades: ['diamond-hands', 'hardened-wallet', 'proof-of-work', 'hot-wallet', 'compound-interest'] },
  // The later bosses' seekers survive like the turtle (laps around the
  // Meadows, heals early) until their lead, then trek to the court.
  lockkeeper: { kite: 2.2, pickups: true, sites: true, grenades: true, swaps: true, orbit: true, orbitRadius: 700, localRadius: 1600, bosses: ['lockkeeper', 'fifty-one-percent-foreman', 'liquidator'], bossLead: 3_000, healAt: 0.7, upgrades: ['proof-of-work', 'diamond-hands', 'hot-wallet', 'gas-optimization', 'compound-interest', 'hardened-wallet'] },
  foreman: { kite: 2.2, pickups: true, sites: true, grenades: true, swaps: true, orbit: true, orbitRadius: 700, localRadius: 1600, bosses: ['fifty-one-percent-foreman', 'liquidator'], bossLead: 3_000, healAt: 0.7, upgrades: ['proof-of-work', 'diamond-hands', 'hot-wallet', 'gas-optimization', 'compound-interest', 'hardened-wallet'] },
  bell: { kite: 2.2, pickups: true, sites: true, grenades: true, swaps: true, orbit: true, orbitRadius: 700, localRadius: 1600, bosses: ['liquidator'], bossLead: 3_600, healAt: 0.7, upgrades: ['proof-of-work', 'diamond-hands', 'hot-wallet', 'gas-optimization', 'compound-interest', 'hardened-wallet'] },
});

export function createTenAreaPilot({ style, seed, tickCap }) {
  const { world, gameplay, grid } = tenArea();
  const cfg = { healAt: 0.45, grenadeCooldown: 120, favour: [], upgrades: [], tellAvoid: 1, localRadius: Infinity, weaponPreference: ['auto-miner', 'scatter-shotgun', 'lightning-ledger', 'bear-market-burner', 'forked-standard', 'coin-blaster', 'launcher-rig', 'hash-rail'], ...TEN_AREA_STYLE_DEFAULTS[style] };
  if (!TEN_AREA_STYLE_DEFAULTS[style]) throw new TypeError(`unknown ten-area style ${style}`);
  const random = rng(seed ^ 0x2545f491);
  const entry = world.player.spawn;
  const stats = { grenadePresses: 0, swapPresses: 0, stuckEvents: 0, goals: {}, surrenderedAt: null, bossesStarted: [], maxEnemies: 0, lowestHealth: Infinity, areas: [], coverPushes: 0, ledgePushes: 0 };
  const blacklist = new Map();
  const fieldCache = { key: '', field: null, tick: -1 };
  let goal = null;
  let goalSetTick = -1;
  let lastProgressCheck = { tick: 0, x: entry.x, y: entry.y };
  let jitter = null;
  let grenadeState = { phase: 'idle', until: 0, dir: null, lastThrowTick: -10_000 };
  let swapHeldUntil = -1;
  let nextSwapTick = 900 + Math.floor(random() * 1200);
  let holdSince = -1;
  let orbitSide = 1;
  let coverPlan = null;
  const ledgeDone = new Set();
  const tour = areaTour('mweb-meadows', random).map((id) => world.districts.find((district) => district.id === id));
  let tourIndex = 0;
  const machines = gameplay.missionObjectives.map((row) => ({ x: row.operate.x, y: row.operate.y, id: row.id, kind: 'site', hold: true, holdRadius: Math.min(40, row.ringRadius * 0.5), holdTicks: row.fillTicks + 600 }));
  const bell = gameplay.missionBossZones.find((row) => row.bossZone?.kind === 'trigger');
  const home = { x: entry.x, y: entry.y };

  const walkableAt = (x, y) => { const cell = grid.cellAt(x, y); return cell >= 0 && grid.walkable[cell] === 1; };
  const liveBosses = (spies, tick) => Object.values(spies.bossSlots?.slots ?? {})
    .map((slot) => slot.boss).filter((boss) => boss?.active && boss.health > 0 && tick >= boss.startTick);
  const hostile = (spies, tick) => {
    const list = (spies.population?.active ?? []).filter((enemy) => enemy.active && enemy.health > 0);
    for (const boss of liveBosses(spies, tick)) list.push({ ...boss, archetypeId: 'boss', isBoss: true });
    return list;
  };
  const flowTowards = (me, target, tick) => {
    const dx = target.x - me.x;
    const dy = target.y - me.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 70) return distance > 1 ? { x: dx / distance, y: dy / distance } : { x: 0, y: 0 };
    const key = `${grid.cellAt(target.x, target.y)}`;
    if (fieldCache.key !== key || tick - fieldCache.tick > 240) {
      fieldCache.key = key;
      fieldCache.field = computeEnemyFlowField({ grid, targetX: target.x, targetY: target.y });
      fieldCache.tick = tick;
    }
    return sampleFlowDirection(grid, fieldCache.field, me.x, me.y) ?? { x: dx / distance, y: dy / distance };
  };
  const pickupCandidates = (spies, tick) => {
    const state = spies.collectibles;
    if (!state || !spies.loadout || !spies.progression) return [];
    const pbw = progressionByWeapon(spies.progression.ranks);
    const out = [];
    for (const item of state.entries) {
      const placement = item.placement;
      if (!collectibleIsAvailable(state, placement, tick) || blacklist.get(placement.id) > tick) continue;
      if (!walkableAt(placement.x, placement.y)) continue;
      if (!canAcceptCollectible(item.effect, { health: spies.health ?? 100, maxHealth: spies.maxHealth ?? 100, grenades: spies.grenades?.handCharges ?? 0, maxGrenades: spies.grenades?.maxHandCharges ?? 5, loadout: spies.loadout, progressionByWeapon: pbw })) continue;
      out.push({ x: placement.x, y: placement.y, id: placement.id, kind: 'pickup', effect: item.effect });
    }
    return out;
  };

  // The next boss this style hunts that is not yet down.
  const bossTarget = (spies, tick) => {
    for (const bossId of cfg.bosses ?? []) {
      const slot = spies.bossSlots?.slots?.[bossId];
      if (!slot || slot.status === 'defeated') continue;
      if (tick < HMH_V7_BOSSES[bossId].readyTick - cfg.bossLead) return null;
      return { bossId, slot };
    }
    return null;
  };

  const chooseGoal = (spies, tick, me) => {
    const health = spies.health ?? 100;
    const maxHealth = spies.maxHealth ?? 100;
    const dist = (p) => Math.hypot(p.x - me.x, p.y - me.y);
    const pickups = cfg.pickups ? pickupCandidates(spies, tick) : [];
    const heal = pickups.filter((p) => p.effect.kind === 'heal').sort((a, b) => dist(a) - dist(b))[0];
    if (heal && health < maxHealth * cfg.healAt && dist(heal) < 3000) return heal;
    const hunt = bossTarget(spies, tick);
    if (hunt) {
      const definition = spies.bossSlots.definitions?.[hunt.bossId];
      const live = hunt.slot.boss?.active && hunt.slot.boss.health > 0;
      if (live) {
        const boss = hunt.slot.boss;
        const centre = definition?.arenas?.threshold?.centre ?? definition?.arenas?.bell?.centre ?? boss;
        const angle = Math.atan2(me.y - centre.y, me.x - centre.x) + orbitSide * 0.45;
        const target = { x: centre.x + Math.cos(angle) * 360, y: centre.y + Math.sin(angle) * 360 };
        if (!walkableAt(target.x, target.y)) orbitSide = -orbitSide;
        return { ...target, id: `boss-orbit-${Math.floor(tick / 30)}`, kind: 'boss' };
      }
      if (hunt.bossId === 'liquidator') {
        if (tick >= HMH_V7_BOSSES.liquidator.readyTick && !(blacklist.get('boss-bell') > tick)) return { x: bell.operate.x, y: bell.operate.y, id: 'boss-bell', kind: 'boss', hold: true, holdRadius: 40, holdTicks: bell.fillTicks + 900 };
        return { x: bell.operate.x - 500, y: bell.operate.y, id: 'boss-stage-liquidator', kind: 'boss' };
      }
      const court = definition?.arenas?.threshold;
      if (court) {
        // Wait outside the threshold until the boss is ready, then step in.
        const ready = tick >= HMH_V7_BOSSES[hunt.bossId].readyTick;
        const outward = { x: court.threshold.x - court.centre.x, y: court.threshold.y - court.centre.y };
        const length = Math.hypot(outward.x, outward.y) || 1;
        const stage = { x: court.threshold.x + (outward.x / length) * 260, y: court.threshold.y + (outward.y / length) * 260 };
        if (!ready || blacklist.get(`boss-${hunt.bossId}`) > tick) return { ...(walkableAt(stage.x, stage.y) ? stage : court.threshold), id: `boss-stage-${hunt.bossId}`, kind: 'boss' };
        return { x: court.threshold.x, y: court.threshold.y, id: `boss-${hunt.bossId}`, kind: 'boss', hold: true, holdRadius: court.threshold.radius * 0.5, holdTicks: 600 };
      }
    }
    if (cfg.ledges) {
      const markers = spies.tenAreaCombat?.traversalMarkers ?? [];
      const next = markers.filter((marker) => !ledgeDone.has(marker.id) && !(blacklist.get(`ledge-${marker.id}`) > tick))
        .map((marker) => ({ marker, centre: { x: (marker.zone.minX + marker.zone.maxX) / 2, y: (marker.zone.minY + marker.zone.maxY) / 2 } }))
        .sort((a, b) => dist(a.centre) - dist(b.centre))[0];
      if (next && dist(next.centre) < 4500) return { ...next.centre, id: `ledge-${next.marker.id}`, kind: 'ledge', marker: next.marker };
    }
    if (cfg.sites) {
      const open = machines.filter((row) => !spies.mission?.completed.has(row.id) && !(blacklist.get(row.id) > tick) && dist(row) < Math.min(4000, (cfg.localRadius ?? Infinity) * 2));
      const machine = open.sort((a, b) => dist(a) - dist(b))[0];
      if (machine) return machine;
    }
    const near = pickups.filter((p) => (cfg.pickupFirst ? true : dist(p) < Math.min(1600, cfg.localRadius))).sort((a, b) => dist(a) - dist(b))[0];
    const favoured = pickups.filter((p) => cfg.favour.includes(p.effect.effectId)).sort((a, b) => dist(a) - dist(b))[0];
    if (favoured && dist(favoured) < 5000) return favoured;
    if (near) return near;
    if (cfg.explore) {
      while (tourIndex < tour.length) {
        const area = tour[tourIndex];
        const centre = area.center;
        const inArea = getWorldV2DistrictAt(world, me.x, me.y)?.id === area.id;
        if (inArea && dist(centre) < 900) { tourIndex += 1; continue; }
        if (blacklist.get(`area-${tourIndex}`) > tick) { tourIndex += 1; continue; }
        return { ...(walkableAt(centre.x, centre.y) ? centre : world.pointsOfInterest.find((poi) => poi.districtId === area.id).anchor), id: `area-${tourIndex}`, kind: 'area' };
      }
      tourIndex = 0;
    }
    if (cfg.orbit || cfg.camper) {
      const radius = cfg.orbitRadius ?? 500;
      const angle = Math.atan2(me.y - home.y, me.x - home.x) + orbitSide * 0.7;
      const target = { x: home.x + Math.cos(angle) * radius, y: home.y + Math.sin(angle) * radius };
      if (!walkableAt(target.x, target.y)) orbitSide = -orbitSide;
      return { ...target, id: `orbit-${Math.floor(tick / 30)}`, kind: 'orbit' };
    }
    if (!goal || goal.kind !== 'wander' || dist(goal) < 150) {
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const x = me.x + (random() - 0.5) * 2400;
        const y = me.y + (random() - 0.5) * 2400;
        if (walkableAt(x, y)) return { x, y, id: `wander-${tick}-${attempt}`, kind: 'wander' };
      }
      return { ...home, id: `wander-home-${tick}`, kind: 'wander' };
    }
    return goal;
  };

  // The cover face to fight from: the nearest enterable one within reach.
  const coverFace = (spies, me) => {
    let best = null;
    for (const face of spies.tenAreaCombat?.coverFaces ?? []) {
      if (face.length < 96) continue;
      const mid = { x: face.a.x + face.tangent.x * face.length / 2, y: face.a.y + face.tangent.y * face.length / 2 };
      const stand = { x: mid.x + face.normal.x * 40, y: mid.y + face.normal.y * 40 };
      const d = Math.hypot(stand.x - me.x, stand.y - me.y);
      if (d > 500 || !walkableAt(stand.x, stand.y)) continue;
      if (!best || d < best.d) best = { face, stand, d };
    }
    return best;
  };

  const frame = (spies, tick) => {
    const motion = spies.motion;
    if (!motion) return null;
    const me = { x: motion.x, y: motion.y };
    const area = getWorldV2DistrictAt(world, me.x, me.y)?.id;
    if (area && !stats.areas.includes(area)) stats.areas.push(area);
    const enemies = hostile(spies, tick);
    stats.maxEnemies = Math.max(stats.maxEnemies, enemies.length);
    const health = spies.health ?? 100;
    const maxHealth = spies.maxHealth ?? 100;
    stats.lowestHealth = Math.min(stats.lowestHealth, health);
    for (const bossId of BOSS_IDS) if (spies.bossSlots?.slots?.[bossId]?.status === 'live' && !stats.bossesStarted.includes(bossId)) stats.bossesStarted.push(bossId);
    const surrender = tick >= tickCap;
    if (surrender && stats.surrenderedAt === null) stats.surrenderedAt = tick;
    const axes = [0, 0, 0, 0];
    const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
    const gamepad = { id: 'headless-virtual-pad', index: 0, connected: true, mapping: 'standard', timestamp: tick, axes, buttons };
    if (cfg.still) return gamepad;
    let nearest = null;
    let nearestDistance = Infinity;
    for (const enemy of enemies) {
      const d = Math.hypot(enemy.x - me.x, enemy.y - me.y);
      if (d < nearestDistance) { nearestDistance = d; nearest = enemy; }
    }
    let move;
    const run = spies.tenAreaCombat?.currentRun?.() ?? null;
    if (surrender || style === 'suicide') {
      move = nearest ? flowTowards(me, nearest, tick) : flowTowards(me, world.encounterArenas.find((arena) => arena.districtId === 'mweb-meadows').anchor, tick);
    } else if (cfg.cover && run && (run.cover.phase === 'cover' || coverPlan)) {
      // In cover (or walking to it): push into the face; step out when the
      // area is quiet for a while, when hurt, or after a long hold.
      const crowd = enemies.filter((enemy) => Math.hypot(enemy.x - me.x, enemy.y - me.y) < 650).length;
      if (run.cover.phase === 'cover') {
        coverPlan ??= { since: tick };
        coverPlan.inSince ??= tick;
        const leave = (crowd === 0 && tick - coverPlan.inSince > 240) || health < maxHealth * cfg.healAt || tick - coverPlan.inSince > 1_800;
        move = leave ? { x: run.cover.normal.x, y: run.cover.normal.y } : { x: -run.cover.normal.x, y: -run.cover.normal.y };
        if (leave) coverPlan.leaving = true;
      } else if (coverPlan?.leaving) {
        coverPlan = null;
        blacklist.set('cover', tick + 900);
        move = { x: 0, y: 0 };
      } else {
        const { face, stand } = coverPlan;
        const d = Math.hypot(stand.x - me.x, stand.y - me.y);
        move = d > 30 ? flowTowards(me, stand, tick) : { x: -face.normal.x, y: -face.normal.y };
        if (d <= 30) stats.coverPushes += 1;
        if (tick - coverPlan.since > 600) { coverPlan = null; blacklist.set('cover', tick + 900); }
      }
    } else {
      if (cfg.cover && run && !(blacklist.get('cover') > tick) && health >= maxHealth * cfg.healAt
        && enemies.filter((enemy) => !enemy.isBoss && Math.hypot(enemy.x - me.x, enemy.y - me.y) < 600).length >= 2) {
        const pick = coverFace(spies, me);
        if (pick) coverPlan = { ...pick, since: tick };
      }
      if (tick - goalSetTick >= 30 || !goal || Math.hypot(goal.x - me.x, goal.y - me.y) < 50) {
        const next = chooseGoal(spies, tick, me);
        if (next?.id !== goal?.id) { goal = next; goalSetTick = tick; lastProgressCheck = { tick, x: me.x, y: me.y }; if (goal) stats.goals[goal.kind] = (stats.goals[goal.kind] ?? 0) + 1; }
        else goalSetTick = tick;
      }
      let goalDir = goal ? flowTowards(me, goal, tick) : { x: 0, y: 0 };
      // A ledge: stand in its strip and push across the edge.
      if (goal?.kind === 'ledge' && run) {
        const zone = goal.marker.zone;
        const inside = me.x >= zone.minX && me.x <= zone.maxX && me.y >= zone.minY && me.y <= zone.maxY;
        if (inside) { goalDir = { ...goal.marker.direction }; stats.ledgePushes += 1; }
        if (run.traversal.phase !== 'free' || (run.traversal.markerId === goal.marker.id)) { ledgeDone.add(goal.marker.id); goal = null; }
      }
      let dx = 0;
      let dy = 0;
      for (const enemy of enemies) {
        const ex = me.x - enemy.x;
        const ey = me.y - enemy.y;
        const d = Math.hypot(ex, ey) || 1;
        const radius = enemy.isBoss ? 520 : 300;
        if (d <= radius) {
          const weight = (enemy.isBoss ? 3 : THREAT_WEIGHT[enemy.archetypeId] ?? 1) * (1 - d / radius) * (d < 150 ? 2 : 1);
          dx += (ex / d) * weight;
          dy += (ey / d) * weight;
        }
        if (enemy.attackPhase === 'tell' && enemy.telegraphTarget) {
          const tx = me.x - enemy.telegraphTarget.x;
          const ty = me.y - enemy.telegraphTarget.y;
          const td = Math.hypot(tx, ty) || 1;
          if (td < 160) { dx += (tx / td) * 2.5 * cfg.tellAvoid; dy += (ty / td) * 2.5 * cfg.tellAvoid; }
        }
      }
      const danger = Math.hypot(dx, dy);
      const kite = (cfg.kite ?? 1) * (health < maxHealth * 0.5 ? 1.6 : 1);
      if (danger > 0.01) {
        const side = Math.floor(tick / 480) % 2 === 0 ? 1 : -1;
        dx += (-dy / danger) * 0.45 * danger * side;
        dy += (dx / danger) * 0.45 * danger * side;
      }
      move = { x: goalDir.x + dx * kite, y: goalDir.y + dy * kite };
      if (cfg.hunt && nearest && danger < 0.01) move = flowTowards(me, nearest, tick);
      const holding = goal?.hold && Math.hypot(goal.x - me.x, goal.y - me.y) <= goal.holdRadius;
      if (holding) {
        if (holdSince < 0) holdSince = tick;
        if (danger < 1.2) move = { x: 0, y: 0 };
        lastProgressCheck = { tick, x: me.x, y: me.y };
        if (tick - holdSince > goal.holdTicks) { blacklist.set(goal.id, tick + 3600); goal = null; holdSince = -1; }
      } else if (!goal?.hold || Math.hypot(goal.x - me.x, goal.y - me.y) > goal.holdRadius * 2) holdSince = -1;
      if (goal && tick - lastProgressCheck.tick >= 180) {
        const progress = Math.hypot(me.x - lastProgressCheck.x, me.y - lastProgressCheck.y);
        if (progress < 40 && danger < 0.5) {
          stats.stuckEvents += 1;
          const angle = random() * Math.PI * 2;
          jitter = { x: Math.cos(angle), y: Math.sin(angle), until: tick + 45 };
          blacklist.set(goal.id, tick + 3600);
          goal = null;
        }
        lastProgressCheck = { tick, x: me.x, y: me.y };
      }
      if (jitter && tick < jitter.until) move = { x: move.x * 0.3 + jitter.x, y: move.y * 0.3 + jitter.y };
    }
    const magnitude = Math.hypot(move.x, move.y);
    if (magnitude > 0.05) { axes[0] = move.x / magnitude; axes[1] = move.y / magnitude; }

    if (!surrender && cfg.grenades && (spies.grenades?.handCharges ?? 0) > 0 && grenadeState.phase === 'idle' && tick - grenadeState.lastThrowTick >= cfg.grenadeCooldown) {
      const cluster = findCluster(me, enemies, style === 'grenadier' ? 2 : 3);
      if (cluster) grenadeState = { ...grenadeState, phase: 'aim', until: tick + 4, dir: cluster };
    }
    if (grenadeState.phase === 'aim' || grenadeState.phase === 'press') {
      axes[2] = grenadeState.dir.x;
      axes[3] = grenadeState.dir.y;
      if (grenadeState.phase === 'aim' && tick >= grenadeState.until) { grenadeState.phase = 'press'; grenadeState.until = tick + 3; stats.grenadePresses += 1; }
      if (grenadeState.phase === 'press') {
        buttons[4] = { pressed: true, value: 1 };
        if (tick >= grenadeState.until) grenadeState = { ...grenadeState, phase: 'idle', lastThrowTick: tick };
      }
    }
    const loadout = spies.loadout;
    if (!surrender && cfg.swaps && loadout && tick >= nextSwapTick && tick >= swapHeldUntil + 2) {
      const weapons = loadout.weapons ?? {};
      const usable = (id) => weapons[id]?.owned && ((weapons[id].ammoInClip ?? 0) > 0 || (weapons[id].reserveAmmo ?? 0) > 0 || weapons[id].reserveAmmo === null || id === 'coin-blaster' || id === 'forked-standard');
      const owned = Object.values(weapons).filter((w) => w.owned).length;
      if (cfg.cycleSwaps) {
        if (owned > 1) { swapHeldUntil = tick + 3; stats.swapPresses += 1; }
        nextSwapTick = tick + 1200 + Math.floor(random() * 2400);
      } else {
        const preferred = cfg.weaponPreference.find(usable);
        if (preferred && preferred !== loadout.activeWeaponId && owned > 1) { swapHeldUntil = tick + 3; stats.swapPresses += 1; nextSwapTick = tick + 24; }
        else nextSwapTick = tick + 60;
      }
    }
    if (tick < swapHeldUntil) buttons[5] = { pressed: true, value: 1 };
    return gamepad;
  };

  const chooseUpgrade = (offer) => {
    const ids = offer.pendingChoices.map((choice) => choice.id);
    for (const preferred of cfg.upgrades) if (ids.includes(preferred)) return preferred;
    return ids[Math.floor(random() * ids.length)];
  };
  const rerollSlot = (offer) => {
    const choices = offer.pendingChoices ?? [];
    if (choices.length === 0 || random() >= 0.25) return null;
    const unwanted = choices.filter((choice) => !cfg.upgrades.includes(choice.id));
    return unwanted.length ? unwanted[Math.floor(random() * unwanted.length)].slot ?? null : null;
  };
  return { frame, chooseUpgrade, rerollSlot, stats, config: cfg };
}

function findCluster(me, enemies, minimum) {
  let best = null;
  for (const anchor of enemies) {
    if (anchor.isBoss) continue;
    const d = Math.hypot(anchor.x - me.x, anchor.y - me.y);
    if (d < 120 || d > 360) continue;
    let count = 0;
    for (const other of enemies) if (Math.hypot(other.x - anchor.x, other.y - anchor.y) <= 150) count += 1;
    if (count >= minimum && (!best || count > best.count)) best = { count, x: (anchor.x - me.x) / d, y: (anchor.y - me.y) / d };
  }
  return best;
}
