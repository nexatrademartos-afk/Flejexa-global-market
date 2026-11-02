import { supabase } from "@/integrations/supabase/client";
import {
  readOfflineCatalogue,
  saveCatalogueOffline,
} from "@/lib/offline-storage";

/**
 * Shared live catalogue types and data access.
 * Only public, active storefront records are persisted for offline browsing.
 */

export interface StoreCategory {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  image_url: string | null;
}

export interface StoreProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  compare_at_price: number | null;
  discount_pct: number | null;
  image_url: string | null;
  gallery?: string[] | null;
  description?: string | null;
  category_id: string | null;
  is_featured: boolean;
  stock: number;
  merchandising_tags?: string[] | null;
}

export interface StoreBanner {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  sort_order: number;
}

export interface StoreCatalogue {
  products: StoreProduct[];
  categories: StoreCategory[];
  banners: StoreBanner[];
  savedAt?: string;
  isOfflineSnapshot?: boolean;
}

/**
 * Legacy shape retained for older preview components.
 * Do not use sample data for new storefront features.
 */
export const IS_PREVIEW_DATA = true;

export interface PreviewProduct {
  id: string;
  name: string;
  category: string;
  priceLabel: string;
  origin: string;
}

const LEGACY_CATEGORIES = [
  "Fashion",
  "Home",
  "Beauty",
  "Electronics",
  "Groceries",
  "Crafts",
];

const LEGACY_NAMES = [
  "Woven Market Basket",
  "Leather Tote",
  "Shea Body Butter",
  "Wireless Headphones",
  "Kente Throw",
  "Ceramic Pour-over",
  "Brass Cuff",
  "Hibiscus Tea",
  "Linen Shirt",
  "Desk Lamp",
  "Black Soap Bar",
  "Smart Speaker",
  "Raffia Sandals",
  "Clay Planter",
  "Baobab Oil",
  "Power Bank",
  "Ankara Scarf",
  "Wooden Bowl Set",
  "Coffee Beans",
  "Phone Stand",
];

const LEGACY_ORIGINS = [
  "Ghana",
  "Kenya",
  "Nigeria",
  "South Africa",
  "Senegal",
  "Global",
];

export const PREVIEW_PRODUCTS: PreviewProduct[] = LEGACY_NAMES.map(
  (name, index) => ({
    id: `preview-${index + 1}`,
    name,
    category: LEGACY_CATEGORIES[index % LEGACY_CATEGORIES.length]!,
    priceLabel: "Price TBC",
    origin: LEGACY_ORIGINS[index % LEGACY_ORIGINS.length]!,
  }),
);

export const CATEGORIES = LEGACY_CATEGORIES;

/**
 * Resolve a database image path to a public URL.
 * Absolute URLs are preserved because some existing banners reference
 * storage outside the current Supabase project.
 */
export function getStoreImageUrl(
  path: string | null | undefined,
): string | null {
  if (!path?.trim()) return null;

  const value = path.trim();

  if (/^https?:\/\//i.test(value)) return value;

  const cleanPath = value
    .replace(/^\/+/, "")
    .replace(/^store-media\//, "");

  const { data } = supabase.storage
    .from("store-media")
    .getPublicUrl(cleanPath);

  return data.publicUrl || null;
}

/**
 * Format catalogue prices using the existing storefront convention.
 * Currency configuration is a separate global-commerce task; this preserves
 * the current display behaviour without changing the checkout or database.
 */
export function formatStorePrice(price: number): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 2,
  }).format(price);
}

async function fetchLiveStoreCatalogue(): Promise<StoreCatalogue> {
  const [productResult, categoryResult, bannerResult] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id,name,slug,price,compare_at_price,discount_pct,image_url,gallery,description,category_id,is_featured,stock,merchandising_tags",
      )
      .eq("is_active", true)
      .gt("price", 0)
      .gt("stock", 0)
      .order("created_at", { ascending: false })
      .limit(500),

    supabase
      .from("categories")
      .select("id,name,slug,sort_order,image_url")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),

    supabase
      .from("banners")
      .select("id,title,subtitle,image_url,sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
  ]);

  if (productResult.error) {
    throw new Error(`Unable to load products: ${productResult.error.message}`);
  }

  if (categoryResult.error) {
    throw new Error(`Unable to load categories: ${categoryResult.error.message}`);
  }

  if (bannerResult.error) {
    console.error(
      "Unable to load promotional banners:",
      bannerResult.error.message,
    );
  }

  const mappedProducts: StoreProduct[] = (
    (productResult.data ?? []) as Array<Record<string, unknown>>
  ).map((item) => ({
    ...(item as unknown as StoreProduct),
    gallery: Array.isArray(item["gallery"])
      ? (item["gallery"] as unknown[]).filter(
          (url): url is string => typeof url === "string",
        )
      : null,
    merchandising_tags: Array.isArray(item["merchandising_tags"])
      ? (item["merchandising_tags"] as unknown[]).filter(
          (tag): tag is string => typeof tag === "string",
        )
      : [],
  }));

  return {
    products: mappedProducts,
    categories: (categoryResult.data ?? []) as StoreCategory[],
    banners: (bannerResult.data ?? []) as StoreBanner[],
  };
}

/**
 * Loads the live public catalogue when possible and falls back to the most
 * recently saved public snapshot when the device is offline or the request
 * fails. This never persists account, authentication or admin information.
 */
export async function fetchStoreCatalogue(): Promise<StoreCatalogue> {
  const canAttemptNetwork =
    typeof navigator === "undefined" || navigator.onLine;

  if (canAttemptNetwork) {
    try {
      const catalogue = await fetchLiveStoreCatalogue();

      if (typeof indexedDB !== "undefined") {
        try {
          await saveCatalogueOffline(catalogue);
        } catch (error) {
          // Browsing online should continue even if local storage is unavailable.
          console.warn("Unable to save the offline catalogue snapshot:", error);
        }
      }

      return catalogue;
    } catch (error) {
      const saved = await readOfflineCatalogue().catch(() => null);
      if (saved) {
        return {
          products: saved.products,
          categories: saved.categories,
          banners: saved.banners,
          savedAt: saved.savedAt,
          isOfflineSnapshot: true,
        };
      }
      throw error;
    }
  }

  const saved = await readOfflineCatalogue();
  if (!saved) {
    throw new Error("No saved catalogue is available on this device yet.");
  }

  return {
    products: saved.products,
    categories: saved.categories,
    banners: saved.banners,
    savedAt: saved.savedAt,
    isOfflineSnapshot: true,
  };
}

/**
 * Pagination helper retained for the existing shop route.
 */
export function paginate<T>(items: T[], page: number, size = 8) {
  const safeSize = Number.isFinite(size) && size > 0 ? size : 8;
  const safePage = Number.isFinite(page) ? Math.floor(page) : 1;
  const total = Math.max(1, Math.ceil(items.length / safeSize));
  const currentPage = Math.min(Math.max(1, safePage), total);

  return {
    items: items.slice(
      (currentPage - 1) * safeSize,
      currentPage * safeSize,
    ),
    page: currentPage,
    total,
  };
}
