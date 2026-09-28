// Arcade avatars (contract §7.8, guide §5.7): a fixed set of existing site art a
// player can pick for their on-chain profile. PlayerProfileRegistry stores
// `avatarUri = 'lestersarcade:avatar/<id>'`; the index keeps only URIs of that
// shape (server/profile/sanitize.mjs), and every view resolves the id here.
// An unknown id (including the presets retired in 1.9.3: lester-pilot,
// gold-emblem, diamond-emblem, mythic-emblem) renders the default avatar.
// Paths resolve against the portal's <base href="/">.
//
// A signed-in wallet can also upload its own picture (1.9.3, api/avatar.mjs).
// The index then returns `avatarUrl` ('/api/avatar?wallet=0x…&v=<12 hex>')
// next to the on-chain avatarUri, and resolveAvatar() prefers it: custom
// upload, then the on-chain preset, then the default. Only that exact
// same-origin path shape is ever used as an image source.
//
// Every file is small (a few KB): boards, the podium and the name editor show
// these as 56 px chips on phones. The four hero avatars are 128 px head crops
// of the hero portraits (scripts/build-arcade-avatar-thumbnails.py), never the
// 0.5 MB portrait strips themselves.

export const ARCADE_AVATAR_URI_PREFIX = 'lestersarcade:avatar/';
export const DEFAULT_ARCADE_AVATAR_ID = 'litecoin-chad';
export const CUSTOM_AVATAR_PATH = '/api/avatar';
const AVATAR_ID = /^[a-z0-9-]{1,32}$/;
const CUSTOM_AVATAR_URL = /^\/api\/avatar\?wallet=0x[0-9a-f]{40}&v=[0-9a-f]{12}$/;
const WALLET = /^0x[0-9a-fA-F]{40}$/;
const SHA256_HEX = /^[0-9a-f]{64}$/;

export const ARCADE_AVATARS = Object.freeze([
  Object.freeze({ id: 'litecoin-chad', label: 'Litecoin Chad', src: './assets/generated/hmh-avatars/litecoin-chad-default.jpg' }),
  Object.freeze({ id: 'lit-commando', label: 'Lit Commando', src: './assets/generated/arcade-avatars/lit-commando.webp' }),
  Object.freeze({ id: 'lit-valkyrie', label: 'Lit Valkyrie', src: './assets/generated/arcade-avatars/lit-valkyrie.webp' }),
  Object.freeze({ id: 'lester', label: 'Lester', src: './assets/generated/arcade-avatars/lester.webp' }),
  Object.freeze({ id: 'lilly', label: 'Lilly', src: './assets/generated/arcade-avatars/lilly.webp' }),
  Object.freeze({ id: 'chikun', label: 'Chikun', src: './assets/generated/chikun-ragdoll-v1/head.webp' }),
]);

const BY_ID = new Map(ARCADE_AVATARS.map((avatar) => [avatar.id, avatar]));

// 'lestersarcade:avatar/<id>' for a known avatar id, else null.
export function avatarUriFor(id) {
  const key = String(id ?? '');
  return AVATAR_ID.test(key) && BY_ID.has(key) ? `${ARCADE_AVATAR_URI_PREFIX}${key}` : null;
}

// The avatar an index avatarUri names, or null (hidden profiles, no avatar,
// or an id this build does not ship).
export function arcadeAvatarForUri(uri) {
  const text = String(uri ?? '');
  if (!text.startsWith(ARCADE_AVATAR_URI_PREFIX)) return null;
  const id = text.slice(ARCADE_AVATAR_URI_PREFIX.length);
  return AVATAR_ID.test(id) ? BY_ID.get(id) ?? null : null;
}

export function defaultArcadeAvatar() {
  return BY_ID.get(DEFAULT_ARCADE_AVATAR_ID);
}

// The public URL of a wallet's uploaded avatar: '/api/avatar?wallet=<lower
// wallet>&v=<first 12 hex of the image SHA-256>', or null. The server builds
// every avatarUrl with this, so a new upload is a new URL (cache busting).
export function customAvatarUrlFor(wallet, sha256) {
  const who = String(wallet ?? '');
  const digest = String(sha256 ?? '').toLowerCase();
  if (!WALLET.test(who) || !SHA256_HEX.test(digest)) return null;
  return `${CUSTOM_AVATAR_PATH}?wallet=${who.toLowerCase()}&v=${digest.slice(0, 12)}`;
}

// An index avatarUrl when it is exactly the same-origin upload path, else
// null: never an absolute or foreign URL, never anything with extra params.
export function customAvatarUrl(value) {
  const text = String(value ?? '');
  return CUSTOM_AVATAR_URL.test(text) ? text : null;
}

// What an avatar slot shows for a board row, a profile or a session:
// { src, alt, kind } with kind 'custom' (the wallet's upload), 'preset' (the
// on-chain arcade avatar) or 'default' (Litecoin Chad).
export function resolveAvatar(entry = {}) {
  const custom = customAvatarUrl(entry?.avatarUrl);
  if (custom) return Object.freeze({ src: custom, alt: 'Player avatar', kind: 'custom' });
  const preset = arcadeAvatarForUri(entry?.avatarUri);
  if (preset) return Object.freeze({ src: preset.src, alt: `${preset.label} avatar`, kind: 'preset' });
  const fallback = defaultArcadeAvatar();
  return Object.freeze({ src: fallback.src, alt: `${fallback.label} avatar`, kind: 'default' });
}
