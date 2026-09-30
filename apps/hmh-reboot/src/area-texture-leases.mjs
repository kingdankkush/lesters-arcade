// Presentation resources only. Leases never receive actor, nav, RNG or run state.
export function createAreaTextureLeases({ pages, load, unload, publish, detach, onError = () => {}, maxInFlight = 2, maxDecodedBytes = 16 * 1024 * 1024 } = {}) {
  if (!Array.isArray(pages) || !pages.length || !Number.isInteger(maxInFlight) || maxInFlight < 1 || !Number.isSafeInteger(maxDecodedBytes) || maxDecodedBytes < 1) throw new TypeError('bounded pages and texture budgets required');
  for (const callback of [load, unload, publish, detach, onError]) if (typeof callback !== 'function') throw new TypeError('texture lifecycle callbacks required');
  const catalog = new Map();
  for (const page of pages) {
    if (!page || typeof page.id !== 'string' || !page.id || catalog.has(page.id) || !Number.isSafeInteger(page.reservedDecodedBytes) || page.reservedDecodedBytes <= 0 || page.reservedDecodedBytes > maxDecodedBytes) throw new TypeError('unique pages with bounded decoded reservation required');
    catalog.set(page.id, Object.freeze({ ...page }));
  }
  const entries = new Map(), jobs = new Set(), errors = [];
  let desired = new Map(), areaIds = [], activeLoads = 0, closed = false, disposal = null, errorCount = 0;
  const recordError = error => { errorCount++; errors.push(String(error?.message ?? error)); if (errors.length > 64) errors.shift(); };
  const report = error => {
    recordError(error);
    // Status reporting cannot interrupt release of owned resources. Preserve
    // both failures; do not recursively call a broken callback.
    try { onError(error); }
    catch (callbackError) { recordError(new Error(`Area texture error callback failed: ${String(callbackError?.message ?? callbackError)}`)); }
  };
  const reserved = () => [...entries.values()].reduce((sum, entry) => sum + entry.reservedBytes, 0);
  const fresh = id => ({ page: catalog.get(id), owners: new Set(desired.get(id)), state: 'queued', controller: new AbortController(), cancelled: false, published: false, resource: null, reservedBytes: 0, decodedBytes: 0, error: null });
  const track = promise => { jobs.add(promise); promise.finally(() => jobs.delete(promise)).catch(() => {}); return promise; };
  const retire = entry => {
    if (entry.state === 'retiring') return entry.retirement;
    entry.state = 'retiring';
    const job = (async () => {
      try {
        // Consumers and cached draws stop referencing the source before unload.
        if (entry.published) { detach(entry.page, entry.resource); entry.published = false; }
        await unload(entry.resource);
        entry.resource = null; entry.reservedBytes = 0; entry.decodedBytes = 0;
        entries.delete(entry.page.id);
        if (!closed && desired.has(entry.page.id)) entries.set(entry.page.id, fresh(entry.page.id));
        return true;
      } catch (error) {
        entry.state = 'failed-release'; entry.error = error;
        // Retain ownership/reference/reservation on ambiguous disposal failure.
        report(error); return false;
      } finally { pump(); }
    })();
    entry.retirement = track(job); return entry.retirement;
  };
  const begin = entry => {
    entry.state = 'loading'; entry.reservedBytes = entry.page.reservedDecodedBytes; activeLoads++;
    track((async () => {
      try {
        entry.resource = await load(entry.page, { signal: entry.controller.signal });
        const bytes = entry.resource?.decodedBytes;
        if (!Number.isSafeInteger(bytes) || bytes <= 0) throw new TypeError('actual decoded pixel byte estimate required');
        entry.decodedBytes = bytes;
        entry.reservedBytes = Math.max(entry.reservedBytes, bytes);
        if (bytes > entry.page.reservedDecodedBytes) throw new RangeError('decoded resource exceeds reserved budget');
        if (closed || entry.cancelled || !entry.owners.size) await retire(entry);
        else {
          entry.published = true; // A throwing partial publisher still detaches.
          publish(entry.page, entry.resource); entry.state = 'ready';
        }
      } catch (error) {
        entry.resource ??= error?.resource ?? null;
        report(error);
        if (entry.resource) await retire(entry);
        else if (entry.cancelled) {
          entry.reservedBytes = 0; entries.delete(entry.page.id);
          if (!closed && desired.has(entry.page.id)) entries.set(entry.page.id, fresh(entry.page.id));
        } else { entry.state = 'failed-load'; entry.error = error; entry.reservedBytes = 0; }
      } finally { activeLoads--; pump(); }
    })());
  };
  function pump() {
    if (closed) return;
    for (const entry of entries.values()) {
      if (activeLoads >= maxInFlight) break;
      if (entry.state !== 'queued' || !entry.owners.size || reserved() + entry.page.reservedDecodedBytes > maxDecodedBytes) continue;
      begin(entry);
    }
  }
  function reconcile(areas) {
    const next = new Map(), ids = new Set();
    for (const area of areas) {
      if (!area || typeof area.id !== 'string' || !area.id || ids.has(area.id) || !Array.isArray(area.pages)) throw new TypeError('unique area page leases required');
      ids.add(area.id);
      for (const id of new Set(area.pages)) {
        if (!catalog.has(id)) throw new RangeError(`unknown texture page ${String(id)}`);
        if (!next.has(id)) next.set(id, new Set()); next.get(id).add(area.id);
      }
    }
    desired = next; areaIds = [...ids].sort();
    for (const entry of entries.values()) {
      entry.owners = new Set(desired.get(entry.page.id));
      if (entry.owners.size) continue;
      if (entry.state === 'loading') { entry.cancelled = true; entry.controller.abort(); }
      else if (entry.state === 'ready') retire(entry);
      else if (entry.state === 'queued' || entry.state === 'failed-load') entries.delete(entry.page.id);
    }
    for (const id of desired.keys()) if (!entries.has(id)) entries.set(id, fresh(id));
    pump();
  }
  const snapshot = () => Object.freeze({ disposed: closed, areaIds: [...areaIds], activeLoads, maxInFlight, maxDecodedBytes,
    reservedDecodedBytes: reserved(), decodedRgbaEstimateBytes: [...entries.values()].reduce((sum, entry) => sum + entry.decodedBytes, 0),
    readyPages: [...entries.values()].filter(entry => entry.state === 'ready').map(entry => entry.page.id).sort(),
    failedDisposals: [...entries.values()].filter(entry => entry.state === 'failed-release').length,
    errorCount, errors: [...errors], entries: [...entries.values()].map(entry => ({ id: entry.page.id, state: entry.state, owners: [...entry.owners].sort(), reservedDecodedBytes: entry.reservedBytes, decodedRgbaEstimateBytes: entry.decodedBytes, actualUrl: entry.resource?.url ?? null, cancelled: entry.cancelled })) });
  const idle = async () => { while (jobs.size) await Promise.all([...jobs]); return snapshot(); };
  return Object.freeze({ setAreas(areas) { if (closed) throw new Error('area leases disposed'); if (!Array.isArray(areas)) throw new TypeError('areas required'); reconcile(areas); }, snapshot, idle,
    dispose() {
      if (disposal) return disposal;
      closed = true; reconcile([]);
      disposal = idle().then(state => { if (state.failedDisposals) throw new AggregateError([...entries.values()].filter(entry => entry.error).map(entry => entry.error), 'Area source disposal failed'); return state; });
      return disposal;
    },
  });
}
