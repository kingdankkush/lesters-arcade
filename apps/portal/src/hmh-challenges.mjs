// Parent-owned Free practice courses. Never an official ranking/settlement input.
export const HMH_CHALLENGE_VERSION = 'hmh-challenge-v1';
const DAY_MS = 86_400_000;

function identity(value, name) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9._:-]{1,128}$/.test(value)) throw new Error(`Invalid challenge ${name}`);
  return value;
}

export function hmhChallengePeriod(cadence, now = Date.now()) {
  if (!['daily', 'weekly'].includes(cadence)) throw new Error('Invalid challenge cadence');
  const date = new Date(now);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid challenge date');
  date.setUTCHours(0, 0, 0, 0);
  if (cadence === 'weekly') date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

export function buildHmhChallenge({ cadence, periodStart = null, buildHash, seasonId, now = Date.now(), version = HMH_CHALLENGE_VERSION } = {}) {
  if (version !== HMH_CHALLENGE_VERSION) throw new Error('Unsupported challenge version');
  identity(buildHash, 'build');
  identity(seasonId, 'season');
  const period = periodStart ?? hmhChallengePeriod(cadence, now);
  if (typeof period !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(period)) throw new Error('Invalid challenge period');
  const start = Date.parse(`${period}T00:00:00.000Z`);
  if (!Number.isFinite(start) || hmhChallengePeriod(cadence, start) !== period) throw new Error('Invalid challenge period');
  const gameId = 'lester-blaster';
  let seed = 0x811c9dc5;
  for (const character of JSON.stringify([version, gameId, cadence, period, buildHash, seasonId])) {
    seed ^= character.charCodeAt(0);
    seed = Math.imul(seed, 0x01000193) >>> 0;
  }
  return Object.freeze({
    version, gameId, cadence, periodStart: period, buildHash, seasonId, seed,
    endsAt: new Date(start + DAY_MS * (cadence === 'weekly' ? 7 : 1)).toISOString(),
    label: `${cadence === 'weekly' ? 'Weekly' : 'Daily'} ${period} UTC`,
    official: false,
  });
}

export function resolveHmhChallenge(request, { mode, gameId, buildHash, seasonId, now } = {}) {
  if (request == null) return null;
  if (mode !== 'free' || gameId !== 'lester-blaster') throw new Error('Challenges are available only for Free HMH');
  if (typeof request !== 'object' || Array.isArray(request)) throw new Error('Invalid challenge request');
  if (request.buildHash != null && request.buildHash !== buildHash) throw new Error('This challenge uses a different build. Choose a current course or ordinary Free play.');
  if (request.seasonId != null && request.seasonId !== seasonId) throw new Error('This challenge uses a different season. Choose a current course or ordinary Free play.');
  return buildHmhChallenge({ ...request, buildHash, seasonId, now });
}

const SHARE_FIELDS = Object.freeze({
  hmhChallenge: 'cadence', hmhPeriod: 'periodStart', hmhBuild: 'buildHash',
  hmhSeason: 'seasonId', hmhChallengeVersion: 'version',
});

export function readHmhChallengeSearch(search) {
  const params = new URLSearchParams(search);
  const keys = Object.keys(SHARE_FIELDS);
  if (!keys.some((key) => params.has(key))) return null;
  const request = {};
  for (const key of keys) {
    const values = params.getAll(key);
    if (!values.length) throw new Error('Incomplete shared challenge link. Choose a current course or ordinary Free play.');
    if (values.length !== 1) throw new Error('Duplicate shared challenge field');
    if (values[0].length > 128) throw new Error('Challenge field too large');
    request[SHARE_FIELDS[key]] = values[0];
  }
  // Validate, but do not rewrite malformed identifiers or make a fresh course.
  buildHmhChallenge(request);
  return Object.freeze(request);
}

export function buildHmhChallengeUrl(challenge, location) {
  const course = buildHmhChallenge(challenge);
  const base = new URL(location);
  if (!['https:', 'http:'].includes(base.protocol)) throw new Error('Invalid challenge origin');
  // No inherited search, hash, credentials, wallet or active-session handle.
  const url = new URL('/games/hard-money-heroes', base.origin);
  for (const [key, field] of Object.entries(SHARE_FIELDS)) url.searchParams.set(key, course[field]);
  return url.href;
}
