// The world option on the Hard Money Heroes mode select.
//
// Before game 2.1.0 it is the "New Frontier (preview)" option: a second Free
// start, not a mode. Clicking it asks main.js to start an ordinary unranked
// Free session and to have the HMH host request the W4a ten-area world
// (hmh-reboot-host.mjs) for that session only. The 2.0.x child never records
// a run summary, a score or an achievement on that world, so the copy says so.
//
// From game 2.1.0 the ten-area world is Level 1 for Free and Ranked, so the
// option becomes "Original map (Free only)": the same second Free start, now
// requesting the legacy six-district map, which the 2.1.0 child runs for an
// unranked Free session only, with the usual Free result and share card.
// No wallet, chain, storage or network involvement either way.
import { GAME_VERSION } from './version-tracking.mjs';
import { isHmhV8GameVersion } from '../../../sdk/hmh-run-v8-build.mjs';

// This portal hosts a child whose Level 1 is the ten-area world.
export const HMH_TEN_AREA_LEVEL_ONE = isHmhV8GameVersion(GAME_VERSION);

export const HMH_FRONTIER_PREVIEW_COPY = Object.freeze({
  button: 'Explore the New Frontier (preview)',
  note: 'Unfinished ten-area world in Free Mode. Unranked: no leaderboard, no run result and no share card.',
  title: 'New Frontier (preview)',
  gameplay: 'New Frontier preview: unfinished ten-area world, Free and unranked; no result, leaderboard or share card.',
  result: 'Preview run: New Frontier runs are unranked and have no result or share card.',
  // The level intro the preview shows instead of the legacy Forked Frontier
  // card (QA sweep 2026-10-01). The world's proposed name matches the child's
  // loading panel (apps/hmh-reboot/src/world-v2-gameplay.mjs).
  intro: Object.freeze({
    eyebrow: 'Hard Money Heroes // New Frontier (preview)',
    title: 'The Litecoin Frontier',
    body: 'Ten areas joined by roads, from the MWEB Meadows to the Fork Fortress. Light the Meadows relay, find a cache in every area and take on the Liquidator, the Rug Pull Baron, the Lockkeeper and the 51% Foreman in their courts. This world is unfinished: runs are Free and unranked, with no result, leaderboard or share card.',
  }),
});

// The Level 1 intro a 2.1.0 portal shows by default: the ten-area world is
// Level 1, so no preview wording (QA sweep merge, 2026-10-01).
export const HMH_TEN_AREA_LEVEL_ONE_INTRO = Object.freeze({
  eyebrow: 'Hard Money Heroes // Level 1',
  title: 'Level 1: The Litecoin Frontier',
  body: 'Ten areas joined by roads, from the MWEB Meadows to the Fork Fortress. Light the Meadows relay, find a cache in every area and take on the Liquidator, the Rug Pull Baron, the Lockkeeper and the 51% Foreman in their courts. Your approach changes each run; keep moving as the horde closes in. The run ends when your hero falls.',
});

// Which level intro the card shows: before 2.1.0 the preview start gets the
// preview copy and an ordinary run the page's own (legacy) card; from 2.1.0
// an ordinary run gets the ten-area Level 1 copy and the original-map start
// the page's own Forked Frontier card.
export function hmhLevelIntroMode({ levelOne = HMH_TEN_AREA_LEVEL_ONE, optionRequested = false } = {}) {
  if (levelOne) return optionRequested ? 'legacy' : 'level-one';
  return optionRequested ? 'preview' : 'legacy';
}

// Swaps the level intro card's eyebrow, title and story and restores the
// page's own copy for 'legacy'. `mode` is 'preview', 'level-one' or 'legacy'
// (true/false keep meaning preview/legacy). Returns the copy now showing.
export function applyHmhFrontierPreviewIntro(section, mode) {
  const resolved = mode === true ? 'preview' : mode === 'preview' || mode === 'level-one' ? mode : 'legacy';
  const card = section?.querySelector?.('.level-intro-card');
  if (!card) return null;
  const copy = resolved === 'preview' ? HMH_FRONTIER_PREVIEW_COPY.intro : resolved === 'level-one' ? HMH_TEN_AREA_LEVEL_ONE_INTRO : null;
  const slots = [['eyebrow', card.querySelector('.eyebrow')], ['title', card.querySelector('h2')], ['body', card.querySelector('h2 + p')]];
  for (const [key, element] of slots) {
    if (!element) continue;
    if (element.dataset.legacyCopy === undefined) element.dataset.legacyCopy = element.textContent;
    element.textContent = copy ? copy[key] : element.dataset.legacyCopy;
  }
  return resolved;
}

export const HMH_ORIGINAL_MAP_COPY = Object.freeze({
  button: 'Play the original map (Free only)',
  note: 'The six-district Forked Frontier from before the ten-area world. Free Mode only, with the usual result and share card; Ranked runs play the ten-area world.',
  title: 'Original map (Free only)',
});

// What the option requests for this portal's child, and how it reads.
export function hmhWorldOption(levelOne = HMH_TEN_AREA_LEVEL_ONE) {
  return levelOne
    ? Object.freeze({ world: 'legacy', copy: HMH_ORIGINAL_MAP_COPY, ids: Object.freeze({ root: 'hmhOriginalMapOption', button: 'hmhOriginalMapButton', note: 'hmhOriginalMapNote' }) })
    : Object.freeze({ world: 'ten-area', copy: HMH_FRONTIER_PREVIEW_COPY, ids: Object.freeze({ root: 'hmhFrontierPreviewOption', button: 'hmhFrontierPreviewButton', note: 'hmhFrontierPreviewNote' }) });
}
export const HMH_WORLD_OPTION = hmhWorldOption();

export function mountHmhFrontierPreviewOption({ documentRef = document, container, before = null, onStart, option = HMH_WORLD_OPTION } = {}) {
  if (!container?.append) throw new TypeError('HMH frontier preview needs the mode-select container');
  if (typeof onStart !== 'function') throw new TypeError('HMH frontier preview needs a Free start authority');
  const root = documentRef.createElement('div');
  root.id = option.ids.root;
  root.className = 'hmh-frontier-preview';
  const button = documentRef.createElement('button');
  button.type = 'button';
  button.id = option.ids.button;
  button.className = 'secondary';
  button.textContent = option.copy.button;
  button.setAttribute('aria-describedby', option.ids.note);
  const note = documentRef.createElement('p');
  note.id = option.ids.note;
  note.className = 'tiny-note';
  note.textContent = option.copy.note;
  root.append(button, note);
  button.addEventListener('click', () => onStart());
  if (before?.parentNode && typeof before.before === 'function') before.before(root);
  else container.append(root);
  return Object.freeze({
    root,
    button,
    note,
    // Only the Hard Money Heroes cabinet has this world.
    render(gameId) { root.hidden = gameId !== 'lester-blaster'; },
  });
}
