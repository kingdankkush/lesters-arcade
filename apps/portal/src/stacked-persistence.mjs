import { recordStackedScore } from './arcade-core.mjs';
import { snapshotArcadeState, ARCADE_PERSIST_KEY } from './persistence.mjs';

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
