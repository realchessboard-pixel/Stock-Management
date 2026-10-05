/* StockFlow service worker.
 *
 * Caching policy (deliberately conservative):
 *  - Hashed build assets (/_next/static) and icons: cache-first. They never change for a given URL.
 *  - Page navigations: always network. If the network is down, show the cached /offline page.
 *  - API, Server Actions, RSC data, uploaded photos: NEVER cached. Stock and business data must
 *    always be live, and nothing private stays on a shared shop phone.
 *
 * Offline stock entry can be added later by queueing mutations (each already carries an
 * idempotency key, so replays are safe) — see docs/IMPLEMENTATION_PLAN.md.
 */
const VERSION = "sf-v1";
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_URL = "/offline";
const MAX_STATIC_ENTRIES = 300;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, "/icons/icon-192.png"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_STATIC_ENTRIES; i++) await cache.delete(keys[i]);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) {
          cache.put(req, res.clone());
          trim(cache);
        }
        return res;
      }),
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(async () => (await caches.match(OFFLINE_URL)) || new Response("Offline", { status: 503 })),
    );
  }
  // Everything else: default network behaviour, no caching.
});
