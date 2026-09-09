/**
 * Just enough service worker to make the app installable and to open when the
 * network does not answer.
 *
 * Deliberately narrow: it caches the shell — the page, its script, its styles,
 * its icons — and nothing else. Task data is Firestore's job, and Firestore
 * keeps its own IndexedDB copy that already survives being offline. Caching API
 * responses here as well would mean two caches disagreeing about the same
 * tasks, which is worse than none.
 */

// Bumping this name is what evicts the previous shell.
const CACHE = "stepler-shell-v2";

/**
 * There are two pages on this origin now — the site at `/` and the app at
 * `/app` — and they are not interchangeable. Serving the marketing page to
 * somebody who opened the installed app offline would be a bug you only see
 * on a train.
 */
const SITE = "/";
const APP = "/app";

const SHELL = [
  SITE,
  APP,
  "/manifest.webmanifest",
  "/favicon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

/** Which of the two shells a navigation belongs to. */
function shellFor(pathname) {
  return pathname === APP ||
    pathname.startsWith(`${APP}/`) ||
    pathname === "/login"
    ? APP
    : SITE;
}

self.addEventListener("install", (event) => {
  // A single missing file must not fail the whole install, so each is added on
  // its own and allowed to fail.
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        Promise.all(SHELL.map((url) => cache.add(url).catch(() => {}))),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Anything that is not this origin is Firebase talking to its servers. Let it
  // through untouched — intercepting auth or Firestore traffic here would break
  // both in ways that are miserable to debug.
  if (url.origin !== self.location.origin) return;

  // Navigations: network first, so a deploy is picked up immediately, with the
  // cached shell as the offline answer.
  if (request.mode === "navigate") {
    const shell = shellFor(url.pathname);
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(shell, copy));
          return res;
        })
        .catch(() => caches.match(shell).then((r) => r || Response.error())),
    );
    return;
  }

  // Hashed assets never change under the same name, so the cache is always
  // right for them and the network is only a fallback.
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((res) => {
          if (res.ok && url.pathname.startsWith("/assets/")) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        }),
    ),
  );
});
