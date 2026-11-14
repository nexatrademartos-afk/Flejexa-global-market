import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { ProductCard } from "@/components/ProductCard";
import { SkeletonGrid } from "@/components/states";
import {
  buildShowcaseCollections,
  type ShowcaseCollection,
} from "@/lib/shop-showcase";
import type { StoreCategory, StoreProduct } from "@/lib/preview-data";

const AUTOPLAY_MS = 6000;
const SHOWCASE_OPTIONS = { loop: true, align: "start" } as const;

type ShowcaseApi = NonNullable<
  Parameters<NonNullable<ComponentProps<typeof Carousel>["setApi"]>>[0]
>;

interface ShopShowcaseProps {
  products: StoreProduct[];
  categories: StoreCategory[];
  loading: boolean;
  loadError: boolean;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return reduced;
}

export function ShopShowcase({ products, categories, loading, loadError }: ShopShowcaseProps) {
  const collections = useMemo(() => buildShowcaseCollections(products), [products]);
  const reducedMotion = usePrefersReducedMotion();

  const [api, setApi] = useState<ShowcaseApi>();
  const [selected, setSelected] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [holding, setHolding] = useState(false); // hover, focus, or touch/pointer down

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setSelected(api.selectedScrollSnap());
    onSelect();
    api.on("select", onSelect);
    api.on("reInit", onSelect);
    return () => {
      api.off("select", onSelect);
      api.off("reInit", onSelect);
    };
  }, [api]);

  const autoplayActive =
    !!api && !reducedMotion && !userPaused && !holding && collections.length > 1;

  useEffect(() => {
    if (!autoplayActive || !api) return;
    const id = window.setInterval(() => api.scrollNext(), AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [autoplayActive, api]);

  if (loading) {
    return (
      <section aria-live="polite" aria-label="Shop highlights" className="space-y-3">
        <p className="text-sm text-muted-foreground">Loading live highlights…</p>
        <SkeletonGrid count={4} />
      </section>
    );
  }

  if (loadError) {
    return (
      <div role="status" className="surface rounded-xl p-5 text-sm text-muted-foreground">
        Highlights are unavailable because the live catalogue could not be reached.
      </div>
    );
  }

  if (collections.length === 0) return null;

  return (
    <section aria-label="Shop highlights" className="space-y-3">
      <Carousel
        setApi={setApi}
        opts={SHOWCASE_OPTIONS}
        aria-label="Shop highlights"
        onPointerEnter={() => setHolding(true)}
        onPointerLeave={() => setHolding(false)}
        onPointerDown={() => setHolding(true)}
        onPointerUp={() => setHolding(false)}
        onPointerCancel={() => setHolding(false)}
        onFocus={() => setHolding(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHolding(false);
        }}
      >
        <CarouselContent className="-ml-0">
          {collections.map((collection, index) => (
            <CarouselItem key={collection.key} className="pl-0">
              <ShowcaseSlide
                collection={collection}
                index={index}
                total={collections.length}
                categories={categories}
              />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-outline h-9 w-9 p-0"
            aria-label="Previous highlight"
            onClick={() => api?.scrollPrev()}
            disabled={!api || collections.length < 2}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            className="btn btn-outline h-9 w-9 p-0"
            aria-label="Next highlight"
            onClick={() => api?.scrollNext()}
            disabled={!api || collections.length < 2}
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
          {collections.length > 1 && !reducedMotion && (
            <button
              type="button"
              className="btn btn-outline h-9 gap-2 px-3"
              aria-pressed={userPaused}
              onClick={() => setUserPaused((paused) => !paused)}
            >
              {userPaused ? <Play className="h-4 w-4" aria-hidden /> : <Pause className="h-4 w-4" aria-hidden />}
              {userPaused ? "Play highlights" : "Pause highlights"}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2" role="group" aria-label="Choose highlight">
          {collections.map((collection, index) => (
            <button
              key={collection.key}
              type="button"
              aria-label={`Show ${collection.title}`}
              aria-current={selected === index ? "true" : undefined}
              onClick={() => api?.scrollTo(index)}
              className={`h-2.5 rounded-full transition-all ${
                selected === index ? "w-6 bg-gold" : "w-2.5 bg-muted-foreground/40"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function ShowcaseSlide({
  collection,
  index,
  total,
  categories,
}: {
  collection: ShowcaseCollection;
  index: number;
  total: number;
  categories: StoreCategory[];
}) {
  return (
    <div
      role="group"
      aria-roledescription="slide"
      aria-label={`${collection.title}, ${index + 1} of ${total}`}
      className="surface rounded-xl p-4 sm:p-5"
    >
      <div className="mb-4">
        <h2 className="text-xl font-bold">{collection.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{collection.subtitle}</p>
      </div>

      <ul className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {collection.products.map((product) => (
          <li key={`${collection.key}-${product.id}`} className="min-w-0">
            <ProductCard
              p={product}
              categoryName={categories.find((item) => item.id === product.category_id)?.name ?? ""}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

