// Keeps keyboard focus across a view re-render that rebuilds its DOM.
//
// The hosted Scores and Profile views render synchronously with
// replaceChildren() and render again when an index answer arrives. Before
// this helper, every such render dropped focus to <body>: on /scores the
// search box lost focus as soon as its results came back, so the next keys
// typed went nowhere, and the period, cabinet and profile game tabs lost it
// the moment they were pressed (live UI audit 2026-09-24).
//
// focusKeyFor() describes the focused control by tag, stable classes and
// data-* attributes, plus its index among the controls that share that
// description; restoreFocus() finds the same control in the new DOM. Pure and
// DOM-agnostic (no document or window at import time), so the node tests
// drive it with doubles.

// Classes that describe state, not identity: a tab gains `is-active` when it
// is pressed, and must still be found again.
const STATE_CLASSES = new Set(['is-active', 'is-current-player', 'is-ranked', 'is-loading', 'is-open', 'is-selected']);
const SAFE_NAME = /^[A-Za-z_][\w-]*$/;
const SAFE_VALUE = /^[\w:.-]*$/;

const dataAttributeName = (key) => `data-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;

export function focusSelectorFor(element) {
  const tag = String(element?.tagName ?? '').toLowerCase();
  if (!/^[a-z][a-z0-9-]*$/.test(tag)) return null;
  const classes = String(element.className ?? '')
    .split(/\s+/)
    .filter((name) => name && !STATE_CLASSES.has(name) && SAFE_NAME.test(name));
  const data = Object.entries(element.dataset ?? {})
    .filter(([key, value]) => /^[a-z][A-Za-z0-9]*$/.test(key) && SAFE_VALUE.test(String(value)))
    .map(([key, value]) => `[${dataAttributeName(key)}="${value}"]`);
  return `${tag}${classes.map((name) => `.${name}`).join('')}${data.join('')}`;
}

// The focused control inside `root`, as { selector, index, selection }, or null
// when focus is elsewhere (or on the root itself).
export function focusKeyFor(element, root) {
  if (!element || !root || element === root || typeof root.contains !== 'function' || !root.contains(element)) return null;
  const selector = focusSelectorFor(element);
  if (!selector || typeof root.querySelectorAll !== 'function') return null;
  const matches = [...root.querySelectorAll(selector)];
  const index = Math.max(0, matches.indexOf(element));
  const selection = typeof element.selectionStart === 'number' && typeof element.selectionEnd === 'number'
    ? { start: element.selectionStart, end: element.selectionEnd }
    : null;
  return { selector, index, selection };
}

// Focuses the control `key` describes in the re-rendered `root`. Returns true
// when it did. A control that no longer exists leaves focus where it is.
export function restoreFocus(key, root) {
  if (!key || typeof root?.querySelectorAll !== 'function') return false;
  const matches = [...root.querySelectorAll(key.selector)];
  const target = matches[key.index] ?? (matches.length === 1 ? matches[0] : null);
  if (!target || typeof target.focus !== 'function' || target.disabled) return false;
  target.focus({ preventScroll: true });
  if (key.selection && typeof target.setSelectionRange === 'function') {
    try { target.setSelectionRange(key.selection.start, key.selection.end); } catch { /* input type without a caret */ }
  }
  return true;
}

// Focuses the first control a selector in `selectors` finds in `root`.
export function focusFallback(selectors, root) {
  for (const selector of [selectors ?? []].flat()) {
    const target = root?.querySelector?.(selector);
    if (target && typeof target.focus === 'function' && !target.disabled) {
      target.focus({ preventScroll: true });
      return true;
    }
  }
  return false;
}

// Runs render() (which rebuilds `root`'s children) and puts focus back on the
// control that had it. When that control is gone (Try again became a Loading
// card, Back to the top left with page 1), focus goes to the first of
// `fallback` (selectors, in order) instead of dropping to the page. Focus
// that was outside `root` is never touched. `documentRef` defaults to the
// root's owner document.
export function renderKeepingFocus(root, render, { documentRef = root?.ownerDocument ?? null, fallback = null } = {}) {
  const key = focusKeyFor(documentRef?.activeElement ?? null, root);
  const result = render();
  if (key && documentRef?.activeElement !== undefined && !root.contains?.(documentRef.activeElement)) {
    if (!restoreFocus(key, root)) focusFallback(fallback, root);
  }
  return result;
}
