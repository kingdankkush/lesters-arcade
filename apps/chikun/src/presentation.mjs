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

export function buildChikunShareText(result = {}, mode = 'free') {
  const label = mode === 'ranked' ? 'Replay Verified Ranked' : 'Free Practice';
  const seconds = Math.max(0, Number(result.survivalTime) || 0).toFixed(1);
  return `I scored ${number(result.score).toLocaleString('en-US')} points in Chikun's Escape: ${number(result.forksPassed)} forks, ${number(result.nearMisses)} near misses, ${number(result.bestCombo)} best combo, ${seconds}s flight. ${label} at lestersarcade.io`;
}
