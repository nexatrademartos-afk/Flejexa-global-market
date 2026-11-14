
import { createFileRoute, Link } from "@tanstack/react-router";
import { BRAND, brandPageTitle } from "@/lib/brand";
import { useEffect, useMemo, useState } from "react";
import { ProductCard } from "@/components/ProductCard";
import { ShopShowcase } from "@/components/ShopShowcase";
import { EmptyState, SkeletonGrid } from "@/components/states";
import {
  fetchStoreCatalogue,
  paginate,
  type StoreCategory,
  type StoreProduct,
  type StoreBanner,
} from "@/lib/preview-data";

type Search = {
  category?: string;
  q?: string;
  page: number;
};

import { getFeatureRobotsMeta } from "@/lib/feature-seo";
import { PromotionalBannerCarousel } from "@/components/PromotionalBannerCarousel";

export const Route = createFileRoute("/shop")({
  validateSearch: (search: Record<string, unknown>): Search => {
    const parsedPage = Number(search.page);

    return {
      category:
        typeof search.category === "string"
          ? search.category
          : undefined,
      q: typeof search.q === "string" ? search.q : undefined,
      page:
        Number.isFinite(parsedPage) && parsedPage >= 1
          ? Math.floor(parsedPage)
          : 1,
    };
  },

  head: () => ({
    meta: [
      { title: brandPageTitle("Shop") },
      {
        name: "description",
        content: `Browse available products and categories across ${BRAND.name}. Discover useful products and shop with confidence.`,
      },
      ...getFeatureRobotsMeta("/shop"),
      {
        property: "og:type",
        content: "website",
      },
      {
        property: "og:site_name",
        content: BRAND.name,
      },
      {
        property: "og:title",
        content: brandPageTitle("Shop"),
      },
      {
        property: "og:description",
        content: `Explore available products across ${BRAND.name}. Browse categories, discover products and shop with confidence.`,
      },
      {
        property: "og:url",
        content: "https://flejexa-global-mart.tjc-os.workers.dev/shop",
      },
      {
        property: "og:image",
        content: "https://flejexa-global-mart.tjc-os.workers.dev/og-image.png",
      },
      {
        property: "og:image:alt",
        content: `${BRAND.name} — Shop More. Save More. Get Rewarded.`,
      },
      {
        name: "twitter:card",
        content: "summary_large_image",
      },
      {
        name: "twitter:title",
        content: brandPageTitle("Shop"),
      },
      {
        name: "twitter:description",
        content: `Discover products and shop across ${BRAND.name}.`,
      },
      {
        name: "twitter:image",
        content: "https://flejexa-global-mart.tjc-os.workers.dev/og-image.png",
      },
    ],
    links: [
      {
        rel: "canonical",
        href: "https://flejexa-global-mart.tjc-os.workers.dev/shop",
      },
    ],
  }),

  component: Shop,
});

function Shop() {
  const { category, q, page } = Route.useSearch();

  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [banners, setBanners] = useState<StoreBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadCatalogue() {
      setLoading(true);
      setLoadError(false);

      try {
        const catalogue = await fetchStoreCatalogue();

        if (!active) return;

        setProducts(catalogue.products);
        setCategories(catalogue.categories);
        setBanners(catalogue.banners);
      } catch (error) {
        console.error("Unable to load the live shop catalogue:", error);

        if (active) {
          setLoadError(true);
          setProducts([]);
          setCategories([]);
          setBanners([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadCatalogue();

    return () => {
      active = false;
    };
  }, []);

  const filteredProducts = useMemo(() => {
    const term = (q ?? "").trim().toLowerCase();

    return products.filter((product) => {
      const productCategory = categories.find(
        (item) => item.id === product.category_id,
      );

      const matchesCategory =
        !category ||
        product.category_id === category ||
        productCategory?.slug === category ||
        productCategory?.name.toLowerCase() === category.toLowerCase();

      const matchesSearch =
        !term ||
        product.name.toLowerCase().includes(term) ||
        product.slug.toLowerCase().includes(term) ||
        (productCategory?.name.toLowerCase().includes(term) ?? false);

      return matchesCategory && matchesSearch;
    });
  }, [products, categories, category, q]);

  const paginated = useMemo(
    () => paginate(filteredProducts, page, 8),
    [filteredProducts, page],
  );

  const totalPages = paginated.total;

  return (
    <div className="mx-auto min-h-screen max-w-6xl space-y-5 px-4 py-6 sm:py-8">
      {/* Single category browsing row — keep above promotional banners */}
      <section
        aria-label="Product categories"
        className="-mx-4 min-w-0"
      >
        <div className="flex gap-2 overflow-x-auto px-4 pb-2">
          <Link
            to="/shop"
            search={{ page: 1, q }}
            className={`btn shrink-0 ${
              !category ? "btn-gold" : "btn-outline"
            }`}
          >
            All Products
          </Link>

          {categories.map((item) => {
            const selected =
              category === item.id ||
              category === item.slug ||
              category === item.name;

            return (
              <Link
                key={item.id}
                to="/shop"
                search={{
                  category: item.slug,
                  q,
                  page: 1,
                }}
                className={`btn shrink-0 ${
                  selected ? "btn-gold" : "btn-outline"
                }`}
              >
                {item.name}
              </Link>
            );
          })}
        </div>
      </section>

      <PromotionalBannerCarousel banners={banners} />

      {!q?.trim() && !category && (
        <ShopShowcase
          products={products}
          categories={categories}
          loading={loading}
          loadError={loadError}
        />
      )}

      {/* Main product catalogue */}
      {loading ? (
        <section aria-live="polite" className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Loading available products...
          </p>
          <SkeletonGrid count={8} />
        </section>
      ) : loadError ? (
        <div
          role="alert"
          className="rounded-xl border border-red-500/40 bg-red-950/20 p-5"
        >
          <h2 className="font-semibold">The shop could not load</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            We couldn't retrieve the live catalogue. Your account and
            marketplace data have not been changed by this page.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="btn btn-outline mt-4"
          >
            Try again
          </button>
        </div>
      ) : filteredProducts.length === 0 ? (
        <EmptyState
          title="No products found"
          body="Try another search term or choose a different category."
          action={
            <Link
              to="/shop"
              search={{ page: 1 }}
              className="btn btn-outline"
            >
              Clear filters
            </Link>
          }
        />
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {filteredProducts.length}{" "}
              {filteredProducts.length === 1 ? "product" : "products"} found
            </p>

            {category && (
              <Link
                to="/shop"
                search={{ q, page: 1 }}
                className="text-sm text-gold hover:underline"
              >
                Clear category
              </Link>
            )}
          </div>

          <section
            aria-label="Available products"
            className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4"
          >
            {paginated.items.map((product) => {
              const productCategory = categories.find(
                (item) => item.id === product.category_id,
              );

              return (
                <ProductCard
                  key={product.id}
                  p={product}
                  categoryName={productCategory?.name}
                />
              );
            })}
          </section>

          {totalPages > 1 && (
            <nav
              aria-label="Product pagination"
              className="flex items-center justify-center gap-3 pt-3"
            >
              <Link
                to="/shop"
                search={{ category, q, page: Math.max(1, page - 1) }}
                disabled={page <= 1}
                className="btn btn-outline"
              >
                Previous
              </Link>

              <span className="text-sm text-muted-foreground">
                Page {paginated.page} of {totalPages}
              </span>

              <Link
                to="/shop"
                search={{
                  category,
                  q,
                  page: Math.min(totalPages, page + 1),
                }}
                disabled={page >= totalPages}
                className="btn btn-outline"
              >
                Next
              </Link>
            </nav>
          )}
        </>
      )}
    </main>
  );
}
