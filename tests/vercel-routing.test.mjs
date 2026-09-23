import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

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

// First matching rewrite wins; the original query string is carried through.
function rewrite(url) {
  const [path, query = ''] = url.split('?');
  for (const rule of vercel.rewrites) {
    const match = sourcePattern(rule.source).exec(path);
    if (!match) continue;
    let destination = rule.destination.replace(/:([A-Za-z0-9_]+)/g, (_, name) => match.groups?.[name] ?? '');
    if (query) destination += `${destination.includes('?') ? '&' : '?'}${query}`;
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
    [`/profile/${WALLET}`, '/index.html'],
    ['/profile', '/index.html'],
    ['/api/session/nonce', '/api/session-nonce'],
    [`/api/session/0x${HEX64}`, `/api/verified-session?id=0x${HEX64}`],
    [`/api/session/${HEX64}`, `/api/verified-session?id=${HEX64}`],
    [`/api/settle/status?sessionId32=0x${HEX64}`, `/api/settle-status?sessionId32=0x${HEX64}`],
    [`/api/profile/refresh?wallet=${WALLET}`, `/api/profile-refresh?wallet=${WALLET}`],
    ['/api/ranked/seed', '/api/ranked-seed'],
    [`/api/share-card/${HEX64}.png?v=0123456789ab`, `/api/share-card?id=${HEX64}&v=0123456789ab`],
    ['/games/chikun', '/discover/chikun.html'],
    ['/play/hard-money-heroes/ranked', '/index.html'],
  ];
  for (const [url, destination] of cases) assert.equal(rewrite(url)?.destination, destination, url);
  for (const url of [`/s/${HEX64.slice(2)}`, `/s/${HEX64}0`, '/profile/0x1234', `/api/session/${HEX64.slice(1)}`, `/api/share-card/${HEX64}.jpg`, '/api/session']) {
    assert.equal(rewrite(url), null, `${url} matches no rewrite`);
  }
  const sources = vercel.rewrites.map((rule) => rule.source);
  assert.ok(sources.indexOf('/api/session/nonce') < sources.indexOf('/api/session/:shareId((?:0x)?[0-9a-fA-F]{64})'), 'nonce is routed before the share id');
  assert.ok(sources.indexOf('/api/share-card/:shareId([0-9a-fA-F]{64}).png') < sources.indexOf('/games/:path*'), 'the new rewrites come before /games/:path*');
  assert.equal(vercel.rewrites.find((rule) => rule.source.startsWith('/api/share-card/')).destination, '/api/share-card?id=:shareId', 'the card rewrite adds only id, so ?v=<rev> reaches the handler from the original query');
  for (const rule of vercel.rewrites.filter((entry) => entry.destination.startsWith('/api/'))) {
    const file = `${rule.destination.split('?')[0].slice(1)}.mjs`;
    assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), `${rule.source} → ${file} exists`);
  }
});

test('crons and function limits are declared', () => {
  const chikunShapes = 'apps/chikun/assets/obstacle-shapes.json';
  assert.deepEqual(vercel.functions, {
    'api/settle.mjs': { maxDuration: 60, memory: 1024, includeFiles: chikunShapes },
    'api/cron/settle-retry.mjs': { maxDuration: 60, memory: 1024, includeFiles: chikunShapes },
    'api/cron/index-chain.mjs': { maxDuration: 60 },
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
  });
  assert.deepEqual(vercel.crons, [
    { path: '/api/cron/settle-retry', schedule: '* * * * *' },
    { path: '/api/cron/index-chain', schedule: '*/5 * * * *' },
  ]);
  for (const cron of vercel.crons) assert.ok(vercel.functions[`${cron.path.slice(1)}.mjs`], `${cron.path} has a function entry`);
});

test('noindex covers profile, share and owner pages', () => {
  for (const path of [`/profile/${WALLET}`, '/profile', `/s/${HEX64}`, '/owner/confirm-dev-wallet.html', '/play/chikun/ranked', '/leaderboards']) {
    assert.equal(headersFor(path)['X-Robots-Tag'], 'noindex, follow', path);
  }
  assert.equal(headersFor('/owner/confirm-dev-wallet.html')['Cache-Control'], 'no-store');
  assert.equal(headersFor('/games/chikun')['X-Robots-Tag'], undefined, 'discover pages stay indexable');
  assert.equal(headersFor('/')['X-Robots-Tag'], undefined);
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
