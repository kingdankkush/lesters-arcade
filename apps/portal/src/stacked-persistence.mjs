import { recordStackedScore } from './arcade-core.mjs';
import { snapshotArcadeState, ARCADE_PERSIST_KEY } from './persistence.mjs';
import { createStackedReplayStore } from './stacked-replay-store.mjs';

// Do not announce acceptance or mutate live profiles until durable readback.
export function persistStackedScore(state, storage, session, evidence, canonical, metadata = {}) {
  if (!session.leaderboardEligible) return { trackingDisabled: true, acceptedForGlobalLeaderboard: false };
  const keys = ['profiles', 'usernames', 'loginEvents', 'leaderboards', 'cadenceLeaderboards', 'sessions', 'sessionsByUrlId', 'officialSessions'];
  const candidate = { ...state };
  for (const key of keys) if (state[key] !== undefined) candidate[key] = structuredClone(state[key]);
  const result = recordStackedScore(candidate, session, evidence, canonical, metadata);
  // localStorage.setItem is atomic on quota failure. Never invoke the legacy
  // lossy fallback: another cabinet's avatars and boards belong to the player.
  let encoded;
  try { encoded = JSON.stringify(snapshotArcadeState(candidate)); storage.setItem(ARCADE_PERSIST_KEY, encoded); }
  catch { throw new Error('Device storage is full or unavailable; this Ranked result was not saved'); }
  let stored;
  try { const readback = storage.getItem(ARCADE_PERSIST_KEY); if (readback === encoded) stored = JSON.parse(readback); } catch {}
  const archived = stored?.profiles?.[session.wallet.toLowerCase()]?.progress?.stacked?.rankedArchive?.[session.sessionId];
  if (!archived || JSON.stringify(archived.canonical) !== JSON.stringify(canonical)) throw new Error('Device storage readback failed; result acceptance could not be confirmed');
  for (const key of keys) if (candidate[key] !== undefined) state[key] = candidate[key];
  return result;
}

// The replay store's encoding: unpadded base64url of the SIC1 bytes. Encoded
// here rather than through stacked-evidence-transport.mjs, whose extra lazy
// importers would re-split the STACKED child's shared chunks.
export function stackedReplayBase64Url(bytes) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// A secondary on-device copy of a live Ranked replay (guide §5.4 item 3). The
// pending settle body in ranked-settlement storage is the retry source; the
// store keeps only the newest and the best record. resultHash is the host's
// evidence digest, passed through and never recomputed.
export function writeStackedRankedReplay(storage, { sessionId, score, evidence, evidenceDigest } = {}) {
  if (!storage || typeof evidenceDigest !== 'string') return { stored: false, reason: 'invalid-replay' };
  try {
    return createStackedReplayStore(storage).write({ sessionId, score, encoded: stackedReplayBase64Url(evidence), mode: 'ranked', resultHash: evidenceDigest });
  } catch {
    return { stored: false, reason: 'storage-unavailable' };
  }
}

// The Ranked persistRanked step of the STACKED host: the local archive first
// (recordStackedScore replays once and refuses a second record, so nothing
// here records twice), then for a live run the replay-store copy, then the
// injected settle step (the request builder, the settlement handle and the
// results hand-off). A live paid run is settled even when the device archive
// failed; a preview is only handed off once it is saved.
export async function persistStackedRankedRun({ state, storage, session, evidence, canonical, metadata = {}, live = false, settle = async () => null } = {}) {
  let result = null;
  let failure = null;
  try {
    result = persistStackedScore(state, storage, session, evidence, canonical, metadata);
  } catch (error) {
    failure = error;
  }
  if (!failure || live) {
    if (live) writeStackedRankedReplay(storage, { sessionId: session.sessionId, score: canonical.score, evidence, evidenceDigest: metadata.evidenceDigest });
    await settle();
  }
  if (failure) throw failure;
  return result;
}
