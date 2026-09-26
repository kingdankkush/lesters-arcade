// The Chikun mode-select marquee (design §D.3), loaded by routes/official-play-routes.mjs only while
// JACKPOT_LIVE: "WEEKLY JACKPOT · {prize} {symbol} · closes in 2d 4h · top score {score} (provisional) ·
// Rules". It shows only a funded, open week (on the corrected clock); anything else hides it.
import { JACKPOT_RULES_URL, countdownParts, currentPrize, fetchJackpot, formatCountdown, leaderScoreText, phaseOf } from './jackpot-client.mjs';
import { coin, ensureJackpotStylesheet, fillLine, link, node } from './jackpot-view.mjs';

export const JACKPOT_MARQUEE_ID = 'chikunJackpotMarquee';
const REFRESH_MS = 30_000;
let refreshTimer = null;

// The default export keeps the mode-select loader line short (it passes only the mount; the route sets
// mount.dataset.gameId before calling it).
export default async function renderChikunJackpotPanel(mount, {
  gameId = mount?.dataset?.gameId,
  documentRef = mount?.ownerDocument ?? globalThis.document,
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
  setTimeoutImpl = (callback, ms) => globalThis.setTimeout(callback, ms),
  clearTimeoutImpl = (id) => globalThis.clearTimeout(id),
} = {}) {
  if (!mount) return null;
  let panel = mount.querySelector(`#${JACKPOT_MARQUEE_ID}`);
  const hide = () => {
    if (panel) panel.hidden = true;
    return null;
  };
  if (gameId !== 'chikun') return hide();
  const answer = await fetchJackpot({ fetchImpl, now });
  const api = answer?.api;
  const prize = currentPrize(api);
  const correctedNow = answer ? answer.clock.now(now()) : NaN;
  // The player may have picked another cabinet while this loaded.
  if (!prize || phaseOf(api.current, correctedNow) !== 'open' || mount.dataset?.gameId !== 'chikun') return hide();
  ensureJackpotStylesheet(documentRef);
  if (!panel) {
    panel = node(documentRef, 'p', 'jackpot-marquee');
    panel.id = JACKPOT_MARQUEE_ID;
    const heading = mount.querySelector('.mode-select-heading');
    (heading ?? mount).append(panel);
  }
  const week = api.current;
  fillLine(documentRef, panel, [
    node(documentRef, 'strong', '', 'Weekly Jackpot'),
    node(documentRef, 'strong', 'jackpot-amount', prize.text({ first: true })),
    prize.capNote,
    `closes in ${formatCountdown(countdownParts(week.closesAt, correctedNow))}`,
    week.leader ? leaderScoreText(week.leader) : null,
    link(documentRef, JACKPOT_RULES_URL, 'Rules'),
  ]).prepend(coin(documentRef));
  panel.hidden = false;
  // Keep "closes in" current while the marquee is on screen.
  if (refreshTimer !== null) clearTimeoutImpl(refreshTimer);
  refreshTimer = setTimeoutImpl(() => {
    refreshTimer = null;
    if (panel.isConnected !== false && !panel.hidden && mount.dataset?.gameId === 'chikun' && !mount.hidden) {
      void renderChikunJackpotPanel(mount, { gameId: 'chikun', documentRef, fetchImpl, now, setTimeoutImpl, clearTimeoutImpl });
    }
  }, REFRESH_MS);
  // Node test runs only: a pending refresh never keeps the process alive (browsers return a number).
  refreshTimer?.unref?.();
  return panel;
}
