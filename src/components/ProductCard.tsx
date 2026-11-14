import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { OfflineImage } from "@/components/OfflineImage";
import { buildProductWhatsAppMessage, openWhatsApp } from "@/lib/whatsapp";
import { Link, useNavigate } from "@tanstack/react-router";
import { Heart, ShoppingCart, Zap } from "lucide-react";
import {
  formatStorePrice,
  getStoreImageUrl,
  type PreviewProduct,
  type StoreProduct,
} from "@/lib/preview-data";
import { useLocalList } from "@/lib/local-list";

type ProductCardItem = PreviewProduct | StoreProduct;

function isStoreProduct(p: ProductCardItem): p is StoreProduct {
  return "slug" in p && "price" in p;
}

function productImage(p: ProductCardItem): string | null {
  return isStoreProduct(p) ? getStoreImageUrl(p.image_url) : null;
}

export function ProductTile({ p, className = "" }: { p: ProductCardItem; className?: string }) {
  const image = productImage(p);

  return (
    <div
      className={`relative grid aspect-square place-items-center overflow-hidden bg-ink text-ink-foreground ${className}`}
    >
      {image ? (
        <OfflineImage
          src={image}
          alt={p.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <span className="font-display text-4xl font-bold text-gold/80">
          {p.name.slice(0, 2).toUpperCase()}
        </span>
      )}

      {!isStoreProduct(p) && (
        <span className="absolute left-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-semibold text-foreground">
          PREVIEW
        </span>
      )}
    </div>
  );
}

export function ProductCard({ p, categoryName }: { p: ProductCardItem; categoryName?: string }) {
  const navigate = useNavigate();
  const cart = useLocalList("nexa-cart");
  const wish = useLocalList("nexa-wishlist");

  const saved = wish.has(p.id);
  const liveProduct = isStoreProduct(p);
  const quantity = cart.quantities[p.id] ?? 0;
  const stock = liveProduct ? Math.max(0, p.stock ?? 0) : 0;
  const canAdd = liveProduct && stock > 0 && quantity < stock;

  const categoryLabel = liveProduct ? categoryName || "Marketplace" : `${p.category} · ${p.origin}`;

  const priceLabel = liveProduct ? formatStorePrice(p.price) : p.priceLabel;

  const compareAtPrice =
    liveProduct && p.compare_at_price !== null && p.compare_at_price > p.price
      ? formatStorePrice(p.compare_at_price)
      : null;

  function addToCart() {
  if (!canAdd) return;
  cart.add(p.id);
  }

  function buyNow() {
    if (!canAdd) return;
    cart.add(p.id);
    void navigate({ to: "/cart" });
  }

  function orderProductOnWhatsApp() {
    if (!liveProduct || stock <= 0) return;

    openWhatsApp(buildProductWhatsAppMessage(p, Math.max(1, quantity || 1)));
  }

  return (
    <article className="group relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-md">
      <Link to="/product/$id" params={{ id: p.id }} className="block" aria-label={`View ${p.name}`}>
        <ProductTile p={p} />

        <div className="space-y-1 p-3">
          <p className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">
            {categoryLabel}
          </p>

          <h3 className="line-clamp-2 min-h-10 font-sans text-sm font-semibold">{p.name}</h3>

          <div className="flex flex-wrap items-baseline gap-1.5">
  <p className="text-base font-extrabold text-gold">{priceLabel}</p>

  {compareAtPrice && (
    <p className="text-xs text-muted-foreground line-through">
      {compareAtPrice}
    </p>
  )}

  {liveProduct && p.discount_pct !== null && p.discount_pct > 0 && (
    <span className="rounded-full bg-gold/10 px-1.5 py-0.5 text-[10px] font-bold text-gold">
      {p.discount_pct}% OFF
    </span>
  )}
</div>
        </div>
      </Link>

      <button
        type="button"
        onClick={() => wish.toggle(p.id)}
        aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
        aria-pressed={saved}
        className="absolute right-2 top-2 grid h-10 w-10 place-items-center rounded-full border border-border bg-background/90 transition-colors hover:bg-background"
      >
        <Heart className={`h-5 w-5 ${saved ? "fill-gold text-gold" : "text-foreground"}`} />
      </button>

      {liveProduct ? (
      <div className="mt-auto grid grid-cols-3 gap-1.5 px-2.5 pb-2.5 pt-1">
  {/* Buy Now — left */}
  <button
    type="button"
    onClick={buyNow}
    disabled={!canAdd}
    aria-label={stock <= 0 ? "Out of stock" : "Buy now"}
    title="Buy Now"
    className="grid h-10 place-items-center rounded-lg bg-gold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
  >
    <Zap className="h-5 w-5" />
  </button>

  {/* Add to Cart — centre */}
  <button
    type="button"
    onClick={addToCart}
    disabled={!canAdd}
    aria-label={
      !canAdd
        ? stock <= 0
          ? "Out of stock"
          : "Maximum available stock added"
        : quantity > 0
          ? "Add another to cart"
          : "Add to cart"
    }
    title="Add to Cart"
    className="grid h-10 place-items-center rounded-lg border border-gold/70 bg-background text-foreground transition-colors hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-50"
  >
    <ShoppingCart className="h-5 w-5" />
  </button>

  {/* WhatsApp — right */}
  <button
    type="button"
    onClick={orderProductOnWhatsApp}
    disabled={stock <= 0}
    aria-label="Order on WhatsApp"
    title="WhatsApp"
    className="grid h-10 place-items-center rounded-lg bg-[#25D366] text-white transition-colors hover:bg-[#1DA851] disabled:cursor-not-allowed disabled:opacity-50"
  >
    <WhatsAppIcon className="h-5 w-5" />
  </button>
</div>
          {quantityMenuOpen && (
            <div className="space-y-3 rounded-lg border border-border bg-background p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">Quantity in cart</span>
                <span className="text-sm font-bold">{quantity}</span>
              </div>

              <div className="flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={reduceQuantity}
                  disabled={quantity === 0}
                  aria-label="Reduce quantity"
                  className="grid h-9 w-9 place-items-center rounded-md border border-border hover:bg-muted disabled:opacity-40"
                >
                  <Minus className="h-4 w-4" />
                </button>

                <span className="min-w-6 text-center text-base font-bold">{quantity}</span>

                <button
                  type="button"
                  onClick={increaseQuantity}
                  disabled={!canAdd}
                  aria-label="Increase quantity"
                  className="grid h-9 w-9 place-items-center rounded-md border border-border hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {quantity >= stock && stock > 0 && (
                <p className="text-center text-xs text-muted-foreground">
                  All available stock is in your cart.
                </p>
              )}

              <button
                type="button"
                onClick={removeFromCart}
                className="inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-md border border-destructive/30 px-3 py-2 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/5"
              >
                <Trash2 className="h-4 w-4" />
                Remove from Cart
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={buyNow}
            disabled={!canAdd}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-gold px-2 py-2 text-xs font-bold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Zap className="h-4 w-4 shrink-0" />
            {stock <= 0 ? "Out of Stock" : "Buy Now"}
          </button>

          <button
            type="button"
            onClick={orderProductOnWhatsApp}
            disabled={!liveProduct || stock <= 0}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-[#1DA851] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <WhatsAppIcon className="h-5 w-5 shrink-0" />
            WhatsApp
          </button>
        </div>
      ) : (
        <p className="px-3 pb-3 text-xs text-muted-foreground">
          Preview item — not available to purchase.
        </p>
      )}
    </article>
  );
}
