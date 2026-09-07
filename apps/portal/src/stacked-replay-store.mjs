import {
  STACKED_MAX_STORED_REPLAY_CHARS, STACKED_REPLAY_KEY_PREFIX,
  STACKED_REPLAY_INDEX_KEY, STACKED_MAX_SCORE,
} from './stacked-contracts.mjs';

const validId = id => typeof id === 'string' && id !== 'index' && /^[a-z0-9][a-z0-9:_-]{2,127}$/.test(id);
const keyFor = id => STACKED_REPLAY_KEY_PREFIX + id;
const recordKeys = ['sessionId', 'score', 'encoded', 'mode', 'resultHash'];
const canonicalTail = text => {
  const remainder = text.length % 4;
  const last = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'.indexOf(text.at(-1));
  return remainder === 0 || (remainder === 2 && last % 16 === 0) || (remainder === 3 && last % 4 === 0);
};
function validRecord(value) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype || Reflect.ownKeys(value).length !== recordKeys.length) return false;
  if (!recordKeys.every(key => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && descriptor.enumerable && Object.hasOwn(descriptor, 'value');
  })) return false;
  return validId(value.sessionId) && value.mode === 'ranked'
    && Number.isInteger(value.score) && value.score >= 0 && value.score <= STACKED_MAX_SCORE
    && typeof value.resultHash === 'string' && /^0x[0-9a-f]{64}$/.test(value.resultHash)
    && typeof value.encoded === 'string' && value.encoded.length > 0
    && value.encoded.length <= STACKED_MAX_STORED_REPLAY_CHARS
    && /^[A-Za-z0-9_-]+$/.test(value.encoded) && canonicalTail(value.encoded);
}

export function createStackedReplayStore(storage) {
  const readIndex = () => {
    const raw = storage.getItem(STACKED_REPLAY_INDEX_KEY);
    if (raw === null) return { raw, ids: [] };
    if (typeof raw !== 'string' || raw.length > 300) throw new Error('invalid replay index');
    const ids = JSON.parse(raw);
    if (!Array.isArray(ids) || ids.length > 2 || !ids.every(validId) || new Set(ids).size !== ids.length) throw new Error('invalid replay index');
    return { raw, ids };
  };
  const readRecord = id => {
    const raw = storage.getItem(keyFor(id));
    if (typeof raw !== 'string' || raw.length > STACKED_MAX_STORED_REPLAY_CHARS + 600) throw new Error('invalid stored replay');
    const record = JSON.parse(raw);
    if (!validRecord(record) || record.sessionId !== id) throw new Error('invalid stored replay');
    return record;
  };
  return Object.freeze({
    read(sessionId) {
      try {
        if (!validId(sessionId) || !readIndex().ids.includes(sessionId)) return null;
        return Object.freeze(readRecord(sessionId));
      } catch { return null; }
    },
    write(value) {
      if (value && typeof value.encoded === 'string' && value.encoded.length > STACKED_MAX_STORED_REPLAY_CHARS) return { stored: false, reason: 'replay-too-large' };
      if (!validRecord(value)) return { stored: false, reason: 'invalid-replay' };
      let index;
      let previous;
      let oldValue;
      let encoded;
      let ids;
      try {
        index = readIndex();
        previous = index.ids.map(readRecord);
        const record = Object.fromEntries(recordKeys.map(key => [key, value[key]]));
        encoded = JSON.stringify(record);
        oldValue = storage.getItem(keyFor(record.sessionId));
        const existing = previous.find(item => item.sessionId === record.sessionId);
        if (existing && JSON.stringify(existing) !== encoded) return { stored: false, reason: 'session-conflict' };
        let best = previous[0] ?? record;
        for (const item of previous) if (item.score > best.score) best = item;
        if (record.score > best.score) best = record;
        ids = [record.sessionId];
        const second = best.sessionId !== record.sessionId ? best.sessionId : index.ids.find(id => id !== record.sessionId);
        if (second !== undefined) ids.push(second);
      } catch { return { stored: false, reason: 'storage-unavailable' }; }
      const newKey = keyFor(value.sessionId);
      try {
        storage.setItem(newKey, encoded);
        if (storage.getItem(newKey) !== encoded) throw new Error('replay write readback failed');
        const newIndex = JSON.stringify(ids);
        storage.setItem(STACKED_REPLAY_INDEX_KEY, newIndex);
        if (storage.getItem(STACKED_REPLAY_INDEX_KEY) !== newIndex) throw new Error('index write readback failed');
      } catch {
        // No old indexed key has been removed. Restore only this attempted write.
        try { if (index.raw === null) storage.removeItem(STACKED_REPLAY_INDEX_KEY); else storage.setItem(STACKED_REPLAY_INDEX_KEY, index.raw); } catch { /* Original blobs remain intact. */ }
        try { if (oldValue === null) storage.removeItem(newKey); else storage.setItem(newKey, oldValue); } catch { /* Cleanup cannot affect a score write. */ }
        return { stored: false, reason: 'storage-unavailable' };
      }
      let cleanupFailed = false;
      for (const id of index.ids) if (!ids.includes(id)) {
        try { storage.removeItem(keyFor(id)); } catch { cleanupFailed = true; }
      }
      return cleanupFailed ? { stored: true, warning: 'cleanup-failed' } : { stored: true };
    },
  });
}
