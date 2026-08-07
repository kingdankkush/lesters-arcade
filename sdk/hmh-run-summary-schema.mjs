export const HMH_RUN_SUMMARY_CATALOGS = Object.freeze({
  enemyRoles: Object.freeze([
    'bagholder-rusher',
    'forkrunner',
    'liquidator-agent',
    'whale-enforcer',
    'gas-bomber',
    'validator-cultist',
    'liquidator',
  ]),
  weapons: Object.freeze([
    'coin-blaster',
    'scatter-shotgun',
    'auto-miner',
    'launcher-rig',
    'hash-rail',
    'litecoin-knife',
    'satoshi-frag',
    'nuke-liquidation',
  ]),
  collectibles: Object.freeze([
    'bonus-life',
    'coin-blaster-cache',
    'scatter-shotgun-cache',
    'auto-miner-cache',
    'launcher-rig-cache',
    'litecoin-token',
    'hash-rail-core',
    'time-dilation',
    'berserk-candle',
    'nuke-liquidation',
  ]),
  upgrades: Object.freeze([
    'proof-of-work',
    'diamond-hands',
    'gas-optimization',
    'cold-storage',
    'block-reward',
    'validator-training',
    'compound-interest',
    'precision-ledger',
    'hard-fork-rounds',
    'hot-wallet',
    'layer-two',
    'hardened-wallet',
  ]),
  districts: Object.freeze([
    'frontier-relay',
    'rugpull-ravine',
    'liquidity-crossing',
    'hashwood',
    'mining-camp',
    'liquidation-yard',
  ]),
  pointsOfInterest: Object.freeze([
    'relay-cache',
    'relay-armory',
    'ravine-salvage',
    'ravine-overlook-cache',
    'crossing-fuel-depot',
    'crossing-bank-cache',
    'hashwood-shrine',
    'mining-control-room',
    'yard-extraction-console',
    'yard-medbay-cache',
  ]),
});

const plain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const keys = (value, expected, label) => {
  if (!plain(value)) return `${label} must be a plain object`;
  const actual = Object.keys(value);
  if (actual.length !== expected.length) return `${label} must contain exact fields`;
  for (const key of actual) if (!expected.includes(key)) return `${label} has unexpected field: ${key}`;
  for (const key of expected) if (!Object.hasOwn(value, key)) return `${label} is missing field: ${key}`;
  return '';
};
const integer = (value, maximum = 1_000_000_000) => Number.isInteger(value) && value >= 0 && value <= maximum;
const finite = (value) => Number.isFinite(value) && value >= 0 && value <= 1_000_000_000;
const rows = (value, ids, idKey, fields, label) => {
  if (!Array.isArray(value) || value.length !== ids.length) return `${label} rows are invalid`;
  for (let rowIndex = 0; rowIndex < ids.length; rowIndex += 1) {
    const row = value[rowIndex];
    const error = keys(row, [idKey, ...fields], `${label}[${rowIndex}]`);
    if (error) return error;
    if (row[idKey] !== ids[rowIndex]) return `${label}[${rowIndex}] id is invalid`;
    for (const field of fields) if (!integer(row[field])) return `${label}[${rowIndex}].${field} is invalid`;
  }
  return '';
};

export function validateRunSummaryPayload(payload) {
  let error = keys(payload, ['schemaVersion', 'identity', 'totals', 'kills', 'weapons', 'grenades', 'collectibles', 'upgrades', 'exploration'], 'game:run-summary payload');
  if (error) return error;
  if (![1, 2].includes(payload.schemaVersion)) return 'game:run-summary schemaVersion is invalid';
  const identityFields = ['seed', 'buildHash', 'mode', 'heroId', 'terminalReason', 'startTick', 'endTick'];
  error = keys(payload.identity, identityFields, 'game:run-summary identity');
  if (error) return error;
  const identity = payload.identity;
  if (!integer(identity.seed, 0xffff_ffff)) return 'game:run-summary seed is invalid';
  if (typeof identity.buildHash !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(identity.buildHash)) return 'game:run-summary buildHash is invalid';
  if (!['free', 'ranked'].includes(identity.mode)) return 'game:run-summary mode is invalid';
  if (typeof identity.heroId !== 'string' || !/^[a-z0-9][a-z0-9-]{1,63}$/.test(identity.heroId)) return 'game:run-summary heroId is invalid';
  if (!['defeated', 'completed', 'abandoned', 'runtime-error'].includes(identity.terminalReason)) return 'game:run-summary terminalReason is invalid';
  if (!integer(identity.startTick) || !integer(identity.endTick) || identity.endTick < identity.startTick) return 'game:run-summary ticks are invalid';

  const totalFields = ['survivalTicks', 'elapsedMs', 'score', 'level', 'xp', 'litecoin', 'currentCombo', 'maxCombo', 'damageDealt', 'damageTaken', 'healing', 'distanceMilli'];
  error = keys(payload.totals, totalFields, 'game:run-summary totals');
  if (error) return error;
  for (const field of totalFields) if (field !== 'elapsedMs' && !integer(payload.totals[field], field === 'score' || field === 'xp' ? 1_000_000_000_000 : 1_000_000_000)) return `game:run-summary totals.${field} is invalid`;
  if (!finite(payload.totals.elapsedMs) || payload.totals.level < 1 || payload.totals.currentCombo > payload.totals.maxCombo) return 'game:run-summary totals are invalid';
  if (payload.totals.survivalTicks !== identity.endTick - identity.startTick) return 'game:run-summary survivalTicks does not match identity';

  error = keys(payload.kills, ['total', 'byEnemyRole', 'byWeapon', 'elite', 'boss'], 'game:run-summary kills');
  if (error) return error;
  for (const field of ['total', 'elite', 'boss']) if (!integer(payload.kills[field], 10_000_000)) return `game:run-summary kills.${field} is invalid`;
  error = rows(payload.kills.byEnemyRole, HMH_RUN_SUMMARY_CATALOGS.enemyRoles, 'enemyRoleId', ['count'], 'game:run-summary kills.byEnemyRole');
  if (error) return error;
  error = rows(payload.kills.byWeapon, HMH_RUN_SUMMARY_CATALOGS.weapons, 'weaponId', ['count'], 'game:run-summary kills.byWeapon');
  if (error) return error;
  if (payload.kills.byEnemyRole.reduce((sum, row) => sum + row.count, 0) !== payload.kills.total
    || payload.kills.byWeapon.reduce((sum, row) => sum + row.count, 0) !== payload.kills.total
    || payload.kills.elite > payload.kills.total || payload.kills.boss > payload.kills.total) return 'game:run-summary kill totals are inconsistent';

  const weaponFields = ['pickups', 'swaps', 'triggers', 'triggerContacts', 'projectilesEmitted', 'projectileContacts', 'reloadStarts', 'reloadCompletes', 'emptyAttempts', 'equippedTicks', 'damage', 'kills', 'criticalHits', 'overkill'];
  if (payload.schemaVersion >= 2) weaponFields.push('chargesStarted', 'chargesCancelled', 'chargedShots', 'cancelledChargeTicks', 'zeroHitShots', 'oneHitShots', 'twoHitShots', 'threePlusHitShots', 'bossHits', 'damageTakenWhileEquipped');
  error = rows(payload.weapons, HMH_RUN_SUMMARY_CATALOGS.weapons, 'weaponId', weaponFields, 'game:run-summary weapons');
  if (error) return error;
  for (let index = 0; index < payload.weapons.length; index += 1) {
    const weapon = payload.weapons[index];
    if (weapon.triggerContacts > weapon.triggers || weapon.reloadCompletes > weapon.reloadStarts
      || weapon.kills !== payload.kills.byWeapon[index].count) return `game:run-summary weapons[${index}] totals are inconsistent`;
    if (payload.schemaVersion >= 2 && (weapon.chargesCancelled > weapon.chargesStarted
      || weapon.chargedShots > weapon.chargesStarted
      || weapon.zeroHitShots + weapon.oneHitShots + weapon.twoHitShots + weapon.threePlusHitShots > weapon.chargedShots)) return `game:run-summary weapons[${index}] charge totals are inconsistent`;
  }

  error = keys(payload.grenades, ['thrown', 'detonated', 'contacts', 'kills', 'selfDamage', 'overflows'], 'game:run-summary grenades');
  if (error) return error;
  for (const field of Object.keys(payload.grenades)) if (!integer(payload.grenades[field])) return `game:run-summary grenades.${field} is invalid`;
  error = rows(payload.collectibles, HMH_RUN_SUMMARY_CATALOGS.collectibles, 'effectId', ['collected', 'activeTicks'], 'game:run-summary collectibles');
  if (error) return error;
  error = rows(payload.upgrades, HMH_RUN_SUMMARY_CATALOGS.upgrades, 'upgradeId', ['offered', 'selected'], 'game:run-summary upgrades');
  if (error) return error;
  for (const upgrade of payload.upgrades) if (upgrade.selected > upgrade.offered) return 'game:run-summary upgrade totals are inconsistent';

  error = keys(payload.exploration, ['visitedDistrictMask', 'discoveredPoiMask', 'revealedCells', 'totalCells', 'revealedPermille', 'distanceMilli'], 'game:run-summary exploration');
  if (error) return error;
  for (const field of Object.keys(payload.exploration)) if (!integer(payload.exploration[field])) return `game:run-summary exploration.${field} is invalid`;
  const exploration = payload.exploration;
  if (exploration.visitedDistrictMask >= 2 ** HMH_RUN_SUMMARY_CATALOGS.districts.length
    || exploration.discoveredPoiMask >= 2 ** HMH_RUN_SUMMARY_CATALOGS.pointsOfInterest.length
    || exploration.revealedCells > exploration.totalCells
    || exploration.revealedPermille > 1000
    || exploration.revealedPermille !== (exploration.totalCells === 0 ? 0 : Math.round(exploration.revealedCells * 1000 / exploration.totalCells))
    || exploration.distanceMilli !== payload.totals.distanceMilli) return 'game:run-summary exploration totals are inconsistent';
  const litecoin = payload.collectibles.find((row) => row.effectId === 'litecoin-token').collected;
  if (payload.totals.litecoin !== litecoin) return 'game:run-summary Litecoin total is inconsistent';
  return '';
}
