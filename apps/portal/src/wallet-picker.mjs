// Wallet picker and sign-in dialogs (guide §3.1, §5.9; contract §7.6).
//
// Loaded with import() when the player presses Sign in. The model is pure
// (buildWalletPickerModel) so its rules are unit-tested; the DOM half builds
// a focus-trapped dialog with createElement only (no innerHTML), sized for a
// 320 px phone with 44 px+ buttons in the bottom half of the screen.

import {
  FEATURED_WALLET_RDNS,
  WALLET_INSTALL_LINKS,
  WALLET_DEEP_LINKS,
  WALLET_NAMES,
  isReownAllowedHost,
} from './wallet-config.mjs';

export const WALLET_PICKER_STYLESHEET = 'src/styles/wallet-picker.css';
const STYLESHEET_ID = 'walletPickerStyles';

function freezeAll(list) { return Object.freeze(list.map((entry) => Object.freeze(entry))); }

// providers: EIP-6963 details ({ uuid, name, rdns, icon, provider }) plus, when
// a page has only the legacy window.ethereum, one { kind:'legacy' } entry.
// remembered: walletSession.remembered() ({ kind, rdns, wallet }) or null.
export function buildWalletPickerModel({ providers = [], isMobile = false, host = '', remembered = null } = {}) {
  const announced = [];
  let legacy = null;
  for (const detail of Array.isArray(providers) ? providers : []) {
    if (!detail || typeof detail !== 'object') continue;
    if (detail.kind === 'legacy') { legacy = legacy ?? detail; continue; }
    if (typeof detail.uuid !== 'string' || typeof detail.name !== 'string') continue;
    announced.push(detail);
  }
  const rank = (detail) => {
    const index = FEATURED_WALLET_RDNS.indexOf(detail.rdns ?? '');
    return index < 0 ? FEATURED_WALLET_RDNS.length : index;
  };
  const ordered = announced
    .map((detail, order) => ({ detail, order }))
    .sort((a, b) => rank(a.detail) - rank(b.detail) || a.order - b.order)
    .map(({ detail }) => detail);

  const entries = ordered.map((detail) => ({
    id: `eip6963:${detail.uuid}`,
    kind: 'eip6963',
    uuid: detail.uuid,
    rdns: detail.rdns ?? null,
    name: detail.name,
    icon: typeof detail.icon === 'string' && /^data:image\//.test(detail.icon) ? detail.icon : null,
    featured: FEATURED_WALLET_RDNS.includes(detail.rdns ?? ''),
    lastUsed: remembered?.kind === 'eip6963' && Boolean(detail.rdns) && remembered.rdns === detail.rdns,
  }));
  // The legacy slot usually belongs to one of the announced wallets; list it
  // only when nothing announced itself.
  if (!entries.length && legacy) {
    entries.push({ id: 'legacy', kind: 'legacy', uuid: null, rdns: null, name: legacy.name || 'Browser wallet', icon: null, featured: false, lastUsed: remembered?.kind === 'legacy' });
  }
  const injectedCount = entries.length;

  const walletConnect = isReownAllowedHost(host);
  if (walletConnect) {
    entries.push({
      id: 'walletconnect',
      kind: 'walletconnect',
      uuid: null,
      rdns: null,
      name: 'WalletConnect',
      note: isMobile ? 'Open a wallet app on this phone' : 'Scan with a phone wallet',
      icon: null,
      featured: false,
      lastUsed: remembered?.kind === 'walletconnect',
    });
  }

  const featuredInstalled = entries.some((entry) => entry.featured);
  const installLinks = featuredInstalled
    ? []
    : FEATURED_WALLET_RDNS.map((rdns) => ({ rdns, name: WALLET_NAMES[rdns], href: WALLET_INSTALL_LINKS[rdns] }));
  const deepLinks = isMobile && injectedCount === 0
    ? Object.entries(WALLET_DEEP_LINKS).map(([id, href]) => ({ id, name: WALLET_NAMES[id], href }))
    : [];
  // The simulated local identity is the QA fallback only when nothing real
  // exists: no injected wallet, no announcement and no WalletConnect.
  const simulated = injectedCount === 0 && !walletConnect;

  return Object.freeze({
    entries: freezeAll(entries),
    installLinks: freezeAll(installLinks),
    deepLinks: freezeAll(deepLinks),
    walletConnect,
    simulated,
    isMobile: Boolean(isMobile),
    choices: entries.length,
  });
}

// ---------------------------------------------------------------- DOM ----

// Returns the picker's <link> (main.js may have added it first, same id).
export function ensureWalletPickerStyles(documentRef = globalThis.document) {
  if (!documentRef?.head) return null;
  const existing = documentRef.getElementById?.(STYLESHEET_ID);
  if (existing) return existing;
  const link = documentRef.createElement('link');
  link.id = STYLESHEET_ID;
  link.rel = 'stylesheet';
  link.href = WALLET_PICKER_STYLESHEET;
  documentRef.head.append(link);
  return link;
}

// Resolves once the stylesheet applies (load or error), or after timeoutMs.
// null when it already applies. A browser <link> exposes `sheet` (null until
// loaded); test doubles without it count as loaded.
export function walletPickerStylesPending(link, { timeoutMs = 1500 } = {}) {
  if (!link || !('sheet' in link) || link.sheet) return null;
  return new Promise((resolve) => {
    let timer = null;
    const done = () => { if (timer !== null) clearTimeout(timer); resolve(); };
    timer = setTimeout(done, timeoutMs);
    link.addEventListener?.('load', done, { once: true });
    link.addEventListener?.('error', done, { once: true });
  });
}

// Keeps a freshly added sheet or toast invisible until its stylesheet applies.
// Live UI audit 2026-09-24: on a phone with a cold cache the picker first
// painted unstyled at the bottom of the page (a bullet list of plain buttons
// under the footer) before its CSS arrived.
function revealWhenStyled(element, link) {
  const pending = walletPickerStylesPending(link);
  if (!pending || !element?.style) return null;
  element.style.visibility = 'hidden';
  return pending.then(() => { element.style.visibility = ''; });
}

function node(documentRef, tag, { className = '', text = null, attrs = {} } = {}) {
  const element = documentRef.createElement(tag);
  if (className) element.className = className;
  if (text !== null) element.textContent = text;
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    element.setAttribute(key, value === true ? '' : String(value));
  }
  return element;
}

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

// A modal sheet over the page: focus trapped inside, Escape and the backdrop
// close it, focus returns to the opener afterwards.
function openSheet(documentRef, { labelledBy, className = '', onClose }) {
  const stylesheet = ensureWalletPickerStyles(documentRef);
  const previous = documentRef.activeElement;
  const overlay = node(documentRef, 'div', { className: `wallet-sheet-overlay ${className}`.trim() });
  const sheet = node(documentRef, 'div', { className: 'wallet-sheet', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': labelledBy } });
  overlay.append(sheet);
  let closed = false;
  const close = (value) => {
    if (closed) return;
    closed = true;
    documentRef.removeEventListener('keydown', onKey, true);
    overlay.remove();
    try { previous?.focus?.(); } catch { /* opener gone */ }
    onClose(value);
  };
  const onKey = (event) => {
    if (event.key === 'Escape') { event.preventDefault(); close(null); return; }
    if (event.key !== 'Tab') return;
    const focusable = [...sheet.querySelectorAll(FOCUSABLE)];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && documentRef.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && documentRef.activeElement === last) { event.preventDefault(); first.focus(); }
    else if (!sheet.contains(documentRef.activeElement)) { event.preventDefault(); first.focus(); }
  };
  overlay.addEventListener('click', (event) => { if (event.target === overlay) close(null); });
  documentRef.addEventListener('keydown', onKey, true);
  const styled = revealWhenStyled(overlay, stylesheet);
  documentRef.body.append(overlay);
  // A hidden control cannot take focus: focus moves in once the sheet shows.
  const focusFirst = () => {
    const move = () => { if (!closed) sheet.querySelector(FOCUSABLE)?.focus?.(); };
    if (styled) void styled.then(move);
    else move();
  };
  return { overlay, sheet, close, focusFirst };
}

function header(documentRef, id, title, lead) {
  const wrap = node(documentRef, 'div', { className: 'wallet-sheet-head' });
  wrap.append(node(documentRef, 'p', { className: 'wallet-sheet-kicker', text: 'Sign in' }));
  wrap.append(node(documentRef, 'h2', { className: 'wallet-sheet-title', text: title, attrs: { id } }));
  if (lead) wrap.append(node(documentRef, 'p', { className: 'wallet-sheet-lead', text: lead }));
  return wrap;
}

let pickerSequence = 0;

// Shows the model and resolves the chosen entry (or null when dismissed).
// `onPick(entry|null)` is also called, for callers that prefer a callback.
export function openWalletPicker({ documentRef = globalThis.document, model, onPick = () => {} } = {}) {
  return new Promise((resolve) => {
    const titleId = `walletPickerTitle${++pickerSequence}`;
    const finish = (value) => { onPick(value); resolve(value); };
    const { sheet, close, focusFirst } = openSheet(documentRef, { labelledBy: titleId, className: 'wallet-picker', onClose: finish });
    sheet.append(header(documentRef, titleId, 'Choose your wallet', 'Your wallet is your arcade account. Signing in is free and sends no transaction.'));

    const list = node(documentRef, 'ul', { className: 'wallet-picker-list' });
    for (const entry of model.entries) {
      const item = node(documentRef, 'li');
      const button = node(documentRef, 'button', { className: 'wallet-picker-option', attrs: { type: 'button', 'data-wallet-kind': entry.kind, 'data-wallet-rdns': entry.rdns } });
      if (entry.icon) button.append(node(documentRef, 'img', { className: 'wallet-picker-icon', attrs: { src: entry.icon, alt: '', width: 28, height: 28 } }));
      else button.append(node(documentRef, 'span', { className: `wallet-picker-icon wallet-picker-icon-${entry.kind}`, text: entry.kind === 'walletconnect' ? 'WC' : entry.name.slice(0, 1).toUpperCase(), attrs: { 'aria-hidden': 'true' } }));
      const label = node(documentRef, 'span', { className: 'wallet-picker-label' });
      label.append(node(documentRef, 'strong', { text: entry.name }));
      const note = entry.lastUsed ? 'Last used' : entry.note ?? (entry.featured ? 'Recommended' : 'Installed');
      label.append(node(documentRef, 'small', { text: note }));
      button.append(label);
      button.addEventListener('click', () => close(entry));
      item.append(button);
      list.append(item);
    }
    if (model.entries.length) sheet.append(list);

    if (model.deepLinks.length) {
      const block = node(documentRef, 'div', { className: 'wallet-picker-links' });
      block.append(node(documentRef, 'p', { className: 'wallet-picker-links-title', text: 'Open the arcade in your wallet app' }));
      for (const link of model.deepLinks) {
        block.append(node(documentRef, 'a', { className: 'wallet-picker-link', text: `Open in ${link.name}`, attrs: { href: link.href, rel: 'noopener' } }));
      }
      sheet.append(block);
    }
    if (model.installLinks.length) {
      const block = node(documentRef, 'div', { className: 'wallet-picker-links' });
      block.append(node(documentRef, 'p', { className: 'wallet-picker-links-title', text: model.entries.length ? 'Or install a wallet' : 'No wallet found. Install one to sign in:' }));
      for (const link of model.installLinks) {
        block.append(node(documentRef, 'a', { className: 'wallet-picker-link', text: `Get ${link.name}`, attrs: { href: link.href, target: '_blank', rel: 'noopener noreferrer' } }));
      }
      sheet.append(block);
    }

    const footer = node(documentRef, 'div', { className: 'wallet-sheet-actions' });
    const cancel = node(documentRef, 'button', { className: 'wallet-sheet-secondary', text: 'Keep playing Free', attrs: { type: 'button' } });
    cancel.addEventListener('click', () => close(null));
    footer.append(cancel);
    sheet.append(footer);
    focusFirst();
  });
}

// The one chain explainer at sign-in (guide §3.1). Resolves true when the
// player asks to switch, false otherwise. The wallet prompt that follows is
// opened from this button's click.
export function openChainExplainer({ documentRef = globalThis.document, networkName = 'LitVM LiteForge', chainId = 4441 } = {}) {
  return new Promise((resolve) => {
    const titleId = `walletChainTitle${++pickerSequence}`;
    const { sheet, close, focusFirst } = openSheet(documentRef, { labelledBy: titleId, className: 'wallet-chain-explainer', onClose: (value) => resolve(value === true) });
    sheet.append(header(documentRef, titleId, `Switch to ${networkName}`, `Lester’s Arcade runs on ${networkName} (chain ${chainId}), a free test network. Your wallet will ask to add or switch to it once. Nothing is charged.`));
    const footer = node(documentRef, 'div', { className: 'wallet-sheet-actions' });
    const confirm = node(documentRef, 'button', { className: 'wallet-sheet-primary', text: 'Switch network', attrs: { type: 'button' } });
    const later = node(documentRef, 'button', { className: 'wallet-sheet-secondary', text: 'Not now', attrs: { type: 'button' } });
    confirm.addEventListener('click', () => close(true));
    later.addEventListener('click', () => close(false));
    footer.append(confirm, later);
    sheet.append(footer);
    focusFirst();
  });
}

// A short, dismissable status line for sign-in outcomes (declined, cancelled,
// service down). role=status so screen readers hear it.
export function showWalletToast({ documentRef = globalThis.document, message, tone = 'info', actions = [], timeoutMs = 7000 } = {}) {
  const stylesheet = ensureWalletPickerStyles(documentRef);
  documentRef.querySelector?.('.wallet-toast')?.remove();
  const toast = node(documentRef, 'div', { className: `wallet-toast wallet-toast-${tone}`, attrs: { role: 'status', 'aria-live': 'polite' } });
  toast.append(node(documentRef, 'span', { className: 'wallet-toast-text', text: message }));
  for (const action of actions) {
    const button = node(documentRef, 'button', { className: 'wallet-toast-action', text: action.label, attrs: { type: 'button' } });
    button.addEventListener('click', () => { toast.remove(); action.run?.(); });
    toast.append(button);
  }
  const dismiss = node(documentRef, 'button', { className: 'wallet-toast-close', text: '×', attrs: { type: 'button', 'aria-label': 'Dismiss' } });
  dismiss.addEventListener('click', () => toast.remove());
  toast.append(dismiss);
  void revealWhenStyled(toast, stylesheet);
  documentRef.body.append(toast);
  if (timeoutMs > 0) setTimeout(() => toast.remove(), timeoutMs);
  return toast;
}
