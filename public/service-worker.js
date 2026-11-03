const CACHE_NAME = "nexa-shopping-shell-v2";
const OFFLINE_URL = "/offline.html";
const ROOT_URL = "/";

// Shell resources to pre-cache on install
const PRECACHE_ASSETS = [
  ROOT_URL,
  OFFLINE_URL,
  "/manifest.json",
  "/favicon.ico",
  "/nexa-global-mart-logo.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Attempt caching each asset individually so one failure does not abort the install
      for (const asset of PRECACHE_ASSETS) {
        try {
          const response = await fetch(asset, { cache: "reload" });
          if (response.ok) {
            await cache.put(asset, response);
          }
        } catch {
          // If offline during background update, continue
        }
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(
            (key) =>
              (key.startsWith("nexa-shopping-shell-") || key.startsWith("brand-shopping-shell-")) &&
              key !== CACHE_NAME
          )
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== "GET") return;

  // STRICT PRIVACY BOUNDARIES:
  // Never intercept, cache, or handle private, admin, auth, or Supabase endpoints
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.startsWith("/account") ||
    url.pathname.startsWith("/admin") ||
    url.pathname.startsWith("/workspace") ||
    url.pathname.startsWith("/rest/") ||
    url.pathname.startsWith("/storage/v1/object/authenticated/") ||
    url.hostname.includes("supabase.co") ||
    url.hostname.includes("connector-gateway.lovable.dev")
  ) {
    return;
  }

  // Handle SPA HTML navigations
  if (request.mode === "navigate") {
    // Only handle public storefront navigation routes
    const isPublicRoute =
      url.origin === self.location.origin &&
      !url.pathname.startsWith("/admin") &&
      !url.pathname.startsWith("/workspace") &&
      !url.pathname.startsWith("/account");

    if (!isPublicRoute) return;

    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok && response.type === "basic") {
            const cache = await caches.open(CACHE_NAME);
            // Cache the HTML response under its own pathname and keep ROOT_URL updated
            await cache.put(request, response.clone());
            if (url.pathname === ROOT_URL) {
              await cache.put(ROOT_URL, response.clone());
            }
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);

          // 1. Try matching the exact requested URL (e.g. /shop, /cart, /product/123)
          const exactMatch = await cache.match(request);
          if (exactMatch) return exactMatch;

          // 2. Try matching root shell HTML as the SPA fallback
          const rootMatch = await cache.match(ROOT_URL);
          if (rootMatch) return rootMatch;

          // 3. Fallback to clean branded offline HTML
          const offlineMatch = await cache.match(OFFLINE_URL);
          if (offlineMatch) return offlineMatch;

          return new Response("Connection unavailable. Please reconnect to view live pages.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        })
    );
    return;
  }

  // Handle same-origin static assets: JavaScript, CSS, fonts, public static images
  if (url.origin === self.location.origin) {
    const isStaticAsset =
      ["script", "style", "font", "image"].includes(request.destination) ||
      url.pathname.startsWith("/assets/") ||
      url.pathname.endsWith(".js") ||
      url.pathname.endsWith(".css") ||
      url.pathname.endsWith(".woff2") ||
      url.pathname.endsWith(".png") ||
      url.pathname.endsWith(".ico") ||
      url.pathname.endsWith(".json");

    if (isStaticAsset) {
      event.respondWith(
        caches.open(CACHE_NAME).then(async (cache) => {
          const cached = await cache.match(request);

          // If available in cache, return cached immediately and update in background (stale-while-revalidate)
          const fetchPromise = fetch(request)
            .then(async (response) => {
              if (response.ok && (response.type === "basic" || response.type === "cors")) {
                await cache.put(request, response.clone());
              }
              return response;
            })
            .catch(() => undefined);

          if (cached) {
            event.waitUntil(fetchPromise);
            return cached;
          }

          // Not in cache: wait for network
          const networkResponse = await fetchPromise;
          if (networkResponse) return networkResponse;

          return new Response("", { status: 408, statusText: "Asset unavailable offline" });
        })
      );
    }
  }
});
