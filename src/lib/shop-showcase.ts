import type { StoreProduct } from "@/lib/preview-data";

/**
 * Showcase collections are built only from the live catalogue rows that the
 * shop already loads. Each collection is shown only when it has at least one
 * qualifying product, so empty collections are never rendered.
 */
export type ShowcaseKey = "featured" | "hot" | "promotion" | "affordable" | "cheapest";

export interface ShowcaseCollection {
  key: ShowcaseKey;
  title: string;
  subtitle: string;
  products: StoreProduct[];
}

export const SHOWCASE_MAX_PRODUCTS = 4;

const COLLECTIONS: ReadonlyArray<{ key: ShowcaseKey; title: string; subtitle: string }> = [
  { key: "featured", title: "Featured", subtitle: "Selected catalogue listings." },
  { key: "hot", title: "Hot right now", subtitle: "Picks our team marked as hot." },
  { key: "promotion", title: "Active promotions", subtitle: "Live offers with a comparison price." },
  { key: "affordable", title: "Affordable", subtitle: "Good value, selected for the shop." },
  { key: "cheapest", title: "Cheapest today", subtitle: "The lowest prices in the live catalogue." },
];

/** Price must be a finite positive number and stock must be available. */
export function isShowcaseEligible(product: StoreProduct): boolean {
  return (
    Number.isFinite(product.price) &&
    product.price > 0 &&
    Number.isFinite(product.stock) &&
    product.stock > 0
  );
}

function hasComparisonSaving(product: StoreProduct): boolean {
  return (
    product.compare_at_price !== null &&
    Number.isFinite(product.compare_at_price) &&
    product.compare_at_price > product.price
  );
}

function matchesCollection(product: StoreProduct, key: ShowcaseKey): boolean {
  const tags = product.merchandising_tags ?? [];

  switch (key) {
    case "featured":
      return product.is_featured === true;
    case "promotion":
      // The Admin describes a promotion as a product with a comparison price.
      return tags.includes("promotion") && hasComparisonSaving(product);
    case "hot":
    case "affordable":
    case "cheapest":
      return tags.includes(key);
    default:
      return false;
  }
}

/**
 * Returns only non-empty collections, in display order. Products are limited
 * to the eligible live rows; "cheapest" is sorted by price, others keep the
 * catalogue order.
 */
export function buildShowcaseCollections(
  products: StoreProduct[],
  maxProducts: number = SHOWCASE_MAX_PRODUCTS,
): ShowcaseCollection[] {
  const eligible = products.filter(isShowcaseEligible);
  const collections: ShowcaseCollection[] = [];

  for (const definition of COLLECTIONS) {
    let matches = eligible.filter((product) => matchesCollection(product, definition.key));

    if (definition.key === "cheapest") {
      matches = [...matches].sort((a, b) => a.price - b.price);
    }

    if (matches.length === 0) continue;

    collections.push({ ...definition, products: matches.slice(0, maxProducts) });
  }

  return collections;
}
