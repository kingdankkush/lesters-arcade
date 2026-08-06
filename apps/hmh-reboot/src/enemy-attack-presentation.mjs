export function projectGasBomberCanister({ enemy, tick } = {}) {
  const target = enemy?.telegraphTarget;
  const start = enemy?.attackTellStartedTick;
  const end = enemy?.attackPhaseUntilTick;
  if (enemy?.archetypeId !== 'gas-bomber' || enemy.attackPhase !== 'tell' || !target
    || ![tick, start, end, enemy.x, enemy.y, enemy.groundZ, target.x, target.y, target.groundZ].every(Number.isFinite)
    || end <= start) return null;
  const progress = Math.max(0, Math.min(1, (tick - start) / (end - start)));
  return Object.freeze({
    x: enemy.x + (target.x - enemy.x) * progress,
    y: enemy.y + (target.y - enemy.y) * progress,
    z: enemy.groundZ + (target.groundZ - enemy.groundZ) * progress + 28 + Math.sin(progress * Math.PI) * 72,
    rotation: progress * Math.PI * 4,
    progress,
  });
}
