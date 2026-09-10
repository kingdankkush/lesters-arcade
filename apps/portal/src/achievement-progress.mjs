// Read-only presentation of parent-local achievement records, not mint authority.
// Only compatible single-threshold rules use aggregates. A compound rule cannot
// be reconstructed from independent best runs or a bounded summary cache.
const METRICS = Object.freeze({
  score: ['bestPaidScore', 'best Ranked score'],
  paidRuns: ['totalPaidRuns', 'completed Ranked runs (all games)'],
  elapsedSeconds: ['longestRunSeconds', 'best survival seconds'],
  cumulativeKills: ['totalKills', 'total kills'],
  cumulativeGrenadeKills: ['grenadeKills', 'total grenade kills'],
  cumulativeMeleeKills: ['meleeKills', 'total melee kills'],
  cumulativePowerUps: ['cumulativePowerUps', 'total pickups'],
  cumulativeSeconds: ['cumulativeSeconds', 'total survival seconds'],
  maxCombo: ['maxCombo', 'best combo'],
  maxDamageCombo: ['maxDamageCombo', 'best damage combo'],
  cumulativeBossKills: ['bossKills', 'total boss kills'],
  perfectBossKills: ['perfectBossKills', 'perfect boss kills'],
});

export function normalizeAchievementUnlockDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value ? value : null;
}

export function buildAchievementProgress(achievement, profile) {
  const requirements = Object.entries(achievement.requirement ?? {});
  if (requirements.length !== 1) return { status: 'unavailable' };
  const [key, target] = requirements[0];
  const metric = Object.hasOwn(METRICS, key) ? METRICS[key] : null;
  const source = key === 'paidRuns' ? profile : profile.progress?.['lester-blaster'];
  const value = metric ? source?.[metric[0]] : undefined;
  if (!metric || typeof target !== 'number' || !Number.isFinite(target) || target <= 0
    || typeof value !== 'number' || !Number.isFinite(value) || value < 0) return { status: 'unavailable' };
  return { status: 'measured', value, target, fraction: Math.min(1, value / target), unit: metric[1] };
}
