/**
 * HMH progression model (Level 1 design package S0.3, "Measurement").
 *
 * A headless, deterministic model of one Hard Money Heroes run, built on the
 * game's own pure simulation modules. It is the measuring stick for the
 * progression release (package 8.3 and 9.2): median survival may grow by at
 * most 10% against the committed 1.8.1 baseline, or card 2 falls back to
 * every second level-up.
 *
 * What is real (imported from apps/hmh-reboot/src, or from --root):
 *   - XP, levels, the two-card offer and upgrade effects: run-progression.mjs.
 *   - Weapons, cadence, reload, ammo, reserve caps, fallback: weapon-system.mjs.
 *   - Projectile contacts, spread, pierce, splash: projectile-physics.mjs with
 *     the ordinary-enemy hurtbox profile; the knife (melee.mjs); hand and
 *     launcher grenades (grenades.mjs); crits and armour (combat-events.mjs).
 *   - Spawn cadence, bands, body/threat/ranged caps, archetype choice and the
 *     health ramp: encounter-director.mjs, enemy-simulation.mjs,
 *     opening-balance.mjs. Attack tokens, tells and strikes: enemy-combat.mjs.
 *   - Auto-aim (aim.mjs), dash cooldowns (dash.mjs), combo XP
 *     (combo-feedback.mjs), pickups, caches, havens, secrets and supplies
 *     (collectible-system.mjs, collectible-capacity.mjs, objective-rewards.mjs,
 *     world-design-*.mjs, world-destructibles.mjs, the rare weapon events).
 *
 * What is modelled (the proxy, frozen in MODEL_CONSTANTS):
 *   - The route: the hero walks east at a fixed pace, so x = tick / 6 reaches
 *     the Liquidation Yard's far edge (12,000) at 20:00. A pickup is taken when
 *     the route reaches its x and it is available, within a 2-minute window.
 *   - The arena: the hero stands at the origin of a flat, open plane; enemies
 *     spawn 1,600 units out (Level 1's twelve authored spawn points sit on the
 *     district edges, about 1,300 to 2,000 units from the route) on a seeded
 *     bearing in the forward 120° arc, walk straight in at 60% of their speed
 *     (the player kites), and queue in nine bearing lanes behind the bodies
 *     already at their stop distance. Spawn placement never fails.
 *   - Evasion: the hero stands still in the model, so every token holder in
 *     range strikes on the real tell/strike/recovery clock; a strike connects
 *     at a fixed rate (strikeConnectChance, divided by the hero's movement
 *     multipliers), paid out by deterministic error diffusion rather than a
 *     coin flip so survival carries no hit-roll noise. The automatic dodge
 *     (real cooldowns and i-frames) spends itself on a strike that connects.
 *   - Aim: the real auto-aim picks the target; each trigger pull is rotated by
 *     a seeded error of up to ±4° (moving targets, strafing, cover).
 *   - Hand grenades are thrown at 4+ bodies near the landing point.
 *   - No bosses. The progression gate is about the hero against the horde;
 *     boss fights are measured by the boss slices, not by this model. The
 *     Liquidator Vault's Arc Rifle is therefore never collected.
 *   - Calibration: strikeConnectChance was set once, against 1.8.1, so the
 *     pooled median survival sits in the elite band (10:00 to 20:00), where
 *     the pressure is constant and survival is graded by the hero's power
 *     rather than by a band change; the 30:00 horizon stays well above it.
 *
 * The progression release (package S1.3) extended the model without changing
 * what it does on a 1.8.1 tree: every new path is taken only when the source
 * tree provides it (the offer and re-roll API, the focus gun, the grenade
 * maximum, per-shot launcher shells, held-weapon crits, salvage credit, the
 * card magazine and the nuke radius; the rank-3 trickle lives inside the real
 * weapon step), so a 1.8.1 checkout reproduces the committed baseline bit for
 * bit and the working tree is measured with the release's own rules.
 *
 * Outputs: XP income (by minute and source), the offers and picks of three
 * pick policies, the ammo economy per weapon, the survival proxy, and the
 * referenceDps(level) calibration for boss HP (package 4.1).
 *
 * Run:  node scripts/hmh-progression-model.mjs            (compare with the baseline)
 *       node scripts/hmh-progression-model.mjs --root <1.8.1 checkout> --write-baseline --source-label 1.8.1 --source-commit <sha>
 * See docs/hmh-reboot/design/LEVEL-1-BUILD-LEDGER.md for the recorded runs.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));

export const PROGRESSION_MODEL_VERSION = 'hmh-progression-model/v1';
export const BASELINE_RELATIVE_PATH = 'docs/testing/hmh-progression-baseline-1.8.1.json';
export const SURVIVAL_GATE_MAX_GROWTH = 0.1;
export const PICK_POLICIES = Object.freeze(['seeded', 'power', 'survival']);
export const DEFAULT_SEED_COUNT = 16;

const TICKS_PER_SECOND = 60;
const TICKS_PER_MINUTE = 3_600;

// The proxy's own assumptions. Changing any of them changes the fingerprint,
// and a report with another fingerprint cannot be compared with the baseline:
// regenerate the baseline from a 1.8.1 checkout (--root) instead.
export const MODEL_CONSTANTS = Object.freeze({
  horizonTicks: 108_000,
  routeUnitsPerTick: 1 / 6,
  routeLookupY: 2_400,
  pickupWindowTicks: 7_200,
  spawnDistance: 1_600,
  spawnArcRadians: Math.PI * 2 / 3,
  lanes: 9,
  queueGap: 6,
  meleeStopInset: 6,
  closingFactor: 0.6,
  aimErrorRadians: Math.PI * 4 / 180,
  strikeConnectChance: 0.016,
  handGrenadeClusterSize: 4,
  handGrenadeLandingDistance: 210,
  handGrenadeClusterRadius: 150,
  handGrenadeCooldownTicks: 120,
  meleeTargetRange: 180,
  referenceWindowTicks: 1_800,
  referenceSeed: 0x484d4843,
});

// Constants main.mjs owns and does not export. A test reads main.mjs and
// fails when any of them moves, so the model cannot drift silently.
export const MAIN_MIRROR = Object.freeze({
  projectileFlightHeight: 34,
  maxActiveGrenades: 16,
  criticalChanceCap: 0.45,
  baseCriticalChance: 0.08,
  baseCriticalMultiplier: 1.75,
  playerMaxHealth: 100,
  playerRadius: 24,
  openingHandGrenades: 3,
  firstDirectorSpawnTick: 600,
  populationCapacity: 192,
  populationThreatCapacity: 1024,
  muzzleOffset: 28,
  launcherOriginZ: 32,
  handGrenadeOffset: 20,
  handGrenadeOriginZ: 24,
});

const MODULE_FILES = Object.freeze({
  progression: 'run-progression.mjs',
  weapons: 'weapon-system.mjs',
  director: 'encounter-director.mjs',
  enemies: 'enemy-simulation.mjs',
  archetypes: 'enemy-archetypes.mjs',
  enemyCombat: 'enemy-combat.mjs',
  opening: 'opening-balance.mjs',
  combat: 'combat-events.mjs',
  projectiles: 'projectile-physics.mjs',
  hurtboxes: 'enemy-hurtboxes.mjs',
  grenades: 'grenades.mjs',
  melee: 'melee.mjs',
  dash: 'dash.mjs',
  aim: 'aim.mjs',
  collectibles: 'collectible-system.mjs',
  capacity: 'collectible-capacity.mjs',
  objectiveRewards: 'objective-rewards.mjs',
  combo: 'combo-feedback.mjs',
  world: 'level-one-world.mjs',
  propLayout: 'authored-prop-layout.mjs',
  sites: 'world-design-encounters.mjs',
  secrets: 'world-design-secrets.mjs',
  destructibles: 'world-destructibles.mjs',
  ledgerEvent: 'lightning-ledger-event.mjs',
  burnerEvent: 'bear-market-burner-event.mjs',
  standardEvent: 'forked-standard-event.mjs',
});

export async function loadProgressionModules(root = REPO_ROOT) {
  const sourceRoot = resolve(root, 'apps/hmh-reboot/src');
  const entries = await Promise.all(Object.entries(MODULE_FILES).map(async ([key, file]) => [key, await import(pathToFileURL(join(sourceRoot, file)).href)]));
  const modules = Object.fromEntries(entries);
  modules.root = resolve(root);
  return Object.freeze(modules);
}

export function modelConstantsFingerprint(constants = MODEL_CONSTANTS) {
  return sha256(JSON.stringify({ version: PROGRESSION_MODEL_VERSION, constants, mirror: MAIN_MIRROR }));
}

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

function fnv32(text) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

// The fixed seed list: run i always uses the same seed.
export function modelSeeds(count = DEFAULT_SEED_COUNT) {
  if (!Number.isInteger(count) || count < 1 || count > 256) throw new TypeError('seed count must be an integer from 1 to 256');
  return Object.freeze(Array.from({ length: count }, (_, index) => fnv32(`hmh-progression-model:${index}`)));
}

// --- Offers and pick policies --------------------------------------------

// The cards the player is shown right now: the real offer algorithm.
export function readOffer(M, progression) {
  return M.progression.getRunProgressionSnapshot(progression).pendingChoices;
}

// Priority tiers, higher first. Weapon cards are the ones that feed an owned
// gun's tree through progressionByWeapon (the Pistol's three, and later the
// branch cards of any gun), so new cards classify themselves.
function powerTier(card, context) {
  if (context.weaponCardIds?.has(card.id) && !card.repeatable) return 6;
  if (card.effect === 'outgoingDamageMultiplier' && !card.repeatable) return 5;
  if (card.effect === 'criticalChanceBonus' || card.effect === 'criticalDamageBonus') return 4;
  if (card.effect === 'outgoingDamageMultiplier') return 3;
  if (card.effect === 'xpMultiplier') return 2;
  return 1;
}

function survivalTier(card) {
  if (card.effect === 'maxHealthBonus' && !card.repeatable) return 6;
  if (card.effect === 'dashCooldownTier') return 5;
  if (card.effect === 'moveSpeedMultiplier' && !card.repeatable) return 4;
  if ((card.effect === 'maxHealthBonus' || card.effect === 'moveSpeedMultiplier') && card.repeatable) return 3;
  if (card.effect === 'bonusGrenadeCharges') return 2;
  return 1;
}

function policyScore(policy, card, context) {
  if (policy === 'power') return powerTier(card, context) * 10 + survivalTier(card);
  if (policy === 'survival') return survivalTier(card) * 10 + powerTier(card, context);
  throw new TypeError(`unknown scored policy ${String(policy)}`);
}

// The slot the policy takes. seeded: a coin flip keyed by level and pick
// sequence (a casual player). power: damage first. survival: health, dash and
// speed first. Ties keep the earlier slot.
export function choosePick(policy, cards, context) {
  if (!Array.isArray(cards) || cards.length === 0) throw new TypeError('an offer needs at least one card');
  if (policy === 'seeded') {
    const key = `pick:${context.level}:${context.selectionSequence}`;
    return Math.floor(unit(context.seed, key) * cards.length) % cards.length;
  }
  let best = 0;
  for (let index = 1; index < cards.length; index += 1) {
    if (policyScore(policy, cards[index], context) > policyScore(policy, cards[best], context)) best = index;
  }
  return best;
}

// The slot the policy re-rolls before picking, or -1. Frozen here so the
// progression release cannot tune the policies to its own rules: power and
// survival re-roll the weaker slot while it is below their tier 3, once per
// card; the seeded policy never re-rolls. 1.8.1 has no re-roll.
export function chooseReroll(policy, cards, context) {
  if (policy === 'seeded') return -1;
  const tier = policy === 'power' ? (card) => powerTier(card, context) : policy === 'survival' ? survivalTier : null;
  if (!tier) throw new TypeError(`unknown policy ${String(policy)}`);
  const used = context.rerolledSlots ?? new Set();
  let worst = -1;
  for (let index = 0; index < cards.length; index += 1) {
    if (used.has(index) || tier(cards[index]) >= 3) continue;
    if (worst < 0 || tier(cards[index]) < tier(cards[worst])) worst = index;
  }
  // A re-roll replaces only the weak card, so it costs nothing: the policy
  // spends it even when the other card is already a strong pick.
  return worst;
}

// The model's own seeded draws (pick coin flips, spawn bearings, aim
// error): FNV-1a plus an xorshift, the same construction as the
// game's deterministic-hash.mjs seededUnit, kept here so the model's
// randomness never moves when a game module changes.
function unit(seed, key) {
  let hash = ((seed >>> 0) ^ 0x811c9dc5) >>> 0;
  const text = String(key);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  hash ^= hash << 13;
  hash ^= hash >>> 17;
  hash ^= hash << 5;
  return (hash >>> 0) / 0x1_0000_0000;
}

// --- Pistol reference DPS (boss HP calibration) -------------------------

const REFERENCE_CACHE = new WeakMap();

// The benchmark's method (scripts/hmh-reboot-weapon-benchmark.mjs): the real
// weapon step fires at a static single target for 30 s. raw is the shot
// damage; expected adds the run's outgoing damage multiplier and the expected
// critical hit against armour 1, the way the combat resolver pays it.
export function pistolReferenceDps(M, { ranks = {}, effects } = {}) {
  const cache = REFERENCE_CACHE.get(M) ?? new Map();
  REFERENCE_CACHE.set(M, cache);
  const pistol = M.weapons.progressionByWeapon(ranks)['coin-blaster'];
  const critChance = Math.min(MAIN_MIRROR.criticalChanceCap, MAIN_MIRROR.baseCriticalChance + effects.criticalChanceBonus);
  const critMultiplier = MAIN_MIRROR.baseCriticalMultiplier + effects.criticalDamageBonus;
  const key = JSON.stringify([pistol, effects.outgoingDamageMultiplier, critChance, critMultiplier]);
  if (cache.has(key)) return cache.get(key);
  const loadout = M.weapons.createWeaponLoadout({ weaponIds: ['coin-blaster'], activeWeaponId: 'coin-blaster', seed: MODEL_CONSTANTS.referenceSeed });
  const progressionByWeapon = { 'coin-blaster': pistol };
  let raw = 0;
  let expected = 0;
  for (let tick = 1; tick <= MODEL_CONSTANTS.referenceWindowTicks; tick += 1) {
    const frame = M.weapons.stepWeaponLoadout(loadout, { tick, fire: true, direction: { x: 1, y: 0 }, progressionByWeapon });
    for (const event of frame.events) {
      if (event.type !== 'weapon:fire') continue;
      for (const shot of event.shots) {
        raw += shot.damage;
        expected += M.combat.expectedCombatHitDamage({ damage: shot.damage * effects.outgoingDamageMultiplier, armor: 1, criticalChance: critChance, criticalMultiplier: critMultiplier });
      }
    }
  }
  const seconds = MODEL_CONSTANTS.referenceWindowTicks / TICKS_PER_SECOND;
  const result = Object.freeze({ raw: round(raw / seconds, 2), expected: round(expected / seconds, 2) });
  cache.set(key, result);
  return result;
}

// The calibrated referenceDps table: for each level most runs reach (at least
// half of the runs that reach level 1), the median reference DPS, made
// non-decreasing (a later level never asks for less) and rounded to 0.1.
// Past the last calibrated level the value stays at the last entry.
//
// The package placeholder was a capped line, min(47, 8 + 2.6 x (L - 1)). The
// 1.8.1 medians are convex (slow while the level-ups go to health, speed and
// utility, steep once the Pistol and critical cards stack), so no capped line
// fits them; the table is the calibration, and the placeholder's error
// against it is reported alongside.
export function calibrateReferenceDps(table) {
  if (!Array.isArray(table) || table.length === 0) throw new TypeError('a reference table is required');
  const rows = [...table].sort((a, b) => a.level - b.level);
  if (rows[0].level !== 1) throw new TypeError('the reference table must start at level 1');
  const most = rows[0].runsReached;
  const levels = [];
  for (const row of rows) {
    if (row.level !== levels.length + 1 || row.runsReached * 2 < most) break;
    levels.push(round(Math.max(levels.at(-1) ?? 0, row.median), 1));
  }
  return Object.freeze({ levels: Object.freeze(levels), lastLevel: levels.length });
}

export function referenceDpsFromTable(levels, level) {
  if (!Number.isInteger(level) || level < 1) throw new TypeError('level must be a positive integer');
  return levels[Math.min(level, levels.length) - 1];
}

// --- One run --------------------------------------------------------------

const FLAT_GROUND = Object.freeze({ groundZ: 0, kind: 'ground', walkable: true, surfaceId: 'model-flat' });
const flatGround = () => FLAT_GROUND;

function rotate(direction, radians) {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return { x: direction.x * cosine - direction.y * sine, y: direction.x * sine + direction.y * cosine };
}

function round(value, digits) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

// Sorted ids: the weapon system itself iterates its loadout in sorted order,
// and a fixed order keeps the evidence identical across source trees (1.8.1
// kept the weapon order in main.mjs; the foundations slice moved it).
function weaponOrder(M) {
  return Object.keys(M.weapons.HMH_WEAPON_DEFINITIONS).sort();
}

// Rounds the hero carries for a gun: none until it is owned (an unowned gun's
// state already holds a full clip that the pickup hands over).
function roundsHeld(weapon) {
  return weapon.owned ? weapon.ammoInClip + (weapon.reserveAmmo ?? 0) : 0;
}

// Every pickup the route passes, from the game's own placement tables.
function buildPickupSchedule(M, seed, C) {
  const routeTick = (x) => Math.max(0, Math.ceil(x / C.routeUnitsPerTick));
  const effects = M.collectibles.COLLECTIBLE_EFFECTS;
  const pickups = [];
  const pois = M.propLayout.buildAuthoredPointOfInterestPlacements(M.world.LEVEL_ONE_WORLD.pointsOfInterest);
  for (const placement of pois) pickups.push({ id: placement.id, x: placement.x, readyTick: routeTick(placement.x), kind: 'collectible', effect: effects[placement.assetId] });
  const reachable = { queryGround: flatGround, isBlocked: () => false, isRouteReachable: () => true };
  const inDistricts = (ids) => pois.filter((placement) => ids.includes(placement.districtId));
  const ledger = M.ledgerEvent.createLightningLedgerRareEvent({ seed, candidates: inDistricts(['liquidity-crossing', 'hashwood', 'mining-camp']), protectedPoints: pois, ...reachable });
  const burner = M.burnerEvent.createBearMarketBurnerEvent({ seed, candidates: inDistricts(['rugpull-ravine', 'mining-camp', 'liquidation-yard']), protectedPoints: [...pois, ledger], ...reachable });
  const standard = M.standardEvent.createForkedStandardEvent({ seed, candidates: inDistricts(['hashwood', 'mining-camp', 'liquidation-yard']), protectedPoints: [...pois, ledger, burner], ...reachable });
  for (const event of [ledger, burner, standard]) {
    pickups.push({ id: event.id, x: event.x, readyTick: Math.max(routeTick(event.x), event.availableTick ?? 0), routeTick: routeTick(event.x), kind: 'collectible', effect: effects[event.assetId] });
  }
  const siteTicks = new Map();
  for (const site of M.sites.WORLD_DESIGN_SITES) {
    const tick = routeTick(site.x) + site.holdTicks;
    siteTicks.set(site.id, tick);
    if (site.reward) pickups.push({ id: `site:${site.id}`, x: site.x, readyTick: tick, kind: site.reward });
  }
  for (const reward of M.objectiveRewards.objectiveRewardPlacements()) {
    const unlockTick = siteTicks.get(reward.requiredObjective);
    if (unlockTick === undefined) continue; // the Liquidator vault: no boss in this model
    const base = effects[reward.assetId];
    const effect = Object.freeze({ ...base, xpGain: 0, ...(reward.kind ? { kind: reward.kind } : {}) });
    pickups.push({ id: reward.id, x: reward.x, readyTick: Math.max(routeTick(reward.x), unlockTick), routeTick: routeTick(reward.x), kind: 'collectible', effect });
  }
  for (const secret of M.secrets.WORLD_DESIGN_SECRETS) if (secret.reward) pickups.push({ id: `secret:${secret.id}`, x: secret.x, readyTick: routeTick(secret.x), kind: secret.reward });
  for (const cover of M.destructibles.WORLD_DESTRUCTIBLES) pickups.push({ id: `supply:${cover.id}`, x: cover.anchor.x, readyTick: routeTick(cover.anchor.x), kind: cover.supply.reward });
  for (const pickup of pickups) {
    pickup.routeTick ??= routeTick(pickup.x);
    pickup.closeTick = pickup.routeTick + C.pickupWindowTicks;
  }
  return pickups.filter((pickup) => pickup.readyTick <= pickup.closeTick)
    .sort((a, b) => a.readyTick - b.readyTick || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function runProgressionModel(M, {
  seed,
  policy,
  horizonTicks = MODEL_CONSTANTS.horizonTicks,
  constants = MODEL_CONSTANTS,
} = {}) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffff_ffff) throw new TypeError('seed must be an unsigned 32-bit integer');
  if (!PICK_POLICIES.includes(policy)) throw new TypeError(`policy must be one of ${PICK_POLICIES.join(', ')}`);
  if (!Number.isInteger(horizonTicks) || horizonTicks < 1) throw new TypeError('horizonTicks must be a positive integer');
  const C = constants;
  const {
    progression: P, weapons: W, director: D, enemies: E, archetypes: A, enemyCombat: EC, opening: O,
    combat: CB, projectiles: PR, hurtboxes: HB, grenades: G, melee: ML, dash: DS, aim: AM,
    capacity: CAP, combo: CO, world: WORLD,
  } = M;

  const progression = P.createRunProgression({ seed });
  const order = weaponOrder(M);
  const loadout = W.createWeaponLoadout({ weaponIds: order, activeWeaponId: 'coin-blaster', seed });
  const aimState = AM.createAimState();
  const meleeState = ML.createMeleeState();
  const grenades = G.createGrenadeSystem({ capacity: MAIN_MIRROR.maxActiveGrenades, handCharges: MAIN_MIRROR.openingHandGrenades });
  const population = E.createEnemyPopulation({ capacity: MAIN_MIRROR.populationCapacity, threatCapacity: MAIN_MIRROR.populationThreatCapacity });
  const director = D.createEncounterDirector({ nextSpawnTick: MAIN_MIRROR.firstDirectorSpawnTick, seed });
  const pickups = buildPickupSchedule(M, seed, C);
  let pickupCursor = 0;
  const openPickups = [];

  let maxHealth = MAIN_MIRROR.playerMaxHealth;
  let health = maxHealth;
  let dashTier = 0;
  let dashReadyTick = 0;
  let invulnerableUntilTick = -1;
  let combo = 0;
  let nextHandGrenadeTick = 0;
  let connectMass = 0;
  let bandTokens = null;
  const timedEffects = new Map();
  const acquisition = ['coin-blaster'];
  const bodies = []; // alive enemies in spawn order, with their model lane
  const laneById = new Map();

  const addBody = (enemy, bearing) => {
    const lane = Math.min(C.lanes - 1, Math.max(0, Math.floor((bearing + C.spawnArcRadians / 2) / C.spawnArcRadians * C.lanes)));
    laneById.set(enemy.id, lane);
    bodies.push(enemy);
  };
  const bearingFor = (key) => (unit(seed, key) - 0.5) * C.spawnArcRadians;

  // The two opening enemies at their opening health (main.mjs run setup).
  for (const [index, archetypeId] of O.HMH_OPENING_ENEMY_ARCHETYPE_IDS.entries()) {
    const bearing = bearingFor(`opening:${index}`);
    const enemy = E.createEnemyState({
      archetypeId,
      id: `prototype-${String(A.ENEMY_ARCHETYPE_IDS.indexOf(archetypeId) + 1).padStart(2, '0')}-${archetypeId}`,
      x: Math.cos(bearing) * C.spawnDistance,
      y: Math.sin(bearing) * C.spawnDistance,
      groundZ: 0,
      visualMode: 'normal',
    });
    enemy.health = enemy.maxHealth = O.HMH_OPENING_ENEMY_HEALTH_BY_ARCHETYPE[archetypeId];
    population.active.push(enemy);
    population.activeThreat += A.ENEMY_ARCHETYPES[archetypeId].costs.threat;
    population.insertedCount += 1;
    population.seenIds.add(enemy.id);
    addBody(enemy, bearing);
  }
  population.active.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  // Evidence.
  const ammo = Object.fromEntries(order.map((id) => {
    const weapon = loadout.weapons[id];
    return [id, { start: roundsHeld(weapon), granted: weapon.reserveAmmo === null ? null : 0, fired: 0, shots: 0, end: 0, maxReserve: weapon.reserveAmmo ?? 0, reserveCap: 0, activeTicks: 0, fallbacks: 0, acquiredTick: weapon.owned ? 0 : null }];
  }));
  const xpBySource = { kills: 0, combos: 0, caches: 0 };
  const killsByArchetype = {};
  const offers = [];
  const levelTicks = [{ level: 1, tick: 0 }];
  const xpByMinute = [];
  const levelByMinute = [];
  const aliveByMinute = [];
  const collected = [];
  const referenceByLevel = {};
  let damageTaken = 0;
  let healed = 0;
  let strikes = 0;
  let evaded = 0;
  let dodges = 0;
  let hitsTaken = 0;
  let maxAlive = 0;
  let died = false;
  let survivalTicks = horizonTicks;

  const snapshotNow = () => P.getRunProgressionSnapshot(progression);
  let snapshot = snapshotNow();
  let progressionByWeapon = W.progressionByWeapon(progression.ranks);
  referenceByLevel[1] = pistolReferenceDps(M, { ranks: progression.ranks, effects: snapshot.effects }).expected;

  const grantXp = (amount, tick, source) => {
    if (!amount) return;
    const before = progression.xp;
    P.grantRunXp(progression, amount, tick);
    xpBySource[source] += progression.xp - before;
  };
  // The reserve cap a rule bounded the gun by: twice its grant at the ranks in
  // force (the release's Magazine & Salvage moves it; a 1.8.1 tree reads the
  // authored grant). Recorded whenever a rule raises the reserve.
  const noteReserveCap = (id, byWeapon = progressionByWeapon) => {
    const policy = W.applyWeaponProgression(id, byWeapon[id]);
    const authored = policy.reserveAmmoGrant ?? W.HMH_WEAPON_DEFINITIONS[id].pickupReserveAmmo;
    ammo[id].reserveCap = Math.max(ammo[id].reserveCap, authored * 2);
  };
  const noteGrant = (id, before) => {
    const weapon = loadout.weapons[id];
    const ledger = ammo[id];
    if (ledger.granted !== null) {
      ledger.granted += roundsHeld(weapon) - before;
      noteReserveCap(id);
      ledger.maxReserve = Math.max(ledger.maxReserve, weapon.reserveAmmo ?? 0);
    }
  };
  const heldBefore = () => Object.fromEntries(order.map((id) => [id, roundsHeld(loadout.weapons[id])]));
  const noteGrants = (before) => { for (const id of order) if (loadout.weapons[id].owned) noteGrant(id, before[id]); };
  const acquire = (id, tick) => {
    if (ammo[id].acquiredTick === null) ammo[id].acquiredTick = tick;
    const at = acquisition.indexOf(id);
    if (at >= 0) acquisition.splice(at, 1);
    acquisition.push(id);
  };

  const applyPickup = (pickup, tick, hits) => {
    const kind = pickup.kind === 'collectible' ? pickup.effect.kind : pickup.kind;
    // Collectibles wait for canAcceptCollectible (real); site, secret and
    // supply rewards apply the moment they are earned, as in main.mjs.
    if (pickup.kind === 'collectible' && !CAP.canAcceptCollectible(pickup.effect, { health, maxHealth, grenades: grenades.handCharges, maxGrenades: grenades.maxHandCharges, loadout, progressionByWeapon })) return false;
    // 1.8.1 hazard: refilling the loadout, or granting the Arc Rifle, while the
    // Arc Rifle channels throws (lightning-ledger.mjs refillLightningLedgerCells)
    // and main.mjs does not guard it. The model takes such a pickup on the
    // first tick the channel is idle instead (see the build ledger).
    const refills = kind === 'ammo-refill' || kind === 'ammo' || (kind === 'weapon-cache' && loadout.weapons[pickup.effect.weaponId].channelState);
    if (refills && Object.values(loadout.weapons).some((weapon) => weapon.channelState?.active)) return false;
    if (kind === 'heal') {
      const before = health;
      health = Math.min(maxHealth, health + (pickup.effect?.amount ?? 30));
      healed += health - before;
    } else if (kind === 'weapon-cache') {
      const before = heldBefore();
      // 'if-new' is main.mjs's cache rule since the release; a 1.8.1 tree reads it as true.
      W.grantWeaponPickup(loadout, { tick, weaponId: pickup.effect.weaponId, select: 'if-new', progressionByWeapon });
      P.unlockRunProgressionWeapon(progression, pickup.effect.weaponId);
      noteGrants(before);
      acquire(pickup.effect.weaponId, tick);
    } else if (kind === 'ammo-refill' || kind === 'ammo') {
      const before = heldBefore();
      W.refillWeaponLoadout(loadout, { tick, progressionByWeapon });
      noteGrants(before);
    } else if (kind === 'grenade-supply') {
      G.rechargeHandGrenades(grenades, { tick, amount: 1 });
    } else if (kind === 'nuke') {
      G.rechargeHandGrenades(grenades, { tick, amount: 1 });
      for (const enemy of bodies) {
        // The release limits the nuke to its radius around the hero (package 8.6).
        if (pickup.effect.radius !== undefined && Math.hypot(enemy.x, enemy.y) > pickup.effect.radius) continue;
        hits.push({ id: `${pickup.id}:${enemy.id}`, tick, time: 0, targetId: enemy.id, sourceId: 'player', weaponId: 'nuke-liquidation', damage: pickup.effect.damage, criticalChance: 0, criticalMultiplier: 1, armorPiercing: true, direction: { x: 1, y: 0 }, knockback: 0 });
      }
    } else if (kind === 'timed') {
      timedEffects.set(pickup.effect.effectId, { expiresTick: tick + pickup.effect.durationTicks, damageMultiplier: pickup.effect.damageMultiplier ?? 1, speedMultiplier: pickup.effect.speedMultiplier ?? 1 });
    } else {
      throw new Error(`unsupported pickup kind ${kind}`);
    }
    if (pickup.kind === 'collectible' && pickup.effect.xpGain) grantXp(pickup.effect.xpGain, tick, 'caches');
    collected.push([pickup.id, tick]);
    return true;
  };

  const weaponCardIds = (cards) => {
    const current = W.progressionByWeapon(progression.ranks);
    const owned = Object.keys(current).filter((id) => loadout.weapons[id]?.owned);
    const ids = new Set();
    for (const card of cards) {
      const next = W.progressionByWeapon({ ...progression.ranks, [card.id]: (progression.ranks[card.id] ?? 0) + 1 });
      if (owned.some((id) => JSON.stringify(next[id]) !== JSON.stringify(current[id]))) ids.add(card.id);
    }
    return ids;
  };

  const hurtCache = new Map();
  const hurtTarget = (enemy) => {
    let target = hurtCache.get(enemy.id);
    if (!target) {
      const profile = HB.createOrdinaryEnemyHurtboxProfile(enemy.radius);
      const ground = { x: enemy.x, y: enemy.y, z: 0 };
      target = PR.createHurtTarget({ id: enemy.id, bodyShape: profile.bodyShape, hurtShape: profile.projectileShape, previousGround: ground, currentGround: ground, minZ: profile.minZ, maxZ: profile.maxZ, health: enemy.health });
      hurtCache.set(enemy.id, target);
    }
    return target;
  };

  // The run's critical hit. The release (package 8.6) extends it from
  // projectiles to the held weapons' direct hits; a 1.8.1 tree has no list.
  const heldCritical = (weaponId, effects) => (W.HMH_CRITICAL_HELD_WEAPON_IDS?.includes(weaponId)
    ? { criticalChance: Math.min(MAIN_MIRROR.criticalChanceCap, MAIN_MIRROR.baseCriticalChance + effects.criticalChanceBonus), criticalMultiplier: MAIN_MIRROR.baseCriticalMultiplier + effects.criticalDamageBonus }
    : null);

  const resolveShot = (shot, tick, effects, timedDamage, hits) => {
    const direction = shot.direction;
    const muzzle = { x: direction.x * MAIN_MIRROR.muzzleOffset, y: direction.y * MAIN_MIRROR.muzzleOffset, z: MAIN_MIRROR.projectileFlightHeight };
    const reach = shot.range;
    const splash = shot.policy?.type === 'splash' ? shot.policy.radius : 0;
    const margin = 48 + splash + shot.radius;
    const candidates = [];
    for (const enemy of bodies) {
      const dx = enemy.x - muzzle.x;
      const dy = enemy.y - muzzle.y;
      const along = dx * direction.x + dy * direction.y;
      if (along < -margin || along > reach + margin) continue;
      if (Math.abs(dy * direction.x - dx * direction.y) > margin) continue;
      candidates.push(hurtTarget(enemy));
    }
    if (candidates.length === 0) return;
    const projectile = PR.createProjectileState({
      id: shot.id,
      ownerId: 'player',
      previous: muzzle,
      current: { x: muzzle.x + direction.x * reach, y: muzzle.y + direction.y * reach, z: muzzle.z },
      radius: shot.radius,
      damage: shot.damage * timedDamage,
      policy: shot.policy,
    });
    const falloff = shot.policy?.falloff ?? null;
    for (const hit of PR.resolveProjectilePath({ projectile, targets: candidates }).hits) {
      const scale = falloff ? W.laneDamageScale({ traveled: hit.time * reach, range: reach, falloff }) : 1;
      hits.push({
        id: `${shot.id}:${hit.targetId}:${hit.kind}`,
        tick,
        time: hit.time,
        targetId: hit.targetId,
        sourceId: 'player',
        weaponId: shot.weaponId,
        damage: hit.damage * scale,
        criticalChance: Math.min(MAIN_MIRROR.criticalChanceCap, MAIN_MIRROR.baseCriticalChance + effects.criticalChanceBonus),
        criticalMultiplier: MAIN_MIRROR.baseCriticalMultiplier + effects.criticalDamageBonus,
        armorPiercing: shot.armorPiercing === true,
        armorPenetration: 0,
        direction,
        knockback: 0,
      });
    }
  };

  for (let tick = 1; tick <= horizonTicks; tick += 1) {
    hurtCache.clear();
    for (const enemy of bodies) {
      enemy.previousX = enemy.x;
      enemy.previousY = enemy.y;
    }
    const effects = snapshot.effects;
    for (const [id, effect] of [...timedEffects]) if (tick >= effect.expiresTick) timedEffects.delete(id);
    let timedDamage = 1;
    let timedSpeed = 1;
    for (const effect of timedEffects.values()) {
      timedDamage = Math.max(timedDamage, effect.damageMultiplier);
      timedSpeed = Math.max(timedSpeed, effect.speedMultiplier);
    }
    const hits = [];

    // Aim: the real auto-aim, nearest target in range, no manual input.
    const aimIntent = AM.resolveAimIntent(aimState, { tick, actor: { x: 0, y: 0 }, input: null, targets: bodies, device: 'pointer', lineOfSight: () => true });
    const direction = aimIntent.fire
      ? rotate(aimIntent.direction, (unit(seed, `aim:${tick}`) - 0.5) * 2 * C.aimErrorRadians)
      : { ...aimIntent.direction };

    // Pickups on the route (they precede the weapon step, as in main.mjs).
    while (pickupCursor < pickups.length && pickups[pickupCursor].readyTick <= tick) openPickups.push(pickups[pickupCursor++]);
    for (let index = 0; index < openPickups.length;) {
      const pickup = openPickups[index];
      if (tick > pickup.closeTick) { openPickups.splice(index, 1); continue; }
      if (applyPickup(pickup, tick, hits)) { openPickups.splice(index, 1); continue; }
      index += 1;
    }

    // The director: real bands, caps, archetype choice and health ramp.
    const districtId = WORLD.getLevelOneDistrictAt(Math.min(11_999, tick * C.routeUnitsPerTick), C.routeLookupY)?.id ?? 'liquidation-yard';
    const bearing = bearingFor(`spawn:${director.spawnOrdinal}`);
    const step = D.stepEncounterDirector({
      state: director,
      population,
      tick,
      districtId,
      player: { x: 0, y: 0, groundZ: 0 },
      camera: D.directorViewBounds({ x: 0, y: 0 }),
      spawnPoints: [{ id: 'model-spawn', regionId: 'model', districtId, x: Math.cos(bearing) * C.spawnDistance, y: Math.sin(bearing) * C.spawnDistance, routeValid: true }],
      queryGround: flatGround,
      isBlocked: () => false,
      isRouteReachable: () => true,
      visualMode: 'normal',
    });
    if (step.inserted) addBody(population.active.find((enemy) => enemy.id === step.enemyId), bearing);
    maxAlive = Math.max(maxAlive, bodies.length);

    // Enemy movement: straight in, queued by lane, locked while striking.
    if (O.openingEnemyMovementEnabled(tick)) {
      const rank = new Map();
      for (const enemy of bodies) {
        const archetype = A.ENEMY_ARCHETYPES[enemy.archetypeId];
        const melee = archetype.attack.tokenFamily === 'melee';
        const key = laneById.get(enemy.id) * 2 + (melee ? 0 : 1);
        const position = rank.get(key) ?? 0;
        rank.set(key, position + 1);
        if (enemy.attackPhase === 'tell' || enemy.attackPhase === 'attack') continue;
        const stop = (melee
          ? Math.max(archetype.radius + MAIN_MIRROR.playerRadius, archetype.attack.range - C.meleeStopInset)
          : archetype.preferredDistance) + position * (2 * archetype.radius + C.queueGap);
        const distance = Math.hypot(enemy.x, enemy.y);
        if (distance <= stop) continue;
        const move = Math.min(distance - stop, archetype.speed / TICKS_PER_SECOND * C.closingFactor);
        enemy.x -= enemy.x / distance * move;
        enemy.y -= enemy.y / distance * move;
      }
    }

    // Weapon: a dry gun hands back to the pistol (real). The player uses the
    // pistol only as the fallback: while it is drawn and a gun still has
    // rounds, they swap to the most recently acquired one (a pistol cache
    // selects the pistol in 1.8.1, and the player swaps straight back).
    if (loadout.activeWeaponId === 'coin-blaster' && tick > loadout.switchReadyTick) {
      const candidate = [...acquisition].reverse().find((id) => id !== 'coin-blaster' && loadout.weapons[id].owned
        && (W.HMH_WEAPON_DEFINITIONS[id].ammoModel === 'none' || roundsHeld(loadout.weapons[id]) > 0));
      if (candidate && W.switchWeapon(loadout, candidate, { tick })) P.setRunUpgradeFocus?.(progression, candidate);
    }
    const held = heldBefore();
    const activeId = loadout.activeWeaponId;
    const frame = W.stepWeaponLoadout(loadout, {
      tick,
      fire: aimIntent.fire,
      releaseCharged: aimState.autoFireEnabled,
      direction,
      progressionByWeapon,
      channelOrigin: { x: 0, y: 0, z: MAIN_MIRROR.projectileFlightHeight },
      channelTargets: bodies,
      channelProvokesAmbient: !aimIntent.automatic,
      currentEligibleTargetIds: activeId === 'bear-market-burner' ? bodies.map((enemy) => enemy.id).sort() : [],
      channelLineOfSight: () => true,
      channelStopReason: '',
      meleeOrigin: { x: 0, y: 0, z: 0 },
      meleeTargets: activeId === 'forked-standard' ? bodies.filter((enemy) => Math.hypot(enemy.x, enemy.y) <= C.meleeTargetRange + 200).map((enemy) => meleeTarget(ML, HB, enemy)) : [],
      meleeBlockers: [],
      meleeDownwardDropDirection: null,
    });
    for (const id of order) {
      const change = roundsHeld(loadout.weapons[id]) - held[id];
      if (change < 0) ammo[id].fired -= change;
      else if (change > 0 && ammo[id].granted !== null) { ammo[id].granted += change; noteReserveCap(id); } // a refunded cell, or the release's trickle
      ammo[id].maxReserve = Math.max(ammo[id].maxReserve, loadout.weapons[id].reserveAmmo ?? 0);
    }
    for (const event of frame.events) {
      if (event.type === 'weapon:auto-fallback') {
        ammo[event.previousWeaponId].fallbacks += 1;
      } else if (event.type === 'weapon:fire') {
        ammo[event.weaponId].shots += 1;
        if (event.weaponId === 'launcher-rig') {
          // The release throws one shell per shot with its damage and blast
          // radius (shots carry blastRadius); 1.8.1 threw one default grenade.
          const shells = event.shots[0]?.blastRadius != null ? event.shots : null;
          for (const shell of shells ?? [null]) {
            G.throwGrenade(grenades, {
              tick,
              mode: 'launcher',
              origin: { x: (shell ?? { direction }).direction.x * MAIN_MIRROR.muzzleOffset, y: (shell ?? { direction }).direction.y * MAIN_MIRROR.muzzleOffset, z: MAIN_MIRROR.launcherOriginZ },
              direction: shell ? shell.direction : direction,
              damageMultiplier: timedDamage,
              ...(shell ? { damage: shell.damage, blastRadius: shell.blastRadius } : {}),
            });
          }
          continue;
        }
        for (const shot of event.shots) resolveShot(shot, tick, effects, timedDamage, hits);
      } else if (event.type === 'weapon:channel-pulse' || event.type === 'weapon:flame-pulse') {
        ammo[event.weaponId].shots += 1;
        for (const hit of event.hits) {
          hits.push({ id: hit.id, tick, time: 0, targetId: hit.targetId, sourceId: 'player', weaponId: event.weaponId, damage: hit.damage * timedDamage, criticalChance: 0, criticalMultiplier: 1, ...heldCritical(event.weaponId, effects), armorPiercing: false, direction: { x: 1, y: 0 }, knockback: 0 });
        }
      } else if (event.type === 'burner:burn-tick') {
        if (!bodies.some((enemy) => enemy.id === event.targetId)) continue;
        hits.push({ id: `burner-dot:${event.targetId}:${tick}`, tick, time: 0, targetId: event.targetId, sourceId: 'player', weaponId: 'bear-market-burner', damage: event.damage * timedDamage, criticalChance: 0, criticalMultiplier: 1, armorPiercing: false, direction: { x: 0, y: 0 }, knockback: 0 });
      } else if (event.type === 'weapon:melee-strike') {
        ammo[event.weaponId].shots += 1;
        for (const hit of event.hits) hits.push({ ...hit, tick, sourceId: 'player', weaponId: event.weaponId, damage: hit.damage * timedDamage, ...heldCritical(event.weaponId, effects) });
      }
    }
    ammo[loadout.activeWeaponId].activeTicks += 1;

    // The always-on knife.
    const knifeTargets = tick >= meleeState.nextAttackTick ? bodies.filter((enemy) => Math.hypot(enemy.x, enemy.y) <= C.meleeTargetRange) : [];
    const knife = ML.stepMeleeState(meleeState, {
      tick,
      automatic: loadout.activeWeaponId !== 'forked-standard',
      origin: { x: 0, y: 0 },
      direction: aimIntent.direction,
      sourceGroundZ: 0,
      targets: knifeTargets.map((enemy) => meleeTarget(ML, HB, enemy)),
      blockers: [],
      downwardDropDirection: null,
    });
    for (const hit of knife.hits) hits.push({ ...hit, damage: hit.damage * timedDamage });

    // Hand grenades at a cluster in front of the hero.
    if (grenades.handCharges > 0 && tick >= nextHandGrenadeTick && aimIntent.fire) {
      const landing = { x: aimIntent.direction.x * C.handGrenadeLandingDistance, y: aimIntent.direction.y * C.handGrenadeLandingDistance };
      let cluster = 0;
      for (const enemy of bodies) if (Math.hypot(enemy.x - landing.x, enemy.y - landing.y) <= C.handGrenadeClusterRadius) cluster += 1;
      if (cluster >= C.handGrenadeClusterSize) {
        G.throwGrenade(grenades, {
          tick,
          mode: 'hand',
          origin: { x: aimIntent.direction.x * MAIN_MIRROR.handGrenadeOffset, y: aimIntent.direction.y * MAIN_MIRROR.handGrenadeOffset, z: MAIN_MIRROR.handGrenadeOriginZ },
          direction: aimIntent.direction,
          damageMultiplier: timedDamage,
        });
        nextHandGrenadeTick = tick + C.handGrenadeCooldownTicks;
      }
    }
    const blastTargets = grenades.active.length === 0 ? [] : bodies.filter((enemy) => grenades.active.some((grenade) => Math.hypot(enemy.x - grenade.position.x, enemy.y - grenade.position.y) <= grenade.blastRadius + 160)).map(hurtTarget);
    const grenadeFrame = G.stepGrenadeSystem(grenades, { tick, queryGround: flatGround, blockers: [], targets: blastTargets });
    for (const detonation of grenadeFrame.detonations) for (const hit of detonation.hits) hits.push({ ...hit, tick, ...heldCritical(hit.weaponId, effects) });

    // Enemy attacks: real tokens, tells and strikes; the model decides whether
    // a strike connects (evasion proxy) and spends the automatic dodge on it.
    if (O.openingEnemyAttacksEnabled(tick)) {
      const band = D.getEncounterBand(tick);
      if (bandTokens?.id !== band.id) bandTokens = { id: band.id, budgets: D.getEncounterSnapshot(tick).attackTokens };
      const attacks = EC.stepEnemyAttacks({ enemies: population.active, player: { id: 'player', x: 0, y: 0, groundZ: 0, radius: MAIN_MIRROR.playerRadius }, tick, budgets: bandTokens.budgets });
      const connectChance = Math.min(1, C.strikeConnectChance / (effects.moveSpeedMultiplier * timedSpeed));
      for (const event of attacks.events) {
        if (event.damage <= 0 || event.tokenFamily === 'support') continue;
        strikes += 1;
        connectMass += connectChance;
        if (connectMass < 1) { evaded += 1; continue; }
        connectMass -= 1;
        if (tick <= invulnerableUntilTick) { dodges += 1; continue; }
        if (tick >= dashReadyTick) {
          dashReadyTick = tick + DS.DASH_COOLDOWN_TICKS_BY_TIER[dashTier];
          invulnerableUntilTick = tick + DS.DASH_INVULNERABILITY_TICKS - 1;
          dodges += 1;
          continue;
        }
        hits.push({ id: event.attackId, tick, time: 1, targetId: 'player', sourceId: event.enemyId, weaponId: `enemy-${event.archetypeId}`, damage: event.damage, criticalChance: 0, criticalMultiplier: 1, armorPiercing: false, direction: { x: 1, y: 0 }, knockback: 0 });
      }
    }

    // Combat: the real resolver (seeded crits, armour), outgoing multiplier as in main.mjs.
    if (hits.length > 0) {
      const alive = new Map(bodies.map((enemy) => [enemy.id, enemy]));
      const involved = new Set();
      const intents = [];
      for (const hit of hits) {
        if (hit.targetId !== 'player' && !alive.has(hit.targetId)) continue;
        involved.add(hit.targetId);
        intents.push(hit.sourceId === 'player' ? { ...hit, damage: hit.damage * effects.outgoingDamageMultiplier } : hit);
      }
      const targets = [...involved].filter((id) => id !== 'player').map((id) => {
        const enemy = alive.get(id);
        return { id, health: enemy.health, maxHealth: enemy.maxHealth, armor: enemy.armor, shieldCharges: enemy.shieldCharges, knockbackResistance: enemy.knockbackResistance };
      });
      if (involved.has('player')) targets.push({ id: 'player', health, maxHealth, armor: 1, shieldCharges: 0, knockbackResistance: 1 });
      const result = CB.resolveCombatHits({ sessionSeed: seed, hits: intents, targets });
      for (const event of result.damageEvents) {
        if (event.targetId === 'player') {
          hitsTaken += 1;
          damageTaken += event.damageApplied;
          combo = 0;
        } else {
          alive.get(event.targetId).health = event.healthAfter;
        }
      }
      if (involved.has('player')) health = result.targets.player.health;
      for (const death of result.deathEvents) {
        if (death.enemyId === 'player') continue;
        const enemy = alive.get(death.enemyId);
        const threatCost = A.ENEMY_ARCHETYPES[enemy.archetypeId].costs.threat;
        const before = progression.xp;
        P.recordRunDefeat(progression, { enemyId: enemy.id, threatCost, tick });
        // The release's Magazine & Salvage: kills refund reserve to their gun.
        const salvage = W.creditWeaponKills?.(loadout, { tick, weaponId: death.weaponId, count: 1, progressionByWeapon });
        if (salvage?.rounds > 0) {
          ammo[salvage.weaponId].granted += salvage.rounds;
          ammo[salvage.weaponId].maxReserve = Math.max(ammo[salvage.weaponId].maxReserve, salvage.reserveAmmo);
          noteReserveCap(salvage.weaponId);
        }
        xpBySource.kills += progression.xp - before;
        killsByArchetype[enemy.archetypeId] = (killsByArchetype[enemy.archetypeId] ?? 0) + 1;
        const feedback = CO.resolveComboFeedback({ previous: combo, current: combo + 1 });
        combo = feedback.current;
        grantXp(P.comboMilestoneXp(combo), tick, 'combos');
        E.retireEnemyFromPopulation(population, enemy.id, { tick, reason: 'defeated' });
        bodies.splice(bodies.indexOf(enemy), 1);
        laneById.delete(enemy.id);
      }
    }
    if (health <= 0) {
      died = true;
      survivalTicks = tick;
      break;
    }

    // Level-ups: the offer opens inside the tick and the policy picks at once.
    // With the release's API each pending level opens its own offer, card 2
    // drawn from the guns with ammo, and the policy re-rolls by the frozen
    // chooseReroll rule before it picks.
    const levelBefore = levelTicks.at(-1).level;
    if (progression.pendingLevels > 0) snapshot = snapshotNow();
    while (snapshot.pendingLevels > 0 && snapshot.pendingChoices.length > 0) {
      if (P.openRunUpgradeOffer && !P.openRunUpgradeOffer(progression, { armedWeaponIds: W.weaponIdsWithAmmo(loadout) })) break;
      let cards = readOffer(M, progression);
      const shown = cards.map((card) => card.id);
      let rerolls = 0;
      if (P.rerollRunUpgradeSlot) {
        const rerolledSlots = new Set();
        for (;;) {
          const slot = chooseReroll(policy, cards, { seed, level: progression.level, selectionSequence: progression.selectionSequence, weaponCardIds: weaponCardIds(cards), rerolledSlots });
          if (slot < 0) break;
          rerolledSlots.add(slot);
          const replacement = P.rerollRunUpgradeSlot(progression, cards[slot].slot);
          if (!replacement) continue;
          rerolls += 1;
          shown.push(replacement.id);
          cards = readOffer(M, progression);
        }
      }
      const index = choosePick(policy, cards, { seed, level: progression.level, selectionSequence: progression.selectionSequence, weaponCardIds: weaponCardIds(cards) });
      const before = snapshot.effects;
      const selection = P.selectRunUpgrade(progression, cards[index].id);
      // Balance option (a): a gun card comes with a magazine for its gun (reserve
      // only, on the offer's tick). A 1.8.1 tree has no rule and grants nothing.
      const pickedByWeapon = W.progressionByWeapon(progression.ranks);
      const magazine = W.creditWeaponCardPick?.(loadout, { tick, upgradeId: cards[index].id, progressionByWeapon: pickedByWeapon });
      if (magazine?.rounds > 0) {
        ammo[magazine.weaponId].granted += magazine.rounds;
        ammo[magazine.weaponId].maxReserve = Math.max(ammo[magazine.weaponId].maxReserve, magazine.reserveAmmo);
        noteReserveCap(magazine.weaponId, pickedByWeapon);
      }
      offers.push({ tick, level: progression.level, offered: cards.map((card) => card.id), picked: cards[index].id, rerolls, ...(P.rerollRunUpgradeSlot ? { shown } : {}) });
      const healthGain = selection.effects.maxHealthBonus - before.maxHealthBonus;
      if (healthGain > 0) {
        maxHealth += healthGain;
        health = Math.min(maxHealth, health + healthGain);
      }
      dashTier = selection.effects.dashCooldownTier;
      const grenadeGain = selection.effects.bonusGrenadeCharges - before.bonusGrenadeCharges;
      // The release raises the maximum (package 8.6); 1.8.1 let the charges overflow it.
      if (grenadeGain > 0 && G.raiseHandGrenadeMaximum) G.raiseHandGrenadeMaximum(grenades, { amount: grenadeGain });
      else if (grenadeGain > 0) grenades.handCharges += grenadeGain;
      snapshot = selection.snapshot;
    }
    if (progression.level > levelBefore) progressionByWeapon = W.progressionByWeapon(progression.ranks);
    for (let level = levelBefore + 1; level <= progression.level; level += 1) {
      levelTicks.push({ level, tick });
      referenceByLevel[level] = pistolReferenceDps(M, { ranks: progression.ranks, effects: snapshot.effects }).expected;
    }

    if (tick % TICKS_PER_MINUTE === 0) {
      xpByMinute.push(progression.xp);
      levelByMinute.push(progression.level);
      aliveByMinute.push(bodies.length);
    }
  }

  for (const id of order) {
    const weapon = loadout.weapons[id];
    ammo[id].end = roundsHeld(weapon);
  }
  const evidence = {
    model: PROGRESSION_MODEL_VERSION,
    seed,
    policy,
    horizonTicks,
    survivalTicks,
    died,
    health: round(health, 6),
    maxHealth,
    damageTaken: round(damageTaken, 6),
    healed: round(healed, 6),
    strikes,
    evaded,
    dodges,
    hitsTaken,
    maxAlive,
    kills: Object.values(killsByArchetype).reduce((sum, value) => sum + value, 0),
    killsByArchetype,
    xp: progression.xp,
    level: progression.level,
    score: progression.score,
    xpBySource,
    xpByMinute,
    levelByMinute,
    aliveByMinute,
    levelTicks,
    offers,
    ranks: Object.fromEntries(Object.entries(progression.ranks).filter(([, rank]) => rank > 0)),
    ammo,
    collected,
    referenceByLevel,
  };
  return Object.freeze({ ...evidence, digest: sha256(JSON.stringify(evidence)) });
}

function meleeTarget(ML, HB, enemy) {
  const profile = HB.createOrdinaryEnemyHurtboxProfile(enemy.radius);
  const ground = { x: enemy.x, y: enemy.y, z: 0 };
  return ML.createMeleeTarget({ id: enemy.id, previousGround: { x: enemy.previousX ?? enemy.x, y: enemy.previousY ?? enemy.y, z: 0 }, currentGround: ground, radius: profile.meleeRadius, minZ: profile.minZ, maxZ: profile.maxZ });
}

// --- Harness and aggregation ----------------------------------------------

function quantile(values, q) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return round(sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower), 3);
}

function distribution(values) {
  return {
    n: values.length,
    median: quantile(values, 0.5),
    p10: quantile(values, 0.1),
    p25: quantile(values, 0.25),
    p75: quantile(values, 0.75),
    p90: quantile(values, 0.9),
    mean: values.length === 0 ? null : round(values.reduce((sum, value) => sum + value, 0) / values.length, 3),
  };
}

function survivalSummary(runs) {
  return { ...distribution(runs.map((run) => run.survivalTicks)), deaths: runs.filter((run) => run.died).length, reachedHorizon: runs.filter((run) => !run.died).length };
}

const PISTOL_MASTERY = Object.freeze({ 'proof-of-work': 3, 'hot-wallet': 3, 'block-reward': 3 });

function pistolMasteryOffers(run) {
  const ranks = {};
  for (const [index, offer] of run.offers.entries()) {
    ranks[offer.picked] = (ranks[offer.picked] ?? 0) + 1;
    if (Object.entries(PISTOL_MASTERY).every(([id, rank]) => (ranks[id] ?? 0) >= rank)) return index + 1;
  }
  return null;
}

function xpIncomeSummary(runs, horizonTicks) {
  const minutes = Math.floor(horizonTicks / TICKS_PER_MINUTE);
  const byMinute = Array.from({ length: minutes }, (_, index) => {
    const alive = runs.filter((run) => run.xpByMinute.length > index);
    return { minute: index + 1, runs: alive.length, xp: quantile(alive.map((run) => run.xpByMinute[index]), 0.5), level: quantile(alive.map((run) => run.levelByMinute[index]), 0.5), alive: quantile(alive.map((run) => run.aliveByMinute[index]), 0.5) };
  });
  const maxLevel = Math.max(...runs.map((run) => run.level));
  const levelTicks = Array.from({ length: maxLevel - 1 }, (_, index) => {
    const level = index + 2;
    const ticks = runs.map((run) => run.levelTicks.find((entry) => entry.level === level)?.tick).filter((tick) => tick !== undefined);
    return { level, runs: ticks.length, medianTick: quantile(ticks, 0.5) };
  });
  const total = runs.reduce((sum, run) => sum + run.xp, 0) || 1;
  const sources = Object.fromEntries(Object.keys(runs[0].xpBySource).map((source) => [source, round(runs.reduce((sum, run) => sum + run.xpBySource[source], 0) / total, 4)]));
  return { byMinute, levelTicks, sourceShare: sources, finalLevel: distribution(runs.map((run) => run.level)), kills: distribution(runs.map((run) => run.kills)) };
}

function offerSummary(runs) {
  const offered = {};
  const picked = {};
  for (const run of runs) {
    for (const offer of run.offers) {
      for (const id of offer.offered) offered[id] = (offered[id] ?? 0) + 1;
      picked[offer.picked] = (picked[offer.picked] ?? 0) + 1;
    }
  }
  const sortObject = (object) => Object.fromEntries(Object.entries(object).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  const mastery = runs.map(pistolMasteryOffers);
  const reached = mastery.filter((value) => value !== null);
  return {
    offersOpened: distribution(runs.map((run) => run.offers.length)),
    rerolls: runs.reduce((sum, run) => sum + run.offers.reduce((inner, offer) => inner + offer.rerolls, 0), 0),
    offered: sortObject(offered),
    picked: sortObject(picked),
    pistolMastery: { runs: runs.length, reached: reached.length, levelUps: distribution(reached) },
  };
}

function ammoSummary(runs) {
  const weaponIds = Object.keys(runs[0].ammo);
  return Object.fromEntries(weaponIds.map((id) => {
    const owned = runs.filter((run) => run.ammo[id].acquiredTick !== null);
    const share = owned.map((run) => run.ammo[id].activeTicks / run.survivalTicks);
    return [id, {
      acquiredRuns: owned.length,
      acquiredTick: distribution(owned.map((run) => run.ammo[id].acquiredTick)),
      shots: distribution(owned.map((run) => run.ammo[id].shots)),
      granted: id === 'coin-blaster' ? null : distribution(owned.map((run) => run.ammo[id].granted)),
      fired: distribution(owned.map((run) => run.ammo[id].fired)),
      activeShare: distribution(share),
      fallbacks: distribution(owned.map((run) => run.ammo[id].fallbacks)),
    }];
  }));
}

function referenceSummary(runs) {
  const maxLevel = Math.max(...runs.map((run) => run.level));
  const table = [];
  for (let level = 1; level <= maxLevel; level += 1) {
    const values = runs.map((run) => run.referenceByLevel[level]).filter((value) => value !== undefined);
    if (values.length === 0) continue;
    table.push({ level, runsReached: values.length, median: quantile(values, 0.5), p25: quantile(values, 0.25), p75: quantile(values, 0.75) });
  }
  const calibration = calibrateReferenceDps(table);
  const placeholder = (level) => Math.min(47, 8 + 2.6 * (level - 1));
  const rms = (predict) => round(Math.sqrt(calibration.levels.reduce((sum, _, index) => sum + (predict(index + 1) - table[index].median) ** 2, 0) / calibration.lastLevel), 3);
  return {
    method: 'Pistol sustained DPS against one static armour-1 target over 30 s (the weapon benchmark method), times the outgoing damage multiplier, with the expected critical hit, measured once the picks of each new level are made; the median over every run that reaches the level.',
    formula: 'referenceDps(L) = levels[min(L, lastLevel) - 1]: the per-level medians of the levels at least half the runs reach, made non-decreasing and rounded to 0.1',
    table,
    calibration: { levels: calibration.levels, lastLevel: calibration.lastLevel, rmsError: rms((level) => referenceDpsFromTable(calibration.levels, level)) },
    placeholder: { formula: 'min(47, 8 + 2.6 x (L - 1))', rmsError: rms(placeholder) },
  };
}

export function runProgressionHarness(M, {
  seeds = modelSeeds(DEFAULT_SEED_COUNT),
  policies = PICK_POLICIES,
  horizonTicks = MODEL_CONSTANTS.horizonTicks,
  onRun = null,
} = {}) {
  const runs = [];
  for (const policy of policies) {
    for (const seed of seeds) {
      const run = runProgressionModel(M, { seed, policy, horizonTicks });
      runs.push(run);
      onRun?.(run);
    }
  }
  // Same-seed determinism: the first seed of every policy, run again.
  const deterministic = policies.every((policy) => runProgressionModel(M, { seed: seeds[0], policy, horizonTicks }).digest === runs.find((run) => run.policy === policy && run.seed === seeds[0]).digest);
  const byPolicy = (summarize) => Object.fromEntries(policies.map((policy) => [policy, summarize(runs.filter((run) => run.policy === policy))]));
  return {
    schemaVersion: 1,
    modelVersion: PROGRESSION_MODEL_VERSION,
    constantsFingerprint: modelConstantsFingerprint(),
    constants: MODEL_CONSTANTS,
    mirror: MAIN_MIRROR,
    config: { seeds: [...seeds], policies: [...policies], horizonTicks },
    deterministic,
    survival: { unit: 'ticks (60 per second)', pooled: survivalSummary(runs), byPolicy: byPolicy(survivalSummary) },
    xpIncome: { pooled: xpIncomeSummary(runs, horizonTicks), byPolicy: byPolicy((subset) => xpIncomeSummary(subset, horizonTicks)) },
    offers: { pooled: offerSummary(runs), byPolicy: byPolicy(offerSummary) },
    ammo: { pooled: ammoSummary(runs), byPolicy: byPolicy(ammoSummary) },
    health: {
      damageTaken: distribution(runs.map((run) => run.damageTaken)),
      healed: distribution(runs.map((run) => run.healed)),
      dodges: distribution(runs.map((run) => run.dodges)),
      strikes: distribution(runs.map((run) => run.strikes)),
      maxAlive: distribution(runs.map((run) => run.maxAlive)),
    },
    referenceDps: referenceSummary(runs),
    runs: runs.map((run) => ({ seed: run.seed, policy: run.policy, digest: run.digest, survivalTicks: run.survivalTicks, died: run.died, level: run.level, xp: run.xp, kills: run.kills })),
    digest: sha256(runs.map((run) => run.digest).join('\n')),
  };
}

// The progression gate (package 8.3 and 9.2): the pooled median survival may
// grow by at most 10%. Per-policy growth above 10% and any drop beyond 10%
// are warnings the slice must report.
export function compareToBaseline(report, baseline) {
  const comparable = report.modelVersion === baseline.modelVersion
    && report.constantsFingerprint === baseline.constantsFingerprint
    && JSON.stringify(report.config) === JSON.stringify(baseline.config);
  if (!comparable) {
    return { comparable: false, pass: false, reason: 'the report and the baseline differ in model version, constants or configuration; regenerate the baseline from a 1.8.1 checkout with --root', warnings: [] };
  }
  const growth = (current, base) => round(current / base - 1, 4);
  const pooledGrowth = growth(report.survival.pooled.median, baseline.survival.pooled.median);
  const policies = Object.keys(baseline.survival.byPolicy);
  const byPolicy = Object.fromEntries(policies.map((policy) => [policy, growth(report.survival.byPolicy[policy].median, baseline.survival.byPolicy[policy].median)]));
  const warnings = [];
  for (const policy of policies) {
    if (byPolicy[policy] > SURVIVAL_GATE_MAX_GROWTH) warnings.push({ policy, growth: byPolicy[policy], reason: 'policy median survival grew by more than 10%' });
    else if (byPolicy[policy] < -SURVIVAL_GATE_MAX_GROWTH) warnings.push({ policy, growth: byPolicy[policy], reason: 'policy median survival fell by more than 10%' });
  }
  // Information only: the median is the gate, but the model's median moves
  // little with power (+20% outgoing damage on 1.8.1 moved it +3%, p10 +38%),
  // so a slice reports how the whole distribution moved.
  const pooledQuantiles = Object.fromEntries(['p10', 'p25', 'median', 'p75', 'p90', 'mean']
    .filter((key) => Number.isFinite(report.survival.pooled[key]) && Number.isFinite(baseline.survival.pooled[key]) && baseline.survival.pooled[key] > 0)
    .map((key) => [key, growth(report.survival.pooled[key], baseline.survival.pooled[key])]));
  return { comparable: true, pass: pooledGrowth <= SURVIVAL_GATE_MAX_GROWTH, pooledGrowth, byPolicy, limit: SURVIVAL_GATE_MAX_GROWTH, pooledQuantiles, warnings };
}

// --- CLI ------------------------------------------------------------------

function parseArguments(argv) {
  const options = { root: REPO_ROOT, seedCount: DEFAULT_SEED_COUNT, horizonTicks: MODEL_CONSTANTS.horizonTicks, out: null, writeBaseline: false, compare: true, sourceLabel: null, sourceCommit: null };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = () => {
      const next = argv[index + 1];
      if (next === undefined) throw new TypeError(`${flag} needs a value`);
      index += 1;
      return next;
    };
    if (flag === '--root') options.root = resolve(value());
    else if (flag === '--seeds') options.seedCount = Number(value());
    else if (flag === '--horizon') options.horizonTicks = Number(value());
    else if (flag === '--out') options.out = resolve(value());
    else if (flag === '--write-baseline') options.writeBaseline = true;
    else if (flag === '--no-compare') options.compare = false;
    else if (flag === '--source-label') options.sourceLabel = value();
    else if (flag === '--source-commit') options.sourceCommit = value();
    else throw new TypeError(`unknown argument ${flag}`);
  }
  if (options.writeBaseline && (!options.sourceLabel || !options.sourceCommit)) throw new TypeError('--write-baseline needs --source-label and --source-commit');
  return options;
}

function minutes(ticks) {
  return (ticks / TICKS_PER_MINUTE).toFixed(2);
}

async function main(argv) {
  const options = parseArguments(argv);
  const modules = await loadProgressionModules(options.root);
  const started = Date.now();
  let done = 0;
  const seeds = modelSeeds(options.seedCount);
  const report = runProgressionHarness(modules, {
    seeds,
    horizonTicks: options.horizonTicks,
    onRun: (run) => {
      done += 1;
      process.stderr.write(`\r${done}/${seeds.length * PICK_POLICIES.length} runs`);
    },
  });
  process.stderr.write(`\r${done} runs in ${((Date.now() - started) / 1000).toFixed(1)} s\n`);
  report.source = options.sourceLabel ? { label: options.sourceLabel, commit: options.sourceCommit } : { label: 'working tree', commit: null };
  console.log(`model ${report.modelVersion}  deterministic=${report.deterministic}  digest=${report.digest.slice(0, 16)}`);
  console.log(`survival (median, min:s) pooled ${minutes(report.survival.pooled.median)}  ${PICK_POLICIES.map((policy) => `${policy} ${minutes(report.survival.byPolicy[policy].median)}`).join('  ')}`);
  const calibration = report.referenceDps.calibration;
  console.log(`referenceDps levels 1-${calibration.lastLevel}: ${calibration.levels.join(' ')}  (rms ${calibration.rmsError}; placeholder rms ${report.referenceDps.placeholder.rmsError})`);
  if (options.out) {
    await mkdir(dirname(options.out), { recursive: true });
    await writeFile(options.out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }
  if (options.writeBaseline) {
    const path = join(REPO_ROOT, BASELINE_RELATIVE_PATH);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(`baseline written: ${BASELINE_RELATIVE_PATH}`);
    return 0;
  }
  if (!options.compare) return 0;
  const baseline = JSON.parse(await readFile(join(REPO_ROOT, BASELINE_RELATIVE_PATH), 'utf8'));
  const comparison = compareToBaseline(report, baseline);
  console.log(JSON.stringify({ gate: 'hmh-progression-survival', ...comparison }, null, 2));
  return comparison.pass && report.deterministic ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
