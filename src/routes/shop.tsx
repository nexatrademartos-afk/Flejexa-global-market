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
} from "@/lib/preview-data";

type Search = {
  category?: string;
  q?: string;
  page: number;
};

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
      {
        name: "robots",
        content: "index, follow",
      },
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
      } catch (error) {
        console.error("Unable to load the live shop catalogue:", error);

        if (active) {
          setLoadError(true);
          setProducts([]);
          setCategories([]);
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
    <main className="mx-auto min-h-screen max-w-6xl space-y-5 px-4 py-6 sm:py-8">
      <header className="surface space-y-2 rounded-2xl p-5 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
          {BRAND.name}
        </p>

        <h1 className="text-3xl font-bold sm:text-4xl">Shop</h1>

        <p className="text-sm font-bold uppercase tracking-[0.16em] text-gold sm:text-base">
          {BRAND.tagline}
        </p>

        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Explore available products across our marketplace. Browse freely
          and use search or categories to narrow your choices.
        </p>
      </header>

      {!q?.trim() && !category && (
        <ShopShowcase
          products={products}
          categories={categories}
          loading={loading}
          loadError={loadError}
        />
      )}

      <form action="/shop" method="get" role="search" className="flex gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Search products</span>
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search products or categories..."
            className="field w-full"
          />
        </label>

        {category && (
          <input type="hidden" name="category" value={category} />
        )}

        <input type="hidden" name="page" value="1" />

        <button type="submit" className="btn btn-gold">
          Search
        </button>
      </form>

      <section aria-label="Product categories" className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Browse categories
        </h2>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
          <Link
            to="/shop"
            search={{ page: 1, q }}
            className={`btn shrink-0 ${
              !category ? "btn-gold" : "btn-outline"
            }`}
          >
            All products
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
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"
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
