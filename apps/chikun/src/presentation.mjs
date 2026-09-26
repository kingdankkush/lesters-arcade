import { flapTicksOf } from '../../portal/src/chikun-cabinet.mjs';

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

// Weekly Jackpot start-screen lines for Ranked (jackpot design §D.3), used by main.mjs only while
// JACKPOT_LIVE. `api` is the /api/jackpot answer the child reads itself (same origin; the bridge
// protocol is unchanged) and `nowMs` the Age-corrected clock. They replace the rewards tease, whose
// detail would promise prizes that do not exist: a funded week shows its prize and "closes in", a live
// unfunded week says so, and anything else (not live or closing within the minute) gives null, so no
// rewards line shows at all; an answer it cannot read throws, and the caller shows nothing. Amounts use
// BigInt only (truncated).
export const CHIKUN_JACKPOT_DETAIL = 'Top verified Ranked score of the week wins. See the rules.';
export function buildChikunJackpotTease(api, nowMs = Date.now()) {
  const week = api?.live === true ? api.current : null, pot = week?.pot, token = api?.token;
  const minutes = (Date.parse(week?.closesAt) - nowMs) / 60_000 | 0;
  if (!(minutes > 0) || typeof pot?.funded !== 'boolean') return null;
  let prize = 'no prize funded this week';
  if (pot.funded) {
    const { symbol, decimals } = token;
    if (!/^\d{1,78}$/.test(pot.prizeWei)) return null;
    const scale = 10n ** BigInt(decimals), wei = BigInt(pot.prizeWei), hours = minutes / 60 | 0;
    const cents = `${wei % scale}`.padStart(decimals, '0').slice(0, 2).replace(/0+$/, '');
    prize = `${`${wei / scale}`.replace(/\B(?=(\d{3})+$)/g, ',')}${cents && `.${cents}`} ${symbol}${token.testnet ? ' (testnet token, no value)' : ''} · closes in ${hours > 23 ? `${hours / 24 | 0}d ${hours % 24}h` : `${hours}h ${minutes % 60}m`}`;
  }
  return { rewards: `Weekly Jackpot: ${prize}`, rewardsDetail: CHIKUN_JACKPOT_DETAIL };
}

function number(value) {
  return Math.max(0, Math.round(Number(value) || 0));
}

export function buildChikunReplayTimeline(evidence = {}, binCount = 24) {
  const safeBinCount = Math.max(1, Math.min(64, Math.floor(Number(binCount) || 24)));
  const maxTicks = Math.max(1, Math.floor(Number(evidence.maxTicks) || 1));
  const bins = Array.from({ length: safeBinCount }, () => 0);
  let steps = [];
  try { steps = flapTicksOf(evidence); } catch { steps = []; }
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

// The child shares Free runs only (its Ranked share controls are hidden, the
// parent results screen owns Ranked sharing), so a Ranked label never claims
// a verification the server has not made yet. X mentions @LestersArcade and
// carries no hashtags (guide D12, D13).
export function buildChikunShareText(result = {}, mode = 'free', dailyLabel = '') {
  const label = mode === 'ranked'
    ? 'Ranked run'
    : dailyLabel
      ? dailyLabel
      : 'Free Practice';
  const seconds = Math.max(0, Number(result.survivalTime) || 0).toFixed(1);
  return `I scored ${number(result.score).toLocaleString('en-US')} points in Chikun's Escape: ${number(result.forksPassed)} obstacles, ${number(result.nearMisses)} near misses, ${number(result.bestCombo)} best combo, ${seconds}s flight. ${label} on @LestersArcade`;
}
