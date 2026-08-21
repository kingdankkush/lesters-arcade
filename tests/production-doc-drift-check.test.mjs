import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  assertProductionMarker,
  parseReadmeProductionMarker,
  parseServiceWorkerMarker,
} from '../scripts/production-doc-drift-check.mjs';

const README_MARKER = 'lesters-arcade-v18-hmh-mobile-character-start';

function readme(marker = README_MARKER) {
  return `# Lester's Arcade\n\n**Production cache marker:** \`${marker}\`\n`;
}

function serviceWorker(marker = README_MARKER) {
  return `const CACHE_VERSION = '${marker}';\n`;
}

test('production marker parsers read the canonical README and service-worker fields', () => {
  assert.equal(parseReadmeProductionMarker(readme()), README_MARKER);
  assert.equal(parseServiceWorkerMarker(serviceWorker()), README_MARKER);
});

test('production marker parsers fail closed when their canonical field is absent', () => {
  assert.throws(() => parseReadmeProductionMarker('# no marker'), /Production cache marker/);
  assert.throws(() => parseServiceWorkerMarker('self.addEventListener("fetch", () => {});'), /CACHE_VERSION/);
});

test('repository README production marker matches the current service worker marker', async () => {
  const [readmeSource, serviceWorkerSource] = await Promise.all([
    readFile(new URL('../README.md', import.meta.url), 'utf8'),
    readFile(new URL('../apps/portal/sw.js', import.meta.url), 'utf8'),
  ]);
  assert.equal(
    parseReadmeProductionMarker(readmeSource),
    parseServiceWorkerMarker(serviceWorkerSource),
    'README production truth must advance in the same release wave as the service-worker cache marker',
  );
});

test('production drift check passes matching live content and rejects stale README content', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'lesters-production-doc-gate-'));
  const readmePath = path.join(root, 'README.md');
  await writeFile(readmePath, readme(), 'utf8');

  const server = http.createServer((request, response) => {
    if (request.url !== '/sw.js') {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { 'content-type': 'text/javascript' });
    response.end(serviceWorker());
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.close();
    await once(server, 'close');
    await rm(root, { recursive: true, force: true });
  });

  const address = server.address();
  const serviceWorkerUrl = `http://127.0.0.1:${address.port}/sw.js`;
  const result = await assertProductionMarker({ readmePath, serviceWorkerUrl });
  assert.deepEqual(result, {
    readmeMarker: README_MARKER,
    serviceWorkerMarker: README_MARKER,
    serviceWorkerUrl,
  });

  await writeFile(readmePath, readme('lesters-arcade-v17-stale'), 'utf8');
  await assert.rejects(
    assertProductionMarker({ readmePath, serviceWorkerUrl }),
    /production documentation drift.*v17-stale.*v18-hmh-mobile-character-start/i,
  );
});

test('production drift check treats fetch failures as blockers', async () => {
  await assert.rejects(
    assertProductionMarker({
      readmePath: new URL('../README.md', import.meta.url),
      serviceWorkerUrl: 'http://127.0.0.1:1/sw.js',
      timeoutMs: 100,
    }),
    /Unable to fetch production service worker/,
  );
});
