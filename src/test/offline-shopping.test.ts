import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

import { BRAND } from "@/lib/brand";
import { buildWebManifest } from "@/lib/pwa-manifest";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { CartView } from "@/routes/cart";
import type { StoreCatalogue, StoreProduct } from "@/lib/preview-data";

vi.mock("@/components/ProductCard", () => ({
  ProductTile: () => null,
}));

const ORIGIN = "https://shop.example";
const SHELL_CACHE = "nexa-shopping-shell-v3";

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    get: () => value,
  });
}

function readProjectFile(path: string) {
  return readFileSync(join(process.cwd(), path), "utf-8");
}

afterEach(() => {
  setOnline(true);
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("PWA manifest", () => {
  it("is generated from the central brand configuration", () => {
    const manifest = buildWebManifest();

    expect(manifest.name).toBe(BRAND.name);
    expect(manifest.short_name).toBe(BRAND.shortName);
    expect(manifest.description).toBe(BRAND.description);
    expect(manifest.start_url).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons.map((icon) => icon.src)).toContain(BRAND.logoPath);
  });

  it("follows a different brand without code changes", () => {
    const manifest = buildWebManifest({
      name: "Example Shop",
      shortName: "Example",
      description: "An example storefront.",
      logoPath: "/example-logo.png",
    });

    expect(manifest.name).toBe("Example Shop");
    expect(manifest.short_name).toBe("Example");
    expect(manifest.icons[1]?.src).toBe("/example-logo.png");
  });

  it("no longer ships a hardcoded public/manifest.json copy", () => {
    expect(existsSync(join(process.cwd(), "public/manifest.json"))).toBe(false);
  });

  it("is linked from the root route head", () => {
    expect(readProjectFile("src/routes/__root.tsx")).toContain('href: "/manifest.json"');
  });
});

describe("service worker privacy boundaries", () => {
  type Listener = (event: unknown) => void;

  type FakeResponseInit = { body?: string; status?: number; type?: string };

  function makeResponse({ body = "", status = 200, type = "basic" }: FakeResponseInit = {}) {
    const response = new Response(body, { status });
    Object.defineProperty(response, "type", { value: type });
    return response;
  }

  function createCacheStorage() {
    const stores = new Map<string, Map<string, Response>>();
    const keyOf = (input: string | { url: string }) =>
      typeof input === "string" ? new URL(input, ORIGIN).href : input.url;

    const caches = {
      open: async (name: string) => {
        if (!stores.has(name)) stores.set(name, new Map());
        const store = stores.get(name)!;
        return {
          match: async (input: string | { url: string }, options?: { ignoreSearch?: boolean }) => {
            const key = keyOf(input);
            if (store.has(key)) return store.get(key)?.clone();
            if (options?.ignoreSearch) {
              const withoutSearch = key.split("?")[0];
              for (const [storedKey, response] of store) {
                if (storedKey.split("?")[0] === withoutSearch) return response.clone();
              }
            }
            return undefined;
          },
          put: async (input: string | { url: string }, response: Response) => {
            store.set(keyOf(input), response);
          },
        };
      },
      keys: async () => [...stores.keys()],
      delete: async (name: string) => stores.delete(name),
    };

    return { caches, stores };
  }

  function loadServiceWorker(
    caches: unknown,
    network: (input: string | { url: string }) => Promise<Response>,
  ) {
    const listeners = new Map<string, Listener>();
    const self = {
      location: { origin: ORIGIN, href: `${ORIGIN}/service-worker.js` },
      addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
      skipWaiting: () => Promise.resolve(),
      clients: { claim: () => Promise.resolve() },
    };
    const source = readProjectFile("public/service-worker.js");
    new Function("self", "caches", "fetch", "URL", source)(self, caches, network, URL);
    return listeners;
  }

  function dispatchFetch(
    listeners: Map<string, Listener>,
    {
      url,
      mode = "cors",
      destination = "",
      headers = {},
    }: { url: string; mode?: string; destination?: string; headers?: Record<string, string> },
  ) {
    let responded: Promise<Response> | undefined;
    const request = {
      url,
      method: "GET",
      mode,
      destination,
      headers: new Headers(headers),
    };

    listeners.get("fetch")?.({
      request,
      respondWith: (value: Promise<Response>) => {
        responded = value;
      },
      waitUntil: () => {},
    });

    return responded;
  }

  function networkFrom(routes: Record<string, string>) {
    return async (input: string | { url: string }) => {
      const url = typeof input === "string" ? new URL(input, ORIGIN).href : input.url;
      const parsed = new URL(url);
      const body = routes[parsed.pathname + parsed.search];
      if (body !== undefined) return makeResponse({ body });
      return makeResponse({ body: "missing", status: 404 });
    };
  }

  it.each([
    ["same-origin API", `${ORIGIN}/api/orders`, {}],
    ["account page navigation", `${ORIGIN}/account/wallet`, { mode: "navigate" }],
    ["admin navigation", `${ORIGIN}/admin`, { mode: "navigate" }],
    ["workspace navigation", `${ORIGIN}/workspace/seller`, { mode: "navigate" }],
    ["sign-in navigation", `${ORIGIN}/sign-in`, { mode: "navigate" }],
    ["Supabase REST data", "https://ljweqsofsbmrooxgchch.supabase.co/rest/v1/products", {}],
    [
      "authenticated storage object",
      `${ORIGIN}/storage/v1/object/authenticated/private.png`,
      { destination: "image" },
    ],
    ["private same-origin JSON", `${ORIGIN}/data/customer-export.json`, {}],
    [
      "credentialed product page",
      `${ORIGIN}/product/1`,
      { mode: "navigate", headers: { authorization: "Bearer token" } },
    ],
  ])("does not intercept %s", (_label, url, options) => {
    const { caches } = createCacheStorage();
    const listeners = loadServiceWorker(caches, networkFrom({}));

    expect(dispatchFetch(listeners, { url, ...options })).toBeUndefined();
  });

  it("caches the allowlisted public manifest but not other same-origin JSON", async () => {
    const { caches, stores } = createCacheStorage();
    const listeners = loadServiceWorker(
      caches,
      networkFrom({ "/manifest.json": '{"name":"x"}', "/data/catalogue.json": "[]" }),
    );

    const manifest = dispatchFetch(listeners, { url: `${ORIGIN}/manifest.json` });
    expect(manifest).toBeDefined();
    await manifest;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(stores.get(SHELL_CACHE)?.has(`${ORIGIN}/manifest.json`)).toBe(true);

    expect(dispatchFetch(listeners, { url: `${ORIGIN}/data/catalogue.json` })).toBeUndefined();
  });

  it("precaches the shell, the hashed build assets in the root HTML, and the storefront route chunks", async () => {
    const rootHtml =
      '<!doctype html><script type="module" src="/assets/index-abc.js"></script>' +
      '<link rel="stylesheet" href="/assets/styles-def.css">';
    const { caches, stores } = createCacheStorage();
    const listeners = loadServiceWorker(
      caches,
      networkFrom({
        "/": rootHtml,
        "/offline.html": "<html>offline</html>",
        "/manifest.json": "{}",
        "/favicon.ico": "ico",
        "/nexa-global-mart-logo.png": "png",
        "/assets/index-abc.js": "console.log(1)",
        "/assets/styles-def.css": "body{}",
        "/sw-precache.json": JSON.stringify(["/assets/cart-ghi.js"]),
        "/cart": "<html>cart</html>",
        "/shop?page=1": "<html>shop</html>",
        "/assets/cart-ghi.js": "console.log(2)",
      }),
    );

    let pending: Promise<unknown> | undefined;
    listeners.get("install")?.({
      waitUntil: (promise: Promise<unknown>) => {
        pending = promise;
      },
    });
    await pending;

    const keys = [...(stores.get(SHELL_CACHE)?.keys() ?? [])];
    expect(keys).toEqual(
      expect.arrayContaining([
        `${ORIGIN}/`,
        `${ORIGIN}/offline.html`,
        `${ORIGIN}/assets/index-abc.js`,
        `${ORIGIN}/assets/styles-def.css`,
        `${ORIGIN}/assets/cart-ghi.js`,
        `${ORIGIN}/cart`,
        `${ORIGIN}/shop?page=1`,
      ]),
    );
  });

  it("serves the cached page offline, and falls back to the root shell for unvisited routes", async () => {
    const { caches, stores } = createCacheStorage();
    const listeners = loadServiceWorker(caches, networkFrom({}));
    const store = await caches.open(SHELL_CACHE);

    await store.put(`${ORIGIN}/product/42`, makeResponse({ body: "product 42" }));
    await store.put(`${ORIGIN}/`, makeResponse({ body: "root shell" }));
    expect(stores.get(SHELL_CACHE)?.size).toBe(2);

    const offlineNetwork = () => Promise.reject(new TypeError("Failed to fetch"));
    const offlineListeners = loadServiceWorker(caches, offlineNetwork);

    const visited = await dispatchFetch(offlineListeners, {
      url: `${ORIGIN}/product/42`,
      mode: "navigate",
    });
    expect(await visited?.text()).toBe("product 42");

    const unvisited = await dispatchFetch(offlineListeners, {
      url: `${ORIGIN}/cart`,
      mode: "navigate",
    });
    expect(await unvisited?.text()).toBe("root shell");

    expect(listeners.get("fetch")).toBeDefined();
  });

  it("serves precached storefront pages offline, ignoring the query string for /shop", async () => {
    const { caches } = createCacheStorage();
    const offlineNetwork = () => Promise.reject(new TypeError("Failed to fetch"));
    const listeners = loadServiceWorker(caches, offlineNetwork);
    const store = await caches.open(SHELL_CACHE);
    await store.put(`${ORIGIN}/cart`, makeResponse({ body: "cart page" }));
    await store.put(`${ORIGIN}/shop?page=1`, makeResponse({ body: "shop page" }));
    await store.put(`${ORIGIN}/`, makeResponse({ body: "root shell" }));

    const cart = await dispatchFetch(listeners, { url: `${ORIGIN}/cart`, mode: "navigate" });
    expect(await cart?.text()).toBe("cart page");

    const shop = await dispatchFetch(listeners, { url: `${ORIGIN}/shop`, mode: "navigate" });
    expect(await shop?.text()).toBe("shop page");
  });

  it("removes old shell caches on activate but keeps unrelated caches", async () => {
    const { caches, stores } = createCacheStorage();
    stores.set("nexa-shopping-shell-v2", new Map());
    stores.set("brand-shopping-shell-old", new Map());
    stores.set("unrelated-cache", new Map());
    const listeners = loadServiceWorker(caches, networkFrom({}));

    let pending: Promise<unknown> | undefined;
    listeners.get("activate")?.({
      waitUntil: (promise: Promise<unknown>) => {
        pending = promise;
      },
    });
    await pending;

    expect([...stores.keys()].sort()).toEqual(["unrelated-cache"]);
  });
});

describe("useOnlineStatus", () => {
  it("starts from the browser's current connection state", () => {
    setOnline(false);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(false);
  });

  it("follows online and offline events", () => {
    setOnline(true);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);

    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event("offline"));
    });
    expect(result.current).toBe(false);

    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event("online"));
    });
    expect(result.current).toBe(true);
  });

  it("removes its window listeners on unmount", () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useOnlineStatus());

    unmount();

    expect(removeSpy).toHaveBeenCalledWith("online", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("offline", expect.any(Function));
  });
});

describe("cart offline state", () => {
  const PRODUCT = {
    id: "p-1",
    name: "Woven Market Basket",
    price: 150,
    stock: 5,
    image_url: null,
    gallery: null,
    category_id: null,
  } as unknown as StoreProduct;

  const CATALOGUE = {
    products: [PRODUCT],
    categories: [],
    banners: [],
  } as unknown as StoreCatalogue;

  beforeEach(() => {
    localStorage.setItem("nexa-cart", JSON.stringify([PRODUCT.id]));
    localStorage.setItem("nexa-cart-quantities", JSON.stringify({ [PRODUCT.id]: 2 }));
  });

  it("shows the offline notice while offline and keeps the cart working", async () => {
    setOnline(false);
    render(createElement(CartView, { catalogue: CATALOGUE }));

    expect(await screen.findByText(/You are currently offline/)).toBeInTheDocument();
    expect(screen.getByText(/No payment has been processed/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Continue Order on WhatsApp/ })).toBeEnabled();
  });

  it("hides the notice when connectivity returns and shows it again when it drops", async () => {
    setOnline(true);
    render(createElement(CartView, { catalogue: CATALOGUE }));
    await screen.findByText("Woven Market Basket");
    expect(screen.queryByText(/You are currently offline/)).toBeNull();

    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event("offline"));
    });
    expect(await screen.findByText(/You are currently offline/)).toBeInTheDocument();

    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event("online"));
    });
    await waitFor(() => expect(screen.queryByText(/You are currently offline/)).toBeNull());
  });
});

describe("offline static content", () => {
  it("offline.html offers a route back to the saved storefront", () => {
    const content = readProjectFile("public/offline.html");

    expect(content).toContain("NEXA Offline Shopping");
    expect(content).toContain('href="/"');
    expect(content).toContain("Open Saved Storefront");
  });

  it("product route explains offline unavailability for unsaved products", () => {
    const content = readProjectFile("src/routes/product.$id.tsx");

    expect(content).toContain("Product unavailable offline");
    expect(content).toContain("This product has not been saved on your device yet");
  });
});
