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
    weapons: rows(C.weapons, 24),
    weaponAttacks: new Map(),
    grenades: Array(6).fill(0),
    collectibles: rows(C.collectibles, 2),
    upgrades: rows(C.upgrades, 2),
    lightningLedger: Array(10).fill(0),
    lightningLedgerInterruptions: Array(7).fill(0),
    lightningLedgerChannelStartTick: null,
    bearMarketBurner: Array(8).fill(0),
    forkedStandard: Array(7).fill(0),
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

export function recordRunWeaponFire(state, { weaponId, emitted, attackId } = {}) {
  const weaponIndex = index(C.weapons, weaponId, 'weapon');
  const row = state.weapons[weaponIndex];
  row[2] += 1;
  row[4] += count(emitted, 'emitted projectiles');
  if (weaponId === 'hash-rail') {
    row[16] += 1;
    if (typeof attackId === 'string' && attackId) state.weaponAttacks.set(attackId, { weaponIndex, contacts: 0, bossHits: 0 });
  }
}

export function recordRunWeaponTriggerContact(state, { weaponId } = {}) {
  state.weapons[index(C.weapons, weaponId, 'weapon')][3] += 1;
}

export function recordRunProjectileContacts(state, { weaponId, count: contacts = 1 } = {}) {
  state.weapons[index(C.weapons, weaponId, 'weapon')][5] += count(contacts, 'projectile contacts');
}

export function recordRunProjectileResolution(state, shot, hits) {
  const attack = state.weaponAttacks.get(shot.attackId);
  if (attack) {
    attack.contacts += hits.length;
    attack.bossHits += hits.reduce((total, hit) => total + Number(hit.targetId === 'boss-liquidator'), 0);
  }
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
  } else if (event.type === 'weapon:charge-start') state.weapons[index(C.weapons, event.weaponId, 'weapon')][14] += 1;
  else if (event.type === 'weapon:charge-cancel') {
    const row = state.weapons[index(C.weapons, event.weaponId, 'weapon')];
    row[15] += 1;
    row[17] += count(event.chargeTicks, 'cancelled charge ticks');
  }
}

export function recordRunLightningLedgerEvent(state, event = {}) {
  if (!state || !Array.isArray(state.lightningLedger) || state.finalized) throw new TypeError('active run summary state is required');
  const tick = count(event.tick, 'Lightning Ledger event tick');
  const metrics = state.lightningLedger;
  if (event.type === 'ledger:channel-start') {
    if (state.lightningLedgerChannelStartTick !== null) throw new Error('Lightning Ledger channel is already active');
    state.lightningLedgerChannelStartTick = tick;
    return;
  }
  if (event.type === 'ledger:pulse') return state;
  if (event.type === 'weapon:channel-pulse') {
    if (!Array.isArray(event.hits) || event.hits.length > 8) throw new TypeError('Lightning Ledger pulse hits must be bounded to eight');
    const rampPermille = count(event.rampPermille, 'Lightning Ledger ramp');
    const proofDamagePermille = count(event.proofDamagePermille ?? 1000, 'Lightning Ledger proof damage');
    metrics[0] += 1;
    metrics[1] += event.hits.length;
    metrics[2] = Math.max(metrics[2], event.hits.length);
    metrics[3] = Math.max(metrics[3], rampPermille);
    if (event.hits.length === 8) metrics[7] += 1;
    if (proofDamagePermille > 1000) metrics[9] += 1;
    return;
  }
  if (event.type === 'ledger:cell-drain') {
    metrics[5] += count(event.consumed, 'Lightning Ledger cells consumed');
    return;
  }
  if (event.type === 'ledger:cell-refund') {
    metrics[6] += 1;
    return;
  }
  if (event.type === 'ledger:channel-break' || event.type === 'ledger:overheat') {
    if (state.lightningLedgerChannelStartTick !== null) {
      if (tick < state.lightningLedgerChannelStartTick) throw new TypeError('Lightning Ledger interruption precedes channel start');
      metrics[4] += tick - state.lightningLedgerChannelStartTick;
      state.lightningLedgerChannelStartTick = null;
    }
    const reason = event.type === 'ledger:overheat' ? 'overheat' : event.reason;
    const interruptionIndex = { release: 0, switch: 1, dodge: 2, empty: 3, overheat: 4, 'invalid-target': 5 }[reason] ?? 6;
    state.lightningLedgerInterruptions[interruptionIndex] += 1;
    if (reason === 'overheat') metrics[8] += 1;
    return;
  }
  throw new TypeError(`unknown Lightning Ledger event ${String(event.type)}`);
}

export function recordRunBearMarketBurnerEvent(state, event = {}) {
  if (!state || !Array.isArray(state.bearMarketBurner) || state.finalized) throw new TypeError('active run summary state is required');
  count(event.tick, 'Bear Market Burner event tick');
  const metrics = state.bearMarketBurner;
  if (event.type === 'weapon:flame-pulse') {
    if (!Array.isArray(event.hits) || event.hits.length > 12) throw new TypeError('Burner pulse hits must be bounded to twelve');
    metrics[0] += 1;
    metrics[1] += event.hits.length;
    if ((event.pressurePermille ?? 1000) > 1000) metrics[6] += 1;
    return;
  }
  if (event.type === 'burner:pulse') {
    metrics[5] = Math.max(metrics[5], count(event.activeBurns ?? 0, 'active burns'));
    return;
  }
  if (event.type === 'burner:fuel') { metrics[2] += count(event.consumed, 'fuel consumed'); return; }
  if (event.type === 'burner:burn-tick') { metrics[3] += 1; return; }
  if (event.type === 'burner:scorch-created') { metrics[4] += 1; return; }
  if (event.type === 'burner:total-selloff') { return; }
  if (event.type === 'burner:emergency-refill') { metrics[7] += 1; return; }
  if (['burner:empty', 'burner:burn-expired'].includes(event.type)) return;
  throw new TypeError(`unknown Bear Market Burner event ${String(event.type)}`);
}

export function recordRunForkedStandardEvent(state, event = {}) {
  if (!state || !Array.isArray(state.forkedStandard) || state.finalized) throw new TypeError('active run summary state is required');
  count(event.tick, 'Forked Standard event tick');
  if (event.type === 'standard:strike') return state;
  if (event.type !== 'weapon:melee-strike') throw new TypeError(`unknown Forked Standard event ${String(event.type)}`);
  if (!Array.isArray(event.hits) || event.hits.length > 6) throw new TypeError('Forked Standard hits must be bounded to six');
  if (!['thrust', 'sweep'].includes(event.form)) throw new TypeError('Forked Standard form is invalid');
  if (typeof event.whiff !== 'boolean' || typeof event.capstone !== 'boolean') throw new TypeError('Forked Standard flags are invalid');
  if (event.whiff && event.hits.length > 0) throw new TypeError('Forked Standard whiff cannot contain hits');
  const metrics = state.forkedStandard;
  metrics[0] += 1;
  metrics[1] += event.hits.length;
  metrics[2] += Number(event.whiff);
  metrics[event.form === 'thrust' ? 3 : 4] += 1;
  metrics[5] += Number(event.capstone);
  metrics[6] += count(event.droppedContacts ?? 0, 'Forked Standard dropped contacts');
  return state;
}

export function recordRunDamage(state, event = {}) {
  const amount = finite(event.damageApplied, 'damageApplied');
  if (event.targetId === 'player') {
    state.totals[1] += amount;
    if (event.equippedWeaponId) state.weapons[index(C.weapons, event.equippedWeaponId, 'equipped weapon')][23] += amount;
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
  if (state.lightningLedgerChannelStartTick !== null) {
    if (endTick < state.lightningLedgerChannelStartTick) throw new TypeError('endTick precedes active Lightning Ledger channel');
    state.lightningLedger[4] += endTick - state.lightningLedgerChannelStartTick;
    state.lightningLedgerChannelStartTick = null;
  }
  state.finalized = true;
  for (const attack of state.weaponAttacks.values()) {
    const row = state.weapons[attack.weaponIndex];
    row[18 + Math.min(3, attack.contacts)] += 1;
    row[22] += attack.bossHits;
  }
  const distanceMilli = Math.round(state.exploration[2] * 1000);
  const byEnemyRole = C.enemyRoles.map((enemyRoleId, i) => ({ enemyRoleId, count: state.enemyKills[i] }));
  const byWeapon = C.weapons.map((weaponId, i) => ({ weaponId, count: state.weapons[i][11] }));
  const weaponFields = ['pickups', 'swaps', 'triggers', 'triggerContacts', 'projectilesEmitted', 'projectileContacts', 'reloadStarts', 'reloadCompletes', 'emptyAttempts', 'equippedTicks', 'damage', 'kills', 'criticalHits', 'overkill', 'chargesStarted', 'chargesCancelled', 'chargedShots', 'cancelledChargeTicks', 'zeroHitShots', 'oneHitShots', 'twoHitShots', 'threePlusHitShots', 'bossHits', 'damageTakenWhileEquipped'];
  const weapons = C.weapons.map((weaponId, i) => Object.fromEntries([['weaponId', weaponId], ...weaponFields.map((field, metric) => [field, state.weapons[i][metric]])]));
  const summary = {
    schemaVersion: 5,
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
    lightningLedger: {
      pulses: state.lightningLedger[0],
      chainedHits: state.lightningLedger[1],
      longestChain: state.lightningLedger[2],
      maxRampPermille: state.lightningLedger[3],
      heldTicks: state.lightningLedger[4],
      secondsHeld: Number((state.lightningLedger[4] / 60).toFixed(3)),
      cellsSpent: state.lightningLedger[5],
      cellsRefunded: state.lightningLedger[6],
      fullChains: state.lightningLedger[7],
      overheats: state.lightningLedger[8],
      capstonePulses: state.lightningLedger[9],
      interruptions: Object.fromEntries(['release', 'switch', 'dodge', 'empty', 'overheat', 'invalidTarget', 'other'].map((reason, i) => [reason, state.lightningLedgerInterruptions[i]])),
    },
    bearMarketBurner: {
      pulses: state.bearMarketBurner[0],
      contacts: state.bearMarketBurner[1],
      fuelSpent: state.bearMarketBurner[2],
      burnTicks: state.bearMarketBurner[3],
      scorchZonesCreated: state.bearMarketBurner[4],
      maxActiveBurns: state.bearMarketBurner[5],
      totalSelloffPulses: state.bearMarketBurner[6],
      emergencyRefills: state.bearMarketBurner[7],
    },
    forkedStandard: {
      attacks: state.forkedStandard[0],
      contacts: state.forkedStandard[1],
      whiffs: state.forkedStandard[2],
      thrusts: state.forkedStandard[3],
      sweeps: state.forkedStandard[4],
      capstoneAttacks: state.forkedStandard[5],
      droppedContacts: state.forkedStandard[6],
    },
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
