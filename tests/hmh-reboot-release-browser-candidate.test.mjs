import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../scripts/hmh-reboot-release-browser-certification.mjs', import.meta.url), 'utf8');

test('release browser certification executes the freshly built child candidate without service-worker or HTTP-cache drift', () => {
  assert.match(source, /candidateBundlePath/);
  assert.match(source, /serviceWorkers:\s*'block'/);
  assert.match(source, /Network\.setCacheDisabled/);
  assert.match(source, /route\.fulfill\(\{ path: candidateBundlePath/);
  assert.match(source, /candidateBundleRequests/);
});

test('release browser certification serves canonical production assets from tracked local files and preserves the five-control child contract', () => {
  assert.match(source, /portalAssetsRootPath/);
  assert.match(source, /https:\/\/lestersarcade\.io\/assets\/\*\*/);
  assert.match(source, /relativePath\.includes\('\.\.'\)/);
  assert.match(source, /\['aim', 'move', 'pause', 'power', 'weapon'\]/);
});
