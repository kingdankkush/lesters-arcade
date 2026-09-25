// The profile's "Jackpot Champion" section (design §D.3, §C.7), loaded by routes/hosted-profile-view.mjs
// only while JACKPOT_LIVE and only for a profile with jackpot wins. Each win shows its date range, the
// prize in its own week's token, the score and the transaction. A `claim-pending` win (the prize
// transfer failed, design §A.9) viewed by its own connected winner gets the Claim form of
// jackpot-profile-claim.mjs, loaded only then.
import { explorerTxUrl, tokenAmountText, weekRangeText } from './jackpot-client.mjs';
import { coin, ensureJackpotStylesheet, fillLine, link, node } from './jackpot-view.mjs';

const WALLET = /^0x[0-9a-f]{40}$/;
const loadClaim = () => import('./jackpot-profile-claim.mjs');

// The loader's entry (hosted-profile-view.mjs): positional, so the view chunk's glue stays small. The
// view's `target.own` means the connected wallet is the viewed one (viewedTarget), so the viewer is
// `target.wallet` on its own profile and nobody who can claim anywhere else.
export default (mount, response, target, walletProviderForAction) => renderJackpotWins({ mount, wins: response?.jackpot?.wins, wallet: target?.wallet, own: target?.own === true, connectedWallet: target?.own === true ? target.wallet : null, walletProviderForAction });

export function renderJackpotWins({
  mount,
  wins = [],
  wallet = null,
  own = false,
  connectedWallet = null,
  walletProviderForAction = async () => null,
  deployment = undefined,
  documentRef = mount?.ownerDocument ?? globalThis.document,
  loadClaimForm = loadClaim,
} = {}) {
  if (!mount || !Array.isArray(wins) || wins.length === 0) return null;
  ensureJackpotStylesheet(documentRef);
  const viewer = String(connectedWallet ?? '').toLowerCase();
  const owner = own && WALLET.test(viewer) && viewer === String(wallet ?? '').toLowerCase();
  const card = node(documentRef, 'article', 'official-info-card jackpot-wins');
  const rerender = () => renderJackpotWins({ mount, wins, wallet, own, connectedWallet, walletProviderForAction, deployment, documentRef, loadClaimForm });
  const title = node(documentRef, 'h3', '', 'Jackpot Champion');
  title.prepend(coin(documentRef));
  const list = node(documentRef, 'ol', 'jackpot-history');
  const noted = new Set();
  for (const win of wins) {
    if (!win?.token?.symbol || !win.prizeWei) continue;
    const first = !noted.has(win.token.symbol);
    noted.add(win.token.symbol);
    const item = fillLine(documentRef, node(documentRef, 'li'), [
      weekRangeText(win.startsAt, win.closesAt, { year: true }),
      node(documentRef, 'strong', 'jackpot-amount', tokenAmountText(win.prizeWei, win.token, { first })),
      Number.isSafeInteger(win.score) ? `${win.score.toLocaleString('en-US')} pts` : null,
      win.status === 'claim-pending' ? node(documentRef, 'span', 'jackpot-badge', 'Claim pending') : null,
      explorerTxUrl(win.finalizeTx) ? link(documentRef, explorerTxUrl(win.finalizeTx), 'Transaction') : null,
    ]);
    let pending = false;
    try { pending = win.status === 'claim-pending' && BigInt(String(win.unclaimedWei ?? '0')) > 0n; } catch { pending = false; }
    if (pending && owner) {
      void Promise.resolve(loadClaimForm()).then((claim) => {
        if (item.isConnected !== false) item.append(claim.claimForm(documentRef, win, { wallet: viewer, walletProviderForAction, deployment, rerender }));
      }).catch(() => {});
    }
    list.append(item);
  }
  card.append(title, list);
  mount.replaceChildren(card);
  return card;
}
