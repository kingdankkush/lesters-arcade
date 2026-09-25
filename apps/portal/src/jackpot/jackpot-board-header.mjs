// The Scores page header for Chikun · Weekly (design §D.3), loaded by routes/hosted-leaderboard-view.mjs
// only while JACKPOT_LIVE. It shows this week's prize (or "No jackpot funded this week"), the countdown
// on the corrected clock (the board's "resets in" uses the same clock while this header is on screen),
// the provisional top score, last week's outcome, a "Past winners" list (date range, name, score,
// prize in its own token, transaction, "Watch" replay, "Claim pending"), and a note that the jackpot
// leader can differ from board #1.
import { JACKPOT_RULES_PATH } from '../jackpot-config.mjs';
import {
  countdownParts, currentPrize, explorerTxUrl, fetchJackpot, formatCountdown, leaderScoreText, localAndUtcTime,
  phaseOf, tokenAmountText, watchReplayUrl, weekRangeText, weekStartOfKey, weekStatusText,
} from './jackpot-client.mjs';
import { coin, ensureJackpotStylesheet, fillLine, link, node } from './jackpot-view.mjs';

const WEEK_MS = 7 * 86_400_000;
export const JACKPOT_BOARD_NOTE = 'The jackpot leader can differ from #1 on this board: only eligible runs count (paid in the week, in its season, under 60 minutes, published within 6 hours of the close, from an eligible wallet).';

function rangeOf(week, options) {
  const start = week.startsAt ?? new Date(weekStartOfKey(week.weekKey)).toISOString();
  const close = week.closesAt ?? new Date(weekStartOfKey(week.weekKey) + WEEK_MS).toISOString();
  return weekRangeText(start, close, options);
}

// A past week with a winner: the winner's candidate row carries the previous week's score and replay.
function winnerRow(documentRef, week, noted) {
  const top = week.candidates?.find((row) => row.walletShort === week.winner.walletShort) ?? null;
  const score = week.score ?? top?.score;
  const first = !noted.has(week.token.symbol);
  noted.add(week.token.symbol);
  const parts = [
    rangeOf(week, { year: true }),
    node(documentRef, 'strong', '', week.winner.displayName ?? week.winner.walletShort),
    Number.isSafeInteger(score) ? `${score.toLocaleString('en-US')} pts` : null,
    node(documentRef, 'span', 'jackpot-amount', tokenAmountText(week.prizeWei, week.token, { first })),
  ];
  if (week.status === 'claim-pending') parts.push(node(documentRef, 'span', 'jackpot-badge', 'Claim pending'));
  const tx = explorerTxUrl(week.finalizeTx);
  if (tx) parts.push(link(documentRef, tx, 'Transaction'));
  const watch = watchReplayUrl(week.replay ?? top?.replay);
  if (watch) parts.push(link(documentRef, watch, 'Watch'));
  return fillLine(documentRef, node(documentRef, 'li'), parts);
}

export function createJackpotBoardHeader({
  documentRef = globalThis.document,
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
  onChange = () => {},
} = {}) {
  let answer = null;
  let inFlight = false;

  function refresh() {
    if (inFlight) return;
    inFlight = true;
    void fetchJackpot({ fetchImpl, now }).then((result) => {
      inFlight = false;
      if (result === answer) return;
      answer = result;
      onChange();
    });
  }

  const header = {
    // The header for this board, or null (another game or period, nothing loaded yet, not live).
    shown(gameId, period) {
      if (gameId !== 'chikun' || period !== 'weekly') return null;
      refresh();
      return answer?.api?.live && answer.api.current ? header : null;
    },
    // The corrected clock the board's "resets in" uses while the header is on screen.
    now: () => (answer ? answer.clock.now(now()) : now()),
    render(container) {
      const api = answer?.api;
      const week = api?.current;
      if (!container || !week) return null;
      ensureJackpotStylesheet(documentRef);
      const correctedNow = header.now();
      const prize = currentPrize(api);
      const open = phaseOf(week, correctedNow) === 'open';
      const card = node(documentRef, 'section', 'jackpot-board-header');
      card.setAttribute('aria-label', 'Weekly Jackpot');
      const title = node(documentRef, 'h3', '', 'Weekly Jackpot');
      title.prepend(coin(documentRef));
      const noted = new Set();
      const lines = [];
      if (prize) {
        noted.add(api.token.symbol);
        lines.push(fillLine(documentRef, node(documentRef, 'p'), [node(documentRef, 'strong', 'jackpot-amount', prize.text({ first: true })), prize.capNote]));
      } else {
        lines.push(node(documentRef, 'p', '', 'No jackpot funded this week'));
      }
      lines.push(fillLine(documentRef, node(documentRef, 'p', 'jackpot-note'), [
        rangeOf(week),
        open ? `closes in ${formatCountdown(countdownParts(week.closesAt, correctedNow))}` : 'closed, results after review',
        `closes ${localAndUtcTime(week.closesAt)}`,
      ]));
      if (prize && open && week.leader) lines.push(node(documentRef, 'p', '', leaderScoreText(week.leader)));
      const previous = api.previous;
      if (previous && !previous.winner && ['review', 'awaiting-admin'].includes(previous.status)) {
        lines.push(node(documentRef, 'p', 'jackpot-note', `Last week (${rangeOf(previous)}): ${weekStatusText(previous.status).toLowerCase()}`));
      }
      const winners = [previous, ...api.history].filter((row) => row?.winner && row.prizeWei);
      const list = node(documentRef, 'ol', 'jackpot-history');
      list.append(...winners.map((row) => winnerRow(documentRef, row, noted)));
      const winnersTitle = node(documentRef, 'h4', '', 'Past winners');
      const note = node(documentRef, 'p', 'jackpot-note', `${JACKPOT_BOARD_NOTE} `);
      note.append(link(documentRef, JACKPOT_RULES_PATH, 'Rules'));
      card.append(title, ...lines, ...(winners.length ? [winnersTitle, list] : []), note);
      container.append(card);
      return card;
    },
  };
  return Object.freeze(header);
}
