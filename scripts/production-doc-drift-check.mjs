import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_SERVICE_WORKER_URL = 'https://lestersarcade.io/sw.js';
const DEFAULT_TIMEOUT_MS = 10_000;

export function parseReadmeProductionMarker(source) {
  const marker = source.match(/^\*\*Production cache marker:\*\*\s+`([^`]+)`\s*$/m)?.[1];
  if (!marker) throw new Error('README is missing the canonical **Production cache marker:** field.');
  return marker;
}

export function parseServiceWorkerMarker(source) {
  const marker = source.match(/\bCACHE_VERSION\s*=\s*['"]([^'"]+)['"]/m)?.[1];
  if (!marker) throw new Error('Production service worker is missing its CACHE_VERSION declaration.');
  return marker;
}

export async function assertProductionMarker({
  readmePath = path.join(root, 'README.md'),
  serviceWorkerUrl = DEFAULT_SERVICE_WORKER_URL,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const readmeSource = await readFile(readmePath, 'utf8');
  const readmeMarker = parseReadmeProductionMarker(readmeSource);

  let response;
  try {
    response = await fetch(serviceWorkerUrl, {
      cache: 'no-store',
      headers: { 'cache-control': 'no-cache' },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new Error(`Unable to fetch production service worker at ${serviceWorkerUrl}: ${error.message}`, {
      cause: error,
    });
  }
  if (!response.ok) {
    throw new Error(`Unable to fetch production service worker at ${serviceWorkerUrl}: HTTP ${response.status}.`);
  }

  const serviceWorkerMarker = parseServiceWorkerMarker(await response.text());
  if (readmeMarker !== serviceWorkerMarker) {
    throw new Error(
      `Production documentation drift: README records ${readmeMarker}, but ${serviceWorkerUrl} serves ${serviceWorkerMarker}.`,
    );
  }

  return { readmeMarker, serviceWorkerMarker, serviceWorkerUrl };
}

async function main() {
  const result = await assertProductionMarker({
    readmePath: process.env.LESTERS_ARCADE_PRODUCTION_README ?? path.join(root, 'README.md'),
    serviceWorkerUrl: process.env.LESTERS_ARCADE_PRODUCTION_SW_URL ?? DEFAULT_SERVICE_WORKER_URL,
  });
  console.log(`Production documentation marker matches live service worker: ${result.readmeMarker}`);
}

const isMain = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
