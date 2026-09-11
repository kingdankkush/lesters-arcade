import { feedbackUnit } from './deterministic-hash.mjs';
import { LIQUIDATOR_ATTACK_DEFINITIONS } from './liquidator-boss.mjs';

// Cosmetic clocks never advance the simulation or consume its random stream.
export function creatureAnimationTick(id, tick, state, startedAt = tick) {
  if (state === 'hit' || state === 'death') return Math.max(0, tick - startedAt);
  return tick + (state === 'run' || state === 'idle' ? Math.floor(feedbackUnit(String(id)) * 120) : 0);
}

export function liquidatorPose({boss, player, tick, lastAttack, hitUntil, deathUntil}) {
  const pending = boss.pendingAttacks[0];
  const target = pending?.target ?? player;
  const direction = (Math.round(Math.atan2(target.y - boss.y, target.x - boss.x) / (Math.PI / 4)) + 8) % 8;
  let state = 'idle', phaseTick = null, poseTick = tick;
  if (!boss.active) { state = 'death'; poseTick = Math.max(0, tick - (deathUntil - 45)); }
  else if (tick <= hitUntil) { state = 'hit'; poseTick = Math.max(0, tick - (hitUntil - 6)); }
  else if (pending) {
    state = 'tell';
    phaseTick = Math.max(0, tick - pending.resolveTick + (LIQUIDATOR_ATTACK_DEFINITIONS[pending.attackId]?.tellTicks ?? 0));
  } else if (lastAttack && tick >= lastAttack.tick && tick - lastAttack.tick < 30) {
    state = 'attack'; phaseTick = tick - lastAttack.tick;
  }
  return {state, tick: poseTick, phaseTick, direction, phase: boss.phaseId, elite: true};
}
