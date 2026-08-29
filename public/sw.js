const CACHE = 'healthcloud-v2';
const PRECACHE = ['/', '/index.html', '/manifest.webmanifest', '/favicon.png'];

// API responses are intentionally NOT cached. A previous version cached
// /rest/v1/* reads so they could be viewed offline, but that let a tenant
// whose trial/subscription had expired keep reading cached patient data
// offline after access was supposed to be cut. Security > offline
// convenience: authenticated data must always go to the network, and if
// the network says "expired"/403, the app shows the billing gate -- there
// is no stale-cache fallback that could bypass it.

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  // Drop every pre-existing cache that is not the current CACHE -- this
  // also evicts any old 'healthcloud-api-v1' cache from prior versions.
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Only same-origin static assets are cache-first. Everything cross-origin
  // (Supabase REST/auth, Edge Functions, Flutterwave, etc.) goes straight
  // to the network with NO caching -- so no stale authenticated payload can
  // be served, and no expired tenant can read data from the cache.
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        const fetchPromise = fetch(e.request).then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return res;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
  }
  // Non-GET cross-origin requests are handled by the browser as normal.
});
