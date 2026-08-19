import { resolveCombatHits } from './combat-events.mjs';
import {
  applyLiquidatorDamage,
  createLiquidatorAddCandidates,
  createLiquidatorBoss,
  getLiquidatorPunishWindow,
  getLiquidatorRoleCheck,
  LIQUIDATOR_TARGET_FIGHT_TICKS,
  stepLiquidatorBoss,
} from './liquidator-boss.mjs';
import {
  createRunProgression,
  getRunProgressionSnapshot,
  grantRunXp,
  selectRunUpgrade,
} from './run-progression.mjs';
import { freezeDeep } from './value-guards.mjs';

export const CANONICAL_CRIT_UPGRADE_ID = 'precision-ledger';
export const FIRST_LEVEL_XP = 300;
export const ORDINARY_PISTOL_DAMAGE = 4;
export const ORDINARY_PISTOL_DISTANCE = 200;
// Must stay aligned with the live hit site in main.mjs.
export const BASE_CRITICAL_CHANCE = 0.08;
export const BASE_CRITICAL_MULTIPLIER = 1.75;
export const CRITICAL_CHANCE_CAP = 0.45;

function nonNegativeInteger(value, name) {
  if (!Number.isInteger(value) || value < 0) throw new TypeError(`${name} must be a non-negative integer`);
  return value;
}

function resolveCriticalStats(effects) {
  return {
    criticalChance: Math.min(CRITICAL_CHANCE_CAP, BASE_CRITICAL_CHANCE + (effects?.criticalChanceBonus ?? 0)),
    criticalMultiplier: BASE_CRITICAL_MULTIPLIER + (effects?.criticalDamageBonus ?? 0),
  };
}

export function offerAndSelectCanonicalCritUpgrade({ seed = 0 } = {}) {
  nonNegativeInteger(seed, 'seed');
  const state = createRunProgression({ seed, ownedWeaponIds: ['coin-blaster'] });
  grantRunXp(state, FIRST_LEVEL_XP, 0);
  const offered = getRunProgressionSnapshot(state).pendingChoices;
  const offeredIds = offered.map((choice) => choice.id);
  if (!offeredIds.includes(CANONICAL_CRIT_UPGRADE_ID)) {
    throw new Error(`${CANONICAL_CRIT_UPGRADE_ID} is not currently offered`);
  }
  const selected = selectRunUpgrade(state, CANONICAL_CRIT_UPGRADE_ID);
  return freezeDeep({
    ...selected,
    offeredIds,
  });
}

function closePhase(phases, phaseId, exitTick, damage) {
  const open = phases.find((phase) => phase.id === phaseId && phase.exitTick === null);
  if (!open) return;
  open.exitTick = exitTick;
  open.damage = damage;
}

export function runLiquidatorUpgradeBenchmark({
  mode = 'ordinary',
  seed = 1337,
  partition = 1,
  startTick = 0,
} = {}) {
  if (mode !== 'ordinary' && mode !== 'precision-ledger') {
    throw new TypeError('mode must be ordinary or precision-ledger');
  }
  nonNegativeInteger(seed, 'seed');
  if (partition !== 1 && partition !== 4) throw new TypeError('partition must be 1 or 4');
  nonNegativeInteger(startTick, 'startTick');

  let upgradeId = null;
  let offeredIds = [];
  let selectedRank = 0;
  let effects = freezeDeep({ criticalChanceBonus: 0, criticalDamageBonus: 0 });
  if (mode === 'precision-ledger') {
    const selected = offerAndSelectCanonicalCritUpgrade({ seed });
    upgradeId = selected.selected.id;
    selectedRank = selected.selected.rank;
    effects = selected.effects;
    offeredIds = selected.offeredIds;
  }

  const { criticalChance, criticalMultiplier } = resolveCriticalStats(effects);
  const boss = createLiquidatorBoss({ id: 'upgrade-benchmark-liquidator', x: 0, y: 0, startTick });
  const player = { x: ORDINARY_PISTOL_DISTANCE, y: 0, groundZ: 0 };
  const phases = [];
  const perPhaseDamage = {
    'market-open': 0,
    'margin-call': 0,
    'total-liquidation': 0,
  };
  let currentPhaseId = null;
  let lastResolvedAttack = null;
  let punishContacts = 0;
  let addCount = 0;
  let criticalHits = 0;
  let ordinaryHits = 0;
  const activeAddIds = [];
  let accumulator = 0;
  let lastTick = startTick;

  for (let frame = 0; !boss.defeated && boss.elapsedTick < LIQUIDATOR_TARGET_FIGHT_TICKS; frame += 1) {
    accumulator += partition;
    while (accumulator >= 1 && !boss.defeated && boss.elapsedTick < LIQUIDATOR_TARGET_FIGHT_TICKS) {
      const tick = boss.startTick + boss.elapsedTick + 1;
      lastTick = tick;
      const report = stepLiquidatorBoss({ boss, tick, player });
      if (report.phaseId !== currentPhaseId) {
        if (currentPhaseId) closePhase(phases, currentPhaseId, tick - 1, perPhaseDamage[currentPhaseId]);
        currentPhaseId = report.phaseId;
        phases.push({
          id: currentPhaseId,
          entryTick: tick,
          exitTick: null,
          damage: 0,
        });
      }

      for (const event of report.events) {
        if (event.type === 'attack' || event.type === 'add-wave') {
          lastResolvedAttack = { attackId: event.attackId, tick };
        }
        if (event.type === 'add-wave') {
          const candidates = createLiquidatorAddCandidates({ event, activeAddIds });
          for (const candidate of candidates) activeAddIds.push(candidate.id);
          addCount += candidates.length;
        }
      }

      const punish = lastResolvedAttack
        ? getLiquidatorPunishWindow({
          phaseId: boss.phaseId,
          attackId: lastResolvedAttack.attackId,
          ticksSinceResolve: tick - lastResolvedAttack.tick,
        })
        : { active: false, multiplier: 1, windowId: null };

      const roleCheck = getLiquidatorRoleCheck({
        weaponId: 'coin-blaster',
        distance: ORDINARY_PISTOL_DISTANCE,
        hazardOverlap: false,
        chainTargets: 0,
        targetKind: 'boss',
      });

      const hitDamage = ORDINARY_PISTOL_DAMAGE * roleCheck.multiplier * punish.multiplier;
      const resolution = resolveCombatHits({
        sessionSeed: seed,
        hits: [{
          id: `upgrade-hit:${tick}`,
          tick,
          time: 0,
          targetId: boss.id,
          sourceId: 'player',
          weaponId: 'coin-blaster',
          damage: hitDamage,
          criticalChance,
          criticalMultiplier,
          direction: { x: -1, y: 0 },
          knockback: 8,
          point: { x: boss.x, y: boss.y, z: 0 },
        }],
        targets: [{
          id: boss.id,
          health: boss.health,
          maxHealth: boss.maxHealth,
          armor: 1,
          shieldCharges: 0,
          knockbackResistance: 0.92,
        }],
      });
      const damageEvent = resolution.damageEvents[0];
      if (damageEvent) {
        if (damageEvent.critical) criticalHits += 1;
        else ordinaryHits += 1;
        const result = applyLiquidatorDamage({ boss, amount: damageEvent.damageApplied, tick });
        perPhaseDamage[currentPhaseId] = Math.round((perPhaseDamage[currentPhaseId] + result.damageApplied) * 1_000_000) / 1_000_000;
        if (punish.active && result.damageApplied > 0) punishContacts += 1;
      }

      accumulator -= 1;
    }
  }

  if (currentPhaseId) closePhase(phases, currentPhaseId, lastTick, perPhaseDamage[currentPhaseId]);

  return freezeDeep({
    mode,
    seed,
    partition,
    weaponId: 'coin-blaster',
    upgradeId,
    offeredIds,
    selectedRank,
    criticalChance,
    criticalMultiplier,
    roleMultiplier: getLiquidatorRoleCheck({
      weaponId: 'coin-blaster',
      distance: ORDINARY_PISTOL_DISTANCE,
      hazardOverlap: false,
      chainTargets: 0,
      targetKind: 'boss',
    }).multiplier,
    defeated: boss.defeated,
    defeatTick: boss.defeated ? lastTick : null,
    remainingHealth: Math.round(boss.health * 1_000_000) / 1_000_000,
    criticalHits,
    ordinaryHits,
    punishContacts,
    addCount,
    perPhaseDamage,
    phases,
    bossX: boss.x,
    bossY: boss.y,
  });
}
