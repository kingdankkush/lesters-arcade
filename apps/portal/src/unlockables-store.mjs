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
// The wallet named by the last authenticated `lesters:wallet-session` stands in
// for getWallet() until main.js assigns it (silent restore announces first).
// Whichever call first sees a switch to a signed-in wallet starts its refresh.
// The selected cosmetic ids persist in `preferences.cosmetics` through
// PUT /api/profile (Bearer) when hosted and signed in, and in localStorage
// otherwise (and as the offline copy). A selection is honoured only while the
// item is still unlocked (unlockables.mjs resolveCosmeticSelection).
// Picks the wallet copy does not hold yet (made before sign-in, or whose PUT
// failed) are kept per slot under `lesters-arcade-cosmetics-unsaved-v1:` and
// win over the server copy: the next read of the self view merges them in and
// saves them (also when the browser comes back online). PUTs run one at a
// time with the latest picks, and a read that started before a pick never
// replaces it.
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
export const COSMETICS_UNSAVED_PREFIX = 'lesters-arcade-cosmetics-unsaved-v1:';
const GUEST = 'guest';
const SLOT_KEYS = new Set(Object.entries(COSMETIC_SLOTS).flatMap(([gameId, slots]) => slots.map((slot) => `${gameId}:${slot}`)));

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

// The 'gameId:slot' keys picked on this device that the wallet copy lacks.
export function readUnsavedSlots(storage, wallet) {
  const who = normalizeUnlockWallet(wallet);
  const value = who ? readJson(storage, `${COSMETICS_UNSAVED_PREFIX}${who}`) : null;
  return new Set(Array.isArray(value) ? value.filter((key) => SLOT_KEYS.has(key)) : []);
}

export function writeUnsavedSlots(storage, wallet, slots) {
  const who = normalizeUnlockWallet(wallet);
  if (!who) return false;
  if (!slots?.size) { remove(storage, `${COSMETICS_UNSAVED_PREFIX}${who}`); return true; }
  return writeJson(storage, `${COSMETICS_UNSAVED_PREFIX}${who}`, [...slots].sort());
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
  let announced = null; // the wallet the last authenticated wallet-session named
  let unlocks = emptyUnlocks();
  let source = 'none'; // 'none' | 'cache' | 'server'
  let savedAt = null;
  let selection = {};
  let unsaved = new Set(); // 'gameId:slot' picked here, not yet in the wallet copy
  let pickSerial = 0; // bumps on every pick
  let refreshing = null;
  let refreshSerial = 0;
  let refreshQueued = false;
  let pushQueue = Promise.resolve();
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
    unsaved = live && wallet ? readUnsavedSlots(storage, wallet) : new Set();
  }

  function currentWallet() {
    let next = null;
    try { next = normalizeUnlockWallet(getWallet()); } catch { next = null; }
    return next ?? announced;
  }

  function syncWallet() {
    const next = currentWallet();
    if (next === wallet) return false;
    load(next);
    // A signed-in wallet reads its fresh unlocks, whichever call noticed the
    // switch first (the wallet-session event may fire before or after
    // getWallet() names the wallet, or before this store existed).
    if (live && wallet && authenticated() && !refreshQueued) {
      refreshQueued = true;
      Promise.resolve().then(() => {
        refreshQueued = false;
        if (!refreshing && !destroyed) void refresh();
      });
    }
    return true;
  }

  // `fresh` is false when a pick was made after this copy was read.
  function adopt(body, { self, fresh }) {
    unlocks = unlocksFromProfileResponse(body);
    source = 'server';
    savedAt = now();
    writeUnlocksCache(storage, wallet, unlocks, { now });
    if (!self) return;
    // The self view carries this wallet's saved picks (E6 preferences).
    const remote = body?.preferences?.cosmetics;
    const saved = remote && typeof remote === 'object' && !Array.isArray(remote) ? normalizeCosmeticSelection(remote) : null;
    if (unsaved.size) {
      // Picks the wallet copy lacks win slot by slot and are saved now; the
      // other slots follow the wallet.
      const merged = structuredCloneSafe(fresh && saved ? saved : selection);
      for (const key of unsaved) {
        const [gameId, slot] = key.split(':');
        (merged[gameId] ??= {})[slot] = selection[gameId]?.[slot] ?? null;
      }
      selection = normalizeCosmeticSelection(merged);
      writeCosmeticSelection(storage, wallet, selection);
      void push();
      return;
    }
    // A wallet with no saved `cosmetics` keeps the picks made on this device.
    if (fresh && saved) {
      selection = saved;
      writeCosmeticSelection(storage, wallet, selection);
    }
  }

  // PUT /api/profile, one request at a time, always with the latest picks, so
  // an older map never lands after a newer one. It waits for the wallet copy
  // (source 'server'), so a pick never drops picks saved on another device.
  function push() {
    const run = pushQueue.then(async () => {
      if (!unsaved.size) return { ok: true };
      if (destroyed || !live || !wallet || !authenticated() || !indexApi?.savePreferences) return { ok: false, error: 'signed-out' };
      if (source !== 'server') return { ok: false, error: 'not-loaded' };
      const who = wallet;
      const serial = pickSerial;
      let answer = null;
      try { answer = await indexApi.savePreferences({ cosmetics: structuredCloneSafe(selection) }); } catch { answer = null; }
      if (answer?.ok === true && who === wallet && serial === pickSerial) {
        unsaved = new Set();
        writeUnsavedSlots(storage, wallet, unsaved);
        emit();
      }
      return answer ?? { ok: false, error: 'network' };
    });
    pushQueue = run.catch(() => {});
    return run;
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
    const picksAtStart = pickSerial;
    if (!force) {
      let cached = null;
      try { cached = getCachedSelfProfile(who); } catch { cached = null; }
      if (cached && normalizeUnlockWallet(cached.wallet) === who) {
        // The route's copy may predate a pick made during this visit.
        adopt(cached, { self: true, fresh: pickSerial === 0 });
        emit();
        return Promise.resolve(snapshot());
      }
    }
    const request = Promise.resolve()
      .then(() => indexApi.profile(who, { self }))
      .catch(() => ({ ok: false, error: 'network' }))
      .then((body) => {
        if (serial !== refreshSerial || who !== wallet || destroyed) return snapshot();
        refreshing = null;
        // A pick made while this read was in flight is newer than its copy.
        if (body?.ok === true && normalizeUnlockWallet(body.wallet) === who) adopt(body, { self, fresh: picksAtStart === pickSerial });
        emit();
        return snapshot();
      });
    refreshing = request;
    emit();
    return request;
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
    pickSerial += 1;
    const stored = writeCosmeticSelection(storage, wallet, selection);
    if (live && wallet) {
      unsaved.add(`${gameId}:${slot}`);
      writeUnsavedSlots(storage, wallet, unsaved);
    }
    emit();
    if (live && wallet && authenticated() && indexApi?.savePreferences) {
      // Not read yet in this visit: read the wallet copy first; adopt() merges
      // this pick into it and saves both.
      if (source !== 'server') await refresh();
      const answer = await push();
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
      loading: Boolean(refreshing) || refreshQueued,
      unsaved: unsaved.size > 0,
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
    const signedIn = event?.detail?.authenticated === true;
    announced = signedIn ? normalizeUnlockWallet(event.detail.wallet) : null;
    const changed = syncWallet();
    if (signedIn) void refresh({ force: true });
    else if (changed) emit();
  };
  // Back online: read the wallet copy if it is missing, else save waiting picks.
  const onOnline = () => {
    syncWallet();
    if (!live || !wallet || !authenticated()) return;
    if (source !== 'server') void refresh({ force: true });
    else if (unsaved.size) void push();
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
    ['online', onOnline],
  ];
  for (const [name, handler] of events) windowRef?.addEventListener?.(name, handler);

  function destroy() {
    destroyed = true;
    for (const [name, handler] of events) windowRef?.removeEventListener?.(name, handler);
    for (const stop of [...handleUnsubscribers]) stop();
    listeners.clear();
  }

  load(null);
  // A wallet restored and signed in before this module loaded queues its
  // fresh unlocks here; the wallet-session event may already have fired.
  syncWallet();

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
