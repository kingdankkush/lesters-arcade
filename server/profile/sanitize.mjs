// Sanitizers for everything that reaches wallet_profiles (contract §8.4,
// §4.3.6, A29).
//
// Names and avatars come only from PlayerProfileRegistry, which anyone can
// write directly, so they are re-checked here: the contract charset, then
// moderateName. A failing name is stored as NULL with the moderation reason,
// so it never reaches a board, profile, share page, card or unfurl. The owner
// flags hidden and board_excluded are never derived from chain data.

import { moderateName } from '../../apps/portal/src/name-moderation.mjs';

export const DISPLAY_NAME_PATTERN = /^[A-Za-z0-9 _.-]{3,18}$/;
export const AVATAR_URI_PATTERN = /^lestersarcade:avatar\/[a-z0-9-]{1,32}$/;
const HANDLE_HASH = /^0x[0-9a-f]{64}$/;
const ZERO32 = `0x${'0'.repeat(64)}`;
export const PREFERENCES_MAX_BYTES = 2048;
const GAME_IDS = Object.freeze(['lester-blaster', 'chikun', 'stacked']);
const CHARACTER_ID = /^[a-z0-9-]{1,32}$/;
const COSMETIC_SLOT = /^[a-z-]{1,24}$/;
const COSMETIC_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,47}$/;

function field(result, name, index) {
  if (!result) return undefined;
  const named = result[name];
  return named !== undefined ? named : result[index];
}

// `getProfileResult` is the decoded getProfile(address) tuple: an ethers
// Result or a plain { handle, displayName, avatarUri, createdAt, lastUpdated,
// exists } object.
export function sanitizeOnchainProfile(getProfileResult) {
  const exists = field(getProfileResult, 'exists', 5);
  const empty = { displayName: null, nameBlocked: null, handleHash: null, avatarUri: null };
  if (!getProfileResult || exists === false) return empty;
  // Mirror of PlayerProfileRegistry: trim 0x20 ends, collapse space runs.
  const rawName = String(field(getProfileResult, 'displayName', 1) ?? '');
  const cleaned = rawName.replace(/^ +| +$/g, '').replace(/ {2,}/g, ' ');
  let displayName = null;
  let nameBlocked = null;
  if (DISPLAY_NAME_PATTERN.test(cleaned)) {
    const verdict = moderateName(cleaned);
    if (verdict.ok) displayName = cleaned;
    else nameBlocked = verdict.reason;
  }
  const avatar = String(field(getProfileResult, 'avatarUri', 2) ?? '');
  const handle = String(field(getProfileResult, 'handle', 0) ?? '').toLowerCase();
  return {
    displayName,
    nameBlocked,
    handleHash: HANDLE_HASH.test(handle) && handle !== ZERO32 ? handle : null,
    avatarUri: AVATAR_URI_PATTERN.test(avatar) ? avatar : null,
  };
}

function plainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

// E7 PUT body preferences. Unknown keys and malformed values are dropped;
// returns null when the input is not an object or the result exceeds 2 KB.
export function sanitizePreferences(input) {
  if (!plainObject(input)) return null;
  const out = {};
  if (typeof input.selectedCharacterId === 'string' && CHARACTER_ID.test(input.selectedCharacterId)) out.selectedCharacterId = input.selectedCharacterId;
  if (plainObject(input.cosmetics)) {
    const cosmetics = {};
    for (const gameId of GAME_IDS) {
      const slots = input.cosmetics[gameId];
      if (!plainObject(slots)) continue;
      const kept = {};
      for (const [slot, id] of Object.entries(slots)) {
        if (COSMETIC_SLOT.test(slot) && typeof id === 'string' && COSMETIC_ID.test(id)) kept[slot] = id;
      }
      if (Object.keys(kept).length) cosmetics[gameId] = kept;
    }
    out.cosmetics = cosmetics;
  }
  if (typeof input.nameClaimDismissed === 'boolean') out.nameClaimDismissed = input.nameClaimDismissed;
  if (Buffer.byteLength(JSON.stringify(out), 'utf8') > PREFERENCES_MAX_BYTES) return null;
  return out;
}
