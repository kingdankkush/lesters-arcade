// Lester's Arcade — service worker (PWA offline + repeat-visit caching).
//
// Strategy is deliberately conservative so a deploy is NEVER trapped behind a
// stale cache (the classic PWA footgun):
//   - HTML / navigation  -> NETWORK-FIRST (fall back to cache offline)
//   - JS / CSS           -> NETWORK-FIRST (always get the freshest bundle; the
//                            app already cache-busts with ?v= but network-first
//                            guarantees a new deploy wins immediately)
//   - images/fonts/audio -> CACHE-FIRST  (heavy, effectively immutable assets;
//                            this is where the repeat-visit speedup comes from)
// Bumping CACHE_VERSION drops every old cache on activate.

const CACHE_VERSION = 'lesters-arcade-v4-hmh-reboot-12';
const CACHE_NAME = `${CACHE_VERSION}`;

// Minimal app shell precached on install so the arcade boots offline.
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/dist/main.js',
  '/hmh-reboot/index.html',
  '/hmh-reboot/styles.css',
  '/dist/hmh-reboot/game.js',
];

const CACHE_FIRST_DESTINATIONS = new Set(['image', 'font', 'audio', 'video']);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Network-first: try the network, cache a copy on success, fall back to cache.
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response && response.ok && request.method === 'GET') {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    // Offline navigation falls back to the cached shell.
    if (request.mode === 'navigate') {
      const shell = await cache.match('/index.html') || await cache.match('/');
      if (shell) return shell;
    }
    throw err;
  }
}

// Cache-first: serve from cache if present, else fetch + cache.
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok && request.method === 'GET') {
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Only handle same-origin GETs; let everything else (wallet RPC, CDNs,
  // cross-origin) pass straight through untouched.
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(networkFirst(request));
    return;
  }
  if (request.destination === 'script' || request.destination === 'style') {
    event.respondWith(networkFirst(request));
    return;
  }
  if (CACHE_FIRST_DESTINATIONS.has(request.destination)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  // Default: network-first so we never serve stale unknown resources.
  event.respondWith(networkFirst(request));
});
