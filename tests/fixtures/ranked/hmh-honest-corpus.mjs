// An honest-run corpus for the v6 plausibility path (1.8.x children).
//
// Every run is a schema-6 summary from the real 1.8.x accumulator
// (sdk/hmh-run-summary.mjs), with its level, XP and score from the child's own
// run-progression, played by a scripted pilot through the child's own world
// modules:
//   - the seeded level entry (level-entry selectLevelEntry) and the district
//     strips (level-one-world getLevelOneDistrictAt), recorded every tick;
//   - movement (movement stepPlayerMovement) and dash (dash beginDash and
//     stepDash) at the run's real multipliers: movement ranks, dash tier and
//     time dilation, always downhill (x 1.04), on open ground with no
//     collision, so a pilot outruns any real player;
//   - every collectible placement of the child (the ten authored points of
//     interest with main.mjs's re-arm rule, the three seeded weapon events and
//     the eight objective rewards) through the real stepCollectibles, with
//     every pickup accepted (a real run refuses a heal at full health);
//   - the machinery sites through the real stepWorldDesign, which unlock their
//     objective rewards;
//   - kills scheduled on the encounter director's own insertion schedule
//     (one insertion per band interval from tick 600, as the director runs),
//     with the archetype the director would pick for the district and band.
// Combat itself is scheduled, not simulated: the pilot decides which weapon
// kills an enemy and when, within the child's grenade supply (three hand
// charges, Extra Grenade ranks, +1 per grenade or nuke pickup) and the
// Grenade Launcher once its cache is picked up.
//
// Pilots (HMH_HONEST_PILOTS) stress the 1.8.4 consistency rules: a sprinter
// dashes between the far ends of the map with every movement rank it is
// offered, a hoarder chases every available placement and site, a grenadier
// kills with grenades whenever it holds one, a wanderer roams (and fights the
// Liquidator in long runs), and a camper stays near its entry. The corpus is
// deterministic; tests/server-verify-hmh-honest-corpus.test.mjs pins its
// digest.
import { createHash } from 'node:crypto';
import {
  createRunSummaryAccumulator,
  finalizeRunSummary,
  recordRunCollectible,
  recordRunDamage,
  recordRunGrenade,
  recordRunGrenadeDetonation,
  recordRunKill,
  recordRunMilestone,
  recordRunTick,
  recordRunUpgradeOffer,
  recordRunUpgradeSelection,
  recordRunWeaponEvent,
  recordRunWeaponFire,
} from '../../../sdk/hmh-run-summary.mjs';
import {
  RUN_UPGRADE_CATALOG,
  comboMilestoneXp,
  createRunProgression,
  getRunProgressionSnapshot,
  grantRunSilver,
  grantRunXp,
  recordRunDefeat,
  selectRunUpgrade,
  unlockRunProgressionWeapon,
} from '../../../apps/hmh-reboot/src/run-progression.mjs';
import { selectLevelEntry } from '../../../apps/hmh-reboot/src/level-entry.mjs';
import { LEVEL_ONE_WORLD, createLevelOneGroundQuery, getLevelOneDistrictAt } from '../../../apps/hmh-reboot/src/level-one-world.mjs';
import { createPlayerMotionState, stepPlayerMovement } from '../../../apps/hmh-reboot/src/movement.mjs';
import { beginDash, createDashState, stepDash } from '../../../apps/hmh-reboot/src/dash.mjs';
import { createCollectibleState, stepCollectibles } from '../../../apps/hmh-reboot/src/collectible-system.mjs';
import { collectibleIsAvailable, objectiveRewardPlacements } from '../../../apps/hmh-reboot/src/objective-rewards.mjs';
import { buildAuthoredPointOfInterestPlacements } from '../../../apps/hmh-reboot/src/authored-prop-layout.mjs';
import { createLightningLedgerRareEvent } from '../../../apps/hmh-reboot/src/lightning-ledger-event.mjs';
import { createBearMarketBurnerEvent } from '../../../apps/hmh-reboot/src/bear-market-burner-event.mjs';
import { createForkedStandardEvent } from '../../../apps/hmh-reboot/src/forked-standard-event.mjs';
import { createWorldDesignState, stepWorldDesign } from '../../../apps/hmh-reboot/src/world-design-interactions.mjs';
import { WORLD_DESIGN_SITES } from '../../../apps/hmh-reboot/src/world-design-encounters.mjs';
import { getEncounterBand, selectEncounterArchetype } from '../../../apps/hmh-reboot/src/encounter-director.mjs';
import { ENEMY_ARCHETYPES } from '../../../apps/hmh-reboot/src/enemy-archetypes.mjs';
import { FIXED_STEP_MS } from '../../../apps/hmh-reboot/src/simulation.mjs';
import { HMH_BOSS_START_TICK, LIQUIDATOR_THREAT_COST, SILVER_PER_BOSS_KILL, SILVER_PER_ENEMY_KILL } from '../../../server/verify/hmh-plausibility.mjs';

export const HMH_HONEST_CORPUS_BUILD_HASH = 'site-1.8.2:game-1.8.2';
const DT = 1 / 60;
const WORLD = LEVEL_ONE_WORLD.bounds;
const PLAYER_RADIUS = LEVEL_ONE_WORLD.player.radius;
const COLLECTION_RADIUS = 80;
const SITE_REACH = 82;
const DOWNHILL = 1.04;
const TIME_DILATION = 1.2;
const DIRECTOR_FIRST_TICK = 600;
const MAX_HAND_CHARGES = 5;
const LAUNCHER_ROUNDS_PER_CACHE = 12;
const queryGround = createLevelOneGroundQuery();

// The authored point-of-interest assets main.mjs re-arms, and after how long
// (the plausibility test pins both against main.mjs).
export const HMH_CHILD_REARMED_ASSETS = Object.freeze(['coin-blaster', 'scatter-shotgun', 'auto-miner', 'launcher-rig', 'time-dilation', 'berserk-candle']);
export const HMH_CHILD_REARM_TICKS = 10_800;

// The child's collectible state for `seed`, with its 21 placements built as
// main.mjs builds them (the events' blocked-point check is not modelled, so an
// event may sit a few units from where the child puts it).
export function hmhChildCollectibleState(seed) {
  const authored = buildAuthoredPointOfInterestPlacements(LEVEL_ONE_WORLD.pointsOfInterest);
  const reachable = (point, ground) => ground.kind !== 'deep-water' && point.x >= WORLD.minX && point.x <= WORLD.maxX && point.y >= WORLD.minY && point.y <= WORLD.maxY;
  const inDistricts = (ids) => authored.filter((placement) => ids.includes(placement.districtId));
  const lightning = createLightningLedgerRareEvent({ seed, candidates: inDistricts(['liquidity-crossing', 'hashwood', 'mining-camp']), protectedPoints: authored, queryGround, isBlocked: () => false, isRouteReachable: reachable });
  const burner = createBearMarketBurnerEvent({ seed, candidates: inDistricts(['rugpull-ravine', 'mining-camp', 'liquidation-yard']), protectedPoints: [...authored, lightning], queryGround, isBlocked: () => false, isRouteReachable: reachable });
  const standard = createForkedStandardEvent({ seed, candidates: inDistricts(['hashwood', 'mining-camp', 'liquidation-yard']), protectedPoints: [...authored, lightning, burner], queryGround, isBlocked: () => false, isRouteReachable: reachable });
  const placements = [...authored.map((placement) => (HMH_CHILD_REARMED_ASSETS.includes(placement.assetId) ? Object.freeze({ ...placement, respawnTicks: HMH_CHILD_REARM_TICKS }) : placement)), lightning, burner, standard];
  return createCollectibleState({ placements, objectivePlacements: objectiveRewardPlacements() });
}

const near = (point, position, radius) => (point.x - position.x) ** 2 + (point.y - position.y) ** 2 <= radius * radius;

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const MOBILITY = Object.values(RUN_UPGRADE_CATALOG).filter((upgrade) => ['moveSpeedMultiplier', 'dashCooldownTier'].includes(upgrade.effect)).map((upgrade) => upgrade.id);
const GRENADE_UPGRADES = Object.values(RUN_UPGRADE_CATALOG).filter((upgrade) => upgrade.effect === 'bonusGrenadeCharges').map((upgrade) => upgrade.id);

// Pilot table: run length range (ticks), movement plan, kill mix and upgrade
// preference. `skill` is the share of the director's insertions the pilot kills.
export const HMH_HONEST_PILOTS = Object.freeze({
  sprinter: Object.freeze({ ticks: [900, 14_000], move: 'ends', dash: true, skill: 0.35, grenadeShare: 0.2, prefer: MOBILITY, boss: false }),
  hoarder: Object.freeze({ ticks: [40_000, 110_000], move: 'hoard', dash: true, skill: 0.55, grenadeShare: 0.3, prefer: MOBILITY, boss: true }),
  grenadier: Object.freeze({ ticks: [18_000, 80_000], move: 'grenades', dash: true, skill: 0.8, grenadeShare: 1, prefer: GRENADE_UPGRADES, boss: true }),
  wanderer: Object.freeze({ ticks: [4_000, 100_000], move: 'roam', dash: false, skill: 0.6, grenadeShare: 0.4, prefer: [], boss: true }),
  camper: Object.freeze({ ticks: [20_000, 90_000], move: 'camp', dash: false, skill: 0.9, grenadeShare: 0.15, prefer: ['validator-training', 'block-reward'], boss: false }),
});

// Seeds for the corpus: the first `perEntry` seeds of a fixed stream for each
// of the five level entries, so every entry is covered.
export function hmhHonestCorpusSeeds(perEntry) {
  const random = mulberry32(0x18_40_c0de);
  const buckets = new Map();
  while ([...buckets.values()].reduce((sum, list) => sum + list.length, 0) < perEntry * 5) {
    const seed = Math.floor(random() * 0x1_0000_0000);
    const { id } = selectLevelEntry(seed);
    const list = buckets.get(id) ?? [];
    if (list.length < perEntry) list.push(seed);
    buckets.set(id, list);
  }
  return [...buckets.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).flatMap(([, list]) => list);
}

export function simulateHmhHonestRun({ seed, pilot: pilotId }) {
  const pilot = HMH_HONEST_PILOTS[pilotId];
  if (!pilot) throw new Error(`unknown pilot ${pilotId}`);
  const random = mulberry32(seed ^ createHash('sha256').update(pilotId).digest().readUInt32BE(0));
  const endTick = pilot.ticks[0] + Math.floor(random() * (pilot.ticks[1] - pilot.ticks[0]));
  const entry = selectLevelEntry(seed);
  const accumulator = createRunSummaryAccumulator({ seed, buildHash: HMH_HONEST_CORPUS_BUILD_HASH, mode: 'ranked', heroId: 'lit-commando', startTick: 0, startPosition: { x: entry.x, y: entry.y } });
  const progression = createRunProgression({ seed });
  const motion = createPlayerMotionState({ x: entry.x, y: entry.y, maxSpeed: LEVEL_ONE_WORLD.player.maxSpeed });
  const dash = createDashState({ cooldownTier: 0 });
  const collectibles = hmhChildCollectibleState(seed);
  const sites = createWorldDesignState();
  const placements = collectibles.entries.map((entryRow) => entryRow.placement);

  let effects = getRunProgressionSnapshot(progression).effects;
  let level = 1;
  let activeWeaponId = 'coin-blaster';
  const owned = new Set(['coin-blaster']);
  let handCharges = 3;
  let launcherRounds = 0;
  let timeDilationUntil = -1;
  let combo = 0;
  let maxCombo = 0;
  let kills = 0;
  let enemySequence = 0;
  let grenadeSequence = 0;
  let nextSlot = DIRECTOR_FIRST_TICK;
  let slotOrdinal = 0;
  const due = [];
  let nextDue = Infinity;
  let target = null;
  let bossDownTick = null;
  const bossKillTick = pilot.boss && endTick >= HMH_BOSS_START_TICK + 2_400 ? HMH_BOSS_START_TICK + 2_400 + Math.floor(random() * 2_400) : null;
  let maxStepPx = 0;
  let previous = { x: entry.x, y: entry.y };

  const settleLevels = () => {
    for (let guard = 0; guard < 1000; guard += 1) {
      const snapshot = getRunProgressionSnapshot(progression);
      level = snapshot.level;
      effects = snapshot.effects;
      if (snapshot.pendingLevels <= 0 || snapshot.pendingChoices.length === 0) return;
      const offered = snapshot.pendingChoices.map((choice) => choice.id);
      recordRunUpgradeOffer(accumulator, offered);
      const pick = pilot.prefer.find((id) => offered.includes(id)) ?? offered[Math.floor(random() * offered.length)];
      const before = effects.bonusGrenadeCharges;
      const selection = selectRunUpgrade(progression, pick);
      recordRunUpgradeSelection(accumulator, pick);
      handCharges += selection.effects.bonusGrenadeCharges - before;
      dash.cooldownTier = selection.effects.dashCooldownTier;
      effects = selection.effects;
    }
  };
  const credit = (tick, role, weaponId, { boss = false } = {}) => {
    enemySequence += 1;
    const targetId = boss ? 'boss-liquidator' : `enemy-${enemySequence}`;
    recordRunDamage(accumulator, { targetId, sourceId: 'player', weaponId, damageApplied: 40, healthBefore: 40, critical: enemySequence % 9 === 0, tick });
    recordRunKill(accumulator, { enemyRoleId: role, weaponId, elite: !boss && enemySequence % 23 === 0, boss });
    recordRunDefeat(progression, { enemyId: boss ? 'boss-liquidator' : `encounter-${String(enemySequence).padStart(6, '0')}`, threatCost: boss ? LIQUIDATOR_THREAT_COST : ENEMY_ARCHETYPES[role].costs.threat, tick });
    combo += 1;
    maxCombo = Math.max(maxCombo, combo);
    const milestone = comboMilestoneXp(combo);
    if (milestone) grantRunXp(progression, milestone, tick);
    grantRunSilver(progression, boss ? SILVER_PER_BOSS_KILL : SILVER_PER_ENEMY_KILL, tick);
    kills += 1;
  };
  // One blast: the grenade's detonation hits `victims` enemies, and kills them.
  const blast = (tick, victims, mode) => {
    grenadeSequence += 1;
    const weaponId = mode === 'launcher' ? 'launcher-rig' : 'satoshi-frag';
    if (mode === 'hand') recordRunGrenade(accumulator, { type: 'thrown' });
    else recordRunWeaponFire(accumulator, { weaponId: 'launcher-rig', emitted: 1 });
    recordRunGrenadeDetonation(accumulator, { grenadeId: `${mode === 'launcher' ? 'launcher-rig:' : 'hand:'}${grenadeSequence}`, hits: victims.map((victim, index) => ({ targetId: `blast-${grenadeSequence}-${index}` })) });
    for (const victim of victims) credit(tick, victim.role, weaponId);
  };

  const pickTarget = (tick, position) => {
    const nearest = (points) => points.reduce((best, point) => {
      const distance = Math.hypot(point.x - position.x, point.y - position.y);
      return !best || distance < best.distance ? { x: point.x, y: point.y, distance } : best;
    }, null);
    const available = () => placements.filter((placement) => collectibleIsAvailable(collectibles, placement, tick));
    const lockedSites = () => WORLD_DESIGN_SITES.filter((site) => !sites.completed.has(site.id) && !sites.activating.has(site.id));
    if (pilot.move === 'ends') {
      const west = { x: 40 + random() * 200, y: 400 + random() * 4_000 };
      const east = { x: WORLD.maxX - 40 - random() * 200, y: 400 + random() * 4_000 };
      return position.x > (WORLD.maxX / 2) ? west : east;
    }
    if (pilot.move === 'hoard') return nearest([...available(), ...lockedSites()]) ?? { x: random() * WORLD.maxX, y: random() * WORLD.maxY };
    if (pilot.move === 'grenades') {
      const supply = available().filter((placement) => ['nuke-liquidation', 'launcher-rig'].includes(placement.assetId) || placement.requiredObjective === 'hashwood-shrine');
      return nearest(supply.length ? supply : lockedSites().filter((site) => site.id === 'hashwood-shrine')) ?? { x: random() * WORLD.maxX, y: random() * WORLD.maxY };
    }
    if (pilot.move === 'roam') return { x: random() * WORLD.maxX, y: random() * WORLD.maxY };
    return { x: entry.x + (random() - 0.5) * 900, y: entry.y + (random() - 0.5) * 900 };
  };

  for (let tick = 1; tick <= endTick; tick += 1) {
    // Movement.
    if (!target || Math.hypot(target.x - motion.x, target.y - motion.y) < 12) target = pickTarget(tick, motion);
    const dx = target.x - motion.x;
    const dy = target.y - motion.y;
    const distance = Math.hypot(dx, dy);
    const direction = distance > 0 ? { x: dx / distance, y: dy / distance } : { x: 0, y: 0 };
    // beginDash refuses during a dash or its cooldown, and stepDash does nothing
    // outside a dash, so both run only when they can act.
    if (pilot.dash && !dash.active && tick >= dash.cooldownReadyTick && distance > 260) {
      const started = beginDash(dash, { tick, direction });
      if (started.started) { motion.vx = 0; motion.vy = 0; }
    }
    const dashFrame = dash.active ? stepDash(dash, { tick }) : null;
    if (dashFrame?.active) {
      motion.x += dashFrame.delta.x;
      motion.y += dashFrame.delta.y;
      if (dashFrame.completed) { motion.vx = 0; motion.vy = 0; }
    } else {
      stepPlayerMovement(motion, { move: direction, aim: { ...direction, active: true } }, {
        dtSeconds: DT,
        speedMultiplier: DOWNHILL * (tick < timeDilationUntil ? TIME_DILATION : 1) * effects.moveSpeedMultiplier,
      });
    }
    motion.x = Math.min(WORLD.maxX - PLAYER_RADIUS, Math.max(WORLD.minX + PLAYER_RADIUS, motion.x));
    motion.y = Math.min(WORLD.maxY - PLAYER_RADIUS, Math.max(WORLD.minY + PLAYER_RADIUS, motion.y));
    const position = { x: motion.x, y: motion.y };
    maxStepPx = Math.max(maxStepPx, Math.hypot(position.x - previous.x, position.y - previous.y));
    previous = position;
    const districtId = getLevelOneDistrictAt(position.x, position.y)?.id ?? 'frontier-relay';

    // Machinery sites unlock their objective rewards.
    if (sites.activating.size > 0 || WORLD_DESIGN_SITES.some((site) => !sites.completed.has(site.id) && near(site, position, SITE_REACH))) {
      const frame = stepWorldDesign(sites, { tick, player: { ...position, groundZ: queryGround(position.x, position.y).groundZ }, queryGround, lineBlocked: () => false });
      for (const event of frame.events) {
        recordRunMilestone(accumulator, { type: 'site-operated', id: event.siteId, tick });
        collectibles.unlockedObjectives.add(event.siteId);
      }
    }

    // Pickups through the real collectible system, whenever one is in reach
    // (stepCollectibles only collects an available placement in reach).
    if (placements.some((placement) => near(placement, position, COLLECTION_RADIUS) && collectibleIsAvailable(collectibles, placement, tick))) {
      const frame = stepCollectibles(collectibles, { tick, player: position });
      for (const event of frame.events) {
        if (event.type !== 'collectible:collected') continue;
        recordRunCollectible(accumulator, { effectId: event.effectId });
        if (event.kind === 'weapon-cache') {
          owned.add(event.weaponId);
          unlockRunProgressionWeapon(progression, event.weaponId);
          recordRunWeaponEvent(accumulator, { type: 'pickup', weaponId: event.weaponId });
          if (event.weaponId === 'launcher-rig') launcherRounds += LAUNCHER_ROUNDS_PER_CACHE;
          else if (activeWeaponId !== event.weaponId) {
            activeWeaponId = event.weaponId;
            recordRunWeaponEvent(accumulator, { type: 'swap', weaponId: event.weaponId });
          }
        } else if (event.kind === 'grenade-supply' || event.kind === 'nuke') {
          handCharges = Math.min(MAX_HAND_CHARGES + effects.bonusGrenadeCharges, handCharges + 1);
          if (event.kind === 'nuke') {
            // The nuke kills every enemy on the field: here, every one due.
            for (const victim of due.splice(0, due.length)) credit(tick, victim.role, 'nuke-liquidation');
            nextDue = Infinity;
          }
        } else if (event.effectId === 'time-dilation') timeDilationUntil = tick + event.durationTicks;
        if (event.xpGain) grantRunXp(progression, event.xpGain, tick);
        settleLevels();
      }
    }

    // The director inserts one enemy per band interval; the pilot kills a share.
    if (tick >= nextSlot) {
      const band = getEncounterBand(nextSlot);
      if (random() < pilot.skill) {
        const { archetypeId } = selectEncounterArchetype({ districtId, bandId: band.id, spawnOrdinal: slotOrdinal, seed });
        const dueTick = tick + 60 + Math.floor(random() * 540);
        due.push({ role: archetypeId, dueTick });
        nextDue = Math.min(nextDue, dueTick);
      }
      slotOrdinal += 1;
      nextSlot += band.spawnIntervalTicks;
    }
    const ready = tick >= nextDue ? due.filter((victim) => victim.dueTick <= tick) : [];
    if (ready.length) {
      const grenade = random() < pilot.grenadeShare;
      if (grenade && launcherRounds > 0 && owned.has('launcher-rig') && ready.length >= 1) {
        launcherRounds -= 1;
        const victims = ready.slice(0, 4);
        due.splice(0, due.length, ...due.filter((victim) => !victims.includes(victim)));
        blast(tick, victims, 'launcher');
      } else if (grenade && handCharges > 0 && ready.length >= (pilot.grenadeShare === 1 ? 1 : 2)) {
        handCharges -= 1;
        const victims = ready.slice(0, 6);
        due.splice(0, due.length, ...due.filter((victim) => !victims.includes(victim)));
        blast(tick, victims, 'hand');
      } else if (pilot.grenadeShare < 1 || handCharges === 0 && launcherRounds === 0) {
        const victim = ready[0];
        due.splice(due.indexOf(victim), 1);
        credit(tick, victim.role, activeWeaponId);
      }
      if (kills > 0 && kills % (11 + (seed % 7)) === 0) {
        recordRunDamage(accumulator, { targetId: 'player', sourceId: `enemy-${enemySequence}`, weaponId: 'enemy-bagholder-rusher', damageApplied: 6, killed: false, equippedWeaponId: activeWeaponId, tick });
        combo = 0;
      }
      settleLevels();
      nextDue = due.reduce((soonest, victim) => Math.min(soonest, victim.dueTick), Infinity);
    }
    if (bossKillTick !== null && bossDownTick === null && tick >= bossKillTick) {
      credit(tick, 'liquidator', activeWeaponId, { boss: true });
      bossDownTick = tick;
      collectibles.unlockedObjectives.add('liquidator-defeated');
      settleLevels();
    }

    recordRunTick(accumulator, {
      tick,
      position,
      activeWeaponId,
      districtId,
      level,
      activeEffectIds: tick < timeDilationUntil ? ['time-dilation'] : [],
      bossEngaged: bossKillTick !== null && tick >= HMH_BOSS_START_TICK && bossDownTick === null,
    });
  }

  recordRunDamage(accumulator, { targetId: 'player', sourceId: 'enemy-final', weaponId: 'enemy-bagholder-rusher', damageApplied: 30, killed: true, equippedWeaponId: activeWeaponId, tick: endTick });
  const snapshot = getRunProgressionSnapshot(progression);
  const totalCells = 1_000;
  const runSummary = JSON.parse(JSON.stringify(finalizeRunSummary(accumulator, {
    endTick,
    elapsedMs: endTick * FIXED_STEP_MS,
    terminalReason: 'defeated',
    score: snapshot.score,
    level: snapshot.level,
    xp: snapshot.xp,
    currentCombo: combo,
    maxCombo,
    revealedCells: Math.min(totalCells, 40 + Math.floor(endTick / 90)),
    totalCells,
  })));
  return { runSummary, maxStepPx };
}

// → [{ name, pilot, seed, runSummary, maxStepPx }], in a fixed order; maxStepPx
// is the longest single-tick move the pilot made.
export function buildHmhHonestCorpus({ perEntry = 3, pilots = Object.keys(HMH_HONEST_PILOTS) } = {}) {
  const seeds = hmhHonestCorpusSeeds(perEntry);
  const corpus = [];
  for (const pilot of pilots) {
    for (const seed of seeds) corpus.push({ name: `${pilot}:${seed}`, pilot, seed, ...simulateHmhHonestRun({ seed, pilot }) });
  }
  return corpus;
}

export function hmhHonestCorpusDigest(corpus) {
  return createHash('sha256').update(JSON.stringify(corpus.map(({ name, runSummary }) => [name, runSummary]))).digest('hex');
}
