// NEXA GLOBAL MART offline shell.
// Caches only the public storefront shell and explicitly allowed public static files.
// Private, authenticated, admin, account, API and Supabase traffic is never intercepted.

const CACHE_NAME = "nexa-shopping-shell-v3";
const OFFLINE_URL = "/offline.html";
const ROOT_URL = "/";

// Shell resources to pre-cache on install.
const PRECACHE_ASSETS = [
  ROOT_URL,
  OFFLINE_URL,
  "/manifest.json",
  "/favicon.ico",
  "/nexa-global-mart-logo.png",
];

// Public storefront pages cached as server-rendered HTML, so they hydrate without a fallback mismatch offline.
const PRECACHE_PAGES = ["/shop?page=1", "/cart", "/about", "/wishlist", "/support", "/policies"];

// Public JSON files that may be cached. Any other same-origin JSON is left alone.
const PUBLIC_JSON_FILES = new Set(["/manifest.json"]);

// Path prefixes that must never be intercepted, cached or served offline.
const PRIVATE_PATH_PREFIXES = [
  "/api/",
  "/auth/",
  "/account",
  "/admin",
  "/workspace",
  "/rest/",
  "/storage/v1/object/authenticated/",
  "/sign-in",
  "/sign-up",
  "/forgot-password",
];

const PRIVATE_HOST_FRAGMENTS = ["supabase.co", "connector-gateway.lovable.dev"];

self.addEventListener("install", (event) => {
  event.waitUntil(precacheShell());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                (key.startsWith("nexa-shopping-shell-") || key.startsWith("brand-shopping-shell-")) &&
                key !== CACHE_NAME
            )
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Only handle GET requests
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Only the storefront's own origin is handled; everything else goes straight to the network.
  if (url.origin !== self.location.origin) return;

  // STRICT PRIVACY BOUNDARIES: never intercept, cache or serve private or authenticated traffic.
  if (isPrivateRequest(url, request)) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request, url));
    return;
  }

  if (isAllowedStaticRequest(request, url)) {
    event.respondWith(handleStaticAsset(event, request));
  }
});

/**
 * Pre-caches the public shell, plus the hashed build assets referenced by the
 * root HTML. Without those assets the cached shell cannot hydrate offline.
 */
async function precacheShell() {
  const cache = await caches.open(CACHE_NAME);
  let rootHtml = "";

  for (const asset of PRECACHE_ASSETS) {
    try {
      const response = await fetch(asset, { cache: "reload" });
      if (!response.ok) continue;

      if (asset === ROOT_URL) {
        rootHtml = await response.clone().text();
      }

      await cache.put(asset, response);
    } catch {
      // Offline during install: keep going so one failure does not abort the shell.
    }
  }

  // Public storefront route chunks, listed at build time, so /shop, /cart and product pages load offline.
  const routeAssets = await fetchJsonList("/sw-precache.json");
  const buildAssets = new Set([...buildAssetsFromHtml(rootHtml), ...routeAssets]);

  for (const page of PRECACHE_PAGES) {
    try {
      const response = await fetch(page, { cache: "reload" });
      if (response.ok) await cache.put(page, response);
    } catch {
      // Skip pages that cannot be fetched during install.
    }
  }

  for (const asset of buildAssets) {
    try {
      const response = await fetch(asset, { cache: "reload" });
      if (response.ok) await cache.put(asset, response);
    } catch {
      // Skip assets that cannot be fetched; they are cached on first online use.
    }
  }
}

async function fetchJsonList(url) {
  try {
    const response = await fetch(url, { cache: "reload" });
    if (!response.ok) return [];
    const value = await response.json();
    return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function buildAssetsFromHtml(html) {
  const assets = new Set();

  for (const match of html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) {
    assets.add(match[1]);
  }

  return [...assets];
}

function isPrivateRequest(url, request) {
  if (request.headers.has("authorization")) return true;
  if (PRIVATE_HOST_FRAGMENTS.some((fragment) => url.hostname.includes(fragment))) return true;
  return PRIVATE_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
}

function isAllowedStaticRequest(request, url) {
  if (url.pathname.endsWith(".json")) {
    return PUBLIC_JSON_FILES.has(url.pathname);
  }

  return (
    ["script", "style", "font", "image"].includes(request.destination) ||
    url.pathname.startsWith("/assets/") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".ico")
  );
}

async function handleNavigation(request, url) {
  try {
    const response = await fetch(request);

    if (response.ok && response.type === "basic") {
      try {
        const cache = await caches.open(CACHE_NAME);
        // Cache the HTML under its own path, and keep the root shell up to date.
        await cache.put(request, response.clone());
        if (url.pathname === ROOT_URL) {
          await cache.put(ROOT_URL, response.clone());
        }
      } catch {
        // Caching is best effort; the live response is still returned.
      }
    }

    return response;
  } catch {
    return offlineNavigationResponse(request);
  }
}

async function offlineNavigationResponse(request) {
  const cache = await caches.open(CACHE_NAME);

  // 1. The exact page the user visited earlier (for example /product/123), or a
  //    precached storefront page such as /cart. The query string is ignored so
  //    /shop matches the cached /shop?page=1 page.
  const exactMatch =
    (await cache.match(request)) || (await cache.match(request, { ignoreSearch: true }));
  if (exactMatch) return exactMatch;

  // 2. The root shell. The client router renders the requested route from saved data.
  const rootMatch = await cache.match(ROOT_URL);
  if (rootMatch) return rootMatch;

  // 3. The branded offline page.
  const offlineMatch = await cache.match(OFFLINE_URL);
  if (offlineMatch) return offlineMatch;

  return new Response("Connection unavailable. Please reconnect to view live pages.", {
    status: 503,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

function handleStaticAsset(event, request) {
  return caches.open(CACHE_NAME).then(async (cache) => {
    const cached = await cache.match(request);

    // Serve the cached copy immediately and refresh it in the background.
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

    const networkResponse = await fetchPromise;
    if (networkResponse) return networkResponse;

    return new Response("", { status: 408, statusText: "Asset unavailable offline" });
  });
}
