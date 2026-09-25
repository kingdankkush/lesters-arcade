import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import * as verifiedSessionApi from '../api/verified-session.mjs';
import { HEALTH_CHAIN_TIMEOUT_MS, HEALTH_DB_TIMEOUT_MS } from '../server/ops/health.mjs';
import { createPgliteClient, seedVerifiedSession } from './helpers/pglite-client.mjs';
import { invoke } from './helpers/fake-http.mjs';

const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

test('Vercel rewrites every SPA deep-link namespace used by the arcade router', () => {
  const rewrites = vercel.rewrites ?? [];
  const destinationsBySource = new Map(rewrites.map((rewrite) => [rewrite.source, rewrite.destination]));
  for (const source of ['/', '/games/:path*', '/play/:path*', '/(profile|scores|leaderboards|settings)']) {
    assert.equal(destinationsBySource.get(source), '/index.html', `${source} should serve the SPA shell`);
  }
});

test('production caching keeps hashed chunks immutable and forces stable child bundles to revalidate', () => {
  const headersBySource = new Map((vercel.headers ?? []).map((entry) => [
    entry.source,
    new Map(entry.headers.map((header) => [header.key, header.value])),
  ]));
  assert.equal(
    headersBySource.get('/dist/chunks/(.*)')?.get('Cache-Control'),
    'public, max-age=31536000, immutable',
  );
  assert.equal(
    headersBySource.get('/dist/(hmh-reboot|chikun|stacked)/(.*)')?.get('Cache-Control'),
    'public, max-age=0, must-revalidate',
  );
  assert.equal(
    headersBySource.get('/(dist/main.js|assets/.*|styles.css|styles-arcade-polish.css|src/design-tokens.css)')?.get('Cache-Control'),
    'public, max-age=0, s-maxage=31536000, stale-while-revalidate=86400',
  );
});

// Vercel sources are path-to-regexp patterns: `:name(regex)`, `:name*`,
// `:name` and bare regex groups. This converts the forms vercel.json uses.
function closingParen(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '\\') { i += 1; continue; }
    if (text[i] === '(') depth += 1;
    if (text[i] === ')') { depth -= 1; if (depth === 0) return i; }
  }
  throw new Error(`unbalanced ( in ${text}`);
}

function sourcePattern(source) {
  let out = '';
  for (let i = 0; i < source.length;) {
    const ch = source[i];
    if (ch === ':') {
      let end = i + 1;
      while (end < source.length && /[A-Za-z0-9_]/.test(source[end])) end += 1;
      const name = source.slice(i + 1, end);
      if (source[end] === '(') {
        const close = closingParen(source, end);
        out += `(?<${name}>${source.slice(end + 1, close)})`;
        i = close + 1;
      } else if (source[end] === '*') {
        out += `(?<${name}>.*)`;
        i = end + 1;
      } else {
        out += `(?<${name}>[^/]+)`;
        i = end;
      }
    } else if (ch === '(') {
      const close = closingParen(source, i);
      out += source.slice(i, close + 1);
      i = close + 1;
    } else {
      out += ch.replace(/[.*+?^${}|[\]\\]/g, '\\$&');
      i += 1;
    }
  }
  return new RegExp(`^${out}$`);
}

function namedParams(source) {
  return [...sourcePattern(source).source.matchAll(/\(\?<([A-Za-z0-9_]+)>/g)].map((match) => match[1]);
}

// Vercel's rewrite rule (@vercel/routing-utils replaceSegments): when the
// destination PATHNAME uses none of the source's named params, every named
// param that is not already a destination query key is appended to the query
// as `name=value`. A `:shareId` feeding `?id=:shareId` therefore reaches the
// function as `?id=…&shareId=…`, which the handlers' unknown-query check
// answers with 400 invalid-query.
function vercelAppendedParams(rule) {
  const [pathname, search = ''] = rule.destination.split('?');
  const names = namedParams(rule.source);
  if (names.some((name) => pathname.includes(`:${name}`))) return [];
  const declared = new Set([...new URLSearchParams(search).keys()]);
  return names.filter((name) => !declared.has(name));
}

// First matching rewrite wins; the original query string is carried through.
function rewrite(url) {
  const [path, query = ''] = url.split('?');
  for (const rule of vercel.rewrites) {
    const match = sourcePattern(rule.source).exec(path);
    if (!match) continue;
    let destination = rule.destination.replace(/:([A-Za-z0-9_]+)/g, (_, name) => match.groups?.[name] ?? '');
    const extra = vercelAppendedParams(rule).map((name) => `${name}=${match.groups?.[name] ?? ''}`);
    for (const part of [...extra, ...(query ? [query] : [])]) destination += `${destination.includes('?') ? '&' : '?'}${part}`;
    return { source: rule.source, destination };
  }
  return null;
}

function headersFor(path) {
  const found = {};
  for (const rule of vercel.headers) {
    if (!sourcePattern(rule.source).test(path)) continue;
    for (const header of rule.headers) found[header.key] = header.value;
  }
  return found;
}

const HEX64 = 'ab'.repeat(32);
const WALLET = `0x${'Cd'.repeat(20)}`;

test('API, share and profile deep links route to their functions', () => {
  const cases = [
    [`/s/${HEX64}`, `/api/share-page?id=${HEX64}`],
    [`/s/${HEX64.toUpperCase()}`, `/api/share-page?id=${HEX64.toUpperCase()}`],
    [`/profile/${WALLET}`, `/index.html?wallet=${WALLET}`],
    ['/profile', '/index.html'],
    ['/api/session/nonce', '/api/session-nonce'],
    [`/api/session/0x${HEX64}`, `/api/verified-session?id=0x${HEX64}`],
    [`/api/session/${HEX64}`, `/api/verified-session?id=${HEX64}`],
    [`/api/settle/status?sessionId32=0x${HEX64}`, `/api/settle-status?sessionId32=0x${HEX64}`],
    [`/api/profile/refresh?wallet=${WALLET}`, `/api/profile-refresh?wallet=${WALLET}`],
    ['/api/ranked/seed', '/api/ranked-seed'],
    [`/api/share-card/${HEX64}.png?v=0123456789ab`, `/api/share-card?id=${HEX64}&v=0123456789ab`],
    ['/games/chikun', '/discover/chikun.html'],
    ['/play/hard-money-heroes/ranked', '/index.html?path=hard-money-heroes/ranked'],
  ];
  for (const [url, destination] of cases) assert.equal(rewrite(url)?.destination, destination, url);
  for (const url of [`/s/${HEX64.slice(2)}`, `/s/${HEX64}0`, '/profile/0x1234', `/api/session/${HEX64.slice(1)}`, `/api/share-card/${HEX64}.jpg`, '/api/session']) {
    assert.equal(rewrite(url), null, `${url} matches no rewrite`);
  }
  const sources = vercel.rewrites.map((rule) => rule.source);
  assert.ok(sources.indexOf('/api/session/nonce') < sources.indexOf('/api/session/:id((?:0x)?[0-9a-fA-F]{64})'), 'nonce is routed before the share id');
  assert.ok(sources.indexOf('/api/share-card/:id([0-9a-fA-F]{64}).png') < sources.indexOf('/games/:path*'), 'the new rewrites come before /games/:path*');
  assert.equal(vercel.rewrites.find((rule) => rule.source.startsWith('/api/share-card/')).destination, '/api/share-card?id=:id', 'the card rewrite declares only id, so ?v=<rev> reaches the handler from the original query');
  for (const rule of vercel.rewrites.filter((entry) => entry.destination.startsWith('/api/'))) {
    const file = `${rule.destination.split('?')[0].slice(1)}.mjs`;
    assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), `${rule.source} → ${file} exists`);
  }
});

// The index rewrites exactly as Vercel's own router compiles them
// (@vercel/routing-utils getTransformedRoutes, bundled in vercel CLI 59.14.0
// and 59.25.4, recorded 2026-09-23). path-to-regexp 6 accepts every
// constrained `:param(...)` form used here. `dest` carries no query key other
// than the declared ones only because each captured param is named after
// the destination key (`:id` → `?id=:id`); a `:shareId` compiled to
// `?id=$1&shareId=$1`, which every handler answers with 400 invalid-query.
const VERCEL_COMPILED = Object.freeze([
  { source: '/s/:id([0-9a-fA-F]{64})', destination: '/api/share-page?id=:id', src: '^/s(?:/([0-9a-fA-F]{64}))$', dest: '/api/share-page?id=$1' },
  { source: '/profile/:wallet(0x[0-9a-fA-F]{40})', destination: '/index.html', src: '^/profile(?:/(0x[0-9a-fA-F]{40}))$', dest: '/index.html?wallet=$1' },
  { source: '/api/session/nonce', destination: '/api/session-nonce', src: '^/api/session/nonce$', dest: '/api/session-nonce' },
  { source: '/api/session/:id((?:0x)?[0-9a-fA-F]{64})', destination: '/api/verified-session?id=:id', src: '^/api/session(?:/((?:0x)?[0-9a-fA-F]{64}))$', dest: '/api/verified-session?id=$1' },
  { source: '/api/settle/status', destination: '/api/settle-status', src: '^/api/settle/status$', dest: '/api/settle-status' },
  { source: '/api/profile/refresh', destination: '/api/profile-refresh', src: '^/api/profile/refresh$', dest: '/api/profile-refresh' },
  { source: '/api/ranked/seed', destination: '/api/ranked-seed', src: '^/api/ranked/seed$', dest: '/api/ranked-seed' },
  { source: '/api/share-card/:id([0-9a-fA-F]{64}).png', destination: '/api/share-card?id=:id', src: '^/api/share-card(?:/([0-9a-fA-F]{64}))\\.png$', dest: '/api/share-card?id=$1' },
]);

// Routes a URL through the compiled table; Vercel merges the original query
// string into the destination's.
function vercelRoute(url) {
  const [path, query = ''] = url.split('?');
  for (const route of VERCEL_COMPILED) {
    const match = new RegExp(route.src).exec(path);
    if (!match) continue;
    const destination = route.dest.replace(/\$(\d)/g, (_, index) => match[Number(index)] ?? '');
    return query ? `${destination}${destination.includes('?') ? '&' : '?'}${query}` : destination;
  }
  return null;
}

const queryKeys = (url) => [...new URLSearchParams(url.split('?')[1] ?? '').keys()].sort();

test('rewrites give API functions only the query keys they declare, as Vercel compiles them', () => {
  // vercel.json still says what the compiled table was recorded from.
  const bySource = new Map(vercel.rewrites.map((rule) => [rule.source, rule.destination]));
  for (const route of VERCEL_COMPILED) assert.equal(bySource.get(route.source), route.destination, `${route.source} is unchanged since the compiled table was recorded`);
  const recorded = new Set(VERCEL_COMPILED.map((route) => route.source));
  for (const rule of vercel.rewrites.filter((entry) => entry.destination.startsWith('/api/'))) {
    assert.ok(recorded.has(rule.source), `${rule.source} is in the compiled table`);
    assert.deepEqual(vercelAppendedParams(rule), [], `${rule.source}: Vercel appends no named param to ${rule.destination}`);
  }
  for (const route of VERCEL_COMPILED.filter((entry) => entry.destination.startsWith('/api/'))) {
    assert.deepEqual(queryKeys(route.dest), queryKeys(route.destination), `${route.source} compiles to ${route.dest} with no extra query key`);
  }
  // The pre-fix naming, run through the same rule, is what production would have got.
  assert.deepEqual(vercelAppendedParams({ source: '/api/session/:shareId((?:0x)?[0-9a-fA-F]{64})', destination: '/api/verified-session?id=:shareId' }), ['shareId']);

  const cases = [
    [`/s/${HEX64}`, `/api/share-page?id=${HEX64}`],
    [`/api/session/0x${HEX64}`, `/api/verified-session?id=0x${HEX64}`],
    [`/api/session/${HEX64.toUpperCase()}`, `/api/verified-session?id=${HEX64.toUpperCase()}`],
    ['/api/session/nonce', '/api/session-nonce'],
    [`/api/share-card/${HEX64}.png?v=0123456789ab`, `/api/share-card?id=${HEX64}&v=0123456789ab`],
    [`/api/settle/status?sessionId32=0x${HEX64}`, `/api/settle-status?sessionId32=0x${HEX64}`],
    [`/api/profile/refresh?wallet=${WALLET}`, `/api/profile-refresh?wallet=${WALLET}`],
  ];
  for (const [url, destination] of cases) {
    assert.equal(vercelRoute(url), destination, `${url} (compiled)`);
    assert.equal(rewrite(url)?.destination, destination, `${url} (model)`);
  }
  for (const url of [`/s/${HEX64}0`, `/api/session/${HEX64.slice(1)}`, `/api/share-card/${HEX64}.jpg`, `/api/share-card/${HEX64}xpng`]) {
    assert.equal(vercelRoute(url), null, `${url} matches no compiled route`);
  }
});

test('a routed session link reaches E9 with the exact query Vercel sends', async () => {
  const db = createPgliteClient();
  try {
    const session = await seedVerifiedSession(db, { wallet: `0x${'c3'.repeat(20)}`, score: 4321 });
    const deployment = { status: 'unavailable', chainId: 4441, startBlock: null, addresses: {} };
    const handler = verifiedSessionApi.createHandler(() => verifiedSessionApi.buildDeps({ VERCEL_ENV: 'development' }, { db, deployment, nowMs: Date.parse('2026-09-23T12:00:00.000Z') }));
    for (const link of [`/api/session/${session.sessionId32}`, `/api/session/${session.sessionId32.slice(2)}`]) {
      const url = vercelRoute(link);
      assert.deepEqual(queryKeys(url), ['id'], link);
      const response = await invoke(handler, { url });
      assert.equal(response.status, 200, `${link} → ${url}`);
      assert.equal(response.body.session.sessionId32, session.sessionId32);
      assert.equal(response.body.session.score, 4321);
    }
    const preFix = await invoke(handler, { url: `/api/verified-session?id=${session.sessionId32}&shareId=${session.sessionId32}` });
    assert.deepEqual([preFix.status, preFix.body.error], [400, 'invalid-query'], 'the query a :shareId rewrite produced is rejected');
  } finally {
    await db.close();
  }
});

test('crons and function limits are declared', () => {
  const chikunShapes = 'apps/chikun/assets/obstacle-shapes.json';
  assert.deepEqual(vercel.functions, {
    'api/settle.mjs': { maxDuration: 60, memory: 1024, includeFiles: chikunShapes },
    'api/cron/settle-retry.mjs': { maxDuration: 60, memory: 1024, includeFiles: chikunShapes },
    // 300 s (Pro): the indexer stops starting chunks after 45 s, but one slow public-RPC chunk can run
    // past a 60 s limit (2026-09-24 production: 504 Task timed out after 60 seconds).
    'api/cron/index-chain.mjs': { maxDuration: 300 },
    'api/settle-status.mjs': { maxDuration: 15 },
    'api/leaderboard.mjs': { maxDuration: 10 },
    'api/profile.mjs': { maxDuration: 10 },
    'api/profile-refresh.mjs': { maxDuration: 15 },
    'api/verified-session.mjs': { maxDuration: 10 },
    'api/session.mjs': { maxDuration: 10 },
    'api/session-nonce.mjs': { maxDuration: 10 },
    'api/share-page.mjs': { maxDuration: 10 },
    'api/share-card.mjs': { maxDuration: 20, memory: 1024, includeFiles: 'apps/portal/assets/share-cards/**' },
    'api/ranked-seed.mjs': { maxDuration: 10 },
    // ops-health: two short-deadline read parts (Neon, RPC) in parallel.
    'api/health.mjs': { maxDuration: 15 },
  });
  assert.deepEqual(vercel.crons, [
    { path: '/api/cron/settle-retry', schedule: '* * * * *' },
    { path: '/api/cron/index-chain', schedule: '*/5 * * * *' },
  ]);
  for (const cron of vercel.crons) assert.ok(vercel.functions[`${cron.path.slice(1)}.mjs`], `${cron.path} has a function entry`);
});

test('noindex covers profile, share and owner pages', () => {
  for (const path of [`/profile/${WALLET}`, '/profile', `/s/${HEX64}`, '/owner/confirm-dev-wallet.html', '/owner/status.html', '/owner/status.mjs', '/play/chikun/ranked', '/leaderboards']) {
    assert.equal(headersFor(path)['X-Robots-Tag'], 'noindex, follow', path);
  }
  assert.equal(headersFor('/owner/confirm-dev-wallet.html')['Cache-Control'], 'no-store');
  assert.equal(headersFor('/owner/status.html')['Cache-Control'], 'no-store', 'the owner status page is never cached');
  assert.equal(headersFor('/games/chikun')['X-Robots-Tag'], undefined, 'discover pages stay indexable');
  assert.equal(headersFor('/')['X-Robots-Tag'], undefined);
});

test('the health function is served at its own path with no rewrite', () => {
  assert.equal(rewrite('/api/health'), null, '/api/health is the function itself');
  assert.equal(rewrite('/api/health?cb=1'), null);
  assert.ok(existsSync(new URL('../api/health.mjs', import.meta.url)));
  assert.equal(vercel.crons.some((cron) => cron.path === '/api/health'), false, 'health is read on demand, never scheduled');
  assert.equal(headersFor('/api/health')['X-Robots-Tag'], undefined);
});

test('the health read deadlines end well inside the health function limit', () => {
  // A hung Neon or RPC read must end as a degraded 200, never a Vercel 504.
  const limitMs = vercel.functions['api/health.mjs'].maxDuration * 1000;
  for (const [name, ms] of Object.entries({ HEALTH_DB_TIMEOUT_MS, HEALTH_CHAIN_TIMEOUT_MS })) {
    assert.ok(Number.isSafeInteger(ms) && ms > 0 && ms <= 5_000, `${name} is a short deadline (${ms} ms)`);
  }
  // The parts run in parallel; even back to back they leave a cold-start margin.
  assert.ok(HEALTH_DB_TIMEOUT_MS + HEALTH_CHAIN_TIMEOUT_MS + 5_000 <= limitMs, `${HEALTH_DB_TIMEOUT_MS} + ${HEALTH_CHAIN_TIMEOUT_MS} ms + 5 s margin fits ${limitMs} ms`);
});

test('every functions entry points at an existing file', () => {
  for (const [file, config] of Object.entries(vercel.functions)) {
    assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), `${file} exists (a missing file fails the Vercel build)`);
    if (config.includeFiles) {
      const base = config.includeFiles.replace(/\/\*\*$/, '');
      assert.ok(existsSync(new URL(`../${base}`, import.meta.url)), `${config.includeFiles} matches from day one`);
    }
  }
  assert.ok(existsSync(new URL('../apps/portal/assets/share-cards/.gitkeep', import.meta.url)));
});

// integration-glue C12: production cards show badge art only if every file
// the card function reads is inside its includeFiles glob. The badges are
// byte copies under share-cards/badges (results-share, 786f0129), so the
// one glob covers the catalog art without shipping achievement-badges/**.
test('every badge and background the share card reads is inside its includeFiles', async () => {
  const { shareCardBadgeUrl, shareCardBackgroundUrl } = await import('../api/share-card.mjs');
  const { ACHIEVEMENT_GAME_IDS, catalogFor } = await import('../apps/portal/src/achievements/index.mjs');
  const { fileURLToPath } = await import('node:url');
  const { relative, sep } = await import('node:path');
  const root = fileURLToPath(new URL('..', import.meta.url));
  const glob = vercel.functions['api/share-card.mjs'].includeFiles;
  assert.match(glob, /\/\*\*$/);
  const covered = glob.replace(/\*\*$/, '');
  const repoPath = (url) => relative(root, fileURLToPath(url)).split(sep).join('/');
  const images = ACHIEVEMENT_GAME_IDS.flatMap((gameId) => catalogFor(gameId).map((entry) => entry.image));
  assert.ok(images.length > 100, 'every game catalog has badge art');
  for (const image of images) {
    const url = shareCardBadgeUrl(image);
    assert.ok(url, image);
    assert.ok(repoPath(url).startsWith(covered), `${image} is read from ${repoPath(url)}, inside ${glob}`);
    assert.ok(existsSync(url), `${repoPath(url)} is committed`);
  }
  for (const gameId of ACHIEVEMENT_GAME_IDS) assert.ok(repoPath(shareCardBackgroundUrl(gameId)).startsWith(covered), gameId);
});
