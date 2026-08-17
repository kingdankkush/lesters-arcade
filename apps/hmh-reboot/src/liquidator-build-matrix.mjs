import { freezeDeep } from './value-guards.mjs';
import {
  LIQUIDATOR_TARGET_FIGHT_TICKS,
  applyLiquidatorDamage,
  createLiquidatorAddCandidates,
  createLiquidatorBoss,
  getLiquidatorPunishWindow,
  getLiquidatorRoleCheck,
  stepLiquidatorBoss,
} from './liquidator-boss.mjs';

function nonNegativeInteger(value, name) {
  if (!Number.isInteger(value) || value < 0) throw new TypeError(`${name} must be a non-negative integer`);
  return value;
}

export const LIQUIDATOR_BUILD_PROFILES = freezeDeep({
  'no-hit': {
    weaponId: 'coin-blaster',
    damagePerTick: 0,
    distance: 200,
    hazardOverlap: false,
    chainTargets: 0,
    targetKind: 'boss',
  },
  baseline: {
    weaponId: 'coin-blaster',
    damagePerTick: 4,
    distance: 200,
    hazardOverlap: false,
    chainTargets: 0,
    targetKind: 'boss',
  },
  'high-dps': {
    weaponId: 'hash-rail',
    damagePerTick: 20,
    distance: 480,
    hazardOverlap: false,
    chainTargets: 0,
    targetKind: 'boss',
  },
  'low-dps': {
    weaponId: 'coin-blaster',
    damagePerTick: 2,
    distance: 200,
    hazardOverlap: false,
    chainTargets: 0,
    targetKind: 'boss',
  },
  'melee-heavy': {
    weaponId: 'forked-standard',
    damagePerTick: 4,
    distance: 80,
    hazardOverlap: false,
    chainTargets: 0,
    targetKind: 'boss',
  },
  'crowd-control': {
    weaponId: 'lightning-ledger',
    damagePerTick: 2,
    distance: 200,
    hazardOverlap: false,
    chainTargets: 0,
    targetKind: 'boss',
  },
});

function closePhase(phases, phaseId, exitTick, damage) {
  const open = phases.find((phase) => phase.id === phaseId && phase.exitTick === null);
  if (!open) return;
  open.exitTick = exitTick;
  open.damage = damage;
}

export function runLiquidatorBuildMatrix({
  buildId,
  seed = 1337,
  partition = 1,
  startTick = 0,
} = {}) {
  const profile = LIQUIDATOR_BUILD_PROFILES[buildId];
  if (!profile) throw new TypeError(`unknown liquidator build ${buildId}`);
  nonNegativeInteger(seed, 'seed');
  if (partition !== 1 && partition !== 4) throw new TypeError('partition must be 1 or 4');
  nonNegativeInteger(startTick, 'startTick');

  const boss = createLiquidatorBoss({ id: 'build-matrix-liquidator', x: 0, y: 0, startTick });
  const player = { x: profile.distance, y: 0, groundZ: 0 };
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
  let addRoleContacts = 0;
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
        weaponId: profile.weaponId,
        distance: profile.distance,
        hazardOverlap: profile.hazardOverlap,
        chainTargets: profile.chainTargets,
        targetKind: profile.targetKind,
      });
      const addRoleCheck = getLiquidatorRoleCheck({
        weaponId: profile.weaponId,
        distance: profile.distance,
        hazardOverlap: profile.hazardOverlap,
        chainTargets: activeAddIds.length,
        targetKind: 'add',
      });
      if (addRoleCheck.applied) addRoleContacts += 1;

      if (profile.damagePerTick > 0) {
        const amount = Math.round(profile.damagePerTick * roleCheck.multiplier * punish.multiplier * 1_000_000) / 1_000_000;
        const result = applyLiquidatorDamage({ boss, amount, tick });
        perPhaseDamage[currentPhaseId] = Math.round((perPhaseDamage[currentPhaseId] + result.damageApplied) * 1_000_000) / 1_000_000;
        if (punish.active && result.damageApplied > 0) punishContacts += 1;
      }

      accumulator -= 1;
    }
  }

  if (currentPhaseId) closePhase(phases, currentPhaseId, lastTick, perPhaseDamage[currentPhaseId]);

  return freezeDeep({
    buildId,
    seed,
    partition,
    weaponId: profile.weaponId,
    roleMultiplier: getLiquidatorRoleCheck({
      weaponId: profile.weaponId,
      distance: profile.distance,
      hazardOverlap: profile.hazardOverlap,
      chainTargets: profile.chainTargets,
      targetKind: profile.targetKind,
    }).multiplier,
    defeated: boss.defeated,
    defeatTick: boss.defeated ? lastTick : null,
    remainingHealth: Math.round(boss.health * 1_000_000) / 1_000_000,
    punishContacts,
    addCount,
    addRoleContacts,
    perPhaseDamage,
    phases,
  });
}
