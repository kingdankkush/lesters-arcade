// First-Ranked name prompt (brief acceptance 5, guide §5.7). Loaded lazily by
// the lesters:ranked-run listener in main.js, and only when the portal is
// hosted. After a Ranked run, a signed-in wallet with no on-chain name that has
// not said "Not now" sees one small, non-blocking toast: "Claim your arcade
// name", with Claim (opens the profile's name editor) and Not now (saves
// preferences.nameClaimDismissed = true through PUT /api/profile). Skipping
// keeps the short wallet everywhere, which is fine.

export const NAME_CLAIM_TOAST_CLASS = 'name-claim-toast';
export const NAME_CLAIM_TITLE = 'Claim your arcade name';
export const NAME_CLAIM_COPY = 'Show a name instead of your wallet on the boards, your profile and share cards. It is a small on-chain change you confirm in your wallet.';
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

// Returns { shown, reason }. Never throws for a missing profile or network.
export async function maybePromptNameClaim({
  detail = null,
  hosted = false,
  wallet = null,
  indexApi = null,
  getCachedSelfProfile = () => null,
  documentRef = globalThis.document,
  mount = globalThis.document?.body ?? null,
  onClaim = () => {},
  onDismissed = () => {},
  setTimeoutImpl = (callback, ms) => globalThis.setTimeout(callback, ms),
  autoHideMs = 30_000,
} = {}) {
  if (!hosted || !indexApi) return { shown: false, reason: 'preview' };
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
  const close = () => {
    if (closed) return;
    closed = true;
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
  mount.append(toast);
  if (autoHideMs > 0) setTimeoutImpl(close, autoHideMs);
  return { shown: true, reason: null, toast };
}
