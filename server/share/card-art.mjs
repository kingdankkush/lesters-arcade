// Share-card background art revisions (contract §7.5: a new card image URL
// whenever anything visible on it changes). A game listed here folds its
// `revision` into every card revision (server/neon/queries.mjs cardRevision),
// so replacing its background moves every cardRev, every share page's
// og:image ?v= and, through the stale-revision 302 in api/share-card.mjs, every
// old shared link to the new image. A game that is not listed keeps its
// revisions (Chikun and STACKED: their backgrounds did not change).
//
// `sha256` is the committed apps/portal/assets/share-cards/<gameId>.png;
// tests/share-card-art.test.mjs fails when the PNG changes without a new
// revision here. Written by scripts/build-share-card-backgrounds.py.
export const SHARE_CARD_ART = Object.freeze({
  // 2026-09-26: the owner's HMH-RankedMode-Share art (docs/art/HMH-BANNERS-20260926.md 6.1).
  'lester-blaster': Object.freeze({ revision: 'hmh-art-2026-09-26', sha256: 'a2261a76c7f2d0fef5ee6001b7960d3a9b8d5109c551f8096323ef1dc39a0ea7' }),
});

export function shareCardArtRevision(gameId) {
  return Object.hasOwn(SHARE_CARD_ART, String(gameId)) ? SHARE_CARD_ART[gameId].revision : null;
}
