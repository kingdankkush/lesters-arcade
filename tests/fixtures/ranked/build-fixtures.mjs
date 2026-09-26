// Ranked settle fixtures (verify slice brief, plan step 4) and the generators
// settle and rehearsal reuse to rebuild evidence for their own ticket seeds,
// wallets and registries.
//
//   node tests/fixtures/ranked/build-fixtures.mjs            # check: rebuild every fixture, compare with the committed JSON
//   node tests/fixtures/ranked/build-fixtures.mjs --write    # rewrite the committed JSON
//   node tests/fixtures/ranked/build-fixtures.mjs --write hmh-valid stacked-valid
//
// Every fixture is a complete §5.1 body with a real seed ticket MAC'd by the
// fixture key below, the ticket seed, and evidence played at that seed:
//   - Chikun: a headless bot (scripts/lib/chikun-bots.mjs) plays the live v6
//     course, then stops pressing after `maxMinutes` until the run ends.
//   - STACKED: the Free-only soak pilot plays under the Ranked replay config
//     (maxTicks = STACKED_MAX_TICKS, startLevel 1) until `topOutAtTick`, then
//     hard drops until the board blocks out, so the run is short but terminal.
//   - HMH: a run summary v6 from the real accumulator (sdk/hmh-run-summary.mjs),
//     with level, XP and score from the reboot's own run-progression functions,
//     plus a lesters-session-envelope-v1 from finalizeSessionEvidence.
//   - HMH schema 7 (HMH_V7_FIXTURE_NAMES, kept apart from FIXTURE_NAMES): the
//     same, extended to run summary schema 7 (see buildHmhV7Evidence). Until
//     server/verify/hmh.mjs accepts schema 7 a Ranked v7 body is refused before
//     plausibility, so these fixtures record the identity binding, the schema,
//     the plausibility verdict and the evidence digest instead of a VerifiedRun.
// Nothing here reads a real key: the fixture key is a public test value.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import * as liveCourse from '../../../apps/portal/src/chikun-ground-course.mjs';
import { GROUND_PHYSICS } from '../../../apps/portal/src/chikun-ground-runtime.mjs';
import { createChikunRuntime } from '../../../apps/portal/src/chikun-cabinet.mjs';
import { botProfile, createChikunBot } from '../../../scripts/lib/chikun-bots.mjs';
import { createStackedInputRecorder, createStackedRuntime } from '../../../apps/portal/src/stacked-sim.mjs';
import { STACKED_ACTIONS, STACKED_MAX_TICKS } from '../../../apps/portal/src/stacked-contracts.mjs';
import { encodeStackedBase64 } from '../../../apps/portal/src/stacked-evidence-transport.mjs';
import { createStackedSoakPilot } from '../../../apps/stacked/src/dev/soak-pilot.mjs';
import {
  createRunSummaryAccumulator,
  finalizeRunSummary,
  recordRunCollectible,
  recordRunDamage,
  recordRunKill,
  recordRunMilestone,
  recordRunTick,
  recordRunUpgradeOffer,
  recordRunUpgradeSelection,
  recordRunWeaponEvent,
} from '../../../sdk/hmh-run-summary.mjs';
import { HMH_RUN_SUMMARY_CATALOGS_V6, HMH_RUN_SUMMARY_CATALOGS_V7, validateRunSummaryPayload } from '../../../sdk/hmh-run-summary-schema-v7.mjs';
import {
  HMH_V7_BOSSES,
  HMH_V7_EVOLUTIONS,
  HMH_V7_OBJECTIVES,
  HMH_V7_ROLE_THREAT,
  HMH_V7_RUN_RULES,
  HMH_V7_UPGRADES,
  dealHmhPrisoners,
} from '../../../sdk/hmh-run-contract-v7.mjs';
import {
  RUN_UPGRADE_CATALOG,
  comboMilestoneXp,
  createRunProgression,
  getRunProgressionSnapshot,
  grantRunSilver,
  grantRunXp,
  openRunUpgradeOffer,
  recordRunDefeat,
  rerollRunUpgradeSlot,
  runProgressionRow,
  runUpgradeRows,
  selectRunUpgrade,
  unlockRunProgressionWeapon,
} from '../../../apps/hmh-reboot/src/run-progression.mjs';
import { ENEMY_ARCHETYPES } from '../../../apps/hmh-reboot/src/enemy-archetypes.mjs';
import { COLLECTIBLE_EFFECTS } from '../../../apps/hmh-reboot/src/collectible-system.mjs';
import { getEncounterBand } from '../../../apps/hmh-reboot/src/encounter-director.mjs';
import { FIXED_STEP_MS } from '../../../apps/hmh-reboot/src/simulation.mjs';
import { createSessionEvidenceState, finalizeSessionEvidence, recordSessionEvent, recordSessionInput } from '../../../apps/portal/src/session-integrity.mjs';
import { RANKED_GAMES, RANKED_SETTLE_VERSION, rankedSessionKey } from '../../../apps/portal/src/ranked-identity.mjs';
import { issueSeedTicket } from '../../../server/verify/seed-ticket.mjs';
import { bindRankedIdentity, computeEvidenceDigest, verifyRankedRun } from '../../../server/verify/index.mjs';
import {
  HMH_BOSS_START_TICK,
  LIQUIDATOR_THREAT_COST,
  SILVER_PER_BOSS_KILL,
  SILVER_PER_ENEMY_KILL,
  validateRebootRunPlausibility,
} from '../../../server/verify/hmh-plausibility.mjs';

export const FIXTURE_DIR = fileURLToPath(new URL('./', import.meta.url));
export const FIXTURE_UUID = '11111111-1111-4111-8111-111111111111';
// Hardhat's default Account #1.
export const FIXTURE_WALLET = '0x70997970c51812dc3a010c7d01b50e0d17dc79c8';
// §8.1 predicted ScoreSubmissionRegistry (operator nonce 3).
export const FIXTURE_REGISTRY = '0xc5c5949a02fac9a4115df182672c0f8ceb0eaf55';
export const FIXTURE_CHAIN_ID = 4441;
// A public test value standing in for SESSION_SECRET (at least 32 characters).
export const FIXTURE_SEED_SECRET = ['lesters-arcade', 'ranked-fixture', 'session-key', 'public-test-value'].join(':');
export const FIXTURE_ISSUED_AT = 1_790_000_000;
export const FIXTURE_VERIFY_AT_MS = FIXTURE_ISSUED_AT * 1000 + 60_000;
export const FIXTURE_BUILD_HASHES = Object.freeze({
  chikun: 'site-1.7.0:game-1.7.0:cabinet-0.9.0',
  stacked: 'site-1.7.0:game-1.7.0:cabinet-0.2.0',
  'lester-blaster': 'site-1.7.0:game-1.7.0',
});

const TICKS_PER_MINUTE = 3600;
const HARD_DROP = 1 << STACKED_ACTIONS.indexOf('hardDrop');

export function fixtureSalt(label) {
  return createHash('sha256').update(`lesters-arcade ranked fixture ${label}`).digest('hex').slice(0, 32);
}

const plain = (value) => JSON.parse(JSON.stringify(value));
const hexBytes = (hex) => Uint8Array.from(hex.match(/../g), (pair) => parseInt(pair, 16));

// ---------------------------------------------------------------------------
// Chikun: bot play on the live v6 course.

export function buildChikunEvidence({ seed, profile = 'expert', maxMinutes = 2, maxTicks = 216_000 } = {}) {
  const runtime = createChikunRuntime({ seed, maxTicks });
  const bot = createChikunBot({ profile: botProfile(profile), seed, course: liveCourse, physics: GROUND_PHYSICS });
  const stopTick = Math.round(maxMinutes * TICKS_PER_MINUTE);
  while (!runtime.terminal) {
    const snapshot = runtime.snapshot();
    runtime.step({ flap: snapshot.tick < stopTick ? bot.decide(snapshot) : false });
  }
  const result = runtime.result();
  return { flap: plain(result.evidence), score: result.score, survivalTicks: result.survivalTicks };
}

// ---------------------------------------------------------------------------
// STACKED: soak pilot under the Ranked replay config, then a forced top-out.

export function buildStackedEvidence({ seed, buildHash, seasonId, topOutAtTick = 3600 } = {}) {
  const runtime = createStackedRuntime({ seed, maxTicks: STACKED_MAX_TICKS, config: { startLevel: 1, buildHash, seasonId } });
  const pilot = createStackedSoakPilot({ mode: 'free' });
  const recorder = createStackedInputRecorder({ seed });
  while (!runtime.terminal) {
    const state = runtime.snapshot();
    const mask = state.tick < topOutAtTick ? pilot.sample(state) : ((state.prevMask & HARD_DROP) === 0 ? HARD_DROP : 0);
    recorder.sample(recorder.tick + 1, mask);
    runtime.step(recorder.commit());
  }
  const bytes = recorder.encode();
  const tuple = runtime.result();
  return { bytes, sic1: encodeStackedBase64(bytes), score: tuple.score, ticks: tuple.ticks };
}

// ---------------------------------------------------------------------------
// HMH: a run summary v6 driven through the real accumulator and progression.

const THREAT_OF_ROLE = (role) => (role === 'liquidator' ? LIQUIDATOR_THREAT_COST : ENEMY_ARCHETYPES[role].costs.threat);
const DISTRICTS = Object.freeze(['frontier-relay', 'rugpull-ravine', 'liquidity-crossing', 'hashwood', 'mining-camp', 'liquidation-yard']);
const CACHE_WEAPON = Object.freeze(Object.fromEntries(Object.values(COLLECTIBLE_EFFECTS).filter((effect) => effect.weaponId).map((effect) => [effect.effectId, effect])));

export const HMH_PLANS = Object.freeze({
  // About 3 minutes, 36 low-threat kills, a hit every 8 kills.
  valid: Object.freeze({
    heroId: 'lit-commando', firstKillTick: 900, killEvery: () => 270, maxKills: 36, endTick: 10_800,
    roles: ['bagholder-rusher', 'forkrunner'], hitAfterKills: [8], caches: [], upgradeCaps: {},
  }),
  // §5.3 realistic reboot run: 300 kills of threat 4-6, one xpMultiplier rank,
  // a combo reaching 30, 4 weapon caches, about 18 minutes.
  realistic: Object.freeze({
    heroId: 'lit-commando', firstKillTick: 1_200, killEvery: () => 210, maxKills: 300, endTick: 64_800,
    roles: ['liquidator-agent', 'gas-bomber', 'validator-cultist', 'whale-enforcer'],
    hitAfterKills: [12, 18, 34, 9, 15, 22], caches: [
      { tick: 9_000, effectId: 'hash-rail-core' }, { tick: 21_000, effectId: 'lightning-ledger-cache' },
      { tick: 33_000, effectId: 'bear-market-burner-cache' }, { tick: 45_000, effectId: 'forked-standard-cache' },
    ],
    upgradeCaps: { 'validator-training': 1, 'block-reward': 0 },
  }),
  // A long run past level 80 with consistent XP: every multiplier rank taken
  // when offered, kills at about half the director's spawn rate, the boss down
  // in the boss band, then play until level 90.
  'level-90': Object.freeze({
    heroId: 'lit-commando', firstKillTick: 900, killEvery: (tick) => 2 * getEncounterBand(tick).spawnIntervalTicks, untilLevel: 90,
    roles: ['liquidator-agent', 'gas-bomber', 'validator-cultist', 'whale-enforcer', 'forkrunner'],
    hitAfterKills: [30, 24, 30, 16], bossKillTick: HMH_BOSS_START_TICK + 2_400, caches: [
      { tick: 12_000, effectId: 'hash-rail-core' }, { tick: 30_000, effectId: 'lightning-ledger-cache' },
    ],
    upgradeCaps: { 'validator-training': 3, 'block-reward': 3 }, preferMultipliers: true,
  }),
});

// The schema-6 fixtures stand for 1.8.x runs, so they keep the 1.8.1 level-up
// offer, frozen here like the v6 verifier's literals: two cards, the lowest
// FNV hashChoice of `<level>:<pendingLevels>:<selectionSequence>:<id>` over the
// eligible v6 cards, and a pick that only spends the pending level. The child's
// progression release (a new salt, card 2, re-rolls, twelve more cards) is
// schema 7's; buildHmhV7Evidence plays it through the child's own offer API.
function hashChoice181(seed, value) {
  let hash = (seed ^ 0x811c9dc5) >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

function offer181(progression) {
  if (progression.pendingLevels <= 0) return [];
  const salt = `${progression.level}:${progression.pendingLevels}:${progression.selectionSequence}`;
  return HMH_RUN_SUMMARY_CATALOGS_V6.upgrades
    .map((id) => RUN_UPGRADE_CATALOG[id])
    .filter((upgrade) => (progression.ranks[upgrade.id] ?? 0) < upgrade.maxRank
      && (!upgrade.requiresWeaponId || progression.ownedWeaponIds.has(upgrade.requiresWeaponId))
      && Object.entries(upgrade.requiresRanks ?? {}).every(([id, rank]) => (progression.ranks[id] ?? 0) >= rank))
    .map((upgrade) => ({ upgrade, order: hashChoice181(progression.seed, `${salt}:${upgrade.id}`) }))
    .sort((a, b) => a.order - b.order || (a.upgrade.id < b.upgrade.id ? -1 : a.upgrade.id > b.upgrade.id ? 1 : 0))
    .slice(0, 2)
    .map(({ upgrade }) => upgrade);
}

function select181(progression, upgradeId) {
  progression.ranks[upgradeId] += 1;
  progression.pendingLevels -= 1;
  progression.selectionSequence += 1;
}

function chooseUpgrade(choices, ranksTaken, { upgradeCaps = {}, preferMultipliers = false }) {
  const allowed = choices.filter((choice) => !(choice.id in upgradeCaps) || (ranksTaken[choice.id] ?? 0) < upgradeCaps[choice.id]);
  const multiplier = allowed.find((choice) => choice.id === 'validator-training' || choice.id === 'block-reward');
  if (preferMultipliers && multiplier) return multiplier.id;
  const xp = allowed.find((choice) => choice.id === 'validator-training');
  if (xp) return xp.id;
  const other = allowed.find((choice) => !(choice.id in upgradeCaps));
  return (other ?? allowed[0] ?? choices[0]).id;
}

export async function buildHmhEvidence({ seed, buildHash, identity, plan = 'valid' } = {}) {
  const spec = typeof plan === 'string' ? HMH_PLANS[plan] : plan;
  if (!spec) throw new Error(`unknown HMH fixture plan ${String(plan)}`);
  if (seed !== identity.seed || buildHash !== identity.buildHash) throw new Error('HMH evidence must be built at the identity seed and build');
  const accumulator = createRunSummaryAccumulator({ seed, buildHash, mode: 'ranked', heroId: spec.heroId, startTick: 0, startPosition: { x: 1200, y: 2400 } });
  const progression = createRunProgression({ seed });
  const sessionEvidence = createSessionEvidenceState({ sessionId: identity.sessionId });
  const ranksTaken = {};
  let activeWeaponId = 'coin-blaster';
  let combo = 0;
  let maxCombo = 0;
  let kills = 0;
  let killsSinceHit = 0;
  let hitIndex = 0;
  let nextKillTick = spec.firstKillTick;
  let bossDown = false;
  let enemySequence = 0;
  let endTick = spec.endTick ?? null;
  let position = { x: 1200, y: 2400 };

  const settleLevels = (tick) => {
    for (let guard = 0; guard < 1000; guard += 1) {
      const choices = offer181(progression);
      if (choices.length === 0) return;
      recordRunUpgradeOffer(accumulator, choices.map((choice) => choice.id));
      const pick = chooseUpgrade(choices, ranksTaken, spec);
      select181(progression, pick);
      recordRunUpgradeSelection(accumulator, pick);
      ranksTaken[pick] = (ranksTaken[pick] ?? 0) + 1;
      recordSessionEvent(sessionEvidence, { step: tick, type: 'upgrade-selected', payload: { upgradeId: pick } });
    }
  };
  const defeat = (tick, role, { boss = false } = {}) => {
    enemySequence += 1;
    recordRunDamage(accumulator, { targetId: boss ? 'boss-liquidator' : `enemy-${enemySequence}`, sourceId: 'player', weaponId: activeWeaponId, damageApplied: 40, healthBefore: 40, critical: enemySequence % 7 === 0, tick });
    recordRunKill(accumulator, { enemyRoleId: role, weaponId: activeWeaponId, elite: !boss && enemySequence % 25 === 0, boss });
    recordRunDefeat(progression, { enemyId: boss ? 'boss-liquidator' : `encounter-${String(enemySequence).padStart(6, '0')}`, threatCost: THREAT_OF_ROLE(role), tick });
    combo += 1;
    maxCombo = Math.max(maxCombo, combo);
    const milestone = comboMilestoneXp(combo);
    if (milestone) grantRunXp(progression, milestone, tick);
    grantRunSilver(progression, boss ? SILVER_PER_BOSS_KILL : SILVER_PER_ENEMY_KILL, tick);
    kills += 1;
    killsSinceHit += 1;
    if (enemySequence <= 200) recordSessionEvent(sessionEvidence, { step: tick, type: 'enemy-defeated', payload: { role } });
    settleLevels(tick);
  };

  const cacheQueue = [...spec.caches];
  for (let tick = 60; ; tick += 60) {
    const level = getRunProgressionSnapshot(progression).level;
    const districtId = DISTRICTS[Math.floor(tick / 7_200) % DISTRICTS.length];
    position = { x: position.x + 3, y: position.y + (tick % 120 === 0 ? 2 : -1) };
    const bossEngaged = !bossDown && spec.bossKillTick !== undefined && tick >= HMH_BOSS_START_TICK;
    recordRunTick(accumulator, { tick, position, activeWeaponId, districtId, level, bossEngaged, discoveredPoiIds: tick === 3_600 ? ['relay-cache'] : [] });
    if (tick % 600 === 0) recordSessionInput(sessionEvidence, { step: tick, moveX: tick % 1200 === 0 ? 1 : -1, aimX: 1, shoot: true });

    while (cacheQueue.length && cacheQueue[0].tick <= tick) {
      const { effectId } = cacheQueue.shift();
      const effect = CACHE_WEAPON[effectId];
      recordRunCollectible(accumulator, { effectId });
      recordRunWeaponEvent(accumulator, { type: 'pickup', weaponId: effect.weaponId });
      recordRunWeaponEvent(accumulator, { type: 'swap', weaponId: effect.weaponId });
      unlockRunProgressionWeapon(progression, effect.weaponId);
      activeWeaponId = effect.weaponId;
      if (effect.xpGain) grantRunXp(progression, effect.xpGain, tick);
      settleLevels(tick);
    }
    if (spec.bossKillTick !== undefined && !bossDown && tick >= spec.bossKillTick) {
      defeat(tick, 'liquidator', { boss: true });
      bossDown = true;
    }
    while (nextKillTick <= tick && (spec.maxKills === undefined || kills < spec.maxKills) && (endTick === null || tick < endTick)) {
      defeat(tick, spec.roles[kills % spec.roles.length]);
      nextKillTick += spec.killEvery(nextKillTick);
      if (killsSinceHit >= spec.hitAfterKills[hitIndex % spec.hitAfterKills.length]) {
        recordRunDamage(accumulator, { targetId: 'player', sourceId: `enemy-${enemySequence}`, weaponId: `enemy-${spec.roles[0]}`, damageApplied: 6, killed: false, equippedWeaponId: activeWeaponId, tick });
        combo = 0;
        killsSinceHit = 0;
        hitIndex += 1;
      }
    }
    if (endTick === null && spec.untilLevel !== undefined && getRunProgressionSnapshot(progression).level >= spec.untilLevel) endTick = tick + 600;
    if (endTick !== null && tick >= endTick) {
      endTick = tick;
      break;
    }
  }
  recordRunDamage(accumulator, { targetId: 'player', sourceId: 'enemy-final', weaponId: `enemy-${spec.roles[0]}`, damageApplied: 25, killed: true, equippedWeaponId: activeWeaponId, tick: endTick });
  const snapshot = getRunProgressionSnapshot(progression);
  const runSummary = plain(finalizeRunSummary(accumulator, {
    endTick,
    elapsedMs: endTick * FIXED_STEP_MS,
    terminalReason: 'defeated',
    score: snapshot.score,
    level: snapshot.level,
    xp: snapshot.xp,
    currentCombo: combo,
    maxCombo,
    revealedCells: Math.min(4096, Math.floor(endTick / 40)),
    totalCells: 4096,
  }));
  const schemaError = validateRunSummaryPayload(runSummary);
  if (schemaError) throw new Error(`fixture run summary is invalid: ${schemaError}`);
  const sessionEnvelope = plain(await finalizeSessionEvidence({
    identity,
    evidence: sessionEvidence,
    finalState: { score: snapshot.score, kills, level: snapshot.level, elapsedMs: runSummary.totals.elapsedMs },
  }));
  return { runSummary, sessionEnvelope, score: snapshot.score };
}

// ---------------------------------------------------------------------------
// HMH: a run summary v7 (docs/hmh-reboot/design/HMH-RUN-SUMMARY-V7-CONTRACT.md
// §4, §11 and §13). sdk/hmh-run-summary.mjs stays schema 6 in this branch (the
// child branch versions it), so the real 1.8.1 accumulator records the run
// wherever its catalogues reach, and extendRunSummaryToV7 adds what they cannot
// hold: kills of the nine v7 roles, the appended catalogue rows, and the
// objectives, prisoners, bosses, evolutions and progression rows. XP, level and
// score come from the real run-progression functions, granted as the child
// obligations say: node XP through grantRunXp at the level before the grant,
// OG Miner spans of 300 x level while validator-training is rank 0 (so they are
// unmultiplied), each boss's silver burst in place of the 10-coin drop, 20
// coins per secret, and no coin from a HODL Revenant.

const C6 = HMH_RUN_SUMMARY_CATALOGS_V6;
const C7 = HMH_RUN_SUMMARY_CATALOGS_V7;
const PISTOL_MASTERY = HMH_V7_EVOLUTIONS['settler-rail'].mastery;
const NO_SILVER_ROLES = Object.freeze(['hodl-revenant']);
const legs = (...entries) => Object.freeze(entries.map(([fromTick, districtId]) => Object.freeze({ fromTick, districtId })));
const nodes = (...entries) => Object.freeze(entries.map(([tick, kind, id]) => Object.freeze({ tick, kind, id })));

export const HMH_V7_PLANS = Object.freeze({
  // 15 minutes west to east through all six districts: 24 of the 25
  // objectives (no Dark Pool), 7 prisoners (the Foreman's cage stays shut), the
  // Baron and the Lockkeeper (after one retreat) defeated, their two Seals
  // banked, and no Liquidator.
  districts: Object.freeze({
    heroId: 'lit-valkyrie', endTick: 54_000, firstKillTick: 900, killEvery: (tick) => 3 * getEncounterBand(tick).spawnIntervalTicks,
    roles: ['bagholder-rusher', 'rug-puller', 'forkrunner', 'tollkeeper', 'liquidator-agent', 'pump-and-dump-bloater', 'gas-bomber', 'hodl-revenant', 'validator-cultist', 'money-printer', 'whale-enforcer', 'oracle-marksman'],
    hitAfterKills: [14, 22, 31, 9, 17],
    caches: [{ tick: 12_000, effectId: 'hash-rail-core' }, { tick: 30_000, effectId: 'lightning-ledger-cache' }],
    upgradeCaps: () => ({ 'validator-training': 0, 'block-reward': 1 }), prefer: () => [], rerollEvery: 3,
    route: legs([0, 'frontier-relay'], [6_000, 'rugpull-ravine'], [13_200, 'liquidity-crossing'], [24_000, 'hashwood'], [34_800, 'mining-camp'], [45_600, 'liquidation-yard']),
    nodes: nodes(
      [1_800, 'objective', 'relay-power'], [2_400, 'objective', 'relay-barn-doors'], [3_000, 'objective', 'farmstead-hidden-supplies'], [3_600, 'objective', 'relay-uplink'], [4_200, 'prisoner', 'p1-relay-barn-yard'],
      [6_600, 'objective', 'ravine-winch-handle'], [7_080, 'objective', 'ravine-winch'], [9_600, 'prisoner', 'h1-baron-diggings'], [10_200, 'objective', 'ravine-rope-bridge'], [10_800, 'objective', 'ravine-surveyor-cache'], [11_400, 'prisoner', 'p2-ravine-surveyor-camp'],
      [13_800, 'objective', 'crossing-pump'], [14_400, 'objective', 'crossing-mill-storeroom'], [15_000, 'objective', 'crossing-behind-the-falls'], [15_600, 'prisoner', 'p3-crossing-boathouse'],
      [24_600, 'objective', 'hashwood-lamp-oil'], [25_200, 'objective', 'hashwood-beacon'], [25_800, 'objective', 'hashwood-log-pile'], [26_400, 'objective', 'hashwood-log-chute'], [27_000, 'objective', 'hashwood-lookout'], [27_600, 'objective', 'hashwood-shrine'], [28_200, 'objective', 'hashwood-hollow-grove'], [28_800, 'prisoner', 'p4-hashwood-logging-camp'],
      [35_400, 'objective', 'mining-valve'], [36_000, 'objective', 'mining-collapsed-adit'], [36_600, 'prisoner', 'p5-mining-bench'],
      [46_200, 'objective', 'yard-warehouse'], [46_800, 'objective', 'yard-warehouse-gate'], [47_400, 'objective', 'yard-bascule-lever'], [48_000, 'objective', 'yard-port-bascule'], [48_600, 'prisoner', 'p6-yard-warehouse-compound'],
    ),
    // The Lockkeeper retreats: ring after 600 engaged ticks (19,200), a 120-tick
    // channel, ready again 1,800 later; it is re-initiated at 21,600.
    bosses: [
      { bossId: 'rug-pull-baron', initiations: [7_800], defeatedTick: 9_000, adds: ['bagholder-rusher', 'bagholder-rusher', 'bagholder-rusher', 'bagholder-rusher'] },
      { bossId: 'lockkeeper', initiations: [18_600, 21_600], defeatedTick: 22_800, adds: ['forkrunner', 'forkrunner', 'forkrunner', 'forkrunner'] },
    ],
    reviveTick: null,
  }),
  // 18 minutes: every objective, all eight prisoners, all four bosses defeated
  // (the Baron initiated at exactly its ready tick, the Liquidator through the
  // Dark Pool), the Pistol mastered (Damage, Movement Speed and Score at rank
  // 3) and evolved with the first Seal found after that (the Foreman's, since
  // the progression release's re-rolls reach mastery early), three Seals
  // banked, and the Golden Parachute used once before the final defeat.
  // Mastery takes Block Reward early: with the score multiplier at 1.75 for
  // most of the run the score sits near its ceiling, which flags (never
  // rejects), as in hmh-level-90.
  'four-bosses': Object.freeze({
    heroId: 'lit-commando', endTick: 64_800, firstKillTick: 900, killEvery: (tick) => 2 * getEncounterBand(tick).spawnIntervalTicks,
    roles: ['forkrunner', 'rug-puller', 'liquidator-agent', 'tollkeeper', 'gas-bomber', 'pump-and-dump-bloater', 'validator-cultist', 'money-printer', 'whale-enforcer', 'hodl-revenant', 'bagholder-rusher', 'oracle-marksman'],
    hitAfterKills: [18, 11, 26, 33, 15],
    caches: [{ tick: 10_200, effectId: 'hash-rail-core' }, { tick: 25_200, effectId: 'bear-market-burner-cache' }, { tick: 40_200, effectId: 'forked-standard-cache' }],
    upgradeCaps: () => ({ 'validator-training': 0 }),
    prefer: () => ['block-reward', 'proof-of-work', 'hot-wallet'],
    // The player keeps the guns dry, so card 2 is a second general draw and
    // both re-rolls can find the Pistol's cards.
    armed: () => [],
    rerollEvery: 4,
    route: legs([0, 'frontier-relay'], [5_400, 'rugpull-ravine'], [10_800, 'liquidity-crossing'], [19_800, 'hashwood'], [26_400, 'mining-camp'], [33_000, 'liquidation-yard']),
    nodes: nodes(
      [1_500, 'objective', 'relay-power'], [2_100, 'objective', 'relay-barn-doors'], [2_700, 'prisoner', 'p1-relay-barn-yard'], [3_300, 'objective', 'farmstead-hidden-supplies'], [3_900, 'objective', 'relay-uplink'],
      [6_000, 'objective', 'ravine-winch-handle'], [6_600, 'objective', 'ravine-winch'], [8_100, 'prisoner', 'h1-baron-diggings'], [8_700, 'objective', 'ravine-rope-bridge'], [9_300, 'objective', 'ravine-surveyor-cache'], [9_900, 'prisoner', 'p2-ravine-surveyor-camp'],
      [11_400, 'objective', 'crossing-pump'], [12_000, 'objective', 'crossing-mill-storeroom'], [12_600, 'objective', 'crossing-behind-the-falls'], [13_200, 'prisoner', 'p3-crossing-boathouse'],
      [20_400, 'objective', 'hashwood-lamp-oil'], [21_000, 'objective', 'hashwood-beacon'], [21_600, 'objective', 'hashwood-log-pile'], [22_200, 'objective', 'hashwood-log-chute'], [22_800, 'objective', 'hashwood-lookout'], [23_400, 'objective', 'hashwood-shrine'], [24_000, 'objective', 'hashwood-hollow-grove'], [24_600, 'prisoner', 'p4-hashwood-logging-camp'],
      [27_000, 'objective', 'mining-valve'], [29_400, 'prisoner', 'h2-foreman-hoist-vault'], [30_000, 'objective', 'mining-collapsed-adit'], [30_600, 'prisoner', 'p5-mining-bench'],
      [33_600, 'objective', 'yard-warehouse'], [34_200, 'objective', 'yard-warehouse-gate'], [34_800, 'objective', 'yard-bascule-lever'], [35_400, 'objective', 'yard-port-bascule'], [36_000, 'prisoner', 'p6-yard-warehouse-compound'],
      // Entering the Dark Pool finds the logbook and initiates the Liquidator.
      [55_200, 'objective', 'warehouse-logbook'],
    ),
    bosses: [
      { bossId: 'rug-pull-baron', initiations: [7_200], defeatedTick: 7_560, adds: ['bagholder-rusher', 'bagholder-rusher', 'bagholder-rusher', 'bagholder-rusher'] },
      { bossId: 'lockkeeper', initiations: [18_000], defeatedTick: 19_200, adds: ['forkrunner', 'forkrunner', 'forkrunner', 'forkrunner'] },
      { bossId: 'fifty-one-percent-foreman', initiations: [27_600], defeatedTick: 28_800, adds: ['validator-cultist', 'validator-cultist', 'validator-cultist', 'validator-cultist', 'validator-cultist', 'validator-cultist'] },
      { bossId: 'liquidator', initiations: [55_200], defeatedTick: 56_400, adds: ['liquidator-agent', 'liquidator-agent', 'liquidator-agent', 'liquidator-agent', 'gas-bomber'] },
    ],
    reviveTick: 60_000,
  }),
});

function chooseV7Upgrade(choices, ranksTaken, spec, tick) {
  const caps = spec.upgradeCaps(tick);
  const allowed = choices.filter((choice) => !(choice.id in caps) || (ranksTaken[choice.id] ?? 0) < caps[choice.id]);
  const preferred = spec.prefer(tick).map((id) => allowed.find((choice) => choice.id === id)).find(Boolean);
  if (preferred) return preferred.id;
  const free = allowed.find((choice) => !(choice.id in caps));
  if (free) return free.id;
  if (allowed.length) return allowed[0].id;
  // Both cards are capped: never the XP multiplier, so OG Miner spans stay unmultiplied.
  return (choices.find((choice) => choice.id !== 'validator-training') ?? choices[0]).id;
}

// The schema-6 summary of the 1.8.1 accumulator plus the v7-only record → schema 7.
function extendRunSummaryToV7(summary6, v7) {
  const summary = structuredClone(summary6);
  const byId = (rows, key) => Object.fromEntries(rows.map((row) => [row[key], row]));
  summary.schemaVersion = 7;
  const v6Kills = byId(summary.kills.byEnemyRole, 'enemyRoleId');
  summary.kills.byEnemyRole = C7.enemyRoles.map((enemyRoleId) => ({ enemyRoleId, count: (v6Kills[enemyRoleId]?.count ?? 0) + (v7.roleKills[enemyRoleId] ?? 0) }));
  for (const [weaponId, count] of Object.entries(v7.weaponKills)) {
    summary.kills.total += count;
    byId(summary.kills.byWeapon, 'weaponId')[weaponId].count += count;
    byId(summary.weapons, 'weaponId')[weaponId].kills += count;
    if (weaponId === 'satoshi-frag' || weaponId === 'launcher-rig') summary.grenades.kills += count;
  }
  summary.collectibles.push({ effectId: 'genesis-seal', collected: v7.progression.sealsFound, activeTicks: 0 });
  // Run progression counts every card shown (re-rolls included) and picked.
  summary.upgrades = v7.upgrades.map((row) => ({ ...row }));
  for (const [rows, ids, idKey, flag] of [[summary.milestones.sites, C7.worldSites, 'siteId', 'operated'], [summary.milestones.secrets, C7.secrets, 'secretId', 'found']]) {
    for (const row of rows) {
      const objective = v7.objectives[row[idKey]];
      if (row[flag] !== objective.completed || row.tick !== objective.tick) throw new Error(`${row[idKey]}: the accumulator milestone and the objective disagree`);
    }
    for (const id of ids.slice(rows.length)) rows.push({ [idKey]: id, [flag]: v7.objectives[id].completed, tick: v7.objectives[id].tick });
  }
  if (summary.milestones.bossEngagedTick !== v7.bosses.liquidator.firstInitiatedTick) throw new Error('bossEngagedTick must be the Liquidator initiation');
  if (summary.kills.boss !== byId(summary.kills.byEnemyRole, 'enemyRoleId').liquidator.count) throw new Error('kills.boss must count the Liquidator only');
  summary.objectives = C7.objectives.map((objectiveId) => ({ objectiveId, ...v7.objectives[objectiveId] }));
  summary.prisoners = C7.prisonerSlots.map((slotId) => ({ slotId, ...v7.prisoners[slotId] }));
  summary.bosses = C7.bosses.map((bossId) => ({ bossId, ...v7.bosses[bossId] }));
  summary.evolutions = C7.evolutions.map((evolutionId) => ({ evolutionId, ...v7.evolutions[evolutionId] }));
  summary.progression = { ...v7.progression, sealsBanked: v7.progression.sealsFound - v7.progression.evolutionsApplied };
  return summary;
}

export async function buildHmhV7Evidence({ seed, buildHash, identity, plan } = {}) {
  const spec = typeof plan === 'string' ? HMH_V7_PLANS[plan] : plan;
  if (!spec) throw new Error(`unknown HMH v7 fixture plan ${String(plan)}`);
  if (seed !== identity.seed || buildHash !== identity.buildHash) throw new Error('HMH evidence must be built at the identity seed and build');
  const accumulator = createRunSummaryAccumulator({ seed, buildHash, mode: 'ranked', heroId: spec.heroId, startTick: 0, startPosition: { x: 1200, y: 2400 } });
  const progression = createRunProgression({ seed });
  const sessionEvidence = createSessionEvidenceState({ sessionId: identity.sessionId });
  const deal = dealHmhPrisoners(seed);
  const zeroRows = (ids, fields) => Object.fromEntries(ids.map((id) => [id, Object.fromEntries(fields.map((field) => [field, 0]))]));
  const v7 = {
    roleKills: {},
    weaponKills: {},
    objectives: zeroRows(C7.objectives, ['completed', 'tick', 'levelAtCompletion']),
    prisoners: zeroRows(C7.prisonerSlots, ['rescued', 'tick', 'levelAtRescue']),
    bosses: zeroRows(C7.bosses, ['initiations', 'firstInitiatedTick', 'lastInitiatedTick', 'defeatedTick']),
    evolutions: zeroRows(C7.evolutions, ['offered', 'applied']),
    progression: { offersOpened: 0, evolutionOffersOpened: 0, rerolls: 0, sealsFound: 0, sealsBanked: 0, evolutionsApplied: 0, revivesUsed: 0 },
  };
  const ranksTaken = {};
  const liquidatorInit = spec.bosses.find((entry) => entry.bossId === 'liquidator')?.initiations[0];
  let activeWeaponId = 'coin-blaster';
  let combo = 0;
  let maxCombo = 0;
  let kills = 0;
  let killsSinceHit = 0;
  let hitIndex = 0;
  let nextKillTick = spec.firstKillTick;
  let enemySequence = 0;
  let position = { x: 1200, y: 2400 };
  const endTick = spec.endTick;

  // The child's offer (package 8.3): card 2 from the owned guns (every gun is
  // armed in the plan), one re-roll per card. A plan that prefers cards
  // re-rolls a card it would not take while nothing it prefers is shown, and
  // every rerollEvery-th offer re-rolls the card not taken.
  const settleLevels = (tick) => {
    for (let guard = 0; guard < 1000; guard += 1) {
      if (!openRunUpgradeOffer(progression, { armedWeaponIds: spec.armed?.(tick) ?? [...progression.ownedWeaponIds] })) return;
      const shown = () => getRunProgressionSnapshot(progression).pendingChoices;
      const wanting = spec.prefer(tick).filter((id) => (progression.ranks[id] ?? 0) < HMH_V7_UPGRADES[id].maxRank);
      for (const slot of wanting.length ? [1, 0] : []) {
        if (shown().some((choice) => wanting.includes(choice.id))) break;
        if (shown().some((choice) => choice.slot === slot)) rerollRunUpgradeSlot(progression, slot);
      }
      const pick = chooseV7Upgrade(shown(), ranksTaken, spec, tick);
      if (spec.rerollEvery && progression.offersOpened % spec.rerollEvery === 0) {
        const other = shown().find((choice) => choice.id !== pick);
        if (other) rerollRunUpgradeSlot(progression, other.slot);
      }
      selectRunUpgrade(progression, pick);
      ranksTaken[pick] = (ranksTaken[pick] ?? 0) + 1;
      recordSessionEvent(sessionEvidence, { step: tick, type: 'upgrade-selected', payload: { upgradeId: pick } });
    }
  };
  const defeat = (tick, role, bossId = null) => {
    enemySequence += 1;
    recordRunDamage(accumulator, { targetId: bossId ? `boss-${bossId}` : `enemy-${enemySequence}`, sourceId: 'player', weaponId: activeWeaponId, damageApplied: 40, healthBefore: 40, critical: enemySequence % 7 === 0, tick });
    if (C6.enemyRoles.includes(role)) {
      recordRunKill(accumulator, { enemyRoleId: role, weaponId: activeWeaponId, elite: !bossId && enemySequence % 25 === 0, boss: role === 'liquidator' });
    } else {
      v7.roleKills[role] = (v7.roleKills[role] ?? 0) + 1;
      v7.weaponKills[activeWeaponId] = (v7.weaponKills[activeWeaponId] ?? 0) + 1;
    }
    recordRunDefeat(progression, { enemyId: bossId ? `boss-${bossId}` : `encounter-${String(enemySequence).padStart(6, '0')}`, threatCost: HMH_V7_ROLE_THREAT[role], tick });
    combo += 1;
    maxCombo = Math.max(maxCombo, combo);
    const milestone = comboMilestoneXp(combo);
    if (milestone) grantRunXp(progression, milestone, tick);
    const coins = bossId ? HMH_V7_BOSSES[bossId].silverBurst : NO_SILVER_ROLES.includes(role) ? 0 : HMH_V7_RUN_RULES.SILVER_PER_ENEMY_KILL_MAX;
    if (coins) grantRunSilver(progression, coins, tick);
    kills += 1;
    killsSinceHit += 1;
    if (enemySequence <= 200) recordSessionEvent(sessionEvidence, { step: tick, type: 'enemy-defeated', payload: { role } });
    settleLevels(tick);
  };
  const completeNode = (tick, { kind, id }) => {
    const level = getRunProgressionSnapshot(progression).level;
    if (kind === 'objective') {
      const node = HMH_V7_OBJECTIVES[id];
      Object.assign(v7.objectives[id], { completed: 1, tick, levelAtCompletion: level });
      if (C6.worldSites.includes(id)) recordRunMilestone(accumulator, { type: 'site-operated', id, tick });
      if (C6.secrets.includes(id)) recordRunMilestone(accumulator, { type: 'secret-found', id, tick });
      grantRunXp(progression, HMH_V7_RUN_RULES.OBJECTIVE_XP_PER_LEVEL[node.class] * level, tick);
      if (node.class === 'secret') grantRunSilver(progression, HMH_V7_RUN_RULES.SILVER_PER_SECRET, tick);
    } else {
      Object.assign(v7.prisoners[id], { rescued: 1, tick, levelAtRescue: level });
      if (deal[C7.prisonerSlots.indexOf(id)] === 'og-miner') {
        if (getRunProgressionSnapshot(progression).effects.xpMultiplier !== 1) throw new Error('an OG Miner span must be granted unmultiplied');
        grantRunXp(progression, HMH_V7_RUN_RULES.OG_MINER_XP_PER_LEVEL * level, tick);
      }
    }
    recordSessionEvent(sessionEvidence, { step: tick, type: kind === 'objective' ? 'objective-completed' : 'prisoner-rescued', payload: { id } });
    settleLevels(tick);
  };
  const bossEvents = (tick) => {
    for (const plan of spec.bosses) {
      const row = v7.bosses[plan.bossId];
      if (plan.initiations.includes(tick)) {
        row.initiations += 1;
        row.firstInitiatedTick ||= tick;
        row.lastInitiatedTick = tick;
      }
      if (plan.defeatedTick !== tick) continue;
      for (const role of plan.adds) defeat(tick, role);
      defeat(tick, plan.bossId, plan.bossId);
      row.defeatedTick = tick;
      // The Genesis Seal. The Pistol never evolves on its own: with the Pistol
      // the only candidate, the evolution panel opens and the player takes it.
      v7.progression.sealsFound += 1;
      const mastered = Object.entries(PISTOL_MASTERY).every(([upgradeId, rank]) => (ranksTaken[upgradeId] ?? 0) >= rank);
      if (mastered && !v7.evolutions['settler-rail'].applied) {
        v7.progression.evolutionOffersOpened += 1;
        v7.evolutions['settler-rail'].offered += 1;
        v7.evolutions['settler-rail'].applied = 1;
        v7.progression.evolutionsApplied += 1;
        recordSessionEvent(sessionEvidence, { step: tick, type: 'evolution-applied', payload: { evolutionId: 'settler-rail' } });
      }
    }
  };

  const cacheQueue = [...spec.caches];
  const nodeQueue = [...spec.nodes];
  for (let tick = 60; ; tick += 60) {
    const level = getRunProgressionSnapshot(progression).level;
    const districtId = spec.route.findLast((leg) => tick >= leg.fromTick).districtId;
    position = { x: position.x + 3, y: position.y + (tick % 120 === 0 ? 2 : -1) };
    recordRunTick(accumulator, { tick, position, activeWeaponId, districtId, level, bossEngaged: liquidatorInit !== undefined && tick >= liquidatorInit, discoveredPoiIds: tick === 3_600 ? ['relay-cache'] : [] });
    if (tick % 600 === 0) recordSessionInput(sessionEvidence, { step: tick, moveX: tick % 1200 === 0 ? 1 : -1, aimX: 1, shoot: true });

    while (cacheQueue.length && cacheQueue[0].tick <= tick) {
      const { effectId } = cacheQueue.shift();
      const effect = CACHE_WEAPON[effectId];
      recordRunCollectible(accumulator, { effectId });
      recordRunWeaponEvent(accumulator, { type: 'pickup', weaponId: effect.weaponId });
      recordRunWeaponEvent(accumulator, { type: 'swap', weaponId: effect.weaponId });
      unlockRunProgressionWeapon(progression, effect.weaponId);
      activeWeaponId = effect.weaponId;
      if (effect.xpGain) grantRunXp(progression, effect.xpGain, tick);
      settleLevels(tick);
    }
    while (nodeQueue.length && nodeQueue[0].tick <= tick) completeNode(tick, nodeQueue.shift());
    bossEvents(tick);
    if (spec.reviveTick === tick) {
      // The Golden Parachute: the lethal hit is survived, so it is not the defeat.
      recordRunDamage(accumulator, { targetId: 'player', sourceId: `enemy-${enemySequence}`, weaponId: `enemy-${spec.roles[0]}`, damageApplied: 30, killed: false, equippedWeaponId: activeWeaponId, tick });
      v7.progression.revivesUsed += 1;
      combo = 0;
      killsSinceHit = 0;
    }
    while (nextKillTick <= tick && tick < endTick) {
      defeat(tick, spec.roles[kills % spec.roles.length]);
      nextKillTick += spec.killEvery(nextKillTick);
      if (killsSinceHit >= spec.hitAfterKills[hitIndex % spec.hitAfterKills.length]) {
        recordRunDamage(accumulator, { targetId: 'player', sourceId: `enemy-${enemySequence}`, weaponId: `enemy-${spec.roles[0]}`, damageApplied: 6, killed: false, equippedWeaponId: activeWeaponId, tick });
        combo = 0;
        killsSinceHit = 0;
        hitIndex += 1;
      }
    }
    if (tick >= endTick) break;
  }
  if (nodeQueue.length || cacheQueue.length) throw new Error('every planned node and cache must land inside the run');
  recordRunDamage(accumulator, { targetId: 'player', sourceId: 'enemy-final', weaponId: `enemy-${spec.roles[0]}`, damageApplied: 25, killed: true, equippedWeaponId: activeWeaponId, tick: endTick });
  const snapshot = getRunProgressionSnapshot(progression);
  v7.upgrades = runUpgradeRows(progression);
  Object.assign(v7.progression, { offersOpened: runProgressionRow(progression).offersOpened, rerolls: runProgressionRow(progression).rerolls });
  const summary6 = plain(finalizeRunSummary(accumulator, {
    endTick,
    elapsedMs: endTick * FIXED_STEP_MS,
    terminalReason: 'defeated',
    score: snapshot.score,
    level: snapshot.level,
    xp: snapshot.xp,
    currentCombo: combo,
    maxCombo,
    revealedCells: Math.min(4096, Math.floor(endTick / 40)),
    totalCells: 4096,
  }));
  const runSummary = extendRunSummaryToV7(summary6, v7);
  const schemaError = validateRunSummaryPayload(runSummary);
  if (schemaError) throw new Error(`fixture run summary v7 is invalid: ${schemaError}`);
  const sessionEnvelope = plain(await finalizeSessionEvidence({
    identity,
    evidence: sessionEvidence,
    finalState: { score: snapshot.score, kills: runSummary.kills.total, level: snapshot.level, elapsedMs: runSummary.totals.elapsedMs },
  }));
  return { runSummary, sessionEnvelope, score: snapshot.score };
}

// ---------------------------------------------------------------------------
// §5.1 bodies.

// → { body, seed, identity, sessionId32 }
export async function buildFixtureBody({
  gameId,
  wallet = FIXTURE_WALLET,
  registry = FIXTURE_REGISTRY,
  secret = FIXTURE_SEED_SECRET,
  salt,
  issuedAt = FIXTURE_ISSUED_AT,
  uuid = FIXTURE_UUID,
  chainId = FIXTURE_CHAIN_ID,
  buildHash = FIXTURE_BUILD_HASHES[gameId],
  evidence: evidenceOptions = {},
  entryTxHash = null,
} = {}) {
  const game = RANKED_GAMES[gameId];
  if (!game) throw new Error(`unknown ranked gameId ${String(gameId)}`);
  if (!/^[0-9a-f]{32}$/.test(salt ?? '')) throw new Error('salt must be 32 lowercase hex characters');
  const sessionId = `game-session-${uuid}`;
  const player = wallet.toLowerCase();
  const { seedTicket, seed } = await issueSeedTicket({
    secret, nowMs: issuedAt * 1000, randomBytes: () => hexBytes(salt),
    sessionId, wallet: player, gameId, seasonId: game.seasonId, buildHash,
  });
  const identity = { sessionId, chainId, scoreRegistryAddress: registry.toLowerCase(), wallet: player, gameId, seasonId: game.seasonId, buildHash, seed, nonce: uuid };
  const sessionId32 = await rankedSessionKey(identity);
  let evidence;
  let claimScore;
  if (gameId === 'chikun') {
    const built = buildChikunEvidence({ seed, ...evidenceOptions });
    evidence = { encoding: game.evidenceEncoding, flap: built.flap };
    claimScore = built.score;
  } else if (gameId === 'stacked') {
    const built = buildStackedEvidence({ seed, buildHash, seasonId: game.seasonId, ...evidenceOptions });
    evidence = { encoding: game.evidenceEncoding, sic1: built.sic1, startLevel: 1 };
    claimScore = built.score;
  } else {
    const built = evidenceOptions.v7Plan
      ? await buildHmhV7Evidence({ seed, buildHash, identity, plan: evidenceOptions.v7Plan })
      : await buildHmhEvidence({ seed, buildHash, identity, ...evidenceOptions });
    evidence = { encoding: game.evidenceEncoding, runSummary: built.runSummary, sessionEnvelope: built.sessionEnvelope };
    claimScore = built.score;
  }
  const body = {
    v: RANKED_SETTLE_VERSION,
    gameId,
    sessionId32,
    identity,
    seedTicket: plain(seedTicket),
    entryTxHash,
    evidence,
    claim: { score: claimScore },
  };
  return { body, seed, identity, sessionId32 };
}

// ---------------------------------------------------------------------------
// The committed fixtures.

export const FIXTURE_SPECS = Object.freeze({
  'chikun-valid': Object.freeze({ gameId: 'chikun', note: 'About 2 minutes of expert bot play on the v6 course, then no presses until the run ends.', evidence: { profile: 'expert', maxMinutes: 2 } }),
  'chikun-10min': Object.freeze({ gameId: 'chikun', note: '10 minutes of exceptional bot play (timing fixture; replayed, never rebuilt, by the tests).', evidence: { profile: 'exceptional', maxMinutes: 10 } }),
  'stacked-valid': Object.freeze({ gameId: 'stacked', note: 'Soak pilot to tick 3,600, then hard drops to a block-out under the Ranked replay config.', evidence: { topOutAtTick: 3_600 } }),
  'stacked-15min': Object.freeze({ gameId: 'stacked', note: 'Soak pilot to tick 54,000 (15 minutes), then a forced top-out (timing fixture; replayed, never rebuilt, by the tests).', evidence: { topOutAtTick: 54_000 } }),
  'hmh-valid': Object.freeze({ gameId: 'lester-blaster', note: 'A 3-minute defeated run with 36 low-threat kills.', evidence: { plan: 'valid' } }),
  'hmh-realistic': Object.freeze({ gameId: 'lester-blaster', note: '§5.3 realistic reboot run: 300 kills of threat 4-6, one xpMultiplier rank, a combo reaching 30, 4 weapon caches, 18 minutes.', evidence: { plan: 'realistic' } }),
  'hmh-level-90': Object.freeze({ gameId: 'lester-blaster', note: 'A long run past level 80 (to level 90) with XP, level and score from the reboot progression, including a boss kill in the boss band.', evidence: { plan: 'level-90' } }),
});
export const FIXTURE_NAMES = Object.freeze(Object.keys(FIXTURE_SPECS));

// Run summary schema 7 (HMH v7 contract §13). Kept out of FIXTURE_NAMES: those
// fixtures all verify end to end, while a Ranked schema-7 body is refused by
// server/verify/hmh.mjs until that gate accepts schema 7 (contract §15). A
// schema-7 run comes from a build at or after the first v7 child (1.9.0).
export const HMH_V7_FIXTURE_BUILD_HASH = 'site-1.9.0:game-1.9.0';
export const HMH_V7_FIXTURE_SPECS = Object.freeze({
  'hmh-v7-districts': Object.freeze({ gameId: 'lester-blaster', buildHash: HMH_V7_FIXTURE_BUILD_HASH, note: 'Run summary v7: 15 minutes through all six districts, 24 objectives, 7 prisoners, the Baron and the Lockkeeper (after one retreat) defeated and their Seals banked, no Liquidator.', evidence: { v7Plan: 'districts' } }),
  // Salted for a seed whose offers master the Pistol before the last boss falls.
  'hmh-v7-four-bosses': Object.freeze({ gameId: 'lester-blaster', buildHash: HMH_V7_FIXTURE_BUILD_HASH, salt: fixtureSalt('hmh-v7-four-bosses:1'), note: 'Run summary v7: 18 minutes, every objective and prisoner, all four bosses defeated (the Liquidator through the Dark Pool), the Pistol evolved with a Genesis Seal, three Seals banked and one Golden Parachute revive.', evidence: { v7Plan: 'four-bosses' } }),
});
export const HMH_V7_FIXTURE_NAMES = Object.freeze(Object.keys(HMH_V7_FIXTURE_SPECS));

export function fixturePath(name) {
  return `${FIXTURE_DIR}${name}.json`;
}

export function readFixture(name) {
  return JSON.parse(readFileSync(fixturePath(name), 'utf8'));
}

// The verifyRankedRun / bindRankedIdentity options every committed fixture verifies under.
export function fixtureVerifyOptions(overrides = {}) {
  return {
    chainId: FIXTURE_CHAIN_ID,
    scoreRegistryAddress: FIXTURE_REGISTRY,
    wallet: FIXTURE_WALLET,
    nowMs: FIXTURE_VERIFY_AT_MS,
    seedSecret: FIXTURE_SEED_SECRET,
    ...overrides,
  };
}

// The replay budget tests (brief AC9) time the main thread's CPU, not the wall
// clock, and keep the fastest of up to `attempts` verifications, stopping at the
// first within budget. `npm test` runs every test file at once: a replay that
// waits for a core, or runs on a shared or slower one for a while, is not a
// slower replay. → { fastestMs, results }
export async function fastestVerifyCpuMs(verifyOnce, { budgetMs, attempts = 5 } = {}) {
  const threadClock = typeof process.threadCpuUsage === 'function';
  const cpuUsage = (start) => (threadClock ? process.threadCpuUsage(start) : process.cpuUsage(start));
  let fastestMs = Infinity;
  const results = [];
  for (let attempt = 0; attempt < attempts && !(fastestMs < budgetMs); attempt += 1) {
    const start = cpuUsage();
    results.push(await verifyOnce());
    const used = cpuUsage(start);
    fastestMs = Math.min(fastestMs, (used.user + used.system) / 1000);
  }
  return { fastestMs, results };
}

// A schema-7 fixture: the body binds to its identity and seed ticket, and its
// run summary passes the schema and the v7 plausibility rules. The expected
// block records those, plus the evidence digest, instead of a VerifiedRun.
async function buildHmhV7Fixture(name) {
  const spec = HMH_V7_FIXTURE_SPECS[name];
  const salt = spec.salt ?? fixtureSalt(name);
  const { body, seed } = await buildFixtureBody({ gameId: spec.gameId, salt, buildHash: spec.buildHash, evidence: spec.evidence });
  const bound = await bindRankedIdentity(body, fixtureVerifyOptions());
  if (!bound.ok) throw new Error(`fixture ${name} does not bind: ${JSON.stringify(bound)}`);
  const { runSummary } = body.evidence;
  const schemaError = validateRunSummaryPayload(runSummary);
  if (schemaError) throw new Error(`fixture ${name} run summary is invalid: ${schemaError}`);
  const plausibility = validateRebootRunPlausibility(runSummary);
  if (plausibility.verdict === 'rejected') throw new Error(`fixture ${name} is implausible: ${JSON.stringify(plausibility.flags)}`);
  const digest = await computeEvidenceDigest(body);
  if (!digest.ok) throw new Error(`fixture ${name} has no evidence digest: ${JSON.stringify(digest)}`);
  return {
    fixture: name,
    note: spec.note,
    gameId: spec.gameId,
    wallet: FIXTURE_WALLET,
    registry: FIXTURE_REGISTRY,
    chainId: FIXTURE_CHAIN_ID,
    salt,
    issuedAt: FIXTURE_ISSUED_AT,
    verifyAtMs: FIXTURE_VERIFY_AT_MS,
    body,
    expected: {
      score: runSummary.totals.score,
      evidenceDigest: digest.digest,
      evidenceBytes: digest.bytes,
      seed,
      plausibility,
    },
  };
}

export async function buildFixture(name) {
  if (Object.hasOwn(HMH_V7_FIXTURE_SPECS, name)) return buildHmhV7Fixture(name);
  const spec = FIXTURE_SPECS[name];
  if (!spec) throw new Error(`unknown fixture ${name}`);
  const salt = spec.salt ?? fixtureSalt(name);
  const { body } = await buildFixtureBody({ gameId: spec.gameId, salt, evidence: spec.evidence });
  const verified = await verifyRankedRun(body, fixtureVerifyOptions());
  if (!verified.ok) throw new Error(`fixture ${name} does not verify: ${JSON.stringify(verified)}`);
  return {
    fixture: name,
    note: spec.note,
    gameId: spec.gameId,
    wallet: FIXTURE_WALLET,
    registry: FIXTURE_REGISTRY,
    chainId: FIXTURE_CHAIN_ID,
    salt,
    issuedAt: FIXTURE_ISSUED_AT,
    verifyAtMs: FIXTURE_VERIFY_AT_MS,
    body,
    expected: {
      score: verified.score,
      contract: verified.contract,
      envelopeHash: verified.envelopeHash,
      evidenceDigest: verified.evidence.digest,
      evidenceBytes: verified.evidence.bytes,
      seed: verified.seed,
      plausibility: verified.plausibility,
    },
  };
}

async function main(argv) {
  const write = argv.includes('--write');
  const names = argv.filter((arg) => !arg.startsWith('--'));
  const selected = names.length ? names : [...FIXTURE_NAMES, ...HMH_V7_FIXTURE_NAMES];
  let drift = 0;
  for (const name of selected) {
    const started = Date.now();
    const fixture = await buildFixture(name);
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    if (write) {
      writeFileSync(fixturePath(name), `${JSON.stringify(fixture, null, 1)}\n`);
      console.log(`wrote ${name}.json (score ${fixture.expected.score}, ${seconds} s)`);
      continue;
    }
    let committed = null;
    try { committed = readFixture(name); } catch { committed = null; }
    const same = isDeepStrictEqual(committed, fixture);
    if (!same) drift += 1;
    console.log(`${same ? 'ok     ' : 'DRIFTED'} ${name} (${seconds} s)`);
  }
  if (drift) {
    console.error(`${drift} fixture(s) differ from build-fixtures.mjs; run with --write after a deliberate change.`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main(process.argv.slice(2));
