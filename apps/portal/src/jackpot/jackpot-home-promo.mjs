// The home page promo (design §D.3), loaded by main.js on the home route only while JACKPOT_LIVE:
// a card in the hidden <section id="jackpotPromo"> of index.html,
//   "This week's Chikun Jackpot: {prize} {symbol} → Play Ranked".
// Only a funded, open week shows it; anything else keeps the section hidden and empty.
import { JACKPOT_RULES_PATH } from '../jackpot-config.mjs';
import { currentPrize, fetchJackpot, phaseOf } from './jackpot-client.mjs';
import { coin, ensureJackpotStylesheet, link, node } from './jackpot-view.mjs';

export async function renderJackpotHomePromo({
  section,
  documentRef = section?.ownerDocument ?? globalThis.document,
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
} = {}) {
  if (!section) return null;
  const answer = await fetchJackpot({ fetchImpl, now });
  const prize = currentPrize(answer?.api);
  if (!prize || phaseOf(answer.api.current, answer.clock.now(now())) !== 'open') {
    section.hidden = true;
    section.replaceChildren();
    return null;
  }
  ensureJackpotStylesheet(documentRef);
  const card = node(documentRef, 'div', 'jackpot-card');
  const heading = node(documentRef, 'h2', '', "This week's Chikun Jackpot");
  heading.prepend(coin(documentRef));
  const amount = node(documentRef, 'p');
  amount.append(node(documentRef, 'strong', 'jackpot-amount', prize.text({ first: true })));
  const note = node(documentRef, 'p', 'jackpot-note', "Entries don't fund the prize. ");
  note.append(link(documentRef, JACKPOT_RULES_PATH, 'Rules'));
  card.append(heading, amount, link(documentRef, '/games/chikun', 'Play Ranked →', { className: 'jackpot-play' }), note);
  section.replaceChildren(card);
  section.hidden = false;
  return section;
}
