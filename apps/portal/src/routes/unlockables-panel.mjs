// Unlockables panel (contract §7.9, brief acceptance 3). Lazy UI: main.js
// imports it with import() when the Settings route or the player's own
// profile renders, so it never touches the portal's initial JS or a child.
//
// It shows each game's cosmetic slots with their locked, unlocked, selected
// and coming-soon looks and the achievement that unlocks each ("Earn
// Coastal Escape"), linked to the profile achievement list. Every slot is a
// native radio group: arrow keys move between the looks the wallet owns,
// locked looks are disabled radios whose requirement link stays reachable with
// Tab, and each option is a 44 px touch target. Readable from 320 px.
//
// The panel lives in its own host after the route's grid, so a route that
// re-renders its grid (the hosted profile after E6 loads) never drops it. It
// shows only while #officialApp is on the Settings step or the player's own
// profile.
//
// The Heroes rows repeat the hero select's own gates: main.js passes
// `heroEntries()`, the hero select's buildCharacterSelectEntries with the same
// options (verified counts when hosted, this device's counts in preview), so
// the two screens never disagree.
//
// Copy follows A32: no NFT, soulbound or minting wording in phase 1.
// DOM: createElement and textContent only (§11 rule 6).
import {
  COSMETIC_SLOTS,
  UNLOCKABLES,
  requiredAchievement,
  requirementText,
  unlockState,
} from '../unlockables.mjs';

export const UNLOCKABLES_PANEL_STYLESHEET = './src/styles/unlockables-panel.css?v=unlockables-20260923';
export const UNLOCKABLES_PANEL_ID = 'unlockablesPanel';
export const UNLOCKABLES_GAME_TITLES = Object.freeze({ 'lester-blaster': 'Hard Money Heroes', chikun: 'Chikun’s Escape', stacked: 'STACKED' });
export const UNLOCKABLES_SLOT_LABELS = Object.freeze({
  'hero-skin': 'Hero skin',
  'weapon-skin': 'Weapon skin',
  coat: 'Coat',
  trail: 'Trail',
  hat: 'Hat',
  'piece-skin': 'Piece skin',
  scene: 'Scene grade',
});
const DEFAULT_LOOKS = Object.freeze({
  'hero-skin': 'Hero colours',
  'weapon-skin': 'Standard issue',
  coat: 'Classic coat',
  trail: 'Classic trail',
  hat: 'No hat',
  'piece-skin': 'Classic pieces',
  scene: 'Original grade',
});
const VIEWS = new Set(['settings', 'profile']);

// The status line over the slots, by mode.
export function unlockablesNotice(snapshot) {
  if (!snapshot?.hosted) {
    return 'Preview · this device. Only the default looks are available until verified Ranked runs go live. Looks never change a run.';
  }
  if (!snapshot.wallet) return 'Sign in with a wallet to use the looks your verified achievements unlock. Looks never change a run.';
  const lead = 'Unlocks follow your wallet to every device, in Free and Ranked.';
  const cached = snapshot.source === 'cache' ? ' Showing the unlocks saved on this device.' : '';
  if (!snapshot.authenticated) {
    // Signed out with nothing cached: the store reads nothing until sign-in.
    return snapshot.source === 'none'
      ? `${lead} Sign in to load your unlocks and save your picks to your wallet; until then picks stay on this device.`
      : `${lead} Sign in to save your picks to your wallet; until then they stay on this device.${cached}`;
  }
  const status = snapshot.source === 'none'
    ? (snapshot.loading ? ' Loading your unlocks…' : ' Your unlocks could not load. They load when you are back online.')
    : cached;
  const waiting = snapshot.unsaved ? ' Your latest picks are on this device and save to your wallet when you are back online.' : '';
  return `${lead} Your picks save to your wallet.${status}${waiting}`;
}

// Whether the panel belongs on this view: always on Settings; on a profile only
// when it is the connected wallet's own (no wallet in the route means "mine").
export function isOwnUnlockablesView({ view = 'settings', viewedWallet = null, connectedWallet = null } = {}) {
  if (view !== 'profile' || !viewedWallet) return true;
  return String(viewedWallet).toLowerCase() === String(connectedWallet ?? '').toLowerCase();
}

// One Heroes row from the hero select's entry for that hero (preferred), or
// from the verified counts in the snapshot when hosted. Preview without the
// hero select's entries makes no claim and points to the hero select.
function heroOption(item, snapshot, heroEntries) {
  const base = { id: item.id, title: item.title, swatch: item.swatch ?? null, achievementId: null, achievementTitle: null };
  const entry = Array.isArray(heroEntries) ? heroEntries.find((hero) => hero?.id === item.characterId) : null;
  if (entry) {
    const progress = entry.unlockProgress;
    const verified = progress?.source !== 'device';
    const required = progress?.required ?? item.requires.confirmedRuns;
    return Object.freeze({
      ...base,
      status: entry.unlocked ? 'unlocked' : 'locked',
      requirement: verified ? requirementText(item) : `Finish ${required} Ranked ${required === 1 ? 'run' : 'runs'} on this device`,
      progress: !entry.unlocked && progress ? { current: progress.current, required: progress.required } : null,
    });
  }
  if (!snapshot?.hosted) return Object.freeze({ ...base, status: 'hero-select', requirement: '', progress: null });
  const state = unlockState(item, snapshot.unlocks ?? {});
  return Object.freeze({
    ...base,
    status: state.unlocked ? 'unlocked' : 'locked',
    requirement: requirementText(item),
    progress: state.reason === 'verified-runs-required' ? { current: state.current, required: state.required } : null,
  });
}

// Chikun coats are canvas filters. An engine without CanvasRenderingContext2D
// .filter draws the classic coat, so the Coat slot says so instead of implying
// the look shows. Outside a browser (no canvas at all) nothing is claimed.
export function canvasFilterSupported(scope = globalThis) {
  const Context = scope?.CanvasRenderingContext2D;
  return typeof Context !== 'function' || 'filter' in Context.prototype;
}
const NOTES = Object.freeze({ coat: 'This browser draws the classic coat. Update your browser to see coat colours.' });

// Pure view model of the panel for a store snapshot. `heroEntries` is the hero
// select's entry list (see heroOption); `canvasFilter` whether coats can show.
export function buildUnlockablesPanelModel(snapshot, { heroEntries = null, canvasFilter = true } = {}) {
  const unlocks = snapshot?.unlocks ?? {};
  const selection = snapshot?.selection ?? {};
  const optionFor = (item, selectedId) => {
    const state = unlockState(item, unlocks);
    const achievement = requiredAchievement(item);
    const status = item.artStatus !== 'ready' ? 'coming-soon' : state.unlocked ? (item.id === selectedId ? 'selected' : 'unlocked') : 'locked';
    return Object.freeze({
      id: item.id,
      title: item.title,
      swatch: item.swatch ?? null,
      status,
      requirement: requirementText(item),
      achievementId: achievement?.id ?? null,
      achievementTitle: achievement?.title ?? null,
      progress: state.reason === 'verified-runs-required' ? { current: state.current, required: state.required } : null,
    });
  };
  const games = Object.entries(COSMETIC_SLOTS).map(([gameId, slots]) => {
    const heroes = UNLOCKABLES.filter((item) => item.gameId === gameId && item.kind === 'character').map((item) => heroOption(item, snapshot, heroEntries));
    return Object.freeze({
      gameId,
      title: UNLOCKABLES_GAME_TITLES[gameId],
      heroes: Object.freeze(heroes),
      slots: Object.freeze(slots.map((slot) => {
        const items = UNLOCKABLES.filter((item) => item.gameId === gameId && item.kind === slot);
        const chosen = selection?.[gameId]?.[slot] ?? null;
        const chosenItem = items.find((item) => item.id === chosen);
        const selectedId = chosenItem && unlockState(chosenItem, unlocks).unlocked ? chosen : null;
        return Object.freeze({
          slot,
          label: UNLOCKABLES_SLOT_LABELS[slot],
          note: slot === 'coat' && !canvasFilter ? NOTES.coat : null,
          selectedId,
          options: Object.freeze([
            Object.freeze({ id: null, title: DEFAULT_LOOKS[slot], swatch: null, status: selectedId === null ? 'selected' : 'unlocked', requirement: '', achievementId: null, achievementTitle: null, progress: null }),
            ...items.map((item) => optionFor(item, selectedId)),
          ]),
        });
      })),
    });
  });
  return Object.freeze({ notice: unlockablesNotice(snapshot), games: Object.freeze(games) });
}

function ensureStylesheet(documentRef) {
  const head = documentRef.head ?? documentRef.querySelector?.('head');
  if (!head) return;
  if (typeof head.querySelector === 'function' && head.querySelector('link[data-unlockables-css]')) return;
  const link = documentRef.createElement('link');
  link.rel = 'stylesheet';
  link.href = UNLOCKABLES_PANEL_STYLESHEET;
  link.dataset.unlockablesCss = 'true';
  head.appendChild(link);
}

function text(documentRef, tag, value, className = '') {
  const node = documentRef.createElement(tag);
  if (className) node.className = className;
  node.textContent = value;
  return node;
}

const STATUS_WORDS = Object.freeze({ selected: 'Equipped', unlocked: 'Unlocked', locked: 'Locked', 'coming-soon': 'Coming soon' });

let serial = 0;
const panels = new WeakMap();

// Renders (or re-renders) the panel after `after` (the route grid). `view` is
// 'settings' or 'profile'; on another wallet's profile (`viewedWallet` is not
// `connectedWallet`) the panel hides. `heroEntries()` returns the hero select's
// entries for the Heroes rows. `openAchievements()` shows the own profile.
export function renderUnlockablesPanel({
  store,
  view = 'settings',
  viewedWallet = null,
  connectedWallet = null,
  own = isOwnUnlockablesView({ view, viewedWallet, connectedWallet }),
  heroEntries = null,
  canvasFilter = canvasFilterSupported(),
  documentRef = globalThis.document,
  after,
  app = null,
  openAchievements = () => {},
  requestFrame = (callback) => (typeof globalThis.requestAnimationFrame === 'function' ? globalThis.requestAnimationFrame(callback) : globalThis.setTimeout(callback, 16)),
} = {}) {
  if (!documentRef?.createElement || !after?.parentNode || !store?.snapshot) return null;
  ensureStylesheet(documentRef);
  let host = documentRef.getElementById?.(UNLOCKABLES_PANEL_ID) ?? null;
  if (!host) {
    host = documentRef.createElement('section');
    host.id = UNLOCKABLES_PANEL_ID;
    host.className = 'unlockables-panel';
    host.setAttribute('aria-labelledby', `${UNLOCKABLES_PANEL_ID}Title`);
  }
  if (host.parentNode !== after.parentNode || host.previousElementSibling !== after) after.parentNode.insertBefore(host, after.nextSibling);
  let state = panels.get(host);
  if (!state) {
    state = { status: '', unsubscribe: null, observer: null };
    panels.set(host, state);
  }
  state.view = VIEWS.has(view) ? view : 'settings';
  state.own = own !== false;
  state.store = store;
  state.app = app;
  state.openAchievements = openAchievements;
  state.heroEntries = typeof heroEntries === 'function' ? heroEntries : null;
  state.canvasFilter = canvasFilter !== false;
  state.requestFrame = requestFrame;
  state.documentRef = documentRef;

  const shownFor = (step) => state.own && (step === undefined || step === null || step === state.view);
  const syncVisibility = () => { host.hidden = !shownFor(state.app?.dataset?.step); };
  // Leaving the Settings or profile step hides the panel with no route hook.
  if (!state.observer && app && typeof globalThis.MutationObserver === 'function') {
    state.observer = new globalThis.MutationObserver(syncVisibility);
    state.observer.observe(app, { attributes: true, attributeFilter: ['data-step'] });
  }
  state.unsubscribe?.();
  state.unsubscribe = store.subscribe?.(() => { if (!host.hidden) paint(host, state); }) ?? null;
  syncVisibility();
  paint(host, state);
  return host;
}

function paint(host, state) {
  const { documentRef, store } = state;
  const snapshot = store.snapshot();
  let heroEntries = null;
  try { heroEntries = state.heroEntries?.() ?? null; } catch { heroEntries = null; }
  const model = buildUnlockablesPanelModel(snapshot, { heroEntries, canvasFilter: state.canvasFilter });
  const body = [];

  const header = documentRef.createElement('header');
  header.className = 'unlockables-head';
  header.append(text(documentRef, 'span', 'UNLOCKABLES', 'cabinet-status-label'));
  const title = text(documentRef, 'h2', 'Cosmetic looks', 'unlockables-title');
  title.id = `${UNLOCKABLES_PANEL_ID}Title`;
  header.append(title, text(documentRef, 'p', model.notice, 'unlockables-notice'));
  body.push(header);

  const live = text(documentRef, 'p', state.status, 'unlockables-status');
  live.setAttribute('role', 'status');
  live.setAttribute('aria-live', 'polite');

  for (const game of model.games) {
    const section = documentRef.createElement('section');
    section.className = 'unlockables-game';
    section.dataset.game = game.gameId;
    const heading = text(documentRef, 'h3', game.title, 'unlockables-game-title');
    heading.id = `unlockables-${game.gameId}-${++serial}`;
    section.setAttribute('aria-labelledby', heading.id);
    section.append(heading);
    if (game.heroes.length) section.append(renderHeroes(documentRef, game.heroes));
    for (const slot of game.slots) section.append(renderSlot(host, state, game, slot));
    body.push(section);
  }
  body.push(live);
  host.replaceChildren(...body);
}

function renderHeroes(documentRef, heroes) {
  const wrap = documentRef.createElement('div');
  wrap.className = 'unlockables-heroes';
  wrap.append(text(documentRef, 'p', 'Heroes', 'unlockables-slot-label'));
  const list = documentRef.createElement('ul');
  list.className = 'unlockables-hero-list';
  for (const hero of heroes) {
    const item = documentRef.createElement('li');
    item.className = 'unlockables-hero';
    item.dataset.state = hero.status;
    item.append(text(documentRef, 'strong', hero.title));
    const detail = hero.status === 'locked'
      ? `Locked · ${hero.requirement}${hero.progress ? ` (${hero.progress.current}/${hero.progress.required})` : ''}`
      : hero.status === 'unlocked' ? 'Unlocked · choose in hero select' : 'See the hero select';
    item.append(text(documentRef, 'small', detail));
    list.append(item);
  }
  wrap.append(list);
  return wrap;
}

function renderSlot(host, state, game, slot) {
  const { documentRef } = state;
  const fieldset = documentRef.createElement('fieldset');
  fieldset.className = 'unlockables-slot';
  fieldset.dataset.slot = slot.slot;
  fieldset.append(text(documentRef, 'legend', slot.label, 'unlockables-slot-label'));
  if (slot.note) fieldset.append(text(documentRef, 'p', slot.note, 'unlockables-requirement'));
  const list = documentRef.createElement('ul');
  list.className = 'unlockables-options';
  const name = `unlockables-${game.gameId}-${slot.slot}`;
  for (const option of slot.options) {
    const item = documentRef.createElement('li');
    item.className = 'unlockables-option';
    item.dataset.state = option.status;
    const inputId = `${name}-${option.id ?? 'default'}`;
    const input = documentRef.createElement('input');
    input.type = 'radio';
    input.name = name;
    input.id = inputId;
    input.value = option.id ?? '';
    input.className = 'unlockables-radio';
    input.checked = option.status === 'selected';
    input.disabled = option.status === 'locked' || option.status === 'coming-soon';
    const label = documentRef.createElement('label');
    label.htmlFor = inputId;
    label.className = 'unlockables-card';
    const swatch = documentRef.createElement('span');
    swatch.className = 'unlockables-swatch';
    swatch.setAttribute('aria-hidden', 'true');
    if (option.swatch) swatch.style.backgroundColor = option.swatch;
    else swatch.dataset.default = 'true';
    label.append(swatch, text(documentRef, 'span', option.title, 'unlockables-option-title'), text(documentRef, 'span', STATUS_WORDS[option.status], 'unlockables-option-state'));
    item.append(input, label);
    if (option.status === 'locked' || option.status === 'coming-soon') item.append(renderRequirement(host, state, game.gameId, option));
    input.addEventListener('change', () => {
      if (!input.checked) return;
      void choose(host, state, game.gameId, slot, option);
    });
    list.append(item);
  }
  fieldset.append(list);
  return fieldset;
}

function renderRequirement(host, state, gameId, option) {
  const { documentRef } = state;
  const line = documentRef.createElement('p');
  line.className = 'unlockables-requirement';
  if (option.status === 'coming-soon') {
    line.textContent = 'Coming soon';
    return line;
  }
  if (option.achievementId && option.achievementTitle) {
    line.append(documentRef.createTextNode('Earn '));
    const link = documentRef.createElement('a');
    link.className = 'unlockables-achievement-link';
    link.href = '/profile';
    link.textContent = option.achievementTitle;
    link.dataset.achievementId = option.achievementId;
    link.dataset.gameId = gameId;
    link.addEventListener('click', (event) => {
      if (event.defaultPrevented || event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      showAchievement(state, gameId, option.achievementId);
    });
    line.append(link);
    return line;
  }
  line.textContent = option.progress ? `${option.requirement} (${option.progress.current}/${option.progress.required})` : option.requirement;
  return line;
}

// Opens the player's own profile and brings its achievement list (and the
// named badge, when the list shows it) into view.
function showAchievement(state, gameId, achievementId) {
  try { state.openAchievements({ gameId, achievementId }); } catch { return; }
  const { documentRef } = state;
  let attempts = 0;
  const focus = () => {
    const badge = documentRef.querySelector?.(`[data-achievement="${achievementId}"]`) ?? null;
    const target = badge ?? documentRef.querySelector?.('.achievements-card') ?? null;
    if (!target) {
      if (++attempts < 30) state.requestFrame(focus);
      return;
    }
    target.scrollIntoView?.({ block: 'center' });
    if (badge) {
      if (!badge.hasAttribute?.('tabindex')) badge.setAttribute?.('tabindex', '-1');
      badge.focus?.({ preventScroll: true });
    }
  };
  state.requestFrame(focus);
}

async function choose(host, state, gameId, slot, option) {
  const label = `${slot.label}: ${option.title}`;
  let result = null;
  try { result = await state.store.select(gameId, slot.slot, option.id); } catch { result = null; }
  if (!result?.ok) {
    state.status = result?.error === 'locked' ? `${option.title} is locked.` : 'That look could not be saved. Try again.';
  } else if (result.saved === 'wallet') {
    state.status = `${label} saved to your wallet.`;
  } else if (result.saved === 'device') {
    state.status = result.error ? `${label} saved on this device. It saves to your wallet when you are signed in and online.` : `${label} saved on this device.`;
  } else {
    state.status = `${label} applies for this visit; this browser cannot store it.`;
  }
  paint(host, state);
  // Keep the keyboard where the player left it after the repaint.
  const input = state.documentRef.getElementById?.(`unlockables-${gameId}-${slot.slot}-${option.id ?? 'default'}`);
  input?.focus?.({ preventScroll: true });
}
