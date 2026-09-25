// Chikun's Escape Weekly Jackpot: small DOM helpers for the lazy jackpot surfaces (design §D.2).
// createElement and textContent only (contract §11 rule 6): no innerHTML, and every link is either a
// same-origin path or a well-formed explorer URL from jackpot-client.mjs.

export const JACKPOT_STYLESHEET = '/src/styles/jackpot.css?v=jackpot-ui-20260925';

// The retro jackpot stylesheet, once per document (the ranked-results.mjs pattern).
export function ensureJackpotStylesheet(documentRef) {
  const head = documentRef?.head ?? documentRef?.querySelector?.('head');
  if (!head) return null;
  const existing = typeof head.querySelector === 'function' ? head.querySelector('link[data-jackpot-css]') : null;
  if (existing) return existing;
  const link = documentRef.createElement('link');
  link.rel = 'stylesheet';
  link.href = JACKPOT_STYLESHEET;
  link.dataset.jackpotCss = 'true';
  head.appendChild(link);
  return link;
}

// An element with an optional class and text.
export function node(documentRef, tag, className = '', text) {
  const element = documentRef.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined && text !== null) element.textContent = String(text);
  return element;
}

// A link. `newTab` opens in a new tab with rel="noopener" (the Rules link in the payment modal, so a
// click during a wallet confirmation cannot orphan a paid entry). Explorer links always open apart.
export function link(documentRef, href, text, { className = '', newTab = false } = {}) {
  const anchor = node(documentRef, 'a', className, text);
  anchor.href = href;
  if (newTab || /^https:/.test(href)) {
    anchor.target = '_blank';
    anchor.rel = /^https:/.test(href) ? 'noopener noreferrer' : 'noopener';
  }
  return anchor;
}

// The gold coin glyph of the jackpot marquee (decorative).
export function coin(documentRef) {
  const glyph = node(documentRef, 'span', 'jackpot-coin', 'Ł');
  glyph.setAttribute('aria-hidden', 'true');
  return glyph;
}

// Replaces a mount's children with `parts`, joined by " · " separators (strings or nodes).
export function fillLine(documentRef, mount, parts) {
  const children = [];
  for (const part of parts.filter((item) => item !== null && item !== undefined && item !== '')) {
    if (children.length) children.push(node(documentRef, 'span', 'jackpot-sep', ' · '));
    children.push(typeof part === 'string' ? node(documentRef, 'span', '', part) : part);
  }
  mount.replaceChildren(...children);
  return mount;
}
