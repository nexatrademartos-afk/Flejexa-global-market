import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { OfflineImage } from "@/components/OfflineImage";
import { BRAND, brandPageTitle } from "@/lib/brand";
import {
  buildProductWhatsAppMessage,
  openWhatsApp,
} from "@/lib/whatsapp";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { Heart, ShoppingCart, Zap, ChevronLeft, ChevronRight, Package } from "lucide-react";
import { PlannedBadge } from "@/components/states";
import {
  fetchStoreCatalogue,
  formatStorePrice,
  getStoreImageUrl,
} from "@/lib/preview-data";
import { useLocalList } from "@/lib/local-list";
import { useMemo, useState, useRef } from "react";

export const Route = createFileRoute("/product/$id")({
  loader: async ({ params }) => {
    const catalogue = await fetchStoreCatalogue();

    const product = catalogue.products.find(
      (item) => item.id === params.id,
    );

    if (!product) {
      throw notFound();
    }

    const categoryName =
      catalogue.categories.find(
        (category) => category.id === product.category_id,
      )?.name ?? "Marketplace";

    return { product, categoryName };
  },

  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: brandPageTitle("Product not found") },
          { name: "robots", content: "noindex, nofollow" },
        ],
      };
    }

    const { product, categoryName } = loaderData;
    const title = brandPageTitle(product.name);

    const description = (
      product.description?.replace(/\s+/g, " ").trim() ||
      `Shop ${product.name} in ${categoryName} at ${BRAND.name}.`
    ).slice(0, 160);

    const canonicalUrl =
      `https://flejexa-global-mart.tjc-os.workers.dev/product/${encodeURIComponent(product.id)}`;

    const imageUrl = getStoreImageUrl(product.image_url);

    return {
      meta: [
        { title },
        {
          name: "description",
          content: description,
        },
        {
          name: "robots",
          content: "index, follow",
        },
        {
          property: "og:type",
          content: "product",
        },
        {
          property: "og:site_name",
          content: BRAND.name,
        },
        {
          property: "og:title",
          content: title,
        },
        {
          property: "og:description",
          content: description,
        },
        {
          property: "og:url",
          content: canonicalUrl,
        },
        ...(imageUrl
          ? [
              {
                property: "og:image",
                content: imageUrl,
              },
              {
                property: "og:image:alt",
                content: product.name,
              },
            ]
          : []),
        {
          name: "twitter:card",
          content: imageUrl ? "summary_large_image" : "summary",
        },
        {
          name: "twitter:title",
          content: title,
        },
        {
          name: "twitter:description",
          content: description,
        },
        ...(imageUrl
          ? [
              {
                name: "twitter:image",
                content: imageUrl,
              },
              {
                name: "twitter:image:alt",
                content: product.name,
              },
            ]
          : []),
      ],
      links: [
        {
          rel: "canonical",
          href: canonicalUrl,
        },
      ],
    };
  },
  
  notFoundComponent: () => {
    const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">
          {isOffline ? "Product unavailable offline" : "Product not found"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isOffline
            ? "This product has not been saved on your device yet. Reconnect to the internet to load and cache its full details."
            : "This product may no longer be available in the marketplace."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            to="/shop"
            search={{ page: 1 }}
            className="btn btn-primary"
          >
            Browse saved shop
          </Link>
          <Link to="/" className="btn btn-outline">
            Go home
          </Link>
        </div>
      </div>
    );
  },

  component: Product,
});

function ProductGallery({
  name,
  galleryUrls,
  mainImageUrl,
}: {
  name: string;
  galleryUrls?: string[] | null;
  mainImageUrl?: string | null;
}) {
  const images = useMemo(() => {
    const list: string[] = [];
    if (Array.isArray(galleryUrls)) {
      for (const item of galleryUrls) {
        if (typeof item === "string" && item.trim()) {
          const resolved = getStoreImageUrl(item);
          if (resolved && !list.includes(resolved)) {
            list.push(resolved);
          }
        }
      }
    }
    if (mainImageUrl) {
      const resolved = getStoreImageUrl(mainImageUrl);
      if (resolved && !list.includes(resolved)) {
        list.unshift(resolved);
      }
    }
    return list.slice(0, 5);
  }, [galleryUrls, mainImageUrl]);

  const [activeIndex, setActiveIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const hasMultiple = images.length > 1;
  const currentImage = images[activeIndex] || images[0] || null;

  function handlePrev() {
    setActiveIndex((prev) => (prev <= 0 ? images.length - 1 : prev - 1));
  }

  function handleNext() {
    setActiveIndex((prev) => (prev >= images.length - 1 ? 0 : prev + 1));
  }

  function scrollThumbs(direction: "left" | "right") {
    if (scrollContainerRef.current) {
      const offset = direction === "left" ? -120 : 120;
      scrollContainerRef.current.scrollBy({ left: offset, behavior: "smooth" });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Main Image Display */}
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-gold/30 bg-ink text-ink-foreground shadow-lg">
        {currentImage ? (
          <OfflineImage
            src={currentImage}
            alt={`${name} - View ${activeIndex + 1}`}
            className="h-full w-full object-contain p-3 transition-all duration-300"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <Package className="h-16 w-16 text-gold/60" />
            <span className="font-display text-4xl font-bold text-gold/80">
              {name.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}

        {hasMultiple && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous product image"
              className="absolute left-2 top-1/2 -translate-y-1/2 grid h-10 w-10 place-items-center rounded-full border border-gold/40 bg-background/85 text-foreground backdrop-blur-md transition-colors hover:bg-gold hover:text-black"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={handleNext}
              aria-label="Next product image"
              className="absolute right-2 top-1/2 -translate-y-1/2 grid h-10 w-10 place-items-center rounded-full border border-gold/40 bg-background/85 text-foreground backdrop-blur-md transition-colors hover:bg-gold hover:text-black"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            <span className="absolute bottom-3 right-3 rounded-full border border-gold/40 bg-background/85 px-2.5 py-1 text-xs font-semibold text-foreground backdrop-blur-md">
              {activeIndex + 1} / {images.length}
            </span>
          </>
        )}
      </div>

      {/* Thumbnails Strip with Left/Right scroll controls (up to 5 images) */}
      {hasMultiple && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => scrollThumbs("left")}
            aria-label="Scroll images left"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-card hover:border-gold hover:text-gold transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div
            ref={scrollContainerRef}
            className="flex flex-1 items-center gap-2 overflow-x-auto py-1 scrollbar-none"
          >
            {images.map((img, idx) => {
              const isActive = idx === activeIndex;
              return (
                <button
                  key={img + idx}
                  type="button"
                  onClick={() => setActiveIndex(idx)}
                  aria-label={`View image ${idx + 1} of ${images.length}`}
                  aria-pressed={isActive}
                  className={`group relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border p-1 transition-all ${
                    isActive
                      ? "border-gold ring-2 ring-gold/40 bg-gold/10"
                      : "border-border/70 hover:border-gold/50 bg-card"
                  }`}
                >
                  <OfflineImage
                    src={img}
                    alt=""
                    className="h-full w-full rounded-lg object-contain"
                  />
                  <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 text-[9px] font-bold text-white">
                    {idx + 1}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => scrollThumbs("right")}
            aria-label="Scroll images right"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-card hover:border-gold hover:text-gold transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function Product() {
  const { product: p, categoryName } = Route.useLoaderData();
  const navigate = useNavigate();
  const cart = useLocalList("nexa-cart");
  const wish = useLocalList("nexa-wishlist");

  function addToCart() {
    if (p.stock <= 0) return;
    cart.add(p.id);
  }

  function buyNow() {
    if (p.stock <= 0) return;
    cart.add(p.id);
    void navigate({ to: "/cart" });
  }

  function orderProductOnWhatsApp() {
    if (p.stock <= 0) return;
    openWhatsApp(buildProductWhatsAppMessage(p, 1));
  }

  const isSaved = wish.has(p.id);

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 md:grid-cols-2">
      <ProductGallery
        name={p.name}
        galleryUrls={p.gallery ?? null}
        mainImageUrl={p.image_url}
      />

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {categoryName}
          </p>

          <button
            type="button"
            onClick={() => wish.toggle(p.id)}
            aria-label={isSaved ? "Remove from wishlist" : "Save to wishlist"}
            aria-pressed={isSaved}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-3 py-1 text-xs font-semibold hover:bg-secondary transition-colors"
          >
            <Heart
              className={`h-4 w-4 ${
                isSaved ? "fill-gold text-gold" : "text-muted-foreground"
              }`}
            />
            <span>{isSaved ? "Saved" : "Save"}</span>
          </button>
        </div>

        <h1 className="text-3xl font-bold">{p.name}</h1>

        <div className="flex flex-wrap items-baseline gap-3">
          <p className="text-2xl font-bold text-gold">
            {formatStorePrice(p.price)}
          </p>

          {p.compare_at_price !== null && p.compare_at_price > p.price && (
            <p className="text-sm text-muted-foreground line-through">
              {formatStorePrice(p.compare_at_price)}
            </p>
          )}

          {p.discount_pct !== null && p.discount_pct > 0 && (
            <span className="rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-xs font-bold text-gold">
              {p.discount_pct}% OFF
            </span>
          )}
        </div>

        <p className="text-sm text-muted-foreground">
          {p.stock > 0 ? `${p.stock} available in stock` : "Currently unavailable"}
        </p>

        {p.description && (
          <div className="surface rounded-xl border border-gold/20 p-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gold">
              Product details
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
              {p.description}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={addToCart}
            disabled={p.stock <= 0}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-gold/60 px-3 py-2 text-sm font-semibold transition-colors hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ShoppingCart className="h-4 w-4 shrink-0" />
            Add to Cart
          </button>

          <button
            type="button"
            onClick={buyNow}
            disabled={p.stock <= 0}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-gold px-3 py-2 text-sm font-bold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Zap className="h-4 w-4 shrink-0" />
            Buy Now
          </button>

          <button
            type="button"
            onClick={orderProductOnWhatsApp}
            disabled={p.stock <= 0}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#25D366] px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-[#1DA851] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <WhatsAppIcon className="h-5 w-5 shrink-0" />
            WhatsApp
          </button>
        </div>

        <div className="surface space-y-2 p-4 text-sm">
          <div className="flex items-center justify-between">
            <span>Seller & fulfilment</span>
            <PlannedBadge />
          </div>
          <div className="flex items-center justify-between">
            <span>Delivery estimate</span>
            <PlannedBadge />
          </div>
          <div className="flex items-center justify-between">
            <span>Reviews</span>
            <PlannedBadge />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Preview storefront: checkout and payments are not live yet.
        </p>

        <Link
          to="/shop"
          search={{ page: 1 }}
          className="inline-flex text-sm text-muted-foreground underline underline-offset-4 hover:text-gold"
        >
          Continue shopping
        </Link>
      </div>
    </div>
  );
}
