import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

test('Vercel rewrites every SPA deep-link namespace used by the arcade router', () => {
  const rewrites = vercel.rewrites ?? [];
  const destinationsBySource = new Map(rewrites.map((rewrite) => [rewrite.source, rewrite.destination]));
  for (const source of ['/', '/games/:path*', '/play/:path*', '/(profile|scores|leaderboards|settings)']) {
    assert.equal(destinationsBySource.get(source), '/index.html', `${source} should serve the SPA shell`);
  }
});

test('production caching keeps bundled runtime outputs immutable while stable asset URLs revalidate', () => {
  const headersBySource = new Map((vercel.headers ?? []).map((entry) => [
    entry.source,
    new Map(entry.headers.map((header) => [header.key, header.value])),
  ]));
  assert.equal(
    headersBySource.get('/dist/(chunks|hmh-reboot)/(.*)')?.get('Cache-Control'),
    'public, max-age=31536000, immutable',
  );
  assert.equal(
    headersBySource.get('/(dist/main.js|assets/.*|styles.css|styles-arcade-polish.css|src/design-tokens.css)')?.get('Cache-Control'),
    'public, max-age=0, s-maxage=31536000, stale-while-revalidate=86400',
  );
});
