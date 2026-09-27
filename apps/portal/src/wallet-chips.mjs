// Small wallet chips (guide §3.1, §3.2; contract §7.7).
//
//  - The "Entry confirming…" chip: shown when a live Ranked entry is
//    broadcast. It follows `lesters:ranked-entry` for that session and turns
//    green on `confirmed`; on `failed` it says the run is practice.
//  - The balance chip: the wallet's zkLTC on LiteForge with a faucet link when
//    it is below one Ranked entry plus gas. Live only; the balance is read over
//    the public RPC by the caller.
//
// Loaded with import() from main.js. DOM is built with createElement only.

import { ensureWalletPickerStyles } from './wallet-picker.mjs';
import { LITEFORGE_FAUCET_URL } from './wallet-config.mjs';
import { FAUCET_CHIP_TEXT } from './ranked-facts.mjs';
import { formatZkLtc4, RANKED_ENTRY_EVENT } from './ranked-entry-flow.mjs';

export { RANKED_ENTRY_EVENT };

const ENTRY_CHIP_COPY = Object.freeze({
  broadcast: Object.freeze({ tone: 'pending', text: 'Entry confirming…' }),
  pending: Object.freeze({ tone: 'pending', text: 'Entry confirming…' }),
  confirmed: Object.freeze({ tone: 'ok', text: 'Entry confirmed ✓' }),
  failed: Object.freeze({ tone: 'error', text: 'Entry didn’t go through. This run is practice and won’t be ranked.' }),
});

export function entryChipModel(status) {
  const copy = ENTRY_CHIP_COPY[status] ?? ENTRY_CHIP_COPY.pending;
  return Object.freeze({ status: ENTRY_CHIP_COPY[status] ? status : 'pending', tone: copy.tone, text: copy.text, dismissable: status === 'failed', autoHideMs: status === 'confirmed' ? 4000 : 0 });
}

// Mounts one chip for `sessionId`, in the state the entry is in right now
// (`status`), then follows its events. Returns { element, update, remove }.
export function mountEntryChip({ documentRef = globalThis.document, eventTarget = globalThis.window, sessionId, status = 'broadcast', mount = null } = {}) {
  ensureWalletPickerStyles(documentRef);
  documentRef.querySelector?.('.ranked-entry-chip')?.remove();
  const chip = documentRef.createElement('div');
  chip.className = 'ranked-entry-chip';
  chip.setAttribute('role', 'status');
  chip.setAttribute('aria-live', 'polite');
  const text = documentRef.createElement('span');
  chip.append(text);
  let hideTimer = null;
  let listening = true;

  const remove = () => {
    if (hideTimer) clearTimeout(hideTimer);
    if (listening) eventTarget?.removeEventListener?.(RANKED_ENTRY_EVENT, onEvent);
    listening = false;
    chip.remove();
  };
  const update = (next) => {
    const model = entryChipModel(next);
    chip.dataset.state = model.tone;
    chip.dataset.status = model.status;
    text.textContent = model.text;
    chip.querySelector('button')?.remove();
    if (model.dismissable) {
      const close = documentRef.createElement('button');
      close.type = 'button';
      close.className = 'ranked-entry-chip-close';
      close.setAttribute('aria-label', 'Dismiss');
      close.textContent = '×';
      close.addEventListener('click', remove);
      chip.append(close);
    }
    if ((model.status === 'confirmed' || model.status === 'failed') && listening) {
      eventTarget?.removeEventListener?.(RANKED_ENTRY_EVENT, onEvent);
      listening = false;
    }
    if (model.autoHideMs) hideTimer = setTimeout(remove, model.autoHideMs);
    return model;
  };
  function onEvent(event) {
    const detail = event?.detail ?? {};
    if (detail.sessionId !== sessionId) return;
    if (detail.status === 'confirmed' || detail.status === 'failed') update(detail.status);
  }
  eventTarget?.addEventListener?.(RANKED_ENTRY_EVENT, onEvent);
  update(status);
  (mount ?? documentRef.body).append(chip);
  return { element: chip, update, remove };
}

export function balanceChipModel({ balanceWei = null, needWei = null } = {}) {
  if (balanceWei === null || balanceWei === undefined) return Object.freeze({ text: 'zkLTC …', low: false, faucetUrl: null });
  const balance = BigInt(String(balanceWei));
  const low = needWei !== null && needWei !== undefined && balance < BigInt(String(needWei));
  return Object.freeze({ text: `${formatZkLtc4(balance)} zkLTC`, low, faucetUrl: low ? LITEFORGE_FAUCET_URL : null });
}

// Renders (or refreshes) the nav balance chip inside `container`.
export function renderBalanceChip({ documentRef = globalThis.document, container, balanceWei, needWei } = {}) {
  if (!container) return null;
  ensureWalletPickerStyles(documentRef);
  const model = balanceChipModel({ balanceWei, needWei });
  let chip = container.querySelector?.('.wallet-balance-chip');
  if (!chip) {
    chip = documentRef.createElement('span');
    chip.className = 'wallet-balance-chip';
    container.append(chip);
  }
  chip.dataset.low = model.low ? 'true' : 'false';
  const amount = documentRef.createElement('span');
  amount.className = 'wallet-balance-amount';
  amount.textContent = model.text;
  const parts = [amount];
  if (model.faucetUrl) {
    const faucet = documentRef.createElement('a');
    faucet.className = 'wallet-balance-faucet';
    faucet.href = model.faucetUrl;
    faucet.target = '_blank';
    faucet.rel = 'noopener noreferrer';
    // Names the faucet amount per request (ranked-onboarding, 2026-09-26).
    faucet.textContent = FAUCET_CHIP_TEXT;
    parts.push(faucet);
  }
  chip.replaceChildren(...parts);
  return chip;
}

export function removeBalanceChip(container) {
  container?.querySelector?.('.wallet-balance-chip')?.remove();
}
