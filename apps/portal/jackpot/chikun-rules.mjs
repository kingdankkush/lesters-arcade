// The Weekly Jackpot rules page's lazy module (/jackpot/chikun, design §D.4). CSP-safe: a module script,
// same-origin imports only, DOM through createElement and textContent.
//
// Always (no network): the week's close and payout times in the viewer's local time next to UTC, and
// the contract and token addresses from the generated module once the jackpot is deployed. Only while
// JACKPOT_LIVE (or a test's `live`): one GET /api/jackpot for this week's prize (or "No jackpot funded
// this week"), the provisional top score, and the past weeks with their own tokens, transactions and
// replays. A failed or malformed answer shows nothing.
import { JACKPOT_LIVE } from '../src/jackpot-config.mjs';
import { LITVM_JACKPOT } from '../src/generated/litvm-jackpot.mjs';
import {
  countdownParts, currentPrize, explorerAddressUrl, explorerTxUrl, fetchJackpot, formatCountdown, leaderScoreText,
  localAndUtcTime, phaseOf, tokenAmountText, watchReplayUrl, weekRangeText, weekStartOfKey, weekStatusText,
} from '../src/jackpot/jackpot-client.mjs';
import { coin, fillLine, link, node } from '../src/jackpot/jackpot-view.mjs';

const WEEK_MS = 7 * 86_400_000;
const DAY_MS = 86_400_000;

// The next Monday 00:00 UTC after `nowMs` (the close of the running week) and its payout time.
export function nextCloseOf(nowMs) {
  const weekStart = Math.floor((nowMs + 3 * DAY_MS) / WEEK_MS) * WEEK_MS - 3 * DAY_MS;
  const close = weekStart + WEEK_MS;
  return { closesAt: new Date(close).toISOString(), payoutAt: new Date(close + DAY_MS).toISOString() };
}

function renderTimes(documentRef, times, { closesAt, payoutAt }, options) {
  times.textContent = `Where you are, this week closes ${localAndUtcTime(closesAt, options)}, and its prize is paid from ${localAndUtcTime(payoutAt, options)} (24 hours later, unless the week is extended).`;
  times.hidden = false;
}

function renderContracts(documentRef, list, deployment) {
  const rows = [];
  const row = (term, ...values) => {
    const dd = node(documentRef, 'dd');
    dd.append(...values);
    rows.push(node(documentRef, 'dt', '', term), dd);
  };
  const instance = deployment?.status === 'deployed' ? deployment.instances?.chikun : null;
  if (!instance?.address) {
    row('Contract', 'Not deployed yet.');
  } else {
    const addressLink = (address) => (explorerAddressUrl(address) ? link(documentRef, explorerAddressUrl(address), address) : address);
    row('Contract', addressLink(instance.address));
    row('Prize token', `${instance.token?.symbol ?? ''} `, addressLink(instance.token?.address));
    for (const retired of instance.retired ?? []) row('Earlier contract', addressLink(retired.address), ` (${retired.token?.symbol ?? ''})`);
  }
  list.replaceChildren(...rows);
  list.hidden = false;
}

// One past week: its date range, status, winner, prize in its own token, and links.
function historyItem(documentRef, week, noted, options) {
  const item = node(documentRef, 'li');
  const startsAt = week.startsAt ?? new Date(weekStartOfKey(week.weekKey)).toISOString();
  const closesAt = week.closesAt ?? new Date(weekStartOfKey(week.weekKey) + WEEK_MS).toISOString();
  // `previous` carries its score and replay on the winner's candidate row.
  const top = week.candidates?.find((row) => row.walletShort === week.winner?.walletShort) ?? null;
  const score = week.score ?? top?.score;
  const parts = [weekRangeText(startsAt, closesAt, { ...options, year: true }), weekStatusText(week.status)];
  if (week.winner) parts.push(`${week.winner.displayName ?? week.winner.walletShort}${Number.isSafeInteger(score) ? ` · ${score.toLocaleString('en-US')} pts` : ''}`);
  if (week.prizeWei && week.winner) {
    const first = !noted.has(week.token.symbol);
    noted.add(week.token.symbol);
    parts.push(node(documentRef, 'strong', 'jackpot-amount', tokenAmountText(week.prizeWei, week.token, { first })));
  }
  if (week.status === 'claim-pending') parts.push(node(documentRef, 'span', 'jackpot-badge', 'Claim pending'));
  const tx = explorerTxUrl(week.finalizeTx);
  if (tx) parts.push(link(documentRef, tx, 'Transaction'));
  const watch = watchReplayUrl(week.replay ?? top?.replay);
  if (watch) parts.push(link(documentRef, watch, 'Watch'));
  return fillLine(documentRef, item, parts);
}

export async function mountJackpotRules({
  documentRef = globalThis.document,
  live = JACKPOT_LIVE,
  deployment = LITVM_JACKPOT,
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
  locale,
  timeZone,
} = {}) {
  const byId = (id) => documentRef?.getElementById?.(id) ?? null;
  const times = byId('jackpotRulesTimes');
  const contracts = byId('jackpotRulesContracts');
  const options = { locale, timeZone };
  if (times) renderTimes(documentRef, times, nextCloseOf(now()), options);
  if (contracts) renderContracts(documentRef, contracts, deployment);
  if (!live) return null;

  const answer = await fetchJackpot({ fetchImpl, now });
  const api = answer?.api;
  if (!api?.live) return answer;
  const correctedNow = answer.clock.now(now());
  const week = api.current;
  if (week && times) renderTimes(documentRef, times, week, options);

  // "(testnet token, no value)" goes with the first amount of each testnet token on the page.
  const noted = new Set();
  const summary = byId('jackpotRulesNow');
  if (summary && week) {
    const prize = currentPrize(api);
    const open = phaseOf(week, correctedNow) === 'open';
    const parts = [node(documentRef, 'strong', '', `This week, ${weekRangeText(week.startsAt, week.closesAt, options)}`)];
    if (prize) {
      parts.push(node(documentRef, 'strong', 'jackpot-amount', prize.text({ first: true })), prize.capNote);
      noted.add(api.token.symbol);
    }
    else parts.push('No jackpot funded this week');
    if (open) parts.push(`closes in ${formatCountdown(countdownParts(week.closesAt, correctedNow))}`);
    if (open && prize && week.leader) parts.push(leaderScoreText(week.leader));
    fillLine(documentRef, summary, parts).prepend(coin(documentRef));
    summary.hidden = false;
  }

  const history = byId('jackpotRulesHistory');
  if (history) {
    const weeks = [api.previous, ...api.history].filter(Boolean);
    history.replaceChildren(...weeks.map((row) => historyItem(documentRef, row, noted, options)));
    history.hidden = weeks.length === 0;
  }
  return answer;
}

if (typeof document !== 'undefined' && document.getElementById?.('jackpotRulesTimes')) {
  void mountJackpotRules().catch(() => {});
}
