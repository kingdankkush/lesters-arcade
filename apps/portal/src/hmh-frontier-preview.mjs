// The "New Frontier (preview)" option on the Hard Money Heroes mode select.
//
// It is a second Free start, not a mode: clicking it asks main.js to start an
// ordinary unranked Free session and to have the HMH host request the W4a
// ten-area world (hmh-reboot-host.mjs) for that session only. The child never
// records a run summary, a score or an achievement on that world, so the copy
// says so. No wallet, chain, storage or network involvement.
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

// Swaps the level intro card's eyebrow, title and story for the preview and
// restores the page's own copy for an ordinary run. Returns whether the
// preview copy is showing.
export function applyHmhFrontierPreviewIntro(section, active) {
  const card = section?.querySelector?.('.level-intro-card');
  if (!card) return false;
  const slots = [['eyebrow', card.querySelector('.eyebrow')], ['title', card.querySelector('h2')], ['body', card.querySelector('h2 + p')]];
  for (const [key, element] of slots) {
    if (!element) continue;
    if (element.dataset.legacyCopy === undefined) element.dataset.legacyCopy = element.textContent;
    element.textContent = active ? HMH_FRONTIER_PREVIEW_COPY.intro[key] : element.dataset.legacyCopy;
  }
  return Boolean(active);
}

export function mountHmhFrontierPreviewOption({ documentRef = document, container, before = null, onStart } = {}) {
  if (!container?.append) throw new TypeError('HMH frontier preview needs the mode-select container');
  if (typeof onStart !== 'function') throw new TypeError('HMH frontier preview needs a Free start authority');
  const root = documentRef.createElement('div');
  root.id = 'hmhFrontierPreviewOption';
  root.className = 'hmh-frontier-preview';
  const button = documentRef.createElement('button');
  button.type = 'button';
  button.id = 'hmhFrontierPreviewButton';
  button.className = 'secondary';
  button.textContent = HMH_FRONTIER_PREVIEW_COPY.button;
  button.setAttribute('aria-describedby', 'hmhFrontierPreviewNote');
  const note = documentRef.createElement('p');
  note.id = 'hmhFrontierPreviewNote';
  note.className = 'tiny-note';
  note.textContent = HMH_FRONTIER_PREVIEW_COPY.note;
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
