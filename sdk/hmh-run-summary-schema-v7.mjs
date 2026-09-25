// Hard Money Heroes run summary schema 7 (docs/hmh-reboot/design/
// HMH-RUN-SUMMARY-V7-CONTRACT.md §2, §3, §6 and §16).
//
// This module holds the V7 catalogues and the validator that accepts schema
// versions 1-7. It is separate from sdk/hmh-run-summary-schema.mjs because
// the 1.8.x HMH child and the portal load that module on their initial path,
// where the HMH initial-JS budget has no room for the V7 catalogues: this
// branch leaves their bundles as they were. The server verifier imports this
// module; the child (and the portal bridge, when the child emits schema 7)
// switches to it in the child branch.
//
// Its validateRunSummaryPayload answers schema 1-6 exactly as the base module
// (it delegates to it), and validates schema 7 against the V7 catalogues:
// every v6 rule first, then the rows and rules S1-S16.
import {
  HMH_RUN_SUMMARY_CATALOGS_V6,
  isRunSummaryInteger as integer,
  runSummaryFieldsError as keys,
  runSummaryRowsError as rows,
  validateRunSummaryPayload as validateSchemaUpTo6,
  validateRunSummaryRules,
} from './hmh-run-summary-schema.mjs';

export { HMH_RUN_SUMMARY_CATALOGS_V6 };

const V6 = HMH_RUN_SUMMARY_CATALOGS_V6;
const append = (base, extra) => Object.freeze([...base, ...extra]);
// V6 plus append-only additions (an id's index never moves), plus the
// objectives, bosses, prisonerSlots and evolutions catalogues.
export const HMH_RUN_SUMMARY_CATALOGS_V7 = Object.freeze({
  // Archetype ids for the six new ordinary roles, then the three district
  // bosses (bare role ids, like 'liquidator'; the in-sim target is boss-<id>).
  enemyRoles: append(V6.enemyRoles, [
    'rug-puller',
    'pump-and-dump-bloater',
    'tollkeeper',
    'hodl-revenant',
    'money-printer',
    'oracle-marksman',
    'rug-pull-baron',
    'lockkeeper',
    'fifty-one-percent-foreman',
  ]),
  weapons: V6.weapons,
  collectibles: append(V6.collectibles, ['genesis-seal']),
  upgrades: append(V6.upgrades, [
    'scatter-pump',
    'scatter-dump',
    'scatter-shells',
    'miner-hashrate',
    'miner-asic',
    'miner-pool',
    'rail-blocktime',
    'rail-proof',
    'rail-mempool',
    'launcher-airdrop',
    'launcher-yield',
    'launcher-bandolier',
  ]),
  districts: V6.districts,
  pointsOfInterest: V6.pointsOfInterest,
  // Exactly the 11 switch-class objectives (the machines).
  worldSites: append(V6.worldSites, ['relay-uplink', 'hashwood-log-pile', 'hashwood-beacon', 'hashwood-lookout', 'yard-bascule-lever']),
  // Exactly the 6 secret-class objectives.
  secrets: append(V6.secrets, ['crossing-behind-the-falls', 'hashwood-hollow-grove', 'mining-collapsed-adit']),
  defeatKinds: V6.defeatKinds,
  // Mission objectives, sorted by id. Class, district and prerequisites live in
  // sdk/hmh-run-contract-v7.mjs.
  objectives: Object.freeze([
    'crossing-behind-the-falls',
    'crossing-mill-storeroom',
    'crossing-pump',
    'farmstead-hidden-supplies',
    'hashwood-beacon',
    'hashwood-hollow-grove',
    'hashwood-lamp-oil',
    'hashwood-log-chute',
    'hashwood-log-pile',
    'hashwood-lookout',
    'hashwood-shrine',
    'mining-collapsed-adit',
    'mining-valve',
    'ravine-rope-bridge',
    'ravine-surveyor-cache',
    'ravine-winch',
    'ravine-winch-handle',
    'relay-barn-doors',
    'relay-power',
    'relay-uplink',
    'warehouse-logbook',
    'yard-bascule-lever',
    'yard-port-bascule',
    'yard-warehouse',
    'yard-warehouse-gate',
  ]),
  // West to east, which is also ready order. Each id is also an enemy role.
  bosses: Object.freeze(['rug-pull-baron', 'lockkeeper', 'fifty-one-percent-foreman', 'liquidator']),
  // Sorted by id; the index is the prisoner deal index (dealHmhPrisoners).
  prisonerSlots: Object.freeze([
    'h1-baron-diggings',
    'h2-foreman-hoist-vault',
    'p1-relay-barn-yard',
    'p2-ravine-surveyor-camp',
    'p3-crossing-boathouse',
    'p4-hashwood-logging-camp',
    'p5-mining-bench',
    'p6-yard-warehouse-compound',
  ]),
  // Weapon-catalogue order; rows 5-7 (wave 2) are reserved.
  evolutions: Object.freeze([
    'settler-rail',
    'double-spend',
    'hashstorm-overdrive',
    'crypto-bomb-orbit',
    'crit-candle',
    'lightning-network',
    'burn-address',
    'chain-split',
  ]),
});

// The catalogues a summary of `schemaVersion` validates against.
export function hmhRunSummaryCatalogs(schemaVersion) {
  return schemaVersion === 7 ? HMH_RUN_SUMMARY_CATALOGS_V7 : HMH_RUN_SUMMARY_CATALOGS_V6;
}

// Held prisoners (contract §6 S9): the cage opens only after its boss's arena
// was initiated (a champion arena frees it without a kill).
export const HMH_V7_HELD_PRISONER_BOSSES = Object.freeze({
  'h1-baron-diggings': 'rug-pull-baron',
  'h2-foreman-hoist-vault': 'fifty-one-percent-foreman',
});
export const HMH_V7_PROGRESSION_FIELDS = Object.freeze(['offersOpened', 'evolutionOffersOpened', 'rerolls', 'sealsFound', 'sealsBanked', 'evolutionsApplied', 'revivesUsed']);

const sum = (list, field) => list.reduce((total, row) => total + row[field], 0);
const rowsById = (list, idKey) => Object.fromEntries(list.map((row) => [row[idKey], row]));

// Schema 7 (contract §6, S1-S16). Structural only: the payload, catalogue sizes
// and small fixed caps. Runs after every v6 rule has passed with the V7
// catalogues (S0), so the v6 rows are known to be dense and well formed here.
function validateSchema7(payload, C) {
  const T = payload.identity.endTick;
  const L = payload.totals.level;
  // S1: the five new fields, dense rows in catalogue order with exact keys.
  const error = rows(payload.objectives, C.objectives, 'objectiveId', ['completed', 'tick', 'levelAtCompletion'], 'game:run-summary objectives')
    || rows(payload.prisoners, C.prisonerSlots, 'slotId', ['rescued', 'tick', 'levelAtRescue'], 'game:run-summary prisoners')
    || rows(payload.bosses, C.bosses, 'bossId', ['initiations', 'firstInitiatedTick', 'lastInitiatedTick', 'defeatedTick'], 'game:run-summary bosses')
    || rows(payload.evolutions, C.evolutions, 'evolutionId', ['offered', 'applied'], 'game:run-summary evolutions')
    || keys(payload.progression, HMH_V7_PROGRESSION_FIELDS, 'game:run-summary progression');
  if (error) return error;
  const progression = payload.progression;
  for (const field of HMH_V7_PROGRESSION_FIELDS) if (!integer(progression[field])) return `game:run-summary progression.${field} is invalid`;

  // S2, S3: a node completes at most once, inside the run, at a level the run
  // reached (the level before the node's own grant); an untouched node is all 0.
  const node = (flag, tick, level) => (flag === 1 ? tick <= T && level >= 1 && level <= L : flag === 0 && tick === 0 && level === 0);
  if (!payload.objectives.every((row) => node(row.completed, row.tick, row.levelAtCompletion))) return 'game:run-summary objectives are invalid';
  if (!payload.prisoners.every((row) => node(row.rescued, row.tick, row.levelAtRescue))) return 'game:run-summary prisoners are invalid';

  // S4: initiations bound their ticks; a defeat follows the last initiation.
  const bossRowValid = (row) => (row.initiations === 0
    ? row.firstInitiatedTick === 0 && row.lastInitiatedTick === 0 && row.defeatedTick === 0
    : row.firstInitiatedTick <= row.lastInitiatedTick && row.lastInitiatedTick <= T
      && (row.initiations === 1) === (row.firstInitiatedTick === row.lastInitiatedTick)
      && (row.defeatedTick === 0 || (row.lastInitiatedTick < row.defeatedTick && row.defeatedTick <= T)));
  if (!payload.bosses.every(bossRowValid)) return 'game:run-summary bosses are invalid';

  const bosses = rowsById(payload.bosses, 'bossId');
  const roleKills = rowsById(payload.kills.byEnemyRole, 'enemyRoleId');
  // S5: a boss is killed once, exactly when its row records the defeat.
  if (C.bosses.some((bossId) => roleKills[bossId].count !== (bosses[bossId].defeatedTick > 0 ? 1 : 0))) return 'game:run-summary boss kills do not match the bosses rows';
  // S6: kills.boss keeps its meaning, the Level 1 boss: the Liquidator.
  if (payload.kills.boss !== roleKills.liquidator.count) return 'game:run-summary kills.boss must count the Liquidator only';
  // S7: the v6 boss-engaged milestone is the Liquidator's first initiation.
  if (payload.milestones.bossEngagedTick !== bosses.liquidator.firstInitiatedTick) return 'game:run-summary bossEngagedTick must be the Liquidator initiation';

  // S8: the machines and the secrets are objectives; both rows say the same thing.
  const objectives = rowsById(payload.objectives, 'objectiveId');
  if (!payload.milestones.sites.every((row) => objectives[row.siteId].completed === row.operated && objectives[row.siteId].tick === row.tick)
    || !payload.milestones.secrets.every((row) => objectives[row.secretId].completed === row.found && objectives[row.secretId].tick === row.tick)) return 'game:run-summary milestones do not match the objectives';

  // S9: a held prisoner is freed only after its boss's arena was initiated.
  const prisoners = rowsById(payload.prisoners, 'slotId');
  for (const [slotId, bossId] of Object.entries(HMH_V7_HELD_PRISONER_BOSSES)) {
    const cage = prisoners[slotId];
    if (cage.rescued === 1 && (bosses[bossId].initiations < 1 || cage.tick < bosses[bossId].firstInitiatedTick)) return 'game:run-summary a held prisoner was rescued before its boss';
  }

  // S10: an evolution applies once, and the rows add up to the counter.
  if (!payload.evolutions.every((row) => row.applied <= 1) || sum(payload.evolutions, 'applied') !== progression.evolutionsApplied) return 'game:run-summary evolutions are invalid';
  // S11: at most one Genesis Seal per defeated boss; each Seal is applied or banked.
  const defeatedBosses = payload.bosses.filter((row) => row.defeatedTick > 0).length;
  if (progression.sealsFound > defeatedBosses || progression.evolutionsApplied > progression.sealsFound
    || progression.sealsBanked !== progression.sealsFound - progression.evolutionsApplied
    || progression.evolutionOffersOpened > progression.sealsFound) return 'game:run-summary Genesis Seals are inconsistent';
  // S12: the genesis-seal collectible row counts the same pickups and is never timed.
  const seal = payload.collectibles.find((row) => row.effectId === 'genesis-seal');
  if (seal.collected !== progression.sealsFound || seal.activeTicks !== 0) return 'game:run-summary genesis-seal pickups are inconsistent';
  // S13: at most one offer per level gained, and one pick per offer.
  if (progression.offersOpened > L - 1 || sum(payload.upgrades, 'selected') > progression.offersOpened) return 'game:run-summary level-up offers are inconsistent';
  // S14: one re-roll per card, two cards per offer.
  if (progression.rerolls > 2 * (progression.offersOpened + progression.evolutionOffersOpened)) return 'game:run-summary rerolls are inconsistent';
  // S15: two cards per offer, plus one per re-roll.
  if (sum(payload.upgrades, 'offered') > 2 * progression.offersOpened + progression.rerolls
    || sum(payload.evolutions, 'offered') > 2 * progression.evolutionOffersOpened + progression.rerolls) return 'game:run-summary offered cards are inconsistent';
  // S16: the one revive is the Golden Parachute, which only a Dark Pool win
  // grants: the Warehouse Logbook entered by the Liquidator's last initiation.
  const logbook = rowsById(payload.milestones.secrets, 'secretId')['warehouse-logbook'];
  if (progression.revivesUsed > 1 || (progression.revivesUsed === 1 && !(bosses.liquidator.defeatedTick > 0
    && logbook.found === 1 && logbook.tick <= bosses.liquidator.lastInitiatedTick))) return 'game:run-summary the revive has no Golden Parachute';
  return '';
}

export const HMH_RUN_SUMMARY_V7_FIELDS = Object.freeze(['objectives', 'prisoners', 'bosses', 'evolutions', 'progression']);

// Schema 1-7. For 1-6 the answer is the base module's, word for word.
export function validateRunSummaryPayload(payload) {
  if (payload?.schemaVersion !== 7) return validateSchemaUpTo6(payload);
  return validateRunSummaryRules(payload, HMH_RUN_SUMMARY_CATALOGS_V7, HMH_RUN_SUMMARY_V7_FIELDS)
    || validateSchema7(payload, HMH_RUN_SUMMARY_CATALOGS_V7);
}
