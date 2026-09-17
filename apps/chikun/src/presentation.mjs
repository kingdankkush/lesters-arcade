// Mode-screen teases (owner direction 2026-09-16). Free Mode never mentions a
// wallet or Web3; Ranked also teases the coming high-score rewards.
export const CHIKUN_DAILY_TEASE = 'Daily Challenge — coming soon';
export const CHIKUN_REWARDS_TEASE = 'High-score rewards coming soon';
export function buildChikunModeTease(mode = 'free') {
  const ranked = mode === 'ranked';
  return Object.freeze({
    daily: CHIKUN_DAILY_TEASE,
    dailyDetail: ranked ? 'Daily boards for every Ranked pilot are on the way.' : 'Daily boards and streaks are on the way. Free to play, no sign-in needed.',
    rewards: ranked ? CHIKUN_REWARDS_TEASE : '',
    rewardsDetail: ranked ? 'First to a set Ranked score, plus the top Ranked score of the week, month and year.' : '',
  });
}

function number(value) {
  return Math.max(0, Math.round(Number(value) || 0));
}

export function buildChikunReplayTimeline(evidence = {}, binCount = 24) {
  const safeBinCount = Math.max(1, Math.min(64, Math.floor(Number(binCount) || 24)));
  const maxTicks = Math.max(1, Math.floor(Number(evidence.maxTicks) || 1));
  const bins = Array.from({ length: safeBinCount }, () => 0);
  const steps = Array.isArray(evidence.flapSteps) ? evidence.flapSteps : [];
  for (const raw of steps) {
    const step = Math.max(0, Math.min(maxTicks - 1, Math.floor(Number(raw) || 0)));
    bins[Math.min(safeBinCount - 1, Math.floor((step / maxTicks) * safeBinCount))] += 1;
  }
  return Object.freeze({
    bins: Object.freeze(bins),
    peak: Math.max(0, ...bins),
    totalFlaps: bins.reduce((sum, value) => sum + value, 0),
    maxTicks,
  });
}

export function buildChikunShareText(result = {}, mode = 'free', dailyLabel = '') {
  const label = mode === 'ranked'
    ? 'Replay Verified Ranked'
    : dailyLabel
      ? dailyLabel
      : 'Free Practice';
  const seconds = Math.max(0, Number(result.survivalTime) || 0).toFixed(1);
  return `I scored ${number(result.score).toLocaleString('en-US')} points in Chikun's Escape: ${number(result.forksPassed)} obstacles, ${number(result.nearMisses)} near misses, ${number(result.bestCombo)} best combo, ${seconds}s flight. ${label} at lestersarcade.io`;
}
