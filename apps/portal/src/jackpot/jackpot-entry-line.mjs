// The Ranked entry modal's jackpot row, #rankedEntryJackpot (design §D.3), loaded by main.js
// requestRankedEntry for Chikun only while JACKPOT_LIVE. It never blocks or delays payment: nothing
// awaits it, and it only shows or hides one row.
//   "This week's jackpot · {prize} {symbol} · Entries don't fund the prize · Rules ↗"
// The Rules link opens in a new tab (rel="noopener"), so a click during a pending wallet confirmation
// cannot orphan a paid entry. The row hides when the quoted total is below the week's minPaidWei, when
// the week is unfunded, and after closesAt on the corrected clock; in the last 5 minutes it says that
// runs paid after 00:00 UTC count toward next week. It also notes the entry for the results line
// (jackpot-client.mjs noteJackpotEntry), which checks the run's own paid amount and week.
import { JACKPOT_RULES_PATH } from '../jackpot-config.mjs';
import { currentPrize, fetchJackpot, noteJackpotEntry, phaseOf } from './jackpot-client.mjs';
import { ensureJackpotStylesheet, fillLine, link, node } from './jackpot-view.mjs';

export const LAST_MINUTES_MS = 5 * 60_000;
export const ENTRY_ROW_REFRESH_MS = 15_000;
export const NEXT_WEEK_NOTE = 'Runs paid after 00:00 UTC count toward next week';

function wei(value) {
  try { return BigInt(String(value ?? '0')); } catch { return 0n; }
}

export async function showEntryJackpot({
  row,
  gameId,
  session = null,
  quote = () => '0',
  open = () => true,
  documentRef = row?.ownerDocument ?? globalThis.document,
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
  setTimeoutImpl = (callback, ms) => globalThis.setTimeout(callback, ms),
} = {}) {
  if (!row) return null;
  row.hidden = true;
  if (gameId !== 'chikun') return null;
  const answer = await fetchJackpot({ fetchImpl, now });
  const api = answer?.api;
  const week = api?.live ? api.current : null;
  if (!week || !open()) return null;
  // The last time the modal was seen open (refreshed below) bounds when the entry was paid.
  const note = (seenAtMs) => noteJackpotEntry(session?.sessionId, { session, seenAtMs });
  note(answer.clock.now(now()));
  const prize = currentPrize(api);
  if (!prize) return null;
  ensureJackpotStylesheet(documentRef);

  const render = () => {
    // A closed modal leaves the row alone: the next opening owns it (main.js hides it first).
    if (!open()) return false;
    const correctedNow = answer.clock.now(now());
    note(correctedNow);
    if (phaseOf(week, correctedNow) !== 'open' || wei(quote()) < wei(week.rules.minPaidWei)) {
      row.hidden = true;
      return true;
    }
    const value = fillLine(documentRef, node(documentRef, 'strong'), [
      prize.text({ first: true }),
      "Entries don't fund the prize",
      Date.parse(week.closesAt) - correctedNow <= LAST_MINUTES_MS ? NEXT_WEEK_NOTE : null,
      link(documentRef, JACKPOT_RULES_PATH, 'Rules ↗', { newTab: true }),
    ]);
    row.replaceChildren(node(documentRef, 'span', '', "This week's jackpot"), value);
    row.hidden = false;
    return true;
  };
  // Re-checked while the modal is open: the contract quote arrives later, and the close can pass.
  const tick = () => {
    if (render()) setTimeoutImpl(tick, ENTRY_ROW_REFRESH_MS);
  };
  tick();
  return row;
}
