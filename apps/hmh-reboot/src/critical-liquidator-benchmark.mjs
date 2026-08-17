import { resolveCombatHits } from './combat-events.mjs';
import {
  LIQUIDATOR_TARGET_FIGHT_TICKS,
  applyLiquidatorDamage,
  createLiquidatorAddCandidates,
  createLiquidatorBoss,
  getLiquidatorPunishWindow,
  getLiquidatorRoleCheck,
  stepLiquidatorBoss,
} from './liquidator-boss.mjs';
import {
  createRunProgression,
  grantRunXp,
  selectRunUpgrade,
} from './run-progression.mjs';
import { freezeDeep } from './value-guards.mjs';
import { createWeaponLoadout, stepWeaponLoadout } from './weapon-system.mjs';

export const BASE_CRITICAL_CHANCE = 0.08;
export const BASE_CRITICAL_MULTIPLIER = 1.75;
export const CRITICAL_CHANCE_CAP = 0.45;
export const FIRST_LEVEL_XP = 300;
export const CRITICAL_LIQUIDATOR_BUILD_IDS = freezeDeep(['mobility-control', 'precision-ledger']);

const PLAYER = freezeDeep({ x: 200, y: 0, groundZ: 0 });
const BUILD_SELECTIONS = freezeDeep({
  'mobility-control': 'gas-optimization',
  'precision-ledger': 'precision-ledger',
});

function nonNegativeInteger(value, name) {
  if (!Number.isInteger(value) || value < 0) throw new TypeError(`${name} must be a non-negative integer`);
  return value;
}

function roundDamage(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function buildProgression(buildId, seed) {
  const state = createRunProgression({ seed, ownedWeaponIds: ['coin-blaster'] });
  const offer = grantRunXp(state, FIRST_LEVEL_XP, 0);
  const offeredUpgradeIds = offer.pendingChoices.map((choice) => choice.id);
  const selectedUpgradeId = BUILD_SELECTIONS[buildId];
  if (!offeredUpgradeIds.includes(selectedUpgradeId)) {
    throw new Error(
      `seed ${seed} does not produce the canonical first-level offer for ${buildId}: ${offeredUpgradeIds.join(', ')}`,
    );
  }
  const selection = selectRunUpgrade(state, selectedUpgradeId);
  return freezeDeep({
    offeredUpgradeIds,
    selectedUpgradeId,
    selectedRank: selection.selected.rank,
    effects: selection.effects,
  });
}

function closePhase(phases, phaseId, exitTick, damage) {
  const open = phases.find((phase) => phase.id === phaseId && phase.exitTick === null);
  if (!open) return;
  open.exitTick = exitTick;
  open.damage = roundDamage(damage);
}

/**
 * Read-only certification seam. It composes the canonical first-level draft,
 * weapon cadence/reload state, combat critical resolver, Liquidator role and
 * punish multipliers, and boss damage authority without becoming a runtime
 * import or a second combat engine.
 */
export function runCriticalLiquidatorBenchmark({
  buildId,
  seed = 1337,
  partition = 1,
  durationTicks = LIQUIDATOR_TARGET_FIGHT_TICKS,
} = {}) {
  if (!Object.hasOwn(BUILD_SELECTIONS, buildId)) {
    throw new TypeError(`unknown critical Liquidator build ${String(buildId)}`);
  }
  nonNegativeInteger(seed, 'seed');
  if (![1, 2, 3, 4].includes(partition)) throw new TypeError('partition must be 1, 2, 3, or 4');
  if (!Number.isInteger(durationTicks) || durationTicks <= 0 || durationTicks > LIQUIDATOR_TARGET_FIGHT_TICKS) {
    throw new TypeError(`durationTicks must be an integer from 1 to ${LIQUIDATOR_TARGET_FIGHT_TICKS}`);
  }

  const progression = buildProgression(buildId, seed);
  const criticalChance = Math.min(
    CRITICAL_CHANCE_CAP,
    BASE_CRITICAL_CHANCE + progression.effects.criticalChanceBonus,
  );
  const criticalMultiplier = BASE_CRITICAL_MULTIPLIER + progression.effects.criticalDamageBonus;
  const boss = createLiquidatorBoss({ id: 'critical-benchmark-liquidator', x: 0, y: 0 });
  const loadout = createWeaponLoadout({ weaponIds: ['coin-blaster'], seed });
  const activeAddIds = [];
  const phases = [];
  const perPhaseDamage = {
    'market-open': 0,
    'margin-call': 0,
    'total-liquidation': 0,
  };

  let accumulator = 0;
  let tick = 0;
  let currentPhaseId = null;
  let lastBossResolvedAttack = null;
  let shotsFired = 0;
  let contactHits = 0;
  let criticalHits = 0;
  let reloadStarts = 0;
  let reloadCompletes = 0;
  let totalDamage = 0;
  let punishContacts = 0;
  let punishDamage = 0;
  let addCount = 0;

  while (tick < durationTicks && !boss.defeated) {
    accumulator += partition;
    while (accumulator >= 1 && tick < durationTicks && !boss.defeated) {
      tick += 1;
      const bossFrame = stepLiquidatorBoss({ boss, tick, player: PLAYER });
      if (bossFrame.phaseId !== currentPhaseId) {
        if (currentPhaseId) closePhase(phases, currentPhaseId, tick - 1, perPhaseDamage[currentPhaseId]);
        currentPhaseId = bossFrame.phaseId;
        phases.push({ id: currentPhaseId, entryTick: tick, exitTick: null, damage: 0 });
      }
      for (const event of bossFrame.events) {
        if (event.type === 'attack') lastBossResolvedAttack = { attackId: event.attackId, tick };
        if (event.type === 'add-wave') {
          const candidates = createLiquidatorAddCandidates({ event, activeAddIds });
          for (const candidate of candidates) activeAddIds.push(candidate.id);
          addCount += candidates.length;
        }
      }
      const punish = lastBossResolvedAttack
        ? getLiquidatorPunishWindow({
          phaseId: boss.phaseId,
          attackId: lastBossResolvedAttack.attackId,
          ticksSinceResolve: tick - lastBossResolvedAttack.tick,
        })
        : freezeDeep({ active: false, multiplier: 1, windowId: null });
      const roleCheck = getLiquidatorRoleCheck({
        weaponId: 'coin-blaster',
        distance: Math.hypot(PLAYER.x - boss.x, PLAYER.y - boss.y),
        chainTargets: 0,
        hazardOverlap: false,
        targetKind: 'boss',
      });

      const weaponFrame = stepWeaponLoadout(loadout, {
        tick,
        fire: true,
        direction: { x: -1, y: 0 },
      });
      for (const event of weaponFrame.events) {
        if (event.type === 'weapon:reload-start') reloadStarts += 1;
        if (event.type === 'weapon:reload-complete') reloadCompletes += 1;
        if (event.type !== 'weapon:fire') continue;
        shotsFired += event.shots.length;
        const hits = event.shots.map((shot) => ({
          id: `${shot.id}:boss-contact`,
          targetId: boss.id,
          sourceId: 'critical-benchmark-player',
          weaponId: shot.weaponId,
          tick,
          time: 0,
          damage: shot.damage * roleCheck.multiplier * punish.multiplier,
          criticalChance,
          criticalMultiplier,
          direction: shot.direction,
          knockback: 0,
          point: { x: boss.x, y: boss.y, z: 0 },
        }));
        const resolved = resolveCombatHits({
          sessionSeed: seed,
          hits,
          targets: [{
            id: boss.id,
            health: boss.health,
            maxHealth: boss.maxHealth,
            armor: 1,
            shieldCharges: 0,
            knockbackResistance: 1,
          }],
        });
        for (const damageEvent of resolved.damageEvents) {
          contactHits += 1;
          if (damageEvent.critical) criticalHits += 1;
          const applied = applyLiquidatorDamage({ boss, amount: damageEvent.damageApplied, tick });
          totalDamage += applied.damageApplied;
          perPhaseDamage[currentPhaseId] += applied.damageApplied;
          if (punish.active && applied.damageApplied > 0) {
            punishContacts += 1;
            punishDamage += applied.damageApplied;
          }
        }
      }
      accumulator -= 1;
    }
  }

  if (currentPhaseId) closePhase(phases, currentPhaseId, tick, perPhaseDamage[currentPhaseId]);
  const roundedTotalDamage = roundDamage(totalDamage);
  const roundedRemainingHealth = roundDamage(boss.health);
  return freezeDeep({
    buildId,
    seed,
    partition,
    durationTicks,
    weaponId: 'coin-blaster',
    offeredUpgradeIds: progression.offeredUpgradeIds,
    selectedUpgradeId: progression.selectedUpgradeId,
    selectedRank: progression.selectedRank,
    criticalChance,
    criticalMultiplier,
    roleMultiplier: getLiquidatorRoleCheck({
      weaponId: 'coin-blaster',
      distance: PLAYER.x,
      chainTargets: 0,
      hazardOverlap: false,
      targetKind: 'boss',
    }).multiplier,
    shotsFired,
    contactHits,
    criticalHits,
    reloadStarts,
    reloadCompletes,
    totalDamage: roundedTotalDamage,
    punishContacts,
    punishDamage: roundDamage(punishDamage),
    addCount,
    perPhaseDamage,
    phases,
    defeated: boss.defeated,
    defeatTick: boss.defeated ? tick : null,
    remainingHealth: roundedRemainingHealth,
  });
}
