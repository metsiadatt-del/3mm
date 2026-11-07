const VERSION = '7b3422090975';
const CACHE = `met-static-${VERSION}`;
const BASE = new URL('./', self.location.href);
const PRECACHE = new URL('precache.json', BASE);
const INDEX = new URL('index.html', BASE);
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const response = await fetch(PRECACHE, { cache: 'no-store' });
    if (!response.ok) throw new Error('Cannot load offline manifest');
    const urls = await response.json();
    const cache = await caches.open(CACHE);
    await cache.addAll(urls);
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('met-static-') && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (event.request.mode === 'navigate') {
      try { return await fetch(event.request); }
      catch { return (await cache.match(INDEX)) || Response.error(); }
    }
    return (await cache.match(event.request)) || fetch(event.request);
  })());
});
