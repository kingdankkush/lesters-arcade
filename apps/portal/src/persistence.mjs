// Local persistence layer for Lester's Arcade (P0 from the analysis roadmap).
//
// Saves the durable slices of arcade state (player profiles, usernames,
// cadence leaderboards, ranked run history) to a storage backend with the
// localStorage get/set/removeItem contract. Pure + DOM-free: main.js passes
// globalThis.localStorage in the browser; tests pass an in-memory mock.
//
// Versioned snapshot format so future schema changes can migrate or discard
// stale saves instead of crashing on shape drift. Quota-safe: on a failed
// write the save retries without avatar data URLs (the largest payload),
// then without leaderboards, before giving up.

export const ARCADE_PERSIST_KEY = 'lesters-arcade-save-v1';
export const ARCADE_PERSIST_VERSION = 1;
export const RUN_HISTORY_LIMIT = 50;

function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Build the serializable snapshot of everything worth keeping across reloads.
export function snapshotArcadeState(state, { includeAvatars = true, includeLeaderboards = true } = {}) {
  if (!state || typeof state !== 'object') throw new Error('state is required');
  const profiles = {};
  for (const [wallet, profile] of Object.entries(state.profiles ?? {})) {
    if (!profile || typeof profile !== 'object') continue;
    const copy = { ...profile };
    if (!includeAvatars) delete copy.avatarDataUrl;
    profiles[wallet] = copy;
  }
  return {
    version: ARCADE_PERSIST_VERSION,
    savedAt: new Date().toISOString(),
    seeded: Boolean(state.__seededLeaderboard),
    profiles,
    usernames: { ...(state.usernames ?? {}) },
    cadenceLeaderboards: includeLeaderboards ? (state.cadenceLeaderboards ?? {}) : null,
    runHistory: Array.isArray(state.runHistory) ? state.runHistory.slice(0, RUN_HISTORY_LIMIT) : [],
  };
}

// Mutates `state` with the snapshot's contents. Returns true when anything was
// restored. Unknown versions are ignored (fresh start beats a crash loop).
export function restoreArcadeState(state, snapshot) {
  if (!state || typeof state !== 'object') throw new Error('state is required');
  if (!snapshot || typeof snapshot !== 'object') return false;
  if (snapshot.version !== ARCADE_PERSIST_VERSION) return false;

  let restored = false;
  if (snapshot.profiles && typeof snapshot.profiles === 'object') {
    state.profiles = { ...(state.profiles ?? {}) };
    for (const [wallet, profile] of Object.entries(snapshot.profiles)) {
      if (profile && typeof profile === 'object') {
        state.profiles[wallet] = { ...profile };
        restored = true;
      }
    }
  }
  if (snapshot.usernames && typeof snapshot.usernames === 'object') {
    state.usernames = { ...(state.usernames ?? {}), ...snapshot.usernames };
    restored = true;
  }
  if (snapshot.cadenceLeaderboards && typeof snapshot.cadenceLeaderboards === 'object') {
    state.cadenceLeaderboards = snapshot.cadenceLeaderboards;
    restored = true;
  }
  if (Array.isArray(snapshot.runHistory)) {
    state.runHistory = snapshot.runHistory.slice(0, RUN_HISTORY_LIMIT);
    restored = true;
  }
  if (snapshot.seeded) state.__seededLeaderboard = true;
  return restored;
}

// Persist to storage. Falls back to progressively smaller payloads when the
// backend rejects the write (quota). Returns { ok, bytes, dropped }.
export function saveArcadeState(state, storage, { key = ARCADE_PERSIST_KEY } = {}) {
  if (!storage || typeof storage.setItem !== 'function') return { ok: false, bytes: 0, dropped: [], reason: 'no-storage' };
  const attempts = [
    { includeAvatars: true, includeLeaderboards: true, dropped: [] },
    { includeAvatars: false, includeLeaderboards: true, dropped: ['avatars'] },
    { includeAvatars: false, includeLeaderboards: false, dropped: ['avatars', 'leaderboards'] },
  ];
  for (const attempt of attempts) {
    try {
      const payload = JSON.stringify(snapshotArcadeState(state, attempt));
      storage.setItem(key, payload);
      return { ok: true, bytes: payload.length, dropped: attempt.dropped };
    } catch {
      // quota or serialization failure — retry with a smaller payload
    }
  }
  return { ok: false, bytes: 0, dropped: [], reason: 'write-failed' };
}

// Load from storage into state. Returns true when a valid snapshot was applied.
export function loadArcadeState(state, storage, { key = ARCADE_PERSIST_KEY } = {}) {
  if (!storage || typeof storage.getItem !== 'function') return false;
  let raw = null;
  try {
    raw = storage.getItem(key);
  } catch {
    return false;
  }
  if (!raw) return false;
  const snapshot = safeParse(raw);
  if (!snapshot) {
    // Corrupt save: clear it so the next session starts clean.
    try { storage.removeItem(key); } catch { /* ignore */ }
    return false;
  }
  return restoreArcadeState(state, snapshot);
}

// Append a completed-run record (ranked submissions; free practice is
// intentionally untracked per the product copy). Newest first, capped.
export function appendRunRecord(state, record, { limit = RUN_HISTORY_LIMIT } = {}) {
  if (!state || typeof state !== 'object') throw new Error('state is required');
  if (!record || typeof record !== 'object') throw new Error('record is required');
  state.runHistory ??= [];
  state.runHistory.unshift({
    recordedAt: new Date().toISOString(),
    ...record,
  });
  if (state.runHistory.length > limit) state.runHistory.length = limit;
  return state.runHistory[0];
}
