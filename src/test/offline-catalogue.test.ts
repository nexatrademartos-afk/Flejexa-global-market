import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, readOfflineCatalogue, saveCatalogueOffline } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  readOfflineCatalogue: vi.fn(),
  saveCatalogueOffline: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: fromMock, storage: { from: vi.fn() } },
}));

vi.mock("@/lib/offline-storage", () => ({
  readOfflineCatalogue,
  saveCatalogueOffline,
}));

import { fetchStoreCatalogue, LIVE_CATALOGUE_TIMEOUT_MS } from "@/lib/preview-data";

const SAVED_AT = "2026-01-01T00:00:00.000Z";

const SAVED_SNAPSHOT = {
  products: [
    {
      id: "saved-1",
      name: "Saved Basket",
      price: 100,
      stock: 3,
      gallery: null,
      merchandising_tags: [],
    },
  ],
  categories: [{ id: "cat-1", name: "Home", slug: "home", sort_order: 1, image_url: null }],
  banners: [],
  savedAt: SAVED_AT,
};

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    get: () => value,
  });
}

/** Mimics a PostgREST query builder: chainable, and awaitable with the given result. */
function queryResult(result: { data: unknown[]; error: null } | Promise<never>) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    gt: () => builder,
    order: () => builder,
    limit: () => builder,
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      (result instanceof Promise ? result : Promise.resolve(result)).then(resolve, reject),
  };
  return builder;
}

beforeEach(() => {
  vi.stubGlobal("indexedDB", {});
  setOnline(true);
  fromMock.mockReset();
  readOfflineCatalogue.mockReset();
  saveCatalogueOffline.mockReset();
  saveCatalogueOffline.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  setOnline(true);
});

describe("storefront catalogue loading", () => {
  it("reads the saved IndexedDB catalogue without any network request when offline", async () => {
    setOnline(false);
    readOfflineCatalogue.mockResolvedValue(SAVED_SNAPSHOT);

    const catalogue = await fetchStoreCatalogue();

    expect(fromMock).not.toHaveBeenCalled();
    expect(catalogue.isOfflineSnapshot).toBe(true);
    expect(catalogue.savedAt).toBe(SAVED_AT);
    expect(catalogue.products.map((product) => product.id)).toEqual(["saved-1"]);
  });

  it("treats an unknown connection state as online so server rendering loads the live catalogue", async () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      get: () => undefined,
    });
    fromMock.mockImplementation((table: string) =>
      queryResult({
        data:
          table === "products"
            ? [
                {
                  id: "ssr-1",
                  name: "Server Basket",
                  price: 90,
                  stock: 1,
                  gallery: null,
                  merchandising_tags: [],
                },
              ]
            : [],
        error: null,
      }),
    );

    const catalogue = await fetchStoreCatalogue();

    expect(fromMock).toHaveBeenCalled();
    expect(catalogue.products[0]?.id).toBe("ssr-1");
    expect(readOfflineCatalogue).not.toHaveBeenCalled();
  });

  it("fails clearly when offline and no catalogue has been saved on the device", async () => {
    setOnline(false);
    readOfflineCatalogue.mockResolvedValue(null);

    await expect(fetchStoreCatalogue()).rejects.toThrow("No saved catalogue is available");
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("loads the live catalogue online and saves it for offline use", async () => {
    fromMock.mockImplementation((table: string) =>
      queryResult({
        data:
          table === "products"
            ? [
                {
                  id: "live-1",
                  name: "Live Basket",
                  price: 120,
                  stock: 2,
                  gallery: null,
                  merchandising_tags: [],
                },
              ]
            : [],
        error: null,
      }),
    );

    const catalogue = await fetchStoreCatalogue();

    expect(catalogue.isOfflineSnapshot).toBeUndefined();
    expect(catalogue.products.map((product) => product.id)).toEqual(["live-1"]);
    expect(saveCatalogueOffline).toHaveBeenCalledWith(
      expect.objectContaining({
        products: [expect.objectContaining({ id: "live-1" })],
      }),
    );
  });

  it("falls back to the saved snapshot when the live request fails", async () => {
    readOfflineCatalogue.mockResolvedValue(SAVED_SNAPSHOT);
    fromMock.mockImplementation(() => {
      throw new TypeError("Failed to fetch");
    });

    const catalogue = await fetchStoreCatalogue();

    expect(catalogue.isOfflineSnapshot).toBe(true);
    expect(catalogue.products[0]?.id).toBe("saved-1");
  });

  it("stops waiting on a stalled connection and uses the saved snapshot", async () => {
    vi.useFakeTimers();
    readOfflineCatalogue.mockResolvedValue(SAVED_SNAPSHOT);
    fromMock.mockImplementation(() => queryResult(new Promise<never>(() => {})));

    const pending = fetchStoreCatalogue();
    await vi.advanceTimersByTimeAsync(LIVE_CATALOGUE_TIMEOUT_MS);

    await expect(pending).resolves.toMatchObject({
      isOfflineSnapshot: true,
      savedAt: SAVED_AT,
    });
  });
});
