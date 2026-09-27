// Service worker: makes the viewer open offline and fast.
//
// Every same-origin GET (the app, its assets, data/cards.json, data/collection.enc) is served
// stale-while-revalidate: the cached copy right away, with a fresh copy fetched in the background for
// next time. Requests made with fetch(url, { cache: 'reload' }), which is what the Refresh button
// does, go to the network first and only fall back to the cache when offline.
//
// Card images come from Ravensburger's CDN and aren't handled here: they have no CORS headers, and
// caching thousands of such opaque responses would eat the phone's storage quota. The browser's
// normal HTTP cache keeps the ones you've viewed for a week.

const CACHE = 'ldv-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) if (name !== CACHE) await caches.delete(name);
      await self.clients.claim();
    })(),
  );
});

async function fromNetwork(request) {
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE);
    await cache.put(request.url, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  try {
    return await fromNetwork(request);
  } catch (err) {
    const cached = await caches.match(request.url);
    if (cached) return cached;
    throw err;
  }
}

async function staleWhileRevalidate(event) {
  const cached = await caches.match(event.request.url);
  const fresh = fromNetwork(event.request);
  if (cached) {
    event.waitUntil(fresh.catch(() => undefined));
    return cached;
  }
  return fresh;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(request.cache === 'reload' ? networkFirst(request) : staleWhileRevalidate(event));
});
