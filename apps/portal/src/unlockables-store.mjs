// Per-wallet unlock cache and cosmetic selection (contract A7, §7.9).
//
// The store keeps unlocksFromProfileResponse(E6) for the connected wallet in
// localStorage under `lesters-arcade-unlocks-v1:<wallet>` for seven days, so
// unlocks follow the wallet into Free Mode and offline play. It refreshes the
// entry from GET /api/profile when:
//   - `lesters:wallet-session` announces an authenticated wallet;
//   - `lesters:profile-changed` names the wallet on screen;
//   - a Ranked run's settlement handle (from `lesters:ranked-run`) reaches
//     'published'.
// The selected cosmetic ids persist in `preferences.cosmetics` through
// PUT /api/profile (Bearer) when hosted and signed in, and in localStorage
// otherwise (and as the offline copy). A selection is honoured only while the
// item is still unlocked (unlockables.mjs resolveCosmeticSelection).
//
// Preview (HOSTED_PROFILE_SYNC false, A22): nothing is fetched and nothing
// extra unlocks. The cache is never read, so only the default looks exist.
//
// Every storage access sits in try/catch: private windows, blocked storage and
// quota errors leave the store on its in-memory state.
import {
  COSMETIC_SLOTS,
  childCosmeticsFor,
  deserializeUnlocks,
  emptyUnlocks,
  normalizeCosmeticSelection,
  normalizeUnlockWallet,
  serializeUnlocks,
  unlockState,
  unlockableById,
  unlocksFromProfileResponse,
} from './unlockables.mjs';

export const UNLOCKS_CACHE_PREFIX = 'lesters-arcade-unlocks-v1:';
export const UNLOCKS_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const COSMETICS_SELECTION_PREFIX = 'lesters-arcade-cosmetics-v1:';
const GUEST = 'guest';

export function unlocksCacheKey(wallet) {
  const who = normalizeUnlockWallet(wallet);
  return who ? `${UNLOCKS_CACHE_PREFIX}${who}` : null;
}

function selectionKey(wallet) {
  return `${COSMETICS_SELECTION_PREFIX}${normalizeUnlockWallet(wallet) ?? GUEST}`;
}

function readJson(storage, key) {
  try {
    const raw = storage?.getItem?.(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(storage, key, value) {
  try {
    storage?.setItem?.(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function remove(storage, key) {
  try { storage?.removeItem?.(key); } catch { /* storage unavailable */ }
}

// The cached unlocks for a wallet, or null when absent, malformed, for another
// wallet or older than the TTL (an expired entry is removed).
export function readUnlocksCache(storage, wallet, { now = Date.now } = {}) {
  const key = unlocksCacheKey(wallet);
  if (!key) return null;
  const value = readJson(storage, key);
  const savedAt = Number(value?.savedAt);
  if (!value || value.v !== 1 || value.wallet !== normalizeUnlockWallet(wallet) || !Number.isFinite(savedAt)) return null;
  const age = now() - savedAt;
  if (age < 0 || age > UNLOCKS_CACHE_TTL_MS) {
    remove(storage, key);
    return null;
  }
  return { unlocks: deserializeUnlocks(value.unlocks), savedAt };
}

export function writeUnlocksCache(storage, wallet, unlocks, { now = Date.now } = {}) {
  const key = unlocksCacheKey(wallet);
  if (!key) return false;
  return writeJson(storage, key, { v: 1, wallet: normalizeUnlockWallet(wallet), savedAt: now(), unlocks: serializeUnlocks(unlocks) });
}

export function readCosmeticSelection(storage, wallet) {
  return normalizeCosmeticSelection(readJson(storage, selectionKey(wallet)));
}

export function writeCosmeticSelection(storage, wallet, selection) {
  return writeJson(storage, selectionKey(wallet), normalizeCosmeticSelection(selection));
}

export function createUnlockablesStore({
  hosted = false,
  storage = null,
  indexApi = null,
  windowRef = globalThis.window,
  getWallet = () => null,
  isAuthenticated = () => false,
  getCachedSelfProfile = () => null,
  now = Date.now,
} = {}) {
  const live = hosted === true;
  const listeners = new Set();
  const handleUnsubscribers = new Set();
  let wallet = null;
  let unlocks = emptyUnlocks();
  let source = 'none'; // 'none' | 'cache' | 'server'
  let savedAt = null;
  let selection = {};
  let refreshing = null;
  let refreshSerial = 0;
  let destroyed = false;

  const emit = () => {
    for (const fn of [...listeners]) {
      try { fn(snapshot()); } catch { /* a listener never breaks the store */ }
    }
  };

  const authenticated = () => {
    try { return Boolean(wallet) && isAuthenticated(wallet) === true; } catch { return false; }
  };

  // Switch to `next` (a normalized wallet or null): cache first, no network.
  function load(next) {
    wallet = next;
    unlocks = emptyUnlocks();
    source = 'none';
    savedAt = null;
    refreshSerial += 1;
    refreshing = null;
    if (live && wallet) {
      const cached = readUnlocksCache(storage, wallet, { now });
      if (cached) {
        unlocks = cached.unlocks;
        source = 'cache';
        savedAt = cached.savedAt;
      }
    }
    selection = readCosmeticSelection(storage, wallet);
  }

  function syncWallet() {
    let next = null;
    try { next = normalizeUnlockWallet(getWallet()); } catch { next = null; }
    if (next === wallet) return false;
    load(next);
    return true;
  }

  function adopt(body, { self }) {
    unlocks = unlocksFromProfileResponse(body);
    source = 'server';
    savedAt = now();
    writeUnlocksCache(storage, wallet, unlocks, { now });
    // The self view carries this wallet's saved picks (E6 preferences). A
    // wallet with no saved `cosmetics` keeps the picks made on this device.
    const remote = self ? body?.preferences?.cosmetics : null;
    if (remote && typeof remote === 'object' && !Array.isArray(remote)) {
      selection = normalizeCosmeticSelection(remote);
      writeCosmeticSelection(storage, wallet, selection);
    }
  }

  // Re-read E6 for the wallet on screen. Resolves the store snapshot; never
  // throws. A profile the profile route already holds (the self view) is used
  // instead of a second request unless `force` is set.
  function refresh({ force = false } = {}) {
    if (destroyed) return Promise.resolve(snapshot());
    syncWallet();
    if (!live || !wallet || !indexApi?.profile) return Promise.resolve(snapshot());
    if (refreshing && !force) return refreshing;
    const serial = ++refreshSerial;
    const who = wallet;
    const self = authenticated();
    if (!force) {
      let cached = null;
      try { cached = getCachedSelfProfile(who); } catch { cached = null; }
      if (cached && normalizeUnlockWallet(cached.wallet) === who) {
        adopt(cached, { self: true });
        emit();
        return Promise.resolve(snapshot());
      }
    }
    refreshing = Promise.resolve()
      .then(() => indexApi.profile(who, { self }))
      .catch(() => ({ ok: false, error: 'network' }))
      .then((body) => {
        if (serial !== refreshSerial || who !== wallet || destroyed) return snapshot();
        refreshing = null;
        if (body?.ok === true && normalizeUnlockWallet(body.wallet) === who) {
          adopt(body, { self });
          emit();
        }
        return snapshot();
      });
    return refreshing;
  }

  function stateOf(item) {
    return unlockState(item, unlocks);
  }

  // Choose `id` (or null for the default look) for one slot of one game.
  async function select(gameId, slot, id) {
    syncWallet();
    const slots = COSMETIC_SLOTS[gameId];
    if (!slots?.includes(slot)) return { ok: false, error: 'invalid-slot' };
    if (id !== null) {
      const item = unlockableById(id);
      if (!item || item.gameId !== gameId || item.kind !== slot) return { ok: false, error: 'invalid-cosmetic' };
      if (!stateOf(item).unlocked) return { ok: false, error: 'locked' };
    }
    // normalizeCosmeticSelection drops the null slot and any empty game.
    selection = normalizeCosmeticSelection({ ...selection, [gameId]: { ...(selection[gameId] ?? {}), [slot]: id } });
    const stored = writeCosmeticSelection(storage, wallet, selection);
    emit();
    if (live && wallet && authenticated() && indexApi?.savePreferences) {
      let answer = null;
      try { answer = await indexApi.savePreferences({ cosmetics: selection }); } catch { answer = null; }
      if (answer?.ok === true) return { ok: true, saved: 'wallet' };
      return { ok: true, saved: stored ? 'device' : 'session', error: answer?.error ?? 'network' };
    }
    return { ok: true, saved: stored ? 'device' : 'session' };
  }

  // Verified HMH runs for the hero gates (contract §7.9): the cached or fresh
  // E6 count, or null while it is unknown (preview, no wallet, no cache yet).
  function verifiedRuns(gameId = 'lester-blaster') {
    syncWallet();
    if (!live || !wallet || source === 'none') return null;
    return unlocks.confirmedRuns[gameId] ?? 0;
  }

  function cosmeticsFor(gameId) {
    syncWallet();
    return childCosmeticsFor(gameId, selection, live ? unlocks : emptyUnlocks());
  }

  function snapshot() {
    return Object.freeze({
      hosted: live,
      wallet,
      authenticated: authenticated(),
      source,
      savedAt,
      unlocks: {
        achievementIds: new Set(unlocks.achievementIds),
        heldAchievementIds: new Set(unlocks.heldAchievementIds),
        confirmedRuns: { ...unlocks.confirmedRuns },
      },
      selection: structuredCloneSafe(selection),
    });
  }

  function subscribe(fn) {
    if (typeof fn !== 'function') return () => {};
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  // Window events (§7.7).
  const onWalletSession = (event) => {
    const changed = syncWallet();
    if (event?.detail?.authenticated === true) void refresh({ force: true });
    else if (changed) emit();
  };
  const onProfileChanged = (event) => {
    syncWallet();
    const who = normalizeUnlockWallet(event?.detail?.wallet);
    if (who && who === wallet) void refresh({ force: true });
  };
  const onRankedRun = (event) => {
    const handle = event?.detail?.handle;
    if (!live || typeof handle?.subscribe !== 'function') return;
    let unsubscribe = null;
    const stop = () => {
      handleUnsubscribers.delete(stop);
      try { unsubscribe?.(); } catch { /* handle already disposed */ }
    };
    const check = (value) => {
      const state = value?.state ?? handle.state;
      if (state === 'published') { stop(); void refresh({ force: true }); }
      else if (['preview', 'rejected', 'practice'].includes(state)) stop();
    };
    try {
      unsubscribe = handle.subscribe(check);
      handleUnsubscribers.add(stop);
      check(handle.snapshot ?? { state: handle.state });
    } catch { stop(); }
  };
  const events = [
    ['lesters:wallet-session', onWalletSession],
    ['lesters:profile-changed', onProfileChanged],
    ['lesters:ranked-run', onRankedRun],
  ];
  for (const [name, handler] of events) windowRef?.addEventListener?.(name, handler);

  function destroy() {
    destroyed = true;
    for (const [name, handler] of events) windowRef?.removeEventListener?.(name, handler);
    for (const stop of [...handleUnsubscribers]) stop();
    listeners.clear();
  }

  load(null);
  syncWallet();
  // A wallet restored and signed in before this module loaded gets its fresh
  // unlocks now; the wallet-session event may already have fired.
  if (live && wallet && authenticated()) void refresh();

  return Object.freeze({
    get hosted() { return live; },
    snapshot,
    subscribe,
    refresh,
    select,
    stateOf,
    verifiedRuns,
    cosmeticsFor,
    destroy,
  });
}

function structuredCloneSafe(value) {
  return JSON.parse(JSON.stringify(value ?? {}));
}
