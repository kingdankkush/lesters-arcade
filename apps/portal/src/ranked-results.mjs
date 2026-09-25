// Ranked results screen (contract §7.3, §7.7; guide §3.3, §5.11). Lazy UI:
// main.js imports this module only when `lesters:ranked-run` fires, so it
// never touches the portal's initial JS or the HMH, Chikun and STACKED
// children. It renders buildRankedResultsModel() and follows the settlement
// handle live: hero, standing, per-game stats, the on-chain timeline
// (aria-live), achievements, Share on X first, then Play again, Practice,
// View profile and Back to arcade. It is a modal dialog: focus is trapped
// inside, Escape closes it and focus goes back where it was.
//
// Network: nothing unless `hosted` is true AND the run is published; then the
// standing comes from GET /api/leaderboard (weekly and all-time, `wallet=`),
// with cache:'no-store' (A23). A period counts only when its `you` row is
// this run (the §4.3.8 rule). A failed read, or a `you` that trails this
// run's score (the index or the CDN copy has not caught up), is read again
// after 4, 15 and 40 s, then left out. With both flags false it fetches
// nothing.
//
// Companions (§7.7): another feature may show a small non-modal surface over
// a finished run, such as the first-Ranked name prompt of profile-boards. A
// direct child of <body> marked `data-results-companion` (or carrying the
// `name-claim-toast` class of that prompt) stacks above the backdrop while
// the screen is open (the stylesheet keys on body[data-ranked-results-open]),
// is reachable with Tab from the dialog, and is never pulled back by the
// focus trap. When the view that owns the screen is hidden (a companion
// action or any other in-app navigation), the screen closes with it.
// DOM: createElement and textContent only (§11 rule 6).
import { DAILY_STANDING_ENABLED, buildRankedResultsModel, standingForRun } from './ranked-results-model.mjs';
import { buildShareLinks, createShareRow } from './share-links.mjs';
import { JACKPOT_LIVE } from './jackpot-config.mjs';

export const RANKED_RESULTS_STYLESHEET = './src/styles/ranked-results.css?v=ranked-results-20260923b';
export const RESULTS_COMPANION_CLASSES = Object.freeze(['name-claim-toast']);
export const STANDING_RETRY_DELAYS_MS = Object.freeze([4_000, 15_000, 40_000]);
const STANDING_PERIODS = Object.freeze([['weekly', 'weekly'], ['allTime', 'all-time'], ...(DAILY_STANDING_ENABLED ? [['daily', 'daily']] : [])]);
const WALLET = /^0x[0-9a-f]{40}$/;
const TIERS = new Set(['bronze', 'silver', 'gold', 'platinum', 'diamond', 'mythic']);
const STEP_ICON = Object.freeze({ done: '✓', active: '◌', pending: '·', failed: '✕', skipped: '–' });
const STEP_STATUS_WORDS = Object.freeze({ done: 'Done', active: 'In progress', pending: 'Waiting', failed: 'Failed', skipped: 'Skipped' });
const EYEBROW = Object.freeze({ preview: 'Ranked preview', practice: 'Practice run' });

let activeView = null;
let serial = 0;

function ensureStylesheet(documentRef) {
  const head = documentRef.head ?? documentRef.querySelector?.('head');
  if (!head) return null;
  const existing = typeof head.querySelector === 'function' ? head.querySelector('link[data-ranked-results-css]') : null;
  if (existing) return existing;
  const link = documentRef.createElement('link');
  link.rel = 'stylesheet';
  link.href = RANKED_RESULTS_STYLESHEET;
  link.dataset.rankedResultsCss = 'true';
  link.addEventListener?.('load', () => { link.dataset.rankedResultsCss = 'loaded'; }, { once: true });
  head.appendChild(link);
  return link;
}

// Resolves once the stylesheet applies, so the screen never flashes
// unstyled. A browser link exposes `sheet`; test doubles resolve at once.
function stylesheetReady(link) {
  if (!link || !('sheet' in link) || link.sheet || link.dataset.rankedResultsCss === 'loaded') return null;
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, 2_000);
    const done = () => { clearTimeout(timer); resolve(); };
    link.addEventListener('load', done, { once: true });
    link.addEventListener('error', done, { once: true });
  });
}

function prefersReducedMotion(windowRef) {
  try {
    return Boolean(windowRef?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
  } catch {
    return false;
  }
}

// A companion surface: marked data-results-companion, or a known class.
function isCompanionNode(node) {
  if (!node || typeof node !== 'object') return false;
  if (node.dataset && node.dataset.resultsCompanion !== undefined) return true;
  const classes = typeof node.className === 'string' ? node.className.split(/\s+/) : [];
  return RESULTS_COMPANION_CLASSES.some((name) => classes.includes(name));
}

// Every enabled, visible link and button inside `root`, in document order.
function focusablesIn(root) {
  const found = [];
  const walk = (node) => {
    for (const child of Array.from(node?.children ?? [])) {
      if (child.hidden || child.style?.display === 'none') continue;
      const tag = String(child.tagName ?? '').toUpperCase();
      if ((tag === 'A' && child.href) || (tag === 'BUTTON' && !child.disabled)) found.push(child);
      walk(child);
    }
  };
  walk(root);
  return found;
}

export function openRankedResults({
  handle,
  context = {},
  actions = {},
  documentRef = globalThis.document,
  mount,
  fetchImpl = globalThis.fetch,
  live = false,
  hosted = false,
  reducedMotion,
  windowRef = globalThis.window,
  navigatorRef = globalThis.navigator,
  onClose = null,
  setTimeoutImpl = (callback, ms) => globalThis.setTimeout(callback, ms),
  clearTimeoutImpl = (timer) => globalThis.clearTimeout(timer),
  // Weekly Jackpot line (jackpot-ui): tests switch it on here, never by editing the flag.
  jackpotLive = JACKPOT_LIVE,
} = {}) {
  if (!documentRef?.createElement) throw new TypeError('openRankedResults needs a document');
  activeView?.close({ restoreFocus: false });
  let styles = stylesheetReady(ensureStylesheet(documentRef));

  const ctx = { ...context, entry: { ...(context?.entry ?? {}) }, wallet: String(context?.wallet ?? '').toLowerCase() || null };
  const id = `rr-${++serial}`;
  // Standing: the E5 `you` rows that belong to this run, per period.
  let standing = null;
  const standingSettled = new Set();
  let standingRounds = 0;
  let standingBusy = false;
  let standingTimer = null;
  let ownerObserver = null;
  let open = false;
  let unsubscribe = null;
  let returnFocus = null;
  let lastModel = null;
  let achievementSignature = null;
  let shareRow = null;
  let retrying = false;

  const make = (tag, className, text) => {
    const node = documentRef.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const button = (className, text, onClick) => {
    const node = make('button', className, text);
    node.type = 'button';
    node.addEventListener('click', (event) => { event?.preventDefault?.(); onClick(); });
    return node;
  };

  // Skeleton, built once; render() updates it in place so focus never jumps.
  const root = make('div', 'ranked-results-backdrop');
  root.dataset.rankedResults = 'true';
  root.dataset.reducedMotion = String(reducedMotion ?? prefersReducedMotion(windowRef));
  const dialog = make('section', 'ranked-results');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', `${id}-title`);
  dialog.setAttribute('aria-describedby', `${id}-handle`);
  dialog.tabIndex = -1;
  root.appendChild(dialog);

  const closeButton = button('rr-close', '×', () => close());
  closeButton.setAttribute('aria-label', 'Close results');

  const hero = make('header', 'rr-hero');
  const eyebrow = make('p', 'rr-eyebrow');
  const score = make('h2', 'rr-score');
  score.id = `${id}-title`;
  const scoreValue = make('span', 'rr-score-value');
  const scoreUnit = make('span', 'rr-score-unit', 'pts');
  score.append(scoreValue, scoreUnit);
  const handleLine = make('p', 'rr-handle');
  handleLine.id = `${id}-handle`;
  const standingLine = make('p', 'rr-standing');
  hero.append(eyebrow, score, handleLine, standingLine);
  // Weekly Jackpot line (design §D.3): lazy, Chikun only; its label becomes the share standing.
  let jackpot = null;
  if (jackpotLive && ctx.gameId === 'chikun') import('./jackpot/jackpot-results-line.mjs').then((module) => { jackpot = module.default(hero, ctx, documentRef, fetchImpl, () => open && render()); if (open) render(); }).catch(() => {});

  const banner = make('div', 'rr-banner');
  banner.setAttribute('role', 'status');
  const bannerText = make('p', 'rr-banner-text');
  const bannerDetail = make('p', 'rr-banner-detail');
  const retryButton = button('rr-button rr-button-primary rr-retry', 'Retry now', () => { void retry(); });
  banner.append(bannerText, bannerDetail, retryButton);

  const section = (title, className = '') => {
    const node = make('section', `rr-section ${className}`.trim());
    const heading = make('h3', 'rr-section-title', title);
    heading.id = `${id}-${className || 'section'}`;
    node.setAttribute('aria-labelledby', heading.id);
    node.appendChild(heading);
    return node;
  };

  const notice = make('p', 'rr-notice');
  notice.setAttribute('role', 'status');

  const statsSection = section('Run stats', 'rr-stats-section');
  const statsList = make('dl', 'rr-stats');
  statsSection.appendChild(statsList);
  const statCells = new Map();

  const timelineSection = section('On-chain status', 'rr-timeline-section');
  const timeline = make('ol', 'rr-timeline');
  timeline.setAttribute('aria-live', 'polite');
  timeline.setAttribute('aria-label', 'On-chain status');
  timelineSection.appendChild(timeline);
  const stepNodes = new Map();

  const achievementsSection = section('Achievements earned', 'rr-achievements-section');
  const achievementList = make('ul', 'rr-achievements');
  const achievementEmpty = make('p', 'rr-empty');
  achievementsSection.append(achievementList, achievementEmpty);

  const actionsBlock = make('div', 'rr-actions');
  const shareBlock = make('div', 'rr-share');
  const shareDisabled = make('button', 'rr-button rr-button-primary', 'Share on X');
  shareDisabled.type = 'button';
  shareDisabled.disabled = true;
  shareDisabled.setAttribute('aria-describedby', `${id}-share-note`);
  const shareNote = make('p', 'rr-share-note');
  shareNote.id = `${id}-share-note`;
  const shareStatus = make('p', 'rr-share-note');
  shareStatus.setAttribute('role', 'status');
  shareBlock.append(shareDisabled, shareNote, shareStatus);

  const act = (name) => () => {
    close({ restoreFocus: false });
    const action = actions?.[name];
    if (typeof action === 'function') action();
  };
  const nav = make('div', 'rr-nav');
  const playAgain = button('rr-button rr-button-primary', 'Play again (Ranked)', act('playAgainRanked'));
  const practice = button('rr-button', 'Practice (Free)', act('practiceFree'));
  const profile = button('rr-button', 'View profile', act('viewProfile'));
  const back = button('rr-button', 'Back to arcade', act('backToArcade'));
  nav.append(playAgain, practice, profile, back);
  actionsBlock.append(shareBlock, nav);

  dialog.append(closeButton, hero, banner, notice, statsSection, timelineSection, achievementsSection, actionsBlock);

  function currentSnapshot() {
    try {
      return handle?.snapshot ?? null;
    } catch {
      return null;
    }
  }

  function renderStats(model) {
    for (const row of model.stats) {
      let cell = statCells.get(row.key);
      if (!cell) {
        const wrapper = make('div', 'rr-stat');
        const term = make('dt', '', row.label);
        const value = make('dd');
        wrapper.append(term, value);
        statsList.appendChild(wrapper);
        cell = { wrapper, value };
        statCells.set(row.key, cell);
      }
      cell.value.textContent = row.value;
    }
    statsSection.hidden = model.stats.length === 0;
  }

  function renderTimeline(model) {
    for (const item of model.timeline) {
      let node = stepNodes.get(item.id);
      if (!node) {
        const li = make('li', 'rr-step');
        li.dataset.step = item.id;
        const icon = make('span', 'rr-step-icon');
        icon.setAttribute('aria-hidden', 'true');
        const body = make('span', 'rr-step-body');
        const words = make('span', 'rr-sr');
        const label = make('span', 'rr-step-label');
        const link = make('a', 'rr-step-link', 'View on explorer');
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        body.append(words, label, link);
        li.append(icon, body);
        timeline.appendChild(li);
        node = { li, icon, words, label, link };
        stepNodes.set(item.id, node);
      }
      node.li.dataset.status = item.status;
      node.icon.textContent = STEP_ICON[item.status] ?? '';
      node.words.textContent = `${STEP_STATUS_WORDS[item.status] ?? ''}: `;
      node.label.textContent = item.label;
      if (item.href) {
        node.link.href = item.href;
        node.link.textContent = item.id === 'entry' ? 'Entry transaction' : 'View transaction';
        node.link.hidden = false;
      } else {
        node.link.removeAttribute?.('href');
        node.link.hidden = true;
      }
    }
  }

  function renderAchievements(model) {
    const signature = JSON.stringify(model.achievements);
    if (signature !== achievementSignature) {
      achievementSignature = signature;
      const items = model.achievements.map((achievement) => {
        const li = make('li', 'rr-badge');
        li.dataset.tier = TIERS.has(achievement.tier) ? achievement.tier : 'bronze';
        li.dataset.achievementId = achievement.id;
        if (achievement.image) {
          const img = make('img', 'rr-badge-art');
          img.src = achievement.image;
          img.alt = '';
          img.width = 44;
          img.height = 44;
          img.loading = 'lazy';
          img.decoding = 'async';
          li.appendChild(img);
        } else {
          const placeholder = make('span', 'rr-badge-art');
          placeholder.setAttribute('aria-hidden', 'true');
          li.appendChild(placeholder);
        }
        const copy = make('span', 'rr-badge-copy');
        copy.append(make('span', 'rr-badge-title', achievement.title), make('span', 'rr-badge-tier', achievement.tier));
        // Phase 2 only (A32): a held token shows "Minted" and its explorer link.
        if (achievement.tokenId) {
          const minted = make(achievement.tokenHref ? 'a' : 'span', 'rr-link', 'Minted');
          if (achievement.tokenHref) {
            minted.href = achievement.tokenHref;
            minted.target = '_blank';
            minted.rel = 'noopener noreferrer';
            minted.setAttribute('aria-label', `Minted: view token ${achievement.tokenId}`);
          }
          copy.appendChild(minted);
        }
        li.appendChild(copy);
        return li;
      });
      achievementList.replaceChildren(...items);
    }
    achievementList.hidden = model.achievements.length === 0;
    const verified = model.timeline.find((item) => item.id === 'verified')?.status === 'done';
    achievementEmpty.hidden = model.achievements.length > 0;
    achievementEmpty.textContent = model.state === 'preview' || model.state === 'practice'
      ? 'Achievements are recorded for live Ranked runs.'
      : verified ? 'No new achievements this run.' : 'Achievements appear once the arcade server verifies the run.';
  }

  function renderShare(model) {
    if (model.share) {
      const links = buildShareLinks({ text: model.share.text, url: model.share.url });
      if (shareRow) shareRow.refresh(links);
      else {
        shareRow = createShareRow({
          documentRef,
          navigatorRef,
          title: `${model.title} on Lester's Arcade`,
          links,
          className: 'share-row rr-share-row',
          buttonClassName: 'share-button',
          onStatus: (message) => { shareStatus.textContent = message; },
        });
        shareBlock.insertBefore(shareRow, shareDisabled);
      }
      shareRow.hidden = false;
      shareDisabled.hidden = true;
      shareNote.textContent = model.share.template === 'ranked' ? '' : 'Shares a Free Mode post that links to the arcade.';
      shareNote.hidden = !shareNote.textContent;
    } else {
      if (shareRow) shareRow.hidden = true;
      shareDisabled.hidden = false;
      shareNote.hidden = false;
      shareNote.textContent = model.state === 'rejected' ? 'This run was not published, so it cannot be shared as Ranked.' : 'Sharing unlocks once the run is published on LitVM.';
    }
  }

  function render() {
    const model = buildRankedResultsModel({ snapshot: currentSnapshot(), context: ctx, standing, standingLabel: jackpot?.label });
    jackpot?.update(model, currentSnapshot());
    lastModel = model;
    root.dataset.state = model.state;
    dialog.dataset.state = model.state;
    eyebrow.textContent = `${EYEBROW[model.state] ?? 'Ranked'} · ${model.title}`;
    scoreValue.textContent = model.hero.scoreLabel;
    handleLine.textContent = model.hero.handle;
    standingLine.textContent = model.standing.text ?? '';
    standingLine.hidden = !model.standing.text;

    banner.hidden = !model.banner.kind;
    banner.dataset.kind = model.banner.kind ?? '';
    bannerText.textContent = model.banner.text ?? '';
    bannerDetail.textContent = model.banner.detail ?? '';
    bannerDetail.hidden = !model.banner.detail;
    notice.textContent = model.notice ?? '';
    notice.hidden = !model.notice;
    retryButton.hidden = !model.actions.retry;
    retryButton.disabled = retrying;
    retryButton.textContent = retrying ? 'Retrying…' : 'Retry now';

    renderStats(model);
    renderTimeline(model);
    renderAchievements(model);
    renderShare(model);
    profile.hidden = !model.actions.profile || typeof actions?.viewProfile !== 'function';
    playAgain.hidden = typeof actions?.playAgainRanked !== 'function';
    practice.hidden = typeof actions?.practiceFree !== 'function';
    maybeFetchStanding(model);
    return model;
  }

  // One E5 read gives { settled, you }. Settled means no later read can change
  // the answer: either this run's row, or another run of the wallet scoring
  // at least as much (this run is not the wallet's best in the period).
  async function readStanding(model, wallet, period) {
    try {
      const url = `/api/leaderboard?game=${encodeURIComponent(model.gameId)}&period=${period}&wallet=${wallet}`;
      const response = await fetchImpl(url, { cache: 'no-store', headers: { accept: 'application/json' } });
      if (!response?.ok) return { settled: false, you: null };
      const body = await response.json();
      const you = body?.ok && body.you && typeof body.you === 'object' ? body.you : null;
      if (standingForRun(you, model.sessionId32)) return { settled: true, you };
      return { settled: Boolean(you) && Number(you.score) >= model.hero.score, you: null };
    } catch {
      return { settled: false, you: null };
    }
  }

  function maybeFetchStanding(model) {
    if (!hosted || standingBusy || model.state !== 'published' || typeof fetchImpl !== 'function') return;
    const wallet = String(ctx.wallet ?? currentSnapshot()?.wallet ?? '').toLowerCase();
    if (!WALLET.test(wallet) || !model.gameId || !model.sessionId32) return;
    const periods = STANDING_PERIODS.filter(([key]) => !standingSettled.has(key));
    if (!periods.length || standingRounds > STANDING_RETRY_DELAYS_MS.length) return;
    standingBusy = true;
    standingRounds += 1;
    void Promise.all(periods.map(async ([key, period]) => [key, await readStanding(model, wallet, period)])).then((results) => {
      for (const [key, { settled, you }] of results) {
        if (settled) standingSettled.add(key);
        if (you) standing = { ...standing, [key]: you };
      }
      const delay = STANDING_RETRY_DELAYS_MS[standingRounds - 1];
      const unsettled = STANDING_PERIODS.some(([key]) => !standingSettled.has(key));
      if (open && unsettled && delay !== undefined) {
        standingTimer = setTimeoutImpl(() => {
          standingTimer = null;
          standingBusy = false;
          if (open) render();
        }, delay);
      } else {
        standingBusy = false;
      }
      if (open) render();
    });
  }

  async function retry() {
    if (retrying || typeof handle?.retry !== 'function') return;
    retrying = true;
    if (open) render();
    try {
      await handle.retry();
    } catch {
      // The handle reports the outcome through its snapshot.
    } finally {
      retrying = false;
      if (open) render();
    }
  }

  function onKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault?.();
      event.stopPropagation?.();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = focusablesIn(dialog);
    if (!items.length) {
      event.preventDefault?.();
      dialog.focus?.();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const extra = companionFocusables();
    const activeElement = documentRef.activeElement;
    const inside = items.includes(activeElement);
    if (event.shiftKey && (activeElement === first || activeElement === dialog || !inside)) {
      event.preventDefault?.();
      (extra.at(-1) ?? last).focus?.();
    } else if (!event.shiftKey && (activeElement === last || !inside && activeElement !== dialog)) {
      event.preventDefault?.();
      (extra[0] ?? first).focus?.();
    }
  }

  // Focus that escapes the dialog (a click on the page behind, a screen
  // reader jump) is pulled back in while the dialog is open. A companion
  // keeps it.
  function onFocusIn(event) {
    if (!open || !event?.target || root.contains?.(event.target) || companionOf(event.target)) return;
    (focusablesIn(dialog)[0] ?? dialog).focus?.();
  }

  function companionOf(node) {
    for (let current = node; current && current !== documentRef.body; current = current.parentNode) {
      if (current !== root && isCompanionNode(current)) return current;
    }
    return null;
  }

  function companionFocusables() {
    return Array.from(documentRef.body?.children ?? [])
      .filter((node) => node !== root && !node.hidden && isCompanionNode(node))
      .flatMap((node) => focusablesIn(node));
  }

  // Tab past either end of the companions goes back into the dialog.
  function onCompanionKeydown(event) {
    if (!open || event?.key !== 'Tab' || !companionOf(event.target)) return;
    const extra = companionFocusables();
    const items = focusablesIn(dialog);
    const activeElement = documentRef.activeElement;
    if (!event.shiftKey && activeElement === extra.at(-1)) {
      event.preventDefault?.();
      (items[0] ?? dialog).focus?.();
    } else if (event.shiftKey && activeElement === extra[0]) {
      event.preventDefault?.();
      (items.at(-1) ?? dialog).focus?.();
    }
  }

  function onProfileChanged(event) {
    const detail = event?.detail ?? {};
    if (!ctx.wallet || String(detail.wallet ?? '').toLowerCase() !== ctx.wallet) return;
    ctx.displayName = typeof detail.displayName === 'string' && detail.displayName.trim() ? detail.displayName : null;
    render();
  }

  function onRankedEntry(event) {
    const detail = event?.detail ?? {};
    if (!detail.sessionId || detail.sessionId !== ctx.sessionId) return;
    const status = detail.status === 'broadcast' ? 'pending' : detail.status;
    if (!['pending', 'confirmed', 'failed'].includes(status)) return;
    ctx.entry = { status, txHash: typeof detail.txHash === 'string' ? detail.txHash.toLowerCase() : ctx.entry?.txHash ?? null };
    render();
  }

  // `mount` is the view that owns the screen (main.js passes the gameplay
  // view). The overlay itself attaches to <body>: the gameplay view is its
  // own stacking context under the site chrome (the music player and the
  // footer), and a modal must sit above both. When a browser back or forward
  // hides the owning view, the screen closes with it.
  function ownerShown() {
    if (!mount || mount === documentRef.body) return true;
    if (mount.isConnected === false || mount.hidden) return false;
    return typeof mount.getClientRects === 'function' ? mount.getClientRects().length > 0 : true;
  }

  function closeIfOwnerHidden() {
    if (open && !ownerShown()) close({ restoreFocus: false });
  }

  function onPopState() {
    setTimeout(closeIfOwnerHidden, 0);
  }

  // In-app navigation (pushState, or a companion action such as Claim) hides
  // the owning view without a popstate, so the screen follows its attributes.
  function observeOwner() {
    const Observer = windowRef?.MutationObserver;
    if (!mount || mount === documentRef.body || typeof Observer !== 'function') return null;
    try {
      const observer = new Observer(closeIfOwnerHidden);
      observer.observe(mount, { attributes: true, attributeFilter: ['hidden', 'class', 'style'] });
      return observer;
    } catch {
      return null;
    }
  }

  root.addEventListener('keydown', onKeydown);

  function show() {
    if (open) return;
    open = true;
    activeView = view;
    returnFocus = documentRef.activeElement ?? null;
    (documentRef.body ?? mount).appendChild(root);
    if (documentRef.body?.dataset) documentRef.body.dataset.rankedResultsOpen = 'true';
    documentRef.addEventListener?.('focusin', onFocusIn);
    documentRef.addEventListener?.('keydown', onCompanionKeydown);
    ownerObserver = observeOwner();
    windowRef?.addEventListener?.('lesters:profile-changed', onProfileChanged);
    windowRef?.addEventListener?.('lesters:ranked-entry', onRankedEntry);
    windowRef?.addEventListener?.('popstate', onPopState);
    try {
      unsubscribe = typeof handle?.subscribe === 'function' ? handle.subscribe(() => { if (open) render(); }) : null;
    } catch {
      unsubscribe = null;
    }
    render();
    if (styles) {
      root.style.visibility = 'hidden';
      void styles.then(() => {
        styles = null;
        root.style.visibility = '';
        if (open) focusDialog();
      });
    } else {
      focusDialog();
    }
  }

  // The dialog opens at its top: the hero score is the first thing read.
  function focusDialog() {
    dialog.focus?.({ preventScroll: true });
    root.scrollTop = 0;
  }

  // onClose runs first (HMH re-renders its summary there). Focus then goes
  // back to where it was or, when that element is gone, to whatever onClose
  // returned (the HMH "View results" button).
  function close({ restoreFocus = true } = {}) {
    if (!open) return;
    open = false;
    if (activeView === view) activeView = null;
    try { unsubscribe?.(); } catch { /* a disposed handle has nothing to release */ }
    unsubscribe = null;
    if (standingTimer !== null) {
      clearTimeoutImpl(standingTimer);
      standingTimer = null;
      standingBusy = false;
    }
    ownerObserver?.disconnect?.();
    ownerObserver = null;
    documentRef.removeEventListener?.('focusin', onFocusIn);
    documentRef.removeEventListener?.('keydown', onCompanionKeydown);
    windowRef?.removeEventListener?.('lesters:profile-changed', onProfileChanged);
    windowRef?.removeEventListener?.('lesters:ranked-entry', onRankedEntry);
    windowRef?.removeEventListener?.('popstate', onPopState);
    root.remove?.();
    if (documentRef.body?.dataset) delete documentRef.body.dataset.rankedResultsOpen;
    const previous = returnFocus;
    returnFocus = null;
    const fallback = typeof onClose === 'function' ? onClose(view) : null;
    if (!restoreFocus) return;
    const target = previous && previous.isConnected !== false ? previous : fallback;
    if (target && target.isConnected !== false) target.focus?.();
  }

  const view = {
    close,
    update: () => (open ? render() : lastModel),
    reopen: show,
    element: root,
    sessionId: ctx.sessionId ?? null,
    gameId: ctx.gameId ?? null,
    get isOpen() { return open; },
    get model() { return lastModel; },
  };
  // `live` is informational here: the handle already reports `preview` when
  // settlement is off (§7.2), and the model never claims more than it shows.
  root.dataset.live = String(Boolean(live));
  show();
  return view;
}
