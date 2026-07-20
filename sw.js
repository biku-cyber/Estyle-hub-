/**
 * Style Hub — Minimal service worker.
 * Caches core shell for offline. Registered only in production
 * (see js/main.js initSW).
 */
const CACHE = "stylehub-v2";
const CORE = [
  "/home.html",
  "/gallery.html",
  "/services.html",
  "/booking.html",
  "/favorites.html",
  "/contact.html",
  "/about.html",
  "/404.html",
  "/manifest.json",
  "/assets/logo.svg",
  "/assets/icon-192.png",
  "/assets/icon-512.png",
  "/assets/maskable-512.png",
  "/assets/apple-touch-icon.png",
  "/assets/favicon-32.png",
  "/css/style.css",
  "/css/animations.css",
  "/css/responsive.css",
  "/js/main.js",
  "/js/layout.js",
  "/js/firebase.js",
  "/js/gallery.js",
  "/js/booking.js",
  "/js/favorites.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Network-first for HTML, cache-first for static assets.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (req.mode === "navigate" || req.destination === "document") {
    event.respondWith(
      fetch(req).catch(() => caches.match(req).then((r) => r || caches.match("/404.html")))
    );
    return;
  }
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      return res;
    }).catch(() => cached))
  );
});
