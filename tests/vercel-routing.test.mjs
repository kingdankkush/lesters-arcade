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
