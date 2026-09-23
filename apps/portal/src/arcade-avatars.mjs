// Arcade avatars (contract §7.8, guide §5.7): a fixed set of existing site art a
// player can pick for their on-chain profile. PlayerProfileRegistry stores
// `avatarUri = 'lestersarcade:avatar/<id>'`; the index keeps only URIs of that
// shape (server/profile/sanitize.mjs), and every view resolves the id here.
// Custom uploads are out of scope for launch, so an unknown id renders the
// default avatar. Paths resolve against the portal's <base href="/">.
//
// Every file is small (a few KB): boards, the podium and the name editor show
// these as 56 px chips on phones. The four hero avatars are 128 px head crops
// of the hero portraits (scripts/build-arcade-avatar-thumbnails.py), never the
// 0.5 MB portrait strips themselves.

export const ARCADE_AVATAR_URI_PREFIX = 'lestersarcade:avatar/';
export const DEFAULT_ARCADE_AVATAR_ID = 'litecoin-chad';
const AVATAR_ID = /^[a-z0-9-]{1,32}$/;

export const ARCADE_AVATARS = Object.freeze([
  Object.freeze({ id: 'litecoin-chad', label: 'Litecoin Chad', src: './assets/generated/hmh-avatars/litecoin-chad-default.jpg' }),
  Object.freeze({ id: 'lester-pilot', label: 'Lester Pilot', src: './assets/lester-pilot.svg' }),
  Object.freeze({ id: 'lit-commando', label: 'Lit Commando', src: './assets/generated/arcade-avatars/lit-commando.webp' }),
  Object.freeze({ id: 'lit-valkyrie', label: 'Lit Valkyrie', src: './assets/generated/arcade-avatars/lit-valkyrie.webp' }),
  Object.freeze({ id: 'lester', label: 'Lester', src: './assets/generated/arcade-avatars/lester.webp' }),
  Object.freeze({ id: 'lilly', label: 'Lilly', src: './assets/generated/arcade-avatars/lilly.webp' }),
  Object.freeze({ id: 'chikun', label: 'Chikun', src: './assets/generated/chikun-ragdoll-v1/head.webp' }),
  Object.freeze({ id: 'gold-emblem', label: 'Gold Emblem', src: './assets/generated/hmh-achievement-atlas/tier-gold.png' }),
  Object.freeze({ id: 'diamond-emblem', label: 'Diamond Emblem', src: './assets/generated/hmh-achievement-atlas/tier-diamond.png' }),
  Object.freeze({ id: 'mythic-emblem', label: 'Mythic Emblem', src: './assets/generated/hmh-achievement-atlas/tier-mythic.png' }),
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
