import { describe, expect, it } from "vitest";
import { buildShowcaseCollections, isShowcaseEligible } from "@/lib/shop-showcase";
import type { StoreProduct } from "@/lib/preview-data";

function product(overrides: Partial<StoreProduct> & { id: string }): StoreProduct {
  return {
    name: `Product ${overrides.id}`,
    slug: overrides.id,
    price: 100,
    compare_at_price: null,
    discount_pct: null,
    image_url: null,
    category_id: null,
    is_featured: false,
    stock: 5,
    merchandising_tags: [],
    ...overrides,
  };
}

describe("shop showcase eligibility", () => {
  it("rejects zero, negative, non-finite prices and out-of-stock rows", () => {
    expect(isShowcaseEligible(product({ id: "a", price: 0 }))).toBe(false);
    expect(isShowcaseEligible(product({ id: "b", price: -5 }))).toBe(false);
    expect(isShowcaseEligible(product({ id: "c", price: Number.NaN }))).toBe(false);
    expect(isShowcaseEligible(product({ id: "d", stock: 0 }))).toBe(false);
    expect(isShowcaseEligible(product({ id: "e", price: 10, stock: 1 }))).toBe(true);
  });

  it("never includes ineligible products in any collection", () => {
    const collections = buildShowcaseCollections([
      product({ id: "bad-price", price: 0, is_featured: true, merchandising_tags: ["hot"] }),
      product({ id: "no-stock", stock: 0, is_featured: true, merchandising_tags: ["affordable"] }),
    ]);
    expect(collections).toEqual([]);
  });
});

describe("shop showcase collections", () => {
  it("hides collections that have no qualifying products", () => {
    const collections = buildShowcaseCollections([
      product({ id: "hot-1", merchandising_tags: ["hot"] }),
    ]);
    expect(collections.map((c) => c.key)).toEqual(["hot"]);
  });

  it("returns no collections for an empty live catalogue", () => {
    expect(buildShowcaseCollections([])).toEqual([]);
  });

  it("uses is_featured for the featured collection", () => {
    const collections = buildShowcaseCollections([product({ id: "f", is_featured: true })]);
    expect(collections[0]?.key).toBe("featured");
    expect(collections[0]?.products.map((p) => p.id)).toEqual(["f"]);
  });

  it("counts a promotion only with a real comparison price above the selling price", () => {
    const collections = buildShowcaseCollections([
      product({ id: "no-compare", merchandising_tags: ["promotion"] }),
      product({ id: "equal-compare", price: 100, compare_at_price: 100, merchandising_tags: ["promotion"] }),
      product({ id: "on-sale", price: 80, compare_at_price: 120, merchandising_tags: ["promotion"] }),
    ]);
    const promo = collections.find((c) => c.key === "promotion");
    expect(promo?.products.map((p) => p.id)).toEqual(["on-sale"]);
  });

  it("sorts the cheapest collection lowest price first and honours the Admin cheapest tag", () => {
    const collections = buildShowcaseCollections([
      product({ id: "dear", price: 500, merchandising_tags: ["cheapest"] }),
      product({ id: "cheap", price: 20, merchandising_tags: ["cheapest"] }),
      product({ id: "untagged-cheap", price: 1, merchandising_tags: [] }),
    ]);
    const cheapest = collections.find((c) => c.key === "cheapest");
    expect(cheapest?.products.map((p) => p.id)).toEqual(["cheap", "dear"]);
  });

  it("limits each collection to the slot count and keeps display order", () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      product({ id: `h${i}`, merchandising_tags: ["hot"] }),
    );
    const collections = buildShowcaseCollections([
      product({ id: "aff", merchandising_tags: ["affordable"] }),
      ...many,
      product({ id: "feat", is_featured: true }),
    ], 4);
    expect(collections.map((c) => c.key)).toEqual(["featured", "hot", "affordable"]);
    expect(collections.find((c) => c.key === "hot")?.products).toHaveLength(4);
  });
});
