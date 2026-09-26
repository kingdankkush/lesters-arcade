// Free share token (plan docs/handoffs/free-share-20260926.md §3; contract
// §7.4 addendum). A Free run has no server record: the results panel encodes
// the numbers it shows into one lowercase base36 string, and the Free page
// (/f/<slug>/<token>) and card (/api/free-card/<slug>/<token>.png) render
// purely from it. It is self-reported and carries no integrity: the two
// checksum chars only filter random probes, and decoding is strict (exact
// length, alphabet, version, game, checksum, then re-encode-must-equal, which
// enforces every range, enum and cross-field rule at once). Values are ids,
// booleans and bounded integers only, never a wallet, handle, session id,
// seed or timestamp. Layout: version(1) game(1) fields… check(2), every field
// fixed-width and zero-padded; a new layout is a new version char. This file
// ships in the Chikun and STACKED children, so it stays import-free and small.

// Short local aliases keep the minified chunk small; the exports are the
// long names the contract uses.
const F = Object.freeze;
const V = 'a';
const SCORE = 999_999_999_999;
const COUNT = 9_999_999;
const f = (key, width, max, min = 0) => F([key, width, max, min]);
const GAMES = F({
  'lester-blaster': F({ code: 'h', slug: 'hard-money-heroes', length: 30 }),
  chikun: F({ code: 'c', slug: 'chikun', length: 40 }),
  stacked: F({ code: 's', slug: 'stacked', length: 34 }),
});
const HEROES = F(['lit-commando', 'lit-valkyrie', 'lester-original', 'lilly']);
const REGIONS = F(['farmland', 'forest', 'town', 'city', 'industrial', 'suburbs', 'coast']);
// [key, width, max, min]: score and counters share the share-text caps; the
// clocks are the run ceilings (Chikun 60 min, STACKED 120 min, the HMH share
// clock cap); levels are ROGUELIKE_LEVEL_CAP and STACKED_LEVEL_CAP.
const FIELDS = F({
  'lester-blaster': F([f('hero', 1, 4), f('score', 8, SCORE), f('kills', 5, COUNT), f('maxCombo', 5, COUNT), f('survivalSeconds', 4, 359_999), f('level', 2, 80, 1), f('flags', 1, 1)]),
  chikun: F([f('region', 1, 6), f('score', 8, SCORE), f('forksPassed', 5, COUNT), f('nearMisses', 5, COUNT), f('coinsCollected', 5, COUNT), f('bestCombo', 5, COUNT), f('survivalSeconds', 4, 3_600), f('laps', 2, 99), f('flags', 1, 1)]),
  stacked: F([f('flags', 1, 1), f('score', 8, SCORE), f('lines', 5, COUNT), f('level', 2, 30, 1), f('quadClears', 5, COUNT), f('maxCombo', 5, COUNT), f('survivalSeconds', 4, 7_200)]),
});

export const FREE_SHARE_TOKEN_VERSION = V;
export const FREE_SHARE_HEROES = HEROES;
export const FREE_SHARE_REGIONS = REGIONS;
export const FREE_SHARE_GAMES = GAMES;
export const FREE_TOKEN_FIELDS = FIELDS;

// Enum fields carry an id in the values object and an index in the token;
// the flags field carries one boolean per game.
const ENUMS = { hero: ['', ...HEROES], region: REGIONS };
const FLAG = { 'lester-blaster': 'bossDefeated', chikun: 'daily', stacked: 'assisted' };

function known(gameId) {
  if (!Object.hasOwn(GAMES, gameId)) throw new TypeError(`no free share token for ${gameId}`);
  return gameId;
}

// Rounds and clamps every number (NaN, non-numbers and -Infinity read as the
// minimum, Infinity as the maximum), keeps only `true` as a flag, maps an
// unknown hero to '' and an unknown region to 'farmland', and applies the
// cross-field rules (a lap is 48 forks; a Halving clears four lines).
// Idempotent, so a token the panel builds always decodes.
export function normalizeFreeShareValues(gameId, values) {
  const v = values && typeof values === 'object' ? values : {};
  const out = {};
  for (const [key, , max, min] of FIELDS[known(gameId)]) {
    if (key === 'flags') out[FLAG[gameId]] = v[FLAG[gameId]] === true;
    else if (ENUMS[key]) out[key] = ENUMS[key].includes(v[key]) ? v[key] : ENUMS[key][0];
    else {
      const n = typeof v[key] === 'number' ? Math.round(v[key]) : min;
      out[key] = n < min || Number.isNaN(n) ? min : n > max ? max : n;
    }
  }
  if (gameId === 'chikun') out.laps = Math.min(out.laps, Math.floor(out.forksPassed / 48));
  if (gameId === 'stacked') out.quadClears = Math.min(out.quadClears, Math.floor(out.lines / 4));
  return F(out);
}

function check(body) {
  let c = 0;
  for (let i = 0; i < body.length; i += 1) c = (c * 31 + body.charCodeAt(i)) % 1296;
  return c.toString(36).padStart(2, '0');
}

export function encodeFreeShareToken(gameId, values) {
  const v = normalizeFreeShareValues(gameId, values);
  let body = V + GAMES[gameId].code;
  for (const [key, width] of FIELDS[gameId]) {
    body += (key === 'flags' ? (v[FLAG[gameId]] ? 1 : 0) : ENUMS[key] ? ENUMS[key].indexOf(v[key]) : v[key]).toString(36).padStart(width, '0');
  }
  return body + check(body);
}

// Never throws: { ok: true, gameId, slug, version, values } or
// { ok: false, error: 'invalid-game' | 'invalid-token' }.
export function decodeFreeShareToken(slug, token) {
  const gameId = Object.keys(GAMES).find((id) => GAMES[id].slug === slug);
  if (!gameId) return { ok: false, error: 'invalid-game' };
  const game = GAMES[gameId];
  const bad = { ok: false, error: 'invalid-token' };
  if (typeof token !== 'string' || token.length !== game.length || !/^[0-9a-z]+$/.test(token)) return bad;
  if (token[0] !== V || token[1] !== game.code || check(token.slice(0, -2)) !== token.slice(-2)) return bad;
  const values = {};
  let at = 2;
  for (const [key, width] of FIELDS[gameId]) {
    const n = parseInt(token.slice(at, at + width), 36);
    at += width;
    if (key === 'flags') values[FLAG[gameId]] = n === 1;
    else if (ENUMS[key]) values[key] = ENUMS[key][n] ?? null;
    else values[key] = n;
  }
  if (encodeFreeShareToken(gameId, values) !== token) return bad;
  return { ok: true, gameId, slug, version: V, values: normalizeFreeShareValues(gameId, values) };
}

export function freeSharePageUrl(gameId, token, origin = 'https://lestersarcade.io') {
  return `${origin}/f/${GAMES[known(gameId)].slug}/${token}`;
}

// Relative on purpose: the client fetches the card same-origin for the
// native file share, which satisfies the children's connect-src 'self'.
export function freeShareCardPath(gameId, token) {
  return `/api/free-card/${GAMES[known(gameId)].slug}/${token}.png`;
}
