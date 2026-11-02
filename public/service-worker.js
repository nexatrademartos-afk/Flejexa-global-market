const CACHE_NAME = "brand-shopping-shell-v1";
const OFFLINE_URL = "/offline.html";
const ROOT_URL = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([OFFLINE_URL]))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("brand-shopping-shell-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Never cache APIs, Supabase, authentication, account or admin data.
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.startsWith("/account") ||
    url.pathname.startsWith("/admin") ||
    url.pathname.startsWith("/workspace") ||
    url.pathname.startsWith("/rest/") ||
    url.pathname.startsWith("/storage/")
  ) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).then(async (response) => {
        if (response.ok && url.pathname === ROOT_URL) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(ROOT_URL, response.clone());
        }
        return response;
      }).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        if (url.pathname === ROOT_URL) {
          const savedHome = await cache.match(ROOT_URL);
          if (savedHome) return savedHome;
        }
        return (await cache.match(OFFLINE_URL)) ||
          new Response("Connection unavailable", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" }
          });
      })
    );
    return;
  }

  if (["script", "style", "font"].includes(request.destination)) {
    const cachePromise = caches.open(CACHE_NAME);
    const networkPromise = cachePromise.then((cache) =>
      fetch(request).then(async (response) => {
        if (response.ok && response.type === "basic") {
          await cache.put(request, response.clone());
        }
        return response;
      })
    );

    event.respondWith(
      cachePromise.then(async (cache) => {
        const cached = await cache.match(request);

        if (cached) {
          // Register the refresh while the fetch event is still being handled.
          event.waitUntil(networkPromise.catch(() => undefined));
          return cached;
        }

        return networkPromise;
      })
    );
  }
});
