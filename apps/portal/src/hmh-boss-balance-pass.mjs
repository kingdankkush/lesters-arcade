import {
  HMH_LEVEL_ONE_BOSS_BEAT_SCHEDULE,
  HMH_LEVEL_ONE_BOSS_ROSTER,
  LESTER_BLASTER_ENEMY_CATALOG,
} from './arcade-core.mjs';
import {
  LEVEL_ONE_BOSS_PHASE_COMBAT,
  MINI_BOSS_ENRAGE_HP_PCT,
  MINI_BOSS_PHASE_COMBAT,
  miniBossPlanForPoi,
} from './hmh-level-one-boss.mjs';
import { buildLevelOneBossChoreographyPlan } from './hmh-level-one-balance-pass.mjs';
import { buildEnemyBalanceCard } from './hmh-combat-balance.mjs';

const MAX_BOSS_HEALTH_MULTIPLIER = 2.2;

function freezeArray(items) {
  return Object.freeze(items.map((item) => Object.freeze(item)));
}

export function bossBeatHealthMultiplier(pressureTier = 1) {
  const tier = Math.max(0, Number(pressureTier) || 0);
  return Number(Math.min(MAX_BOSS_HEALTH_MULTIPLIER, 1 + tier * 0.22).toFixed(2));
}

function firstBeatForRole(role, enemyIndex = 0, schedule = HMH_LEVEL_ONE_BOSS_BEAT_SCHEDULE) {
  if (role === 'boss') return schedule.find((beat) => beat.type === 'major-boss') ?? null;
  const miniBeats = schedule.filter((beat) => beat.type === 'mini-boss-pair');
  return miniBeats.find((beat) => ((beat.rosterOffset ?? 0) % 3) === enemyIndex)
    ?? miniBeats[0]
    ?? null;
}

function enemyCatalogEntry(enemyId) {
  return LESTER_BLASTER_ENEMY_CATALOG.find((enemy) => enemy.id === enemyId) ?? { id: enemyId, speed: 1.5, baseHealth: 20, preferredRangeMode: 'melee' };
}

function scheduleSpacing(schedule = HMH_LEVEL_ONE_BOSS_BEAT_SCHEDULE) {
  const starts = schedule.map((beat) => beat.startSeconds).sort((a, b) => a - b);
  const gaps = [];
  for (let i = 1; i < starts.length; i += 1) gaps.push(starts[i] - starts[i - 1]);
  return Object.freeze({ starts: Object.freeze(starts), gaps: Object.freeze(gaps), minGap: gaps.length ? Math.min(...gaps) : Infinity });
}

function buildMiniBossBalanceCard(rosterEntry, index, { plan, schedule }) {
  const beat = firstBeatForRole('mini-boss', index, schedule);
  const catalog = enemyCatalogEntry(rosterEntry.enemyId);
  const enemyCard = buildEnemyBalanceCard({ enemy: catalog, elite: true, miniBoss: true, pressure: 0.5, playerMoveSpeed: 4.15 });
  const miniPlan = miniBossPlanForPoi(rosterEntry.zoneId, { plan });
  return Object.freeze({
    role: 'mini-boss',
    enemyId: rosterEntry.enemyId,
    title: rosterEntry.title,
    zoneId: rosterEntry.zoneId,
    firstSeenSeconds: beat?.startSeconds ?? null,
    beatId: beat?.id ?? null,
    phaseCount: miniPlan?.phaseCount ?? 2,
    enrageHpPct: MINI_BOSS_ENRAGE_HP_PCT,
    enrageAttackResetMul: MINI_BOSS_PHASE_COMBAT.enraged.attackResetMul,
    enragedFanShots: MINI_BOSS_PHASE_COMBAT.enraged.fanShots,
    telegraphFrames: miniPlan?.telegraphFrames ?? enemyCard.readability.minTellFrames,
    chaseSpeedCapRatio: enemyCard.speedLaw.capRatio,
    spawnSpeed: enemyCard.speedLaw.spawnSpeed,
    chaseSpeed: enemyCard.speedLaw.chaseSpeed,
  });
}

function buildMajorBossBalanceCard(rosterEntry, { plan, schedule }) {
  const beat = firstBeatForRole('boss', 0, schedule);
  const phases = plan.finalBoss.phases;
  const combatPhases = phases.map((phase) => LEVEL_ONE_BOSS_PHASE_COMBAT[phase.id]);
  return Object.freeze({
    role: 'boss',
    enemyId: rosterEntry.enemyId,
    title: rosterEntry.title,
    zoneId: rosterEntry.zoneId,
    firstSeenSeconds: beat?.startSeconds ?? null,
    beatId: beat?.id ?? null,
    phaseCount: phases.length,
    fanShotsByPhase: Object.freeze(combatPhases.map((phase) => phase.fanShots)),
    fanSpreadRadByPhase: Object.freeze(combatPhases.map((phase) => phase.fanSpreadRad)),
    attackResetFramesByPhase: Object.freeze(combatPhases.map((phase) => phase.attackResetFrames)),
    addSuppressionPhases: Object.freeze(phases.filter((phase) => phase.addWaveSuppression).map((phase) => phase.id)),
    maxHealthMultiplier: bossBeatHealthMultiplier(Math.max(...schedule.filter((scheduled) => scheduled.type === 'major-boss').map((scheduled) => scheduled.pressureTier ?? 1))),
  });
}

export function buildBossBalanceCards({ roster = HMH_LEVEL_ONE_BOSS_ROSTER, schedule = HMH_LEVEL_ONE_BOSS_BEAT_SCHEDULE, plan = buildLevelOneBossChoreographyPlan() } = {}) {
  const miniEntries = roster.filter((entry) => entry.role === 'mini-boss');
  const bossEntry = roster.find((entry) => entry.role === 'boss');
  const cards = [
    ...miniEntries.map((entry, index) => buildMiniBossBalanceCard(entry, index, { plan, schedule })),
    bossEntry ? buildMajorBossBalanceCard(bossEntry, { plan, schedule }) : null,
  ].filter(Boolean);
  return freezeArray(cards);
}

export function validateBossBalanceCards(cards = buildBossBalanceCards(), { schedule = HMH_LEVEL_ONE_BOSS_BEAT_SCHEDULE } = {}) {
  const gaps = [];
  const mini = cards.filter((card) => card.role === 'mini-boss');
  const bosses = cards.filter((card) => card.role === 'boss');
  if (mini.length !== 3) gaps.push(`expected 3 mini-boss cards, got ${mini.length}`);
  if (bosses.length !== 1) gaps.push(`expected 1 major boss card, got ${bosses.length}`);
  for (const card of mini) {
    if (card.phaseCount !== 2) gaps.push(`${card.enemyId} must have 2 phases`);
    if (card.enrageHpPct !== 50) gaps.push(`${card.enemyId} enrage threshold must be 50%`);
    if (card.enrageAttackResetMul < 0.58 || card.enrageAttackResetMul > 0.72) gaps.push(`${card.enemyId} enrage cadence outside readable band`);
    if (card.chaseSpeedCapRatio > 0.92) gaps.push(`${card.enemyId} chase speed cap exceeds elite escape law`);
    if (card.telegraphFrames < 24) gaps.push(`${card.enemyId} telegraph too short`);
  }
  for (const card of bosses) {
    if (card.phaseCount !== 3) gaps.push(`${card.enemyId} must have 3 phases`);
    if (Math.min(...card.attackResetFramesByPhase) < 58) gaps.push(`${card.enemyId} cadence is too fast`);
    if (Math.max(...card.fanSpreadRadByPhase) > 1.1) gaps.push(`${card.enemyId} fan spread too wide`);
    if (card.maxHealthMultiplier > MAX_BOSS_HEALTH_MULTIPLIER) gaps.push(`${card.enemyId} HP multiplier too high`);
    for (const phaseId of ['gate-warning', 'extraction-break']) {
      if (!card.addSuppressionPhases.includes(phaseId)) gaps.push(`${card.enemyId} must suppress adds during ${phaseId}`);
    }
  }
  const spacing = scheduleSpacing(schedule);
  if (spacing.minGap < 160) gaps.push(`boss beat spacing too tight: ${spacing.minGap}s`);
  const firstMini = Math.min(...schedule.filter((beat) => beat.type === 'mini-boss-pair').map((beat) => beat.startSeconds));
  const firstMajor = Math.min(...schedule.filter((beat) => beat.type === 'major-boss').map((beat) => beat.startSeconds));
  if (firstMini > 240) gaps.push(`first mini-boss too late: ${firstMini}s`);
  if (firstMajor < 480) gaps.push(`first major boss too early: ${firstMajor}s`);
  return Object.freeze({ ok: gaps.length === 0, gaps: Object.freeze(gaps) });
}

export function buildBossBalanceScorecard(cards = buildBossBalanceCards(), { schedule = HMH_LEVEL_ONE_BOSS_BEAT_SCHEDULE } = {}) {
  const validation = validateBossBalanceCards(cards, { schedule });
  const spacing = scheduleSpacing(schedule);
  const miniStarts = schedule.filter((beat) => beat.type === 'mini-boss-pair').map((beat) => beat.startSeconds);
  const majorStarts = schedule.filter((beat) => beat.type === 'major-boss').map((beat) => beat.startSeconds);
  return Object.freeze({
    version: 'wo-33-boss-balance-v1',
    overallScore: validation.ok ? 100 : Math.max(0, 100 - validation.gaps.length * 12),
    summary: Object.freeze({
      cardCount: cards.length,
      miniBossCount: cards.filter((card) => card.role === 'mini-boss').length,
      majorBossCount: cards.filter((card) => card.role === 'boss').length,
      firstMiniBossSeconds: Math.min(...miniStarts),
      firstMajorBossSeconds: Math.min(...majorStarts),
      scheduleSpacingOk: spacing.minGap >= 160,
      minScheduleGapSeconds: spacing.minGap,
    }),
    cards: freezeArray(cards),
    validation,
  });
}
