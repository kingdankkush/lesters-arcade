// Honest pilots for the real HMH child. A pilot only reads state a
// player can see (positions, pickups, sites, its own health, charges and
// weapons) and answers with a virtual gamepad: left stick move, right stick
// aim, LB grenade, RB weapon-next. Firing, melee and dodges stay automatic, as
// in the shipped input model. Pilots never write simulation state.
import { LEVEL_ONE_WORLD, createLevelOneGroundQuery, getLevelOneDistrictAt } from '../../apps/hmh-reboot/src/level-one-world.mjs';
import { createEnemyNavGrid, computeEnemyFlowField, sampleFlowDirection } from '../../apps/hmh-reboot/src/enemy-navgrid.mjs';
import { refreshWorldDesignGateNavigation, worldDesignActiveBlockers } from '../../apps/hmh-reboot/src/world-design-interactions.mjs';
import { WORLD_DESIGN_SITES } from '../../apps/hmh-reboot/src/world-design-encounters.mjs';
import { WORLD_DESIGN_SECRETS } from '../../apps/hmh-reboot/src/world-design-secrets.mjs';
import { collectibleIsAvailable } from '../../apps/hmh-reboot/src/objective-rewards.mjs';
import { canAcceptCollectible } from '../../apps/hmh-reboot/src/collectible-capacity.mjs';
import { progressionByWeapon } from '../../apps/hmh-reboot/src/weapon-system.mjs';

const queryGround = createLevelOneGroundQuery();
let NAV = null;
const navGrid = () => (NAV ??= createEnemyNavGrid({ world: LEVEL_ONE_WORLD, queryGround }));

function rng(seed) {
  let state = (seed >>> 0) || 0x9e3779b9;
  return () => {
    state ^= state << 13; state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5; state >>>= 0;
    return state / 0x1_0000_0000;
  };
}

const THREAT_WEIGHT = { 'bagholder-rusher': 1, forkrunner: 1.1, 'liquidator-agent': 1.2, 'whale-enforcer': 1.8, 'gas-bomber': 1.4, 'validator-cultist': 1.3 };
const BOSS_ARENA = LEVEL_ONE_WORLD.encounterArenas.at(-1).anchor;
const MELEE_REACH = { 'bagholder-rusher': 96, forkrunner: 102, 'whale-enforcer': 150 };

export const STYLE_DEFAULTS = Object.freeze({
  // Walks into the nearest enemy from the first tick and never kites.
  suicide: { kite: 0, pickups: false, sites: false, grenades: false, swaps: false, explore: false, boss: false },
  // Kamikaze: throws every hand grenade and chases it into the blast (grenade
  // self-damage is real friendly fire), then walks into the nearest enemy.
  kamikaze: { kite: 0, pickups: false, sites: false, grenades: false, swaps: false, explore: false, boss: false, kamikaze: true },
  // Camper: holds its entry point and lets the crowd walk into fire, stepping
  // out of reach and out of telegraphs only when threatened; heals nearby.
  camper: { kite: 2, pickups: true, sites: false, grenades: true, swaps: true, explore: false, boss: true, camper: true, healAt: 0.6, healRange: 900, localRadius: 500, upgrades: ['proof-of-work', 'compound-interest', 'diamond-hands', 'precision-ledger', 'hard-fork-rounds', 'hardened-wallet', 'gas-optimization'] },
  // Stands still; the hero still auto-fires, auto-melees and auto-dodges.
  idle: { kite: 0, pickups: false, sites: false, grenades: false, swaps: false, explore: false, boss: false, still: true },
  // Plays normally with light kiting, grenades at clusters, then gives up.
  brawler: { kite: 0.6, pickups: true, sites: false, grenades: true, swaps: true, explore: false, boss: false, keepMoving: false, steer: false, tellAvoid: 0.3, hunt: true },
  // Grenade-first: seeks grenade supply and the launcher, throws often.
  grenadier: { weaponPreference: ['launcher-rig', 'auto-miner', 'scatter-shotgun', 'lightning-ledger', 'bear-market-burner', 'coin-blaster', 'forked-standard', 'hash-rail'], kite: 1.2, pickups: true, sites: true, grenades: true, grenadeCooldown: 45, swaps: true, explore: false, boss: true, favour: ['nuke-liquidation', 'launcher-rig-cache', 'bonus-life'], upgrades: ['cold-storage', 'diamond-hands', 'proof-of-work', 'hot-wallet'] },
  // Pickup hunter: farms every available pickup and its re-arm.
  hunter: { cycleSwaps: true, kite: 1.3, pickups: true, sites: true, grenades: true, swaps: true, explore: false, boss: true, pickupFirst: true, upgrades: ['validator-training', 'block-reward', 'hot-wallet', 'diamond-hands'] },
  // District explorer: sweeps every district, operates every site, takes each
  // reward and secret, then heads for the Liquidator.
  explorer: { kite: 1.2, pickups: true, sites: true, grenades: true, swaps: true, explore: true, boss: true, upgrades: ['hot-wallet', 'diamond-hands', 'gas-optimization', 'proof-of-work'] },
  // Turtle / survivor: kites hard, heals early, fights the Liquidator.
  turtle: { kite: 2.2, pickups: true, sites: true, grenades: true, swaps: true, explore: false, boss: true, healAt: 0.7, healRange: 2600, orbit: true, orbitRadius: 700, localRadius: 900, upgrades: ['proof-of-work', 'diamond-hands', 'hot-wallet', 'gas-optimization', 'compound-interest', 'hardened-wallet', 'precision-ledger', 'hard-fork-rounds'] },
  // Score-greedy: multipliers first (pushes XP and score toward the ceilings).
  greedy: { kite: 1.8, pickups: true, sites: true, grenades: true, swaps: true, explore: false, boss: true, healAt: 0.6, healRange: 3200, orbit: true, orbitRadius: 600, localRadius: 1400, upgrades: ['validator-training', 'block-reward', 'proof-of-work', 'diamond-hands', 'compound-interest', 'hot-wallet'] },
});

export function createPilot({ style, seed, tickCap, entry }) {
  const cfg = { healAt: 0.45, grenadeCooldown: 120, favour: [], upgrades: [], keepMoving: true, steer: true, tellAvoid: 1, hunt: false, weaponPreference: ['auto-miner', 'scatter-shotgun', 'lightning-ledger', 'bear-market-burner', 'forked-standard', 'coin-blaster', 'launcher-rig', 'hash-rail'], ...STYLE_DEFAULTS[style] };
  const random = rng(seed ^ 0x5bd1e995);
  const grid = navGrid();
  const knownGates = new Set();
  const fieldCache = { key: '', field: null, tick: -1 };
  const stats = { grenadePresses: 0, swapPresses: 0, stuckEvents: 0, goals: {}, surrenderedAt: null, bossSeen: false, maxEnemies: 0, visitedSites: [], lowestHealth: Infinity };
  const blacklist = new Map();
  let goal = null;
  let goalSetTick = -1;
  let lastProgressCheck = { tick: 0, x: entry.x, y: entry.y };
  let jitter = null;
  let grenadeState = { phase: 'idle', until: 0, dir: null, lastThrowTick: -10_000 };
  let swapHeldUntil = -1;
  let nextSwapTick = 900 + Math.floor(random() * 1200);
  let exploreIndex = 0;
  let lastCommand = null;
  let stuckFrames = 0;
  let orbitSide = 1;
  const home = cfg.orbit ? openestPoint(grid, entry, cfg.orbitRadius ?? 650) : { x: entry.x, y: entry.y };
  stats.home = home;
  const exploreRoute = buildExploreRoute(entry, random);

  const hostile = (spies, tick) => {
    const list = [];
    for (const enemy of spies.population?.active ?? []) {
      if (!enemy.active || enemy.health <= 0) continue;
      list.push(enemy);
    }
    const boss = spies.boss;
    if (boss?.active && boss.health > 0 && tick >= boss.startTick) list.push({ ...boss, archetypeId: 'boss', isBoss: true });
    return list;
  };

  const syncGates = (spies) => {
    const state = spies.worldDesign;
    if (!state) return;
    for (const gateId of state.openGates) {
      if (knownGates.has(gateId)) continue;
      knownGates.add(gateId);
      try {
        refreshWorldDesignGateNavigation(grid, LEVEL_ONE_WORLD, queryGround, gateId, worldDesignActiveBlockers(state, LEVEL_ONE_WORLD.collisionBlockers));
      } catch { /* non-capsule openings keep the static grid */ }
      fieldCache.key = '';
    }
  };

  const flowTowards = (me, target, tick) => {
    const key = `${grid.cellAt(target.x, target.y)}`;
    if (fieldCache.key !== key || tick - fieldCache.tick > 240) {
      fieldCache.key = key;
      fieldCache.field = computeEnemyFlowField({ grid, targetX: target.x, targetY: target.y });
      fieldCache.tick = tick;
    }
    const dx = target.x - me.x;
    const dy = target.y - me.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 70) return distance > 1 ? { x: dx / distance, y: dy / distance } : { x: 0, y: 0 };
    return sampleFlowDirection(grid, fieldCache.field, me.x, me.y) ?? (distance > 0 ? { x: dx / distance, y: dy / distance } : { x: 0, y: 0 });
  };

  const pickupCandidates = (spies, tick) => {
    const state = spies.collectibles;
    if (!state || !spies.loadout || !spies.progression) return [];
    const health = spies.health ?? 100;
    const maxHealth = spies.maxHealth ?? 100;
    const pbw = progressionByWeapon(spies.progression.ranks);
    const out = [];
    for (const entry of state.entries) {
      const placement = entry.placement;
      if (!collectibleIsAvailable(state, placement, tick)) continue;
      if (blacklist.get(placement.id) > tick) continue;
      if (!canAcceptCollectible(entry.effect, { health, maxHealth, grenades: spies.grenades?.handCharges ?? 0, maxGrenades: spies.grenades?.maxHandCharges ?? 5, loadout: spies.loadout, progressionByWeapon: pbw })) continue;
      out.push({ x: placement.x, y: placement.y, id: placement.id, kind: 'pickup', effect: entry.effect });
    }
    return out;
  };

  const siteCandidates = (spies) => {
    const state = spies.worldDesign;
    if (!state) return [];
    return WORLD_DESIGN_SITES.filter((site) => !state.completed.has(site.id) && !state.activating.has(site.id) && !(blacklist.get(site.id) > 0))
      .map((site) => ({ x: site.x, y: site.y, id: site.id, kind: 'site' }));
  };

  const chooseGoal = (spies, tick, me, enemies) => {
    const health = spies.health ?? 100;
    const maxHealth = spies.maxHealth ?? 100;
    if (tick >= tickCap) return null;
    if (cfg.boss && tick >= 70_800) {
      const boss = spies.boss;
      if (boss?.active && boss.health > 0 && tick >= boss.startTick) {
        stats.bossSeen = true;
        const away = Math.atan2(me.y - boss.y, me.x - boss.x) + 0.35;
        return { x: boss.x + Math.cos(away) * 380, y: boss.y + Math.sin(away) * 380, id: 'boss-orbit', kind: 'boss' };
      }
      if (!boss?.active || boss.health > 0) return { x: BOSS_ARENA.x - 300, y: BOSS_ARENA.y, id: 'boss-arena', kind: 'boss' };
    }
    const pickups = cfg.pickups ? pickupCandidates(spies, tick) : [];
    const dist = (p) => Math.hypot(p.x - me.x, p.y - me.y);
    const heal = pickups.filter((p) => p.effect.kind === 'heal').sort((a, b) => dist(a) - dist(b))[0];
    if (heal && health < maxHealth * cfg.healAt && dist(heal) < (cfg.healRange ?? Infinity)) return heal;
    if (cfg.explore) {
      while (exploreIndex < exploreRoute.length) {
        const step = exploreRoute[exploreIndex];
        if (step.kind === 'site' && (spies.worldDesign?.completed.has(step.id) || spies.worldDesign?.activating.has(step.id))) { exploreIndex += 1; continue; }
        if (dist(step) < (step.kind === 'secret' ? 30 : 60) || (blacklist.get(step.id) ?? 0) > tick) { exploreIndex += 1; continue; }
        break;
      }
      // Take a reward or a weapon that is close before resuming the sweep.
      const near = pickups.filter((p) => dist(p) < 700).sort((a, b) => dist(a) - dist(b))[0];
      if (near) return near;
      if (exploreIndex < exploreRoute.length) return exploreRoute[exploreIndex];
    }
    const favoured = pickups.filter((p) => cfg.favour.includes(p.effect.effectId)).sort((a, b) => dist(a) - dist(b))[0];
    if (favoured && dist(favoured) < 3000) return favoured;
    const local = cfg.localRadius ?? Infinity;
    const reachPickups = pickups.filter((p) => cfg.pickupFirst || (dist(p) < Math.min(1400, local)) || (p.effect.kind === 'weapon-cache' && dist(p) < local));
    const sites = cfg.sites ? siteCandidates(spies).filter((s) => cfg.pickupFirst || dist(s) < Math.min(2200, local * 1.6)) : [];
    const candidates = [...reachPickups, ...sites].sort((a, b) => dist(a) - dist(b));
    if (candidates.length) return candidates[0];
    if (cfg.orbit) {
      // Run laps around the home point; the trailing crowd walks into fire.
      const angle = Math.atan2(me.y - home.y, me.x - home.x) + orbitSide * 0.7;
      const radius = cfg.orbitRadius ?? 650;
      const target = { x: home.x + Math.cos(angle) * radius, y: home.y + Math.sin(angle) * radius };
      if (!walkableAt(target.x, target.y)) orbitSide = -orbitSide;
      return { ...target, id: `orbit-${Math.floor(tick / 30)}`, kind: 'orbit' };
    }
    // Nothing to fetch: wander toward a random open point near the current strip.
    if (!goal || goal.kind !== 'wander' || dist(goal) < 120) {
      const strip = Math.max(0, Math.min(11_999, me.x + (random() - 0.5) * 1600));
      return { x: strip, y: 800 + random() * 3200, id: `wander-${tick}`, kind: 'wander' };
    }
    return goal;
  };

  // Context steering: score sixteen headings by the goal, open ground ahead,
  // and distance kept from every hostile and every telegraphed attack.
  const HEADINGS = Array.from({ length: 16 }, (_, i) => ({ x: Math.cos((i * Math.PI) / 8), y: Math.sin((i * Math.PI) / 8) }));
  const walkableAt = (x, y) => {
    const cell = grid.cellAt(x, y);
    return cell >= 0 && grid.walkable[cell] === 1;
  };
  // Edge-aware ray over the nav grid: cliffs and one-way drops are directed
  // edges, not unwalkable cells, so a plain walkability probe misses them.
  const stepLegal = (from, dc, dr) => {
    const k = dc === 1 ? 0 : dc === -1 ? 1 : dr === 1 ? 2 : 3;
    return (grid.edges[from] & (1 << k)) !== 0;
  };
  const rayBlockedAt = (me, heading, maxDistance) => {
    let cell = grid.cellAt(me.x, me.y);
    if (cell < 0) return 0;
    for (let d = 15; d <= maxDistance; d += 15) {
      const next = grid.cellAt(me.x + heading.x * d, me.y + heading.y * d);
      if (next < 0 || grid.walkable[next] !== 1) return d;
      if (next === cell) continue;
      const c0 = cell % grid.columns, r0 = (cell - c0) / grid.columns;
      const c1 = next % grid.columns, r1 = (next - c1) / grid.columns;
      const dc = Math.sign(c1 - c0), dr = Math.sign(r1 - r0);
      let legal;
      if (dc !== 0 && dr !== 0) {
        const viaX = r0 * grid.columns + c0 + dc;
        const viaY = (r0 + dr) * grid.columns + c0;
        legal = (stepLegal(cell, dc, 0) && grid.walkable[viaX] === 1 && stepLegal(viaX, 0, dr))
          || (stepLegal(cell, 0, dr) && grid.walkable[viaY] === 1 && stepLegal(viaY, dc, 0));
      } else legal = stepLegal(cell, dc, dr);
      if (!legal) return d;
      cell = next;
    }
    return Infinity;
  };
  const blockedHeadings = new Map();
  const contextSteer = (me, preferred, enemies, tick, kite, crowded) => {
    const pm = Math.hypot(preferred.x, preferred.y);
    const want = pm > 0.001 ? { x: preferred.x / pm, y: preferred.y / pm } : null;
    let best = null;
    let bestScore = -Infinity;
    for (const heading of HEADINGS) {
      let wall = 0;
      const blockedAt = rayBlockedAt(me, heading, 150);
      if (blockedAt < 40) wall = 6; else if (blockedAt < 90) wall = 2.5; else if (blockedAt < 150) wall = 0.8;
      if ((blockedHeadings.get(HEADINGS.indexOf(heading)) ?? -1) > tick) wall += 8;
      let penalty = 0;
      const px = me.x + heading.x * 90;
      const py = me.y + heading.y * 90;
      const qx = me.x + heading.x * 40;
      const qy = me.y + heading.y * 40;
      for (const enemy of enemies) {
        if (enemy.disposition === 'ambient' && !enemy.provoked && !enemy.eventHostile) continue;
        const reach = enemy.isBoss ? 320 : (THREAT_WEIGHT[enemy.archetypeId] ?? 1) > 1.5 ? 230 : 190;
        const d = Math.hypot(px - enemy.x, py - enemy.y);
        if (d < reach) penalty += ((reach - d) / reach) ** 2 * (enemy.isBoss ? 4 : THREAT_WEIGHT[enemy.archetypeId] ?? 1);
        if (enemy.attackPhase === 'tell' && enemy.telegraphTarget) {
          const family = MELEE_REACH[enemy.archetypeId];
          if (family) {
            const q = Math.hypot(qx - enemy.x, qy - enemy.y);
            if (q < family + 50) penalty += 3 * cfg.tellAvoid * (1 - q / (family + 50));
          } else {
            const t = Math.hypot(qx - enemy.telegraphTarget.x, qy - enemy.telegraphTarget.y);
            if (t < 150) penalty += 2 * cfg.tellAvoid * (1 - t / 150);
          }
        }
      }
      const goalScore = want ? heading.x * want.x + heading.y * want.y : 0;
      const score = goalScore * 1.2 - penalty * kite * 1.4 - wall;
      if (score > bestScore) { bestScore = score; best = heading; }
    }
    if (!want && !crowded) return { x: 0, y: 0 };
    return best ?? preferred;
  };

  const frame = (spies, tick) => {
    const motion = spies.motion;
    if (!motion) return null;
    const me = { x: motion.x, y: motion.y };
    const enemies = hostile(spies, tick);
    stats.maxEnemies = Math.max(stats.maxEnemies, enemies.length);
    const health = spies.health ?? 100;
    const maxHealth = spies.maxHealth ?? 100;
    stats.lowestHealth = Math.min(stats.lowestHealth, health);
    syncGates(spies);
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
    let move = { x: 0, y: 0 };
    if (cfg.kamikaze) {
      const own = (spies.grenades?.active ?? []).filter((g) => String(g.id).startsWith('satoshi-frag:'));
      const live = own.at(-1);
      if (live) {
        move = { x: live.position.x - me.x, y: live.position.y - me.y };
      } else if ((spies.grenades?.handCharges ?? 0) > 0 && tick >= 30) {
        if (grenadeState.phase === 'idle' && tick - grenadeState.lastThrowTick >= 20) {
          // Throw into the nearest wall so the bounce comes back; else straight down-screen.
          let dir = { x: 0, y: 1 };
          let bestWall = Infinity;
          for (const heading of HEADINGS) { const d = rayBlockedAt(me, heading, 120); if (d < bestWall) { bestWall = d; dir = heading; } }
          grenadeState = { ...grenadeState, phase: 'aim', until: tick + 3, dir };
        }
        move = { x: 0, y: 0 };
      } else {
        move = flowTowards(me, nearest ?? { x: BOSS_ARENA.x, y: BOSS_ARENA.y }, tick);
      }
    } else if (cfg.camper && !surrender && !(cfg.boss && tick >= 70_800)) {
      // Threat check: a melee body within reach, or a telegraph aimed here.
      let threatened = false;
      for (const enemy of enemies) {
        if (enemy.disposition === 'ambient' && !enemy.provoked && !enemy.eventHostile) continue;
        const d = Math.hypot(enemy.x - me.x, enemy.y - me.y);
        const reach = MELEE_REACH[enemy.archetypeId];
        if (reach && d < reach + 70) threatened = true;
        if (enemy.isBoss && d < 420) threatened = true;
        if (enemy.attackPhase === 'tell' && enemy.telegraphTarget && !reach && Math.hypot(enemy.telegraphTarget.x - me.x, enemy.telegraphTarget.y - me.y) < 130) threatened = true;
      }
      const healPick = (health < maxHealth * cfg.healAt) ? pickupCandidates(spies, tick).filter((p) => p.effect.kind === 'heal' && Math.hypot(p.x - me.x, p.y - me.y) < cfg.healRange).sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))[0] : null;
      const nearbyPickup = !healPick && !threatened ? pickupCandidates(spies, tick).filter((p) => p.effect.kind !== 'heal' && Math.hypot(p.x - home.x, p.y - home.y) < cfg.localRadius).sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))[0] : null;
      const target = healPick ?? nearbyPickup ?? home;
      const want = Math.hypot(target.x - me.x, target.y - me.y) > 50 ? flowTowards(me, target, tick) : { x: 0, y: 0 };
      if (threatened) move = contextSteer(me, { x: want.x * 0.4, y: want.y * 0.4 }, enemies, tick, cfg.kite, true);
      else move = want;
      if (!goal || goal.id !== (healPick?.id ?? nearbyPickup?.id ?? 'home')) { goal = { ...target, id: healPick?.id ?? nearbyPickup?.id ?? 'home', kind: healPick ? 'heal' : nearbyPickup ? 'pickup' : 'home' }; stats.goals[goal.kind] = (stats.goals[goal.kind] ?? 0) + 1; }
    } else if (surrender || style === 'suicide') {
      // Give up: walk into the nearest enemy (or toward the busiest area).
      const target = nearest ?? { x: BOSS_ARENA.x, y: BOSS_ARENA.y };
      move = flowTowards(me, target, tick);
    } else {
      if (tick - goalSetTick >= 30 || !goal || Math.hypot(goal.x - me.x, goal.y - me.y) < 50) {
        const next = chooseGoal(spies, tick, me, enemies);
        if (next?.id !== goal?.id) { goal = next; goalSetTick = tick; lastProgressCheck = { tick, x: me.x, y: me.y }; if (goal) stats.goals[goal.kind] = (stats.goals[goal.kind] ?? 0) + 1; }
        else goalSetTick = tick;
      }
      const goalDir = goal ? flowTowards(me, goal, tick) : { x: 0, y: 0 };
      // Danger field: push away from nearby hostiles, weighted by role, and
      // step out of every telegraphed attack (a player sees each tell).
      let dx = 0;
      let dy = 0;
      let cx = 0;
      let cy = 0;
      let near = 0;
      for (const enemy of enemies) {
        if (enemy.disposition === 'ambient' && !enemy.provoked && !enemy.eventHostile) continue;
        const ex = me.x - enemy.x;
        const ey = me.y - enemy.y;
        const d = Math.hypot(ex, ey) || 1;
        if (d < 700) { cx += enemy.x; cy += enemy.y; near += 1; }
        const radius = enemy.isBoss ? 560 : 300;
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
      const lowHealth = health < maxHealth * 0.5 ? 1.6 : 1;
      const kite = cfg.kite * lowHealth;
      if (danger > 0.01) {
        // Strafe a little so kiting circles rather than backing into walls.
        const side = Math.floor(tick / 480) % 2 === 0 ? 1 : -1;
        const px = -dy / danger;
        const py = dx / danger;
        dx += px * 0.45 * danger * side;
        dy += py * 0.45 * danger * side;
      }
      move = { x: goalDir.x + dx * kite, y: goalDir.y + dy * kite };
      if (!goal && danger < 0.01 && nearest && cfg.hunt) move = flowTowards(me, nearest, tick);
      if (cfg.steer) move = contextSteer(me, move, enemies, tick, kite, near > 0);
      // Never stand still while enemies are near: orbit the crowd instead.
      else if (cfg.keepMoving && Math.hypot(move.x, move.y) < 0.35 && near > 0) {
        const ox = me.x - cx / near;
        const oy = me.y - cy / near;
        const od = Math.hypot(ox, oy) || 1;
        const side = Math.floor(tick / 600) % 2 === 0 ? 1 : -1;
        move = { x: (-oy / od) * side + (ox / od) * 0.3, y: (ox / od) * side + (oy / od) * 0.3 };
      }
      // Stuck handling: little progress toward the goal for two and a half seconds.
      if (goal && tick - lastProgressCheck.tick >= 150) {
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
    // Remember headings that produced no motion (a ledge the grid lets through).
    if (lastCommand && Math.hypot(me.x - lastCommand.x, me.y - lastCommand.y) < 0.6 && lastCommand.moving) stuckFrames += 1;
    else stuckFrames = 0;
    if (stuckFrames >= 5 && lastCommand) {
      const angle = Math.atan2(lastCommand.dy, lastCommand.dx);
      const bucket = ((Math.round(angle / (Math.PI / 8)) % 16) + 16) % 16;
      blockedHeadings.set(bucket, tick + 120);
      blockedHeadings.set((bucket + 1) % 16, tick + 60);
      blockedHeadings.set((bucket + 15) % 16, tick + 60);
      stuckFrames = 0;
    }
    lastCommand = { x: me.x, y: me.y, dx: axes[0], dy: axes[1], moving: Math.hypot(axes[0], axes[1]) > 0.5 };

    // Grenades: aim at a cluster for a few ticks, press, release.
    if (!surrender && cfg.grenades && (spies.grenades?.handCharges ?? 0) > 0) {
      if (grenadeState.phase === 'idle' && tick - grenadeState.lastThrowTick >= cfg.grenadeCooldown) {
        const cluster = findCluster(me, enemies, style === 'grenadier' ? 2 : 3);
        if (cluster) grenadeState = { ...grenadeState, phase: 'aim', until: tick + 4, dir: cluster };
      }
    }
    if (grenadeState.phase === 'aim' || grenadeState.phase === 'press') {
      axes[2] = grenadeState.dir.x;
      axes[3] = grenadeState.dir.y;
      if (grenadeState.phase === 'aim' && tick >= grenadeState.until) grenadeState.phase = 'press', grenadeState.until = tick + 3, stats.grenadePresses += 1;
      if (grenadeState.phase === 'press') {
        buttons[4] = { pressed: true, value: 1 };
        if (tick >= grenadeState.until) grenadeState = { ...grenadeState, phase: 'idle', lastThrowTick: tick };
      }
    } else if (!surrender && cfg.boss && spies.boss?.active && spies.boss.health > 0 && tick >= spies.boss.startTick) {
      const bx = spies.boss.x - me.x;
      const by = spies.boss.y - me.y;
      const d = Math.hypot(bx, by);
      if (d < 700 && d > 0 && (tick % 240) < 150) { axes[2] = bx / d; axes[3] = by / d; }
    }

    // Weapon swaps: RB edges. Hunters cycle now and then; the others step
    // toward their preferred gun that still has ammunition.
    const loadout = spies.loadout;
    if (!surrender && cfg.swaps && loadout && tick >= nextSwapTick && tick >= swapHeldUntil + 2) {
      const weapons = loadout.weapons ?? {};
      const usable = (id) => weapons[id]?.owned && ((weapons[id].ammoInClip ?? 0) > 0 || (weapons[id].reserveAmmo ?? 0) > 0 || weapons[id].reserveAmmo === null || id === 'coin-blaster');
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

  return { frame, chooseUpgrade, stats, config: cfg };
}

// The most open ground near the entry: the candidate point whose ring of
// radius r has the most walkable nav cells (a player picks a big clearing).
function openestPoint(grid, entry, radius) {
  let best = { x: entry.x, y: entry.y, score: -1 };
  for (let dx = -1500; dx <= 1500; dx += 150) {
    for (let dy = -1500; dy <= 1500; dy += 150) {
      const cx = entry.x + dx;
      const cy = entry.y + dy;
      if (cx < radius || cy < radius || cx > 12_000 - radius || cy > 4_800 - radius) continue;
      let score = 0;
      for (let a = 0; a < 24; a += 1) {
        for (const r of [radius * 0.6, radius, radius * 1.25]) {
          const cell = grid.cellAt(cx + Math.cos((a * Math.PI) / 12) * r, cy + Math.sin((a * Math.PI) / 12) * r);
          if (cell >= 0 && grid.walkable[cell] === 1) score += 1;
        }
      }
      score -= Math.hypot(dx, dy) / 1500;
      if (score > best.score) best = { x: cx, y: cy, score };
    }
  }
  return best;
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

function buildExploreRoute(entry, random) {
  const stops = [
    ...WORLD_DESIGN_SITES.map((site) => ({ x: site.x, y: site.y, id: site.id, kind: 'site' })),
    ...WORLD_DESIGN_SECRETS.filter((secret) => !secret.sealId).map((secret) => ({ x: secret.x, y: secret.y, id: secret.id, kind: 'secret' })),
    ...LEVEL_ONE_WORLD.pointsOfInterest.map((poi) => ({ x: poi.anchor.x, y: poi.anchor.y, id: `poi:${poi.id}`, kind: 'poi' })),
  ];
  // Sweep toward the nearer world edge first, then across to the far edge.
  const westFirst = entry.x < 6000 ? random() < 0.8 : random() < 0.2;
  const west = stops.filter((stop) => stop.x < entry.x).sort((a, b) => b.x - a.x);
  const east = stops.filter((stop) => stop.x >= entry.x).sort((a, b) => a.x - b.x);
  return westFirst ? [...west, ...[...east].sort((a, b) => a.x - b.x)] : [...east, ...[...west].sort((a, b) => b.x - a.x)];
}

export { getLevelOneDistrictAt };
