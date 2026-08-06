import { HMH_RUN_SUMMARY_CATALOGS as C } from './hmh-run-summary-schema.mjs';

const freezeDeep = (value) => {
  for (const child of Object.values(value)) if (child && typeof child === 'object') freezeDeep(child);
  return Object.freeze(value);
};

const index = (values, value, label) => {
  const result = values.indexOf(value);
  if (result < 0) throw new TypeError(`unknown ${label} ${String(value)}`);
  return result;
};
const count = (value, label) => {
  if (!Number.isInteger(value) || value < 0 || value > 1_000_000_000) throw new TypeError(`${label} must be a bounded non-negative integer`);
  return value;
};
const finite = (value, label) => {
  if (!Number.isFinite(value) || value < 0 || value > 1_000_000_000) throw new TypeError(`${label} must be a bounded non-negative number`);
  return value;
};
const point = (value, label) => {
  if (!Number.isFinite(value?.x) || !Number.isFinite(value?.y)) throw new TypeError(`${label} must be a finite point`);
  return { x: value.x, y: value.y };
};
const rows = (values, length) => values.map(() => Array(length).fill(0));

export function createRunSummaryAccumulator({ seed, buildHash, mode, heroId, startTick = 0, startPosition } = {}) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffff_ffff) throw new TypeError('seed must be an unsigned 32-bit integer');
  if (typeof buildHash !== 'string' || buildHash.length < 1 || buildHash.length > 128) throw new TypeError('buildHash must be bounded');
  if (!['free', 'ranked'].includes(mode)) throw new TypeError('mode must be free or ranked');
  if (typeof heroId !== 'string' || heroId.length < 2 || heroId.length > 64) throw new TypeError('heroId must be bounded');
  count(startTick, 'startTick');
  return {
    identity: { seed, buildHash, mode, heroId, startTick },
    totals: [0, 0, 0], // damage dealt, damage taken, healing
    enemyKills: Array(C.enemyRoles.length).fill(0),
    weapons: rows(C.weapons, 14),
    grenades: Array(6).fill(0),
    collectibles: rows(C.collectibles, 2),
    upgrades: rows(C.upgrades, 2),
    exploration: [0, 0, 0], // district mask, POI mask, accepted distance
    lastPosition: point(startPosition, 'startPosition'),
    lastTick: startTick,
    finalized: false,
  };
}

export function recordRunTick(state, { tick, position, activeWeaponId, districtId, discoveredPoiIds = [], activeEffectIds = [] } = {}) {
  count(tick, 'tick');
  if (tick <= state.lastTick) throw new TypeError('run-summary tick must be monotonic');
  const next = point(position, 'position');
  state.exploration[2] += Math.hypot(next.x - state.lastPosition.x, next.y - state.lastPosition.y);
  state.lastPosition = next;
  state.lastTick = tick;
  state.weapons[index(C.weapons, activeWeaponId, 'weapon')][9] += 1;
  state.exploration[0] |= 1 << index(C.districts, districtId, 'district');
  for (const id of discoveredPoiIds) state.exploration[1] |= 1 << index(C.pointsOfInterest, id, 'point of interest');
  for (const id of activeEffectIds) state.collectibles[index(C.collectibles, id, 'collectible effect')][1] += 1;
}

export function recordRunWeaponFire(state, { weaponId, emitted } = {}) {
  const row = state.weapons[index(C.weapons, weaponId, 'weapon')];
  row[2] += 1;
  row[4] += count(emitted, 'emitted projectiles');
}

export function recordRunWeaponTriggerContact(state, { weaponId } = {}) {
  state.weapons[index(C.weapons, weaponId, 'weapon')][3] += 1;
}

export function recordRunProjectileContacts(state, { weaponId, count: contacts = 1 } = {}) {
  state.weapons[index(C.weapons, weaponId, 'weapon')][5] += count(contacts, 'projectile contacts');
}

export function recordRunProjectileResolution(state, shot, hits) {
  if (!hits.length) return;
  recordRunProjectileContacts(state, { weaponId: shot.weaponId, count: hits.length });
  if (shot.trigger.contacted) return;
  shot.trigger.contacted = true;
  recordRunWeaponTriggerContact(state, { weaponId: shot.weaponId });
}

export function recordRunWeaponEvent(state, { type, weaponId } = {}) {
  const row = state.weapons[index(C.weapons, weaponId, 'weapon')];
  const metric = { pickup: 0, swap: 1, 'reload-start': 6, 'reload-complete': 7, empty: 8 }[type];
  if (metric === undefined) throw new TypeError(`unknown weapon event ${String(type)}`);
  row[metric] += 1;
}

export function recordRunWeaponLifecycleEvent(state, event) {
  if (event.type === 'weapon:reload-start') recordRunWeaponEvent(state, { type: 'reload-start', weaponId: event.weaponId });
  else if (event.type === 'weapon:reload-complete') recordRunWeaponEvent(state, { type: 'reload-complete', weaponId: event.weaponId });
  else if (event.type === 'weapon:auto-fallback') {
    recordRunWeaponEvent(state, { type: 'empty', weaponId: event.previousWeaponId });
    recordRunWeaponEvent(state, { type: 'swap', weaponId: event.weaponId });
  }
}

export function recordRunDamage(state, event = {}) {
  const amount = finite(event.damageApplied, 'damageApplied');
  if (event.targetId === 'player') {
    state.totals[1] += amount;
    return;
  }
  if (event.sourceId !== 'player') return;
  state.totals[0] += amount;
  const row = state.weapons[index(C.weapons, event.weaponId, 'weapon')];
  row[10] += amount;
  if (event.critical) row[12] += 1;
  row[13] += Math.max(0, amount - finite(event.healthBefore, 'healthBefore'));
}

export function recordRunHealing(state, amount) {
  state.totals[2] += finite(amount, 'healing');
}

export function recordRunKill(state, { enemyRoleId, weaponId, elite = false, boss = false } = {}) {
  state.enemyKills[index(C.enemyRoles, enemyRoleId, 'enemy role')] += 1;
  state.weapons[index(C.weapons, weaponId, 'weapon')][11] += 1;
  if (elite) state.eliteKills = (state.eliteKills ?? 0) + 1;
  if (boss) state.bossKills = (state.bossKills ?? 0) + 1;
  if (weaponId === 'satoshi-frag' || weaponId === 'launcher-rig') state.grenades[3] += 1;
}

export function recordRunGrenade(state, { type, contacts = 0, amount = 0 } = {}) {
  const metric = { thrown: 0, detonated: 1, 'self-damage': 4, overflow: 5 }[type];
  if (metric === undefined) throw new TypeError(`unknown grenade event ${String(type)}`);
  if (type === 'detonated') {
    state.grenades[1] += 1;
    state.grenades[2] += count(contacts, 'grenade contacts');
  } else if (type === 'self-damage') state.grenades[4] += finite(amount, 'grenade self damage');
  else state.grenades[metric] += 1;
}

export function recordRunGrenadeDetonation(state, detonation) {
  const contacts = detonation.hits.reduce((sum, hit) => sum + Number(hit.targetId !== 'player'), 0);
  recordRunGrenade(state, { type: 'detonated', contacts });
  if (detonation.grenadeId.startsWith('launcher-rig:') && contacts > 0) {
    recordRunWeaponTriggerContact(state, { weaponId: 'launcher-rig' });
    recordRunProjectileContacts(state, { weaponId: 'launcher-rig', count: contacts });
  }
}

export function recordRunCollectible(state, { effectId } = {}) {
  state.collectibles[index(C.collectibles, effectId, 'collectible effect')][0] += 1;
}

export function recordRunUpgradeOffer(state, upgradeIds) {
  if (!Array.isArray(upgradeIds) || upgradeIds.length > C.upgrades.length) throw new TypeError('upgrade offer must be a bounded array');
  for (const id of upgradeIds) state.upgrades[index(C.upgrades, id, 'upgrade')][0] += 1;
}

export function recordRunUpgradeSelection(state, upgradeId) {
  state.upgrades[index(C.upgrades, upgradeId, 'upgrade')][1] += 1;
}

export function finalizeRunSummary(state, {
  endTick,
  elapsedMs,
  terminalReason,
  score,
  level,
  xp,
  currentCombo,
  maxCombo,
  revealedCells,
  totalCells,
} = {}) {
  if (state.finalized) throw new Error('run summary is already finalized');
  count(endTick, 'endTick');
  if (endTick < state.identity.startTick || endTick < state.lastTick) throw new TypeError('endTick precedes recorded authority');
  finite(elapsedMs, 'elapsedMs');
  if (!['defeated', 'completed', 'abandoned', 'runtime-error'].includes(terminalReason)) throw new TypeError('terminalReason is invalid');
  for (const [value, label] of [[score, 'score'], [level, 'level'], [xp, 'xp'], [currentCombo, 'currentCombo'], [maxCombo, 'maxCombo'], [revealedCells, 'revealedCells'], [totalCells, 'totalCells']]) count(value, label);
  if (level < 1 || revealedCells > totalCells || currentCombo > maxCombo) throw new TypeError('final run-summary totals are inconsistent');
  state.finalized = true;
  const distanceMilli = Math.round(state.exploration[2] * 1000);
  const byEnemyRole = C.enemyRoles.map((enemyRoleId, i) => ({ enemyRoleId, count: state.enemyKills[i] }));
  const byWeapon = C.weapons.map((weaponId, i) => ({ weaponId, count: state.weapons[i][11] }));
  const weaponFields = ['pickups', 'swaps', 'triggers', 'triggerContacts', 'projectilesEmitted', 'projectileContacts', 'reloadStarts', 'reloadCompletes', 'emptyAttempts', 'equippedTicks', 'damage', 'kills', 'criticalHits', 'overkill'];
  const weapons = C.weapons.map((weaponId, i) => Object.fromEntries([['weaponId', weaponId], ...weaponFields.map((field, metric) => [field, state.weapons[i][metric]])]));
  const summary = {
    schemaVersion: 1,
    identity: { ...state.identity, terminalReason, endTick },
    totals: {
      survivalTicks: endTick - state.identity.startTick,
      elapsedMs,
      score,
      level,
      xp,
      litecoin: state.collectibles[index(C.collectibles, 'litecoin-token', 'collectible effect')][0],
      currentCombo,
      maxCombo,
      damageDealt: state.totals[0],
      damageTaken: state.totals[1],
      healing: state.totals[2],
      distanceMilli,
    },
    kills: {
      total: state.enemyKills.reduce((sum, value) => sum + value, 0),
      byEnemyRole,
      byWeapon,
      elite: state.eliteKills ?? 0,
      boss: state.bossKills ?? 0,
    },
    weapons,
    grenades: Object.fromEntries(['thrown', 'detonated', 'contacts', 'kills', 'selfDamage', 'overflows'].map((field, i) => [field, state.grenades[i]])),
    collectibles: C.collectibles.map((effectId, i) => ({ effectId, collected: state.collectibles[i][0], activeTicks: state.collectibles[i][1] })),
    upgrades: C.upgrades.map((upgradeId, i) => ({ upgradeId, offered: state.upgrades[i][0], selected: state.upgrades[i][1] })),
    exploration: {
      visitedDistrictMask: state.exploration[0],
      discoveredPoiMask: state.exploration[1],
      revealedCells,
      totalCells,
      revealedPermille: totalCells === 0 ? 0 : Math.round(revealedCells * 1000 / totalCells),
      distanceMilli,
    },
  };
  return freezeDeep(summary);
}

export function runSummaryMatchesResult(summary, result) {
  return summary?.identity?.terminalReason === 'defeated'
    && summary?.totals?.score === result?.score
    && summary?.kills?.total === result?.kills
    && Math.abs(summary?.totals?.elapsedMs - result?.elapsedMs) <= 0.001;
}
