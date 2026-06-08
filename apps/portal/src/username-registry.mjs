// Username / display-name registry for Lester's Arcade.
//
// Wallet address is the durable identity. A player may optionally set a
// display username in profile settings; that username becomes the name shown
// on leaderboards instead of the truncated wallet address.
//
// Rules enforced here (pure, DOM-free, testable):
//   - length 3-18
//   - allowed charset: letters, digits, single internal spaces, _ - .
//   - case-insensitive global uniqueness (no two wallets share a name)
//   - blocks vulgar / hate-speech names (substring match after leetspeak +
//     separator normalization so "f.u.c.k" / "n1gg3r" style evasions are caught)
//
// The wallet that already owns a name keeps it (idempotent re-save / re-case).

export const USERNAME_RULES = Object.freeze({
  minLength: 3,
  maxLength: 18,
  // letters, digits, space, underscore, hyphen, period
  allowedPattern: /^[A-Za-z0-9 _.-]+$/,
  appearsOnLeaderboards: true,
});

// Hate-speech / vulgarity blocklist. Kept intentionally small + focused on
// slurs and hard profanity; matched as substrings against a normalized form so
// common obfuscations (leetspeak, separators) are caught. This is a prototype
// guardrail, not a complete moderation system; a production build should layer
// a maintained service on top.
const BLOCKED_TERMS = Object.freeze([
  // hate speech / slurs
  'nigger', 'nigga', 'faggot', 'fag', 'retard', 'chink', 'spic', 'kike',
  'wetback', 'tranny', 'coon', 'gook', 'paki', 'beaner', 'dyke',
  // hard profanity
  'fuck', 'shit', 'cunt', 'bitch', 'bastard', 'whore', 'slut', 'dick',
  'pussy', 'cock', 'asshole', 'rape', 'nazi', 'hitler', 'kkk',
]);

const LEET_MAP = Object.freeze({
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b',
  '@': 'a', '$': 's', '!': 'i', '|': 'i',
});

// Normalize a name for moderation: lowercase, map leetspeak to letters, strip
// every non-letter so separators (".", "-", "_", spaces) cannot be used to
// split a banned word. "n.1.g.g.3.r" -> "nigger".
export function normalizeForModeration(name) {
  const lowered = String(name ?? '').toLowerCase();
  let mapped = '';
  for (const ch of lowered) {
    mapped += LEET_MAP[ch] ?? ch;
  }
  return mapped.replace(/[^a-z]/g, '');
}

// Normalize a name for uniqueness comparison: trim, collapse internal
// whitespace, lowercase. Two names that differ only by case/spacing collide.
export function normalizeForUniqueness(name) {
  return String(name ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function containsBlockedTerm(name) {
  const moderated = normalizeForModeration(name);
  return BLOCKED_TERMS.some((term) => moderated.includes(term));
}

// Validate a candidate username WITHOUT checking uniqueness. Returns
// { valid, cleaned, error } where cleaned is the trimmed/space-collapsed form
// to store, and error is a stable machine code when invalid.
export function validateUsername(rawName) {
  if (typeof rawName !== 'string') {
    return { valid: false, cleaned: '', error: 'invalid-type', message: 'Username must be text.' };
  }
  const cleaned = rawName.trim().replace(/\s+/g, ' ');

  if (cleaned.length < USERNAME_RULES.minLength) {
    return { valid: false, cleaned, error: 'too-short', message: `Username must be at least ${USERNAME_RULES.minLength} characters.` };
  }
  if (cleaned.length > USERNAME_RULES.maxLength) {
    return { valid: false, cleaned, error: 'too-long', message: `Username must be ${USERNAME_RULES.maxLength} characters or fewer.` };
  }
  if (!USERNAME_RULES.allowedPattern.test(cleaned)) {
    return { valid: false, cleaned, error: 'invalid-characters', message: 'Use only letters, numbers, spaces, and _ - . characters.' };
  }
  if (containsBlockedTerm(cleaned)) {
    return { valid: false, cleaned, error: 'blocked-term', message: 'That username contains blocked language. Choose another.' };
  }

  return { valid: true, cleaned, error: null, message: 'Username is available.' };
}

// State-aware uniqueness check. `state.usernames` maps a normalized name to the
// owning wallet. The owning wallet may re-claim its own name.
export function isUsernameAvailable(state, name, wallet) {
  const key = normalizeForUniqueness(name);
  const registry = state?.usernames ?? {};
  const owner = registry[key];
  if (!owner) return true;
  if (!wallet) return false;
  try {
    return owner === normalizeWalletLower(wallet);
  } catch {
    return false;
  }
}

function normalizeWalletLower(wallet) {
  const normalized = String(wallet).trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(normalized)) {
    throw new Error(`Invalid EVM wallet address: ${wallet}`);
  }
  return normalized;
}

// Full set-username flow against arcade state. On success it:
//   - releases the wallet's previous name (if any) from the registry
//   - reserves the new normalized name -> wallet
//   - writes profile.handle + profile.usernameSet = true
// Returns { ok, username, error, message }.
export function setPlayerUsername(state, wallet, rawName, { ensureProfile } = {}) {
  if (!state || typeof state !== 'object') {
    throw new Error('state is required');
  }
  if (typeof ensureProfile !== 'function') {
    throw new Error('ensureProfile callback is required');
  }
  const walletKey = normalizeWalletLower(wallet);

  const validation = validateUsername(rawName);
  if (!validation.valid) {
    return { ok: false, username: null, error: validation.error, message: validation.message };
  }

  state.usernames ??= {};
  const newKey = normalizeForUniqueness(validation.cleaned);

  const existingOwner = state.usernames[newKey];
  if (existingOwner && existingOwner !== walletKey) {
    return { ok: false, username: null, error: 'name-taken', message: 'That username is already taken. Choose another.' };
  }

  const profile = ensureProfile(state, walletKey);

  // Release any previous name this wallet held.
  const previousKey = profile.usernameKey;
  if (previousKey && previousKey !== newKey) {
    delete state.usernames[previousKey];
  }

  state.usernames[newKey] = walletKey;
  profile.handle = validation.cleaned;
  profile.usernameKey = newKey;
  profile.usernameSet = true;

  return { ok: true, username: validation.cleaned, error: null, message: 'Username saved.' };
}

// The name to display on a leaderboard/profile for a given wallet+profile:
// the set username, else a truncated wallet address.
export function resolveDisplayName(profile, wallet) {
  if (profile?.usernameSet && profile.handle) {
    return profile.handle;
  }
  const addr = String(profile?.wallet ?? wallet ?? '');
  if (/^0x[a-fA-F0-9]{40}$/.test(addr)) {
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  }
  return profile?.handle ?? addr ?? 'Player';
}
