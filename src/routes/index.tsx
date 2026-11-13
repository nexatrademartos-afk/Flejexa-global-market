import { ProductCard } from "@/components/ProductCard";
import { OfflineImage } from "@/components/OfflineImage";
import { BRAND } from "@/lib/brand";
import { fetchStoreCatalogue } from "@/lib/preview-data";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, ChevronRight, ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getFeatureRobotsMeta } from "@/lib/feature-seo";

type Category = {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  image_url: string | null;
};

type Product = {
  merchandising_tags: string[];
  id: string;
  name: string;
  slug: string;
  price: number;
  compare_at_price: number | null;
  discount_pct: number | null;
  image_url: string | null;
  category_id: string | null;
  is_featured: boolean;
  stock: number;
};

type Banner = {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  sort_order: number;
};

const CATEGORY_ORDER = [
  "Clothing",
  "Men clothes",
  "Weman clothes",
  "Women clothes",
  "Kids",
  "Shoes",
  "Cellphones & Accessories",
  "Electronics",
  "Household",
  "Beauty",
];

export const Route = createFileRoute("/")({
  head: () => ({
    links: [
  {
    rel: "canonical",
    href: "https://flejexa-global-mart.tjc-os.workers.dev/",
  },
],
    meta: [
      {
        title: `${BRAND.name} — ${BRAND.tagline}`,
      },
      {
        name: "description",
        content:
          `Discover products, explore global shopping opportunities, and shop with confidence at ${BRAND.name}. ${BRAND.tagline}`,
      },
      ...getFeatureRobotsMeta("/"),
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
        content: `${BRAND.name} — ${BRAND.tagline}`,
      },
      {
        property: "og:description",
        content:
          "Discover products and global shopping opportunities. Shop More. Save More. Get Rewarded.",
      },
      {
  property: "og:image",
  content: "https://flejexa-global-mart.tjc-os.workers.dev/og-image.png",
},
{
  property: "og:image:alt",
  content: "FleJexa Global Mart — Shop More. Save More. Get Rewarded.",
},
      {
        property: "og:image:type",
        content: "image/png",
      },
      {
        name: "twitter:card",
        content: "summary_large_image",
      },
      {
        name: "twitter:title",
        content: `${BRAND.name} — ${BRAND.tagline}`,
      },
      {
        name: "twitter:description",
        content:
          BRAND.description,
      },
      {
        name: "twitter:image",
        content:
          "https://flejexa-global-mart.tjc-os.workers.dev/og-image.png",
      },
    ],
  }),
  component: Home,
});

function getPublicImageUrl(path: string | null | undefined) {
  if (!path) return null;

  const value = path.trim();
  if (!value) return null;

  // Preserve complete image URLs from other storage providers.
  if (/^https?:\/\//i.test(value)) return value;

  const cleanPath = value
    .replace(/^\/+/, "")
    .replace(/^store-media\//, "");

  const { data } = supabase.storage
    .from("store-media")
    .getPublicUrl(cleanPath);

  return data.publicUrl || null;
}

function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [activeBanner, setActiveBanner] = useState(0);

useEffect(() => {
  if (banners.length <= 1) return;

  const timer = window.setInterval(() => {
    setActiveBanner((current) => (current + 1) % banners.length);
  }, 5000);

  return () => window.clearInterval(timer);
}, [banners.length]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [failedImages, setFailedImages] = useState<string[]>([]);

  // Keep account prompts in sync with the real Supabase session.
  const [signedIn, setSignedIn] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkSession() {
      const { data, error } = await supabase.auth.getSession();

      if (!active) return;

      setSignedIn(!error && Boolean(data.session));
      setSessionReady(true);
    }

    void checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;

      setSignedIn(Boolean(session));
      setSessionReady(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadStorefront() {
      setLoading(true);
      setLoadError(false);

      try {
        const catalogue = await fetchStoreCatalogue();
        if (!active) return;

        setProducts(catalogue.products as Product[]);
        setCategories(catalogue.categories as Category[]);
        setBanners(catalogue.banners as Banner[]);
        setLoadError(false);
      } catch (error) {
        console.error("Storefront catalogue could not be loaded:", error);
        if (active) setLoadError(true);
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadStorefront();

    return () => {
      active = false;
    };
  }, []);

  const visibleProducts = useMemo(() => {
    const term = search.trim().toLowerCase();

    return products.filter((product) => {
      const category = categories.find(
        (item) => item.id === product.category_id,
      );

      const matchesSearch =
        !term ||
        product.name.toLowerCase().includes(term) ||
        (category?.name ?? "").toLowerCase().includes(term) ||
        product.slug.toLowerCase().includes(term);

      const matchesCategory =
        !selectedCategory || product.category_id === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [products, categories, search, selectedCategory]);

  const featuredProducts = visibleProducts.filter(
    (product) => product.is_featured,
  );

  const merchandisingSections = [
    {
      tag: "hot",
      title: "Hot right now",
      subtitle: "Products selected by our team as hot picks.",
    },
    {
      tag: "promotion",
      title: "Promotions",
      subtitle: "Special offers selected for the shop.",
    },
    {
      tag: "luxury",
      title: "Luxury & premium",
      subtitle: "Premium products selected for this collection.",
    },
    {
      tag: "affordable",
      title: "Affordable finds",
      subtitle: "Products selected for the affordable collection.",
    },
  ] as const;

  const orderedCategories = useMemo(() => {
    const rank = (name: string) => {
      const index = CATEGORY_ORDER.findIndex(
        (item) => item.toLowerCase() === name.toLowerCase(),
      );
      return index === -1 ? CATEGORY_ORDER.length : index;
    };

    return [...categories].sort(
      (a, b) => rank(a.name) - rank(b.name) || a.sort_order - b.sort_order,
    );
  }, [categories]);

  function markImageFailed(id: string) {
    setFailedImages((current) =>
      current.includes(id) ? current : [...current, id],
    );
  }

  function renderProductCard(product: Product) {
    const category = categories.find(
      (item) => item.id === product.category_id,
    );

    return (
      <ProductCard
        key={product.id}
        p={product}
        categoryName={category?.name ?? "General"}
      />
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      
<section className="border-b border-gold/20 bg-ink">
  <div className="mx-auto max-w-6xl px-4 py-5 md:py-7">
    {banners.length > 0 && (
      <div className="relative overflow-hidden rounded-2xl border border-gold/40 bg-black shadow-[0_0_24px_rgba(212,175,55,0.12)]">
        {banners.map((banner, index) => {
          const imageUrl = getPublicImageUrl(banner.image_url);
          const imageFailed = failedImages.includes(`banner-${banner.id}`);

          return (
            <article
              key={banner.id}
              aria-hidden={index !== activeBanner}
              className={
                index === activeBanner
                  ? "relative block"
                  : "hidden"
              }
            >
              <div className="relative aspect-[16/7] min-h-[190px] sm:min-h-[260px]">
                {imageUrl && !imageFailed ? (
                  <OfflineImage
                    src={imageUrl}
                    alt={banner.title}
                    loading={index === activeBanner ? "eager" : "lazy"}
                    className="h-full w-full object-cover"
                    onError={() => markImageFailed(`banner-${banner.id}`)}
                  />
                ) : (
                  <div className="grid h-full place-items-center bg-gradient-to-br from-ink via-black to-gold/20 px-5 text-center">
                    <h2 className="text-2xl font-bold text-gold sm:text-4xl">
                      {banner.title}
                    </h2>
                  </div>
                )}

                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/65 to-transparent p-4 pt-14 sm:p-7 sm:pt-20">
                  <h2 className="text-xl font-bold text-white sm:text-3xl">
                    {banner.title}
                  </h2>

                  {banner.subtitle && (
                    <p className="mt-1 max-w-xl text-sm text-slate-200 sm:text-base">
                      {banner.subtitle}
                    </p>
                  )}
                </div>
              </div>
            </article>
          );
        })}

        {banners.length > 1 && (
          <div className="absolute bottom-3 right-4 z-10 flex items-center gap-2">
            {banners.map((banner, index) => (
              <button
                key={banner.id}
                type="button"
                onClick={() => setActiveBanner(index)}
                aria-label={`Show promotion ${index + 1}`}
                aria-current={index === activeBanner ? "true" : undefined}
                className={`h-2.5 rounded-full transition-all ${
                  index === activeBanner
                    ? "w-7 bg-gold"
                    : "w-2.5 bg-white/60 hover:bg-white"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    )}

    <div className="mt-5 flex flex-wrap gap-3">
      <a href="#catalogue" className="btn btn-gold">
        <ShoppingBag className="h-4 w-4" />
        Explore products
      </a>

      {sessionReady && !signedIn && (
        <Link to="/sign-up" className="btn btn-on-ink">
          Create account
        </Link>
      )}
    </div>
  </div>
</section>
      
      <section className="mx-auto max-w-6xl px-4 py-5">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            document
              .getElementById("catalogue")
              ?.scrollIntoView({ behavior: "smooth" });
          }}
          className="flex gap-2"
          role="search"
        >
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search available products</span>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="field pl-10"
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setSelectedCategory(null);
              }}
              placeholder="Search clothes, shoes, electronics..."
            />
          </label>
          <button type="submit" className="btn btn-gold">
            Search
          </button>
        </form>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold">Browse categories</h2>
          <Link
            to="/shop"
            className="inline-flex items-center gap-1 text-sm text-gold"
          >
            View shop <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-3">
          <button
            type="button"
            onClick={() => setSelectedCategory(null)}
            className={`btn shrink-0 ${
              !selectedCategory ? "btn-gold" : "btn-outline"
            }`}
          >
            All products
          </button>

          {orderedCategories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() =>
                setSelectedCategory((current) =>
                  current === category.id ? null : category.id,
                )
              }
              className={`btn shrink-0 ${
                selectedCategory === category.id
                  ? "btn-gold"
                  : "btn-outline"
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>
      </section>

      <section id="catalogue" className="mx-auto max-w-6xl px-4 py-4">
        {loadError && (
          <div className="mb-5 rounded-xl border border-red-500/50 bg-red-950/30 p-4 text-sm text-red-200">
            The live catalogue could not be loaded. Please try again later.
          </div>
        )}

        {loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Loading available products...
          </p>
        ) : !loadError && visibleProducts.length === 0 ? (
          <div className="rounded-xl border border-gold/30 bg-card p-8 text-center">
            <h2 className="text-lg font-bold">No matching products found</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Try another search or choose a different category.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setSelectedCategory(null);
              }}
              className="btn btn-outline mt-4"
            >
              Clear search
            </button>
          </div>
        ) : (
          <>
            {!search.trim() &&
              !selectedCategory &&
              featuredProducts.length > 0 && (
                <div className="mb-9">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="text-xl font-bold">Featured products</h2>
                    <span className="text-xs text-muted-foreground">
                      Selected catalogue listings
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {featuredProducts.slice(0, 8).map(renderProductCard)}
                  </div>
                </div>
              )}

            {!search.trim() &&
              !selectedCategory &&
              merchandisingSections.map((section) => {
                const sectionProducts = visibleProducts.filter((product) =>
                  (product.merchandising_tags ?? []).includes(section.tag),
                );

                if (sectionProducts.length === 0) return null;

                return (
                  <section key={section.tag} className="mb-10">
                    <div className="mb-4">
                      <h2 className="text-xl font-bold">{section.title}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {section.subtitle}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                      {sectionProducts.slice(0, 8).map(renderProductCard)}
                    </div>
                  </section>
                );
              })}

            {orderedCategories.map((category) => {
              const categoryProducts = visibleProducts.filter(
                (product) => product.category_id === category.id,
              );

              if (categoryProducts.length === 0) return null;

              return (
                <section key={category.id} className="mb-10">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="text-xl font-bold">{category.name}</h2>
                    <span className="text-xs text-muted-foreground">
                      {categoryProducts.length}{" "}
                      {categoryProducts.length === 1 ? "product" : "products"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {categoryProducts.map(renderProductCard)}
                  </div>
                </section>
              );
            })}

            {visibleProducts.some(
              (product) =>
                !product.category_id ||
                !categories.some(
                  (category) => category.id === product.category_id,
                ),
            ) && (
              <section className="mb-10">
                <h2 className="mb-4 text-xl font-bold">Other products</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {visibleProducts
                    .filter(
                      (product) =>
                        !product.category_id ||
                        !categories.some(
                          (category) => category.id === product.category_id,
                        ),
                    )
                    .map(renderProductCard)}
                </div>
              </section>
            )}
          </>
        )}
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="rounded-2xl border border-gold/40 bg-card p-6 text-center shadow-[0_0_24px_rgba(212,175,55,0.08)] sm:p-9">
          <h2 className="text-2xl font-bold">Your marketplace. Your choice.</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            {signedIn
              ? `Keep exploring products across ${BRAND.name}.`
              : `Keep browsing as a guest, or create an account to get started with your ${BRAND.shortName} journey.`}
          </p>

          {sessionReady && !signedIn && (
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Link to="/sign-up" className="btn btn-gold">
                Create account
              </Link>
              <Link to="/sign-in" className="btn btn-outline">
                Sign in
              </Link>
              <button
                type="button"
                disabled
                title="Google sign-in is not available yet"
                className="btn btn-outline cursor-not-allowed opacity-60"
              >
                Continue with Google · Coming soon
              </button>
            </div>
          )}
        </div>
      </section>

      <footer className="mt-8 border-t border-gold/30 bg-ink">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <p className="font-display text-xl font-bold">
            <span className="text-gold">{BRAND.shortName}</span>
            <span className="text-slate-300">•Global Mart</span>
          </p>
          <p className="mt-2 text-sm text-slate-300">
            Shop More. Save More. Get Rewarded.
          </p>

          <div className="my-5 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent" />

          <nav className="flex flex-wrap gap-x-5 gap-y-3 text-sm text-slate-300">
            <Link to="/" className="hover:text-gold">
              Home
            </Link>
            <Link to="/shop" className="hover:text-gold">
              Shop
            </Link>
            <Link to="/policies" className="hover:text-gold">
              Policy Centre
            </Link>

            {sessionReady && !signedIn && (
              <>
                <Link to="/sign-in" className="hover:text-gold">
                  Sign in
                </Link>
                <Link to="/sign-up" className="hover:text-gold">
                  Create account
                </Link>
              </>
            )}
          </nav>

          <p className="mt-5 text-xs text-slate-400">Powered by TJC-OS</p>
        </div>
      </footer>
    </main>
  );
}
