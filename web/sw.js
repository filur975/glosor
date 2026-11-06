// Offline support: serve the app from the cache, and refresh the cache in the background so a new
// version is used from the next start. The shared word lists are fetched fresh when online.
const CACHE = "glosor-v2";
const FILES = ["./", "index.html", "style.css", "app.js", "quiz.js", "store.js", "manifest.webmanifest",
  "glosor.json",
  "icon.svg", "icon-192.png", "icon-512.png", "icon-maskable-512.png",
  "apple-touch-icon.png"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.endsWith("/glosor.json")) {
    event.respondWith(fetch(event.request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put("glosor.json", copy));
      }
      return response;
    }).catch(() => caches.match("glosor.json")));
    return;
  }
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(event.request, { ignoreSearch: true });
    const fresh = fetch(event.request).then(response => {
      if (response.ok) cache.put(event.request, response.clone());
      return response;
    });
    if (cached) {
      event.waitUntil(fresh.catch(() => {}));
      return cached;
    }
    return fresh;
  }));
});
