import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStackedReplayStore } from '../apps/portal/src/stacked-replay-store.mjs';
import { STACKED_REPLAY_INDEX_KEY, STACKED_REPLAY_KEY_PREFIX } from '../apps/portal/src/stacked-contracts.mjs';
const record = (sessionId, score) => ({ sessionId, score, encoded: 'AAAA', mode: 'ranked', resultHash: '0x' + 'a'.repeat(64) });
function storage() {
  const data = new Map([['lesters-arcade-save-v1', 'untouched main save']]);
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key) };
}
for (const fault of ['every-removal', 'indexed-replay-removal']) {
  test(`failed replay cleanup cannot accumulate orphan blobs: ${fault}`, () => {
    const s = storage(); const first = createStackedReplayStore(s);
    assert.equal(first.write(record('run-one', 100)).stored, true);
    assert.equal(first.write(record('run-two', 99)).stored, true);
    const before = new Map(s.data); const oldKeys = JSON.parse(s.getItem(STACKED_REPLAY_INDEX_KEY)).map(id => STACKED_REPLAY_KEY_PREFIX + id);
    const remove = s.removeItem;
    s.removeItem = key => { if (fault === 'every-removal' || oldKeys.includes(key)) throw new Error('delete unavailable'); remove(key); };
    for (let index = 0; index < 6; index += 1) {
      // A new store instance must not forget an earlier cleanup failure.
      const store = createStackedReplayStore(s);
      const outcome = store.write(record(`new-run-${index}`, 200 + index));
      assert.equal(outcome.stored, false);
      assert.deepEqual(s.data, before, 'failed replacement preserves both original records and the main save');
    }
  });
}
