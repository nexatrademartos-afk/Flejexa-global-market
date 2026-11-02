import type { StoreCatalogue } from "@/lib/preview-data";

const DATABASE_NAME = "brand-offline-shopping";
const DATABASE_VERSION = 1;
const CATALOGUE_STORE = "catalogue";
const IMAGE_STORE = "images";
const CATALOGUE_KEY = "public-storefront";

export type SavedCatalogue = StoreCatalogue & {
  savedAt: string;
};

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(CATALOGUE_STORE)) {
        database.createObjectStore(CATALOGUE_STORE);
      }

      if (!database.objectStoreNames.contains(IMAGE_STORE)) {
        database.createObjectStore(IMAGE_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveCatalogueOffline(
  catalogue: StoreCatalogue,
): Promise<void> {
  const database = await openDatabase();
  if (!database) return;

  const snapshot: SavedCatalogue = {
    ...catalogue,
    savedAt: new Date().toISOString(),
  };

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(CATALOGUE_STORE, "readwrite");
    transaction.objectStore(CATALOGUE_STORE).put(snapshot, CATALOGUE_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });

  database.close();
}

export async function readOfflineCatalogue(): Promise<SavedCatalogue | null> {
  const database = await openDatabase();
  if (!database) return null;

  const result = await new Promise<SavedCatalogue | null>((resolve, reject) => {
    const transaction = database.transaction(CATALOGUE_STORE, "readonly");
    const request = transaction.objectStore(CATALOGUE_STORE).get(CATALOGUE_KEY);

    request.onsuccess = () =>
      resolve((request.result as SavedCatalogue | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });

  database.close();
  return result;
}

export async function saveOfflineImage(url: string, blob: Blob): Promise<void> {
  const database = await openDatabase();
  if (!database) return;

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(IMAGE_STORE, "readwrite");
    transaction.objectStore(IMAGE_STORE).put(blob, url);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });

  database.close();
}

export async function readOfflineImage(url: string): Promise<Blob | null> {
  const database = await openDatabase();
  if (!database) return null;

  const result = await new Promise<Blob | null>((resolve, reject) => {
    const transaction = database.transaction(IMAGE_STORE, "readonly");
    const request = transaction.objectStore(IMAGE_STORE).get(url);

    request.onsuccess = () => resolve((request.result as Blob | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });

  database.close();
  return result;
}
