// First-Ranked name prompt (brief acceptance 5, guide §5.7). Loaded lazily by
// the lesters:ranked-run listener in main.js, and only when the portal is
// hosted. After a Ranked run, a signed-in wallet with no on-chain name that has
// not said "Not now" sees one small, non-blocking toast: "Claim your arcade
// name", with Claim (opens the profile's name editor) and Not now (saves
// preferences.nameClaimDismissed = true through PUT /api/profile). Skipping
// keeps the short wallet everywhere, which is fine.
//
// The same lesters:ranked-run opens results-share's results screen: a modal
// backdrop over the whole page (z-index 10050) with a focus trap. The toast
// waits until that screen is gone, hides again if it reopens, and its
// auto-hide clock only runs while it is actually on screen.

import { LITVM_DEPLOYMENT } from './generated/litvm-addresses.mjs';

export const NAME_CLAIM_TOAST_CLASS = 'name-claim-toast';
export const NAME_CLAIM_TITLE = 'Claim your arcade name';
export const NAME_CLAIM_COPY = 'Show a name instead of your wallet on the boards, your profile and share cards. It is a small on-chain change you confirm in your wallet.';
// results-share's results screen root (ranked-results.mjs sets data-ranked-results).
export const RANKED_RESULTS_SELECTOR = '[data-ranked-results]';
export const NAME_CLAIM_POLL_MS = 1_000;
const HEX_WALLET = /^0x[0-9a-fA-F]{40}$/;
const walletKey = (value) => (HEX_WALLET.test(String(value ?? '')) ? String(value).toLowerCase() : null);

// At most one toast per wallet per page load.
const promptedThisPage = new Set();

export function resetNameClaimPromptForTests() {
  promptedThisPage.clear();
}

// Whether a self-view profile (E6s) should be offered a name.
export function nameClaimVerdict(selfProfile) {
  if (!selfProfile?.ok) return { show: false, reason: 'no-self-view' };
  if (selfProfile.profile?.hidden === true) return { show: false, reason: 'hidden' };
  if (selfProfile.profile?.displayName) return { show: false, reason: 'has-name' };
  if (selfProfile.preferences?.nameClaimDismissed === true) return { show: false, reason: 'dismissed' };
  return { show: true, reason: null };
}

function button(documentRef, className, text) {
  const node = documentRef.createElement('button');
  node.type = 'button';
  node.className = `pixel-button ${className}`;
  node.textContent = text;
  return node;
}

// Returns { shown, reason, toast? }. `shown` means the prompt is queued: it
// appears as soon as no results screen covers the page. Never throws for a
// missing profile or network.
export async function maybePromptNameClaim({
  detail = null,
  hosted = false,
  wallet = null,
  indexApi = null,
  deployment = LITVM_DEPLOYMENT,
  getCachedSelfProfile = () => null,
  documentRef = globalThis.document,
  mount = globalThis.document?.body ?? null,
  isCovered = () => Boolean(documentRef?.querySelector?.(RANKED_RESULTS_SELECTOR)),
  onClaim = () => {},
  onDismissed = () => {},
  setTimeoutImpl = (callback, ms) => globalThis.setTimeout(callback, ms),
  pollMs = NAME_CLAIM_POLL_MS,
  autoHideMs = 30_000,
} = {}) {
  if (!hosted || !indexApi) return { shown: false, reason: 'preview' };
  // Before the contracts are deployed the profile offers only the device-local
  // editor, so the on-chain promise of this toast would not be true.
  if (deployment?.status !== 'deployed') return { shown: false, reason: 'not-deployed' };
  const viewer = walletKey(wallet);
  const runWallet = walletKey(detail?.context?.wallet);
  if (!viewer || (runWallet && runWallet !== viewer)) return { shown: false, reason: 'other-wallet' };
  if (detail?.context?.mode && detail.context.mode !== 'ranked') return { shown: false, reason: 'not-ranked' };
  if (promptedThisPage.has(viewer)) return { shown: false, reason: 'already-shown' };

  let selfProfile = null;
  try { selfProfile = getCachedSelfProfile(viewer) ?? null; } catch { selfProfile = null; }
  if (!selfProfile?.ok) selfProfile = await indexApi.profile(viewer, { self: true });
  const verdict = nameClaimVerdict(selfProfile);
  if (!verdict.show) return { shown: false, reason: verdict.reason };
  if (!documentRef?.createElement || !mount?.append) return { shown: false, reason: 'no-document' };
  promptedThisPage.add(viewer);

  const toast = documentRef.createElement('aside');
  toast.className = `${NAME_CLAIM_TOAST_CLASS} official-info-card`;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.setAttribute('aria-label', NAME_CLAIM_TITLE);
  // Non-blocking: a small card in a corner, never a modal.
  Object.assign(toast.style ?? {}, {
    position: 'fixed', left: '16px', bottom: '16px', zIndex: '60', maxWidth: 'min(360px, calc(100vw - 32px))',
  });
  const title = documentRef.createElement('strong');
  title.textContent = NAME_CLAIM_TITLE;
  const copy = documentRef.createElement('small');
  copy.textContent = NAME_CLAIM_COPY;
  const actions = documentRef.createElement('div');
  actions.className = 'name-claim-actions profile-quick-actions';
  const claim = button(documentRef, 'profile-action-primary name-claim-accept', 'Claim');
  const later = button(documentRef, 'name-claim-later', 'Not now');
  actions.append(claim, later);
  toast.append(title, copy, actions);

  let closed = false;
  let visible = false;
  let visibleMs = 0;
  const close = () => {
    if (closed) return;
    closed = true;
    visible = false;
    toast.remove?.();
  };
  claim.addEventListener('click', () => {
    close();
    onClaim(viewer);
  });
  later.addEventListener('click', async () => {
    close();
    const saved = await indexApi.savePreferences({ nameClaimDismissed: true });
    onDismissed(viewer, saved);
  });

  // Show the toast whenever nothing covers the page, pull it back out while
  // the results screen is open, and hide it for good after autoHideMs on
  // screen. An ignored toast is not a dismissal.
  const step = () => {
    if (closed) return;
    let covered = false;
    try { covered = Boolean(isCovered()); } catch { covered = false; }
    if (covered) {
      if (visible) {
        visible = false;
        toast.remove?.();
      }
    } else if (!visible) {
      visible = true;
      mount.append(toast);
    } else {
      visibleMs += pollMs;
      if (autoHideMs > 0 && visibleMs >= autoHideMs) {
        close();
        return;
      }
    }
    setTimeoutImpl(step, pollMs);
  };
  step();
  return { shown: true, reason: null, toast };
}
