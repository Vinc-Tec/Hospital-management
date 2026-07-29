const CACHE = 'healthcloud-v1';
const API_CACHE = 'healthcloud-api-v1';
const PRECACHE = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== API_CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Is this a GET request to the Supabase REST API (not auth, not storage,
// not realtime -- only /rest/v1/* data reads)? Matched by hostname rather
// than a hardcoded project URL so this file doesn't need per-deployment
// editing; every Supabase project's API lives at <ref>.supabase.co.
function isSupabaseDataRequest(url) {
  return url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/rest/v1/');
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  if (url.origin === self.location.origin) {
    // Same-origin static assets: cache-first with background revalidation.
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
    return;
  }

  if (isSupabaseDataRequest(url)) {
    // Network-first for live data, falling back to the last successful
    // response when offline -- this is read-only offline support (view
    // whatever was already loaded while connected). It does NOT queue or
    // sync writes made while offline; POST/PATCH/DELETE still require a
    // live connection, same as before.
    e.respondWith(
      fetch(e.request).then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(API_CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match(e.request).then((cached) => cached || new Response(
        JSON.stringify({ error: 'offline', message: 'No connection and no cached data available for this request.' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      )))
    );
  }
});
