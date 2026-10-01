// Hard Money Heroes run summary schema 8: the ten-area Level 1
// (`ten-area-frontier`, map version 2) of game 2.1.0 and later
// (docs/2.0/slices/HMH-RANKED-V8-TEN-AREA.md).
//
// Schema 8 keeps every schema-7 field and rule shape and changes what the
// map-keyed catalogues mean: the ten areas are the districts, the ten area
// caches are the points of interest, the two ten-area machines are the
// objectives (and the worldSites mirror), there are no secrets and no
// prisoner cages, and the four bosses are the district bosses of the ten
// areas plus the Liquidator. It adds one row, `movement`, for the cover and
// traversal counters of HMH-COVER-TRAVERSAL-V1 section 6.
//
// validateRunSummaryPayload answers schema 1-7 exactly as
// sdk/hmh-run-summary-schema-v7.mjs (it delegates to it, word for word) and
// validates schema 8 against HMH_RUN_SUMMARY_CATALOGS_V8. Like the v7 module
// it stays off the HMH initial path: the child loads it in its lazy chunks,
// the server verifier and the portal bridge import it directly.
import {
  HMH_RUN_SUMMARY_CATALOGS_V7 as C7,
  HMH_V7_BOSS_STRIKE_AFTER_DEFEAT_TICKS,
  HMH_V7_PANEL_ONLY_EVOLUTIONS,
  HMH_V7_PROGRESSION_FIELDS,
  HMH_V7_RESERVED_EVOLUTIONS,
  HMH_V7_START_WEAPON,
  HMH_V7_UPGRADE_WEAPON_GATES,
  hmhRunSummaryCatalogs as hmhRunSummaryCatalogsUpTo7,
  validateRunSummaryPayload as validateSchemaUpTo7,
} from './hmh-run-summary-schema-v7.mjs';
import {
  isRunSummaryInteger as integer,
  runSummaryFieldsError as keys,
  runSummaryRowsError as rows,
  validateRunSummaryRules,
} from './hmh-run-summary-schema.mjs';

const freeze = (list) => Object.freeze([...list]);

// The ten areas, in catalogue order (the authored world's area order, by id),
// with their 2D extents [minX, minY, maxX, maxY] in world units. A position
// is in an area when minX <= x <= maxX and minY <= y <= maxY (the child's
// getWorldV2DistrictAt); a position in no area (a road between areas) sets no
// district bit. tests/hmh-ranked-v8-contract.test.mjs pins every extent
// against the child's world.
const AREAS = Object.freeze([
  ['fork-fortress', [10_500, 500, 14_500, 4_500]],
  ['halving-farms', [15_500, 4_700, 19_500, 8_700]],
  ['hashwood-river', [5_500, 9_600, 9_500, 13_600]],
  ['hollow-pines', [10_500, 9_600, 14_500, 13_600]],
  ['ledger-ridge', [5_500, 500, 9_500, 4_500]],
  ['litecoin-city', [5_500, 4_700, 9_500, 8_700]],
  ['mweb-meadows', [10_500, 4_700, 14_500, 8_700]],
  ['rugpull-woods', [15_500, 9_600, 19_500, 13_600]],
  ['scrypt-bayou', [500, 9_600, 4_500, 13_600]],
  ['silver-coast', [500, 4_700, 4_500, 8_700]],
]);

export const HMH_V8_MOVEMENT_FIELDS = freeze([
  'rulesVersion',
  'coverTicks',
  'coverEnters',
  'coverLeaves',
  'coverKills',
  'coverDamageReduced',
  'mantles',
  'drops',
  'mantleTicks',
  'landTicks',
]);

export const HMH_RUN_SUMMARY_CATALOGS_V8 = Object.freeze({
  // The v7 roles: the six legacy ordinary roles, the Liquidator, the six 2.0
  // enemies and the three district bosses. Every one can be killed on the
  // ten-area map.
  enemyRoles: C7.enemyRoles,
  weapons: C7.weapons,
  collectibles: C7.collectibles,
  upgrades: C7.upgrades,
  districts: freeze(AREAS.map(([id]) => id)),
  districtAreas: Object.freeze(AREAS.map(([, area]) => freeze(area))),
  // One cache per area, at its authored secret site.
  pointsOfInterest: freeze(AREAS.map(([id]) => `${id}-cache`)),
  // The two ten-area machines (switch class); both rows mirror objectives.
  worldSites: freeze(['ten-area-meadows-relay', 'ten-area-woods-camp']),
  secrets: freeze([]),
  defeatKinds: C7.defeatKinds,
  objectives: freeze(['ten-area-meadows-relay', 'ten-area-woods-camp']),
  // The v7 row order: the Rug Pull Baron (Hashwood River court), the
  // Lockkeeper (Scrypt Bayou), the 51% Foreman (Fork Fortress) and the
  // Liquidator (Litecoin City).
  bosses: C7.bosses,
  prisonerSlots: freeze([]),
  evolutions: C7.evolutions,
  movementFields: HMH_V8_MOVEMENT_FIELDS,
});

// The catalogues a summary of `schemaVersion` validates against (1-7 as the
// v7 module answers).
export function hmhRunSummaryCatalogs(schemaVersion) {
  return schemaVersion === 8 ? HMH_RUN_SUMMARY_CATALOGS_V8 : hmhRunSummaryCatalogsUpTo7(schemaVersion);
}

// The index of the area holding (x, y), or -1 (a road between areas).
export function hmhV8DistrictIndexAt(x, y) {
  return HMH_RUN_SUMMARY_CATALOGS_V8.districtAreas.findIndex(([minX, minY, maxX, maxY]) => x >= minX && x <= maxX && y >= minY && y <= maxY);
}

export const HMH_RUN_SUMMARY_V8_FIELDS = freeze(['objectives', 'prisoners', 'bosses', 'evolutions', 'progression', 'movement']);
const MOVEMENT_RULES_VERSION = /^[a-z0-9][a-z0-9.+-]{0,63}$/;

const sum = (list, field) => list.reduce((total, row) => total + row[field], 0);
const rowsById = (list, idKey) => Object.fromEntries(list.map((row) => [row[idKey], row]));

// Schema 8 (structural): the v7 rules S1-S18 with the v8 catalogues, then S19
// for the movement row. Runs after every v6 rule passed with the V8
// catalogues, so the v6 rows are dense and well formed here.
function validateSchema8(payload, C) {
  const T = payload.identity.endTick;
  const L = payload.totals.level;
  // S1: dense rows in catalogue order with exact keys.
  const error = rows(payload.objectives, C.objectives, 'objectiveId', ['completed', 'tick', 'levelAtCompletion'], 'game:run-summary objectives')
    || rows(payload.prisoners, C.prisonerSlots, 'slotId', ['rescued', 'tick', 'levelAtRescue'], 'game:run-summary prisoners')
    || rows(payload.bosses, C.bosses, 'bossId', ['initiations', 'firstInitiatedTick', 'lastInitiatedTick', 'defeatedTick'], 'game:run-summary bosses')
    || rows(payload.evolutions, C.evolutions, 'evolutionId', ['offered', 'applied'], 'game:run-summary evolutions')
    || keys(payload.progression, HMH_V7_PROGRESSION_FIELDS, 'game:run-summary progression')
    || keys(payload.movement, C.movementFields, 'game:run-summary movement');
  if (error) return error;
  const progression = payload.progression;
  for (const field of HMH_V7_PROGRESSION_FIELDS) if (!integer(progression[field])) return `game:run-summary progression.${field} is invalid`;

  // S2, S3: a node completes once, inside the run, at a level the run reached.
  const node = (flag, tick, level) => (flag === 1 ? tick <= T && level >= 1 && level <= L : flag === 0 && tick === 0 && level === 0);
  if (!payload.objectives.every((row) => node(row.completed, row.tick, row.levelAtCompletion))) return 'game:run-summary objectives are invalid';

  // S4: initiations bound their ticks; a defeat follows the last initiation.
  const bossRowValid = (row) => (row.initiations === 0
    ? row.firstInitiatedTick === 0 && row.lastInitiatedTick === 0 && row.defeatedTick === 0
    : row.firstInitiatedTick <= row.lastInitiatedTick && row.lastInitiatedTick <= T
      && (row.initiations === 1) === (row.firstInitiatedTick === row.lastInitiatedTick)
      && (row.defeatedTick === 0 || (row.lastInitiatedTick < row.defeatedTick && row.defeatedTick <= T)));
  if (!payload.bosses.every(bossRowValid)) return 'game:run-summary bosses are invalid';

  const bosses = rowsById(payload.bosses, 'bossId');
  const roleKills = rowsById(payload.kills.byEnemyRole, 'enemyRoleId');
  // S5: every boss, the district bosses included, is killed once, exactly
  // when its row records the defeat.
  if (C.bosses.some((bossId) => roleKills[bossId].count !== (bosses[bossId].defeatedTick > 0 ? 1 : 0))) return 'game:run-summary boss kills do not match the bosses rows';
  // S6: kills.boss keeps its meaning in every schema: the Liquidator.
  if (payload.kills.boss !== roleKills.liquidator.count) return 'game:run-summary kills.boss must count the Liquidator only';
  // S7: the boss-engaged milestone is the Liquidator's first initiation.
  if (payload.milestones.bossEngagedTick !== bosses.liquidator.firstInitiatedTick) return 'game:run-summary bossEngagedTick must be the Liquidator initiation';

  // S8: the machines are objectives; both rows say the same thing (no
  // secrets on this map, so that row is empty).
  const objectives = rowsById(payload.objectives, 'objectiveId');
  if (!payload.milestones.sites.every((row) => objectives[row.siteId].completed === row.operated && objectives[row.siteId].tick === row.tick)) return 'game:run-summary milestones do not match the objectives';

  // S10: as in schema 7.
  const evolutions = rowsById(payload.evolutions, 'evolutionId');
  if (!payload.evolutions.every((row) => row.applied <= 1) || sum(payload.evolutions, 'applied') !== progression.evolutionsApplied
    || HMH_V7_RESERVED_EVOLUTIONS.some((id) => evolutions[id].offered !== 0 || evolutions[id].applied !== 0)
    || HMH_V7_PANEL_ONLY_EVOLUTIONS.some((id) => evolutions[id].applied === 1 && evolutions[id].offered < 1)) return 'game:run-summary evolutions are invalid';
  // S11, S12: one Genesis Seal per defeated boss, applied or banked, counted
  // by the collectible row.
  const defeatedBosses = payload.bosses.filter((row) => row.defeatedTick > 0).length;
  if (progression.sealsFound > defeatedBosses || progression.evolutionsApplied > progression.sealsFound
    || progression.sealsBanked !== progression.sealsFound - progression.evolutionsApplied
    || progression.evolutionOffersOpened > progression.sealsFound) return 'game:run-summary Genesis Seals are inconsistent';
  const seal = payload.collectibles.find((row) => row.effectId === 'genesis-seal');
  if (seal.collected !== progression.sealsFound || seal.activeTicks !== 0) return 'game:run-summary genesis-seal pickups are inconsistent';
  // S13-S15: offers, picks, re-rolls and cards, as in schema 7.
  if (progression.offersOpened > L - 1 || sum(payload.upgrades, 'selected') > progression.offersOpened) return 'game:run-summary level-up offers are inconsistent';
  if (progression.rerolls > 2 * (progression.offersOpened + progression.evolutionOffersOpened)) return 'game:run-summary rerolls are inconsistent';
  const upgradeCards = sum(payload.upgrades, 'offered');
  const evolutionCards = sum(payload.evolutions, 'offered');
  if (upgradeCards > 2 * progression.offersOpened + progression.rerolls
    || evolutionCards > 2 * progression.evolutionOffersOpened + progression.rerolls
    || upgradeCards + evolutionCards > 2 * (progression.offersOpened + progression.evolutionOffersOpened) + progression.rerolls
    || payload.upgrades.some((row) => row.offered > progression.offersOpened)
    || payload.evolutions.some((row) => row.offered > progression.evolutionOffersOpened)) return 'game:run-summary offered cards are inconsistent';
  // S16: the only revive is the Golden Parachute of a Dark Pool win, and the
  // ten-area map has no Dark Pool.
  if (progression.revivesUsed !== 0) return 'game:run-summary the revive has no Golden Parachute';
  // S17: a boss defeat names a boss attack, so some boss was live by then.
  const tick = payload.defeat.tick;
  if (payload.defeat.kind === 'boss' && !payload.bosses.some((row) => row.initiations > 0 && row.firstInitiatedTick <= tick
    && (row.defeatedTick === 0 || tick <= row.defeatedTick + HMH_V7_BOSS_STRIKE_AFTER_DEFEAT_TICKS))) return 'game:run-summary a boss defeat needs a live boss';
  // S18: gun cards only for a gun the run owns.
  const weapons = rowsById(payload.weapons, 'weaponId');
  const owned = (weaponId) => weaponId === HMH_V7_START_WEAPON || weapons[weaponId].pickups >= 1;
  if (payload.upgrades.some((row) => row.offered > 0 && Object.hasOwn(HMH_V7_UPGRADE_WEAPON_GATES, row.upgradeId) && !owned(HMH_V7_UPGRADE_WEAPON_GATES[row.upgradeId]))
    || payload.evolutions.some((row, index) => (row.offered > 0 || row.applied > 0) && !owned(C.weapons[index]))) return 'game:run-summary a gun card was shown for a gun the run never owned';

  // S19: the movement row. The counters are the cover and traversal states'
  // own, so each identity holds for every child run: entering cover is a
  // cover tick, a leave follows an enter, a kill in cover is a kill, and
  // mantle and landing ticks are distinct run ticks.
  const movement = payload.movement;
  if (typeof movement.rulesVersion !== 'string' || !MOVEMENT_RULES_VERSION.test(movement.rulesVersion)) return 'game:run-summary movement.rulesVersion is invalid';
  for (const field of C.movementFields) if (field !== 'rulesVersion' && !integer(movement[field])) return `game:run-summary movement.${field} is invalid`;
  if (movement.coverEnters > movement.coverTicks || movement.coverLeaves > movement.coverEnters
    || movement.coverTicks > payload.totals.survivalTicks || movement.coverKills > payload.kills.total
    || movement.mantleTicks + movement.landTicks > payload.totals.survivalTicks) return 'game:run-summary movement totals are inconsistent';
  return '';
}

// Schema 1-8. For 1-7 the answer is the v7 module's, word for word.
export function validateRunSummaryPayload(payload) {
  if (payload?.schemaVersion !== 8) return validateSchemaUpTo7(payload);
  return validateRunSummaryRules(payload, HMH_RUN_SUMMARY_CATALOGS_V8, HMH_RUN_SUMMARY_V8_FIELDS)
    || validateSchema8(payload, HMH_RUN_SUMMARY_CATALOGS_V8);
}
