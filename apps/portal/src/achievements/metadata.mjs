// ERC-721 metadata for achievements (contract §6.6). Published in phase 2; the
// files are generated now so the NFT subset can change without new paths.
// Upgrading the art means replacing the image (or adding `animation_url`), never
// re-minting: token URIs stay `<baseTokenUri><id>.json`.
export const ACHIEVEMENT_SITE_ORIGIN = 'https://lestersarcade.io';
export const ACHIEVEMENT_SEASON = 'LiteForge testnet';

// Slug = on-chain gameId (§2.1); route slug = the portal game route.
export const ACHIEVEMENT_GAMES = Object.freeze({
  'lester-blaster': Object.freeze({ title: 'Hard Money Heroes', routeSlug: 'hard-money-heroes' }),
  chikun: Object.freeze({ title: "Chikun's Escape", routeSlug: 'chikun' }),
  stacked: Object.freeze({ title: 'STACKED', routeSlug: 'stacked' }),
});

const gameInfo = (gameId) => {
  const game = typeof gameId === 'string' && Object.hasOwn(ACHIEVEMENT_GAMES, gameId) ? ACHIEVEMENT_GAMES[gameId] : null;
  if (!game) throw new Error(`unknown achievement gameId: ${String(gameId)}`);
  return game;
};
const words = (slug) => slug.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
const sitePath = (path, label) => {
  if (typeof path !== 'string' || !/^\/[A-Za-z0-9/._-]+$/.test(path) || path.includes('..')) throw new Error(`${label} must be a site-root path`);
  return `${ACHIEVEMENT_SITE_ORIGIN}${path}`;
};

export function baseTokenUriFor(gameId) {
  gameInfo(gameId);
  return `${ACHIEVEMENT_SITE_ORIGIN}/achievements/${gameId}/`;
}

export function tokenUriPathFor(entry) {
  return `${entry.id}.json`;
}

// Repo-relative output file for an entry: apps/portal/achievements/<gameId>/<id>.json.
export function achievementMetadataFile(entry) {
  gameInfo(entry.gameId);
  return `apps/portal/achievements/${entry.gameId}/${tokenUriPathFor(entry)}`;
}

export function buildAchievementMetadata(entry) {
  const game = gameInfo(entry?.gameId);
  const metadata = {
    name: entry.title,
    description: entry.description,
    image: sitePath(entry.image, 'image'),
    external_url: `${ACHIEVEMENT_SITE_ORIGIN}/games/${game.routeSlug}`,
    attributes: [
      { trait_type: 'Game', value: game.title },
      { trait_type: 'Tier', value: words(entry.tier) },
      { trait_type: 'Category', value: words(entry.category) },
      { trait_type: 'Soulbound', value: 'Yes' },
      { trait_type: 'Season', value: ACHIEVEMENT_SEASON },
    ],
  };
  // Reserved for the 3D / effects upgrade: a .glb model or a self-contained .html viewer.
  if (entry.animation !== undefined) {
    if (!/\.(glb|html)$/.test(entry.animation ?? '')) throw new Error('animation must be a .glb or .html site-root path');
    metadata.animation_url = sitePath(entry.animation, 'animation');
  }
  return metadata;
}

// Deterministic JSON: object keys sorted at every depth, two-space indent, trailing newline.
function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeys(value[key])]));
  return value;
}
export function serializeAchievementMetadata(metadata) {
  return `${JSON.stringify(sortKeys(metadata), null, 2)}\n`;
}
