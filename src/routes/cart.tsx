

import { createFileRoute, Link } from "@tanstack/react-router";
import { useLocalList } from "@/lib/local-list";
import { useOnlineStatus } from "@/hooks/use-online-status";
import {
  fetchStoreCatalogue,
  formatStorePrice,
  type StoreCatalogue,
} from "@/lib/preview-data";
import { EmptyState, PreviewNotice, SkeletonGrid } from "@/components/states";
import { ProductTile } from "@/components/ProductCard";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { buildCartWhatsAppMessage, openWhatsApp } from "@/lib/whatsapp";
import { BRAND, brandPageTitle } from "@/lib/brand";
import { WifiOff } from "lucide-react";
import { useState } from "react";

type ContactChannel = "whatsapp" | "sms" | "email";

const CONTACT_OPTIONS: {
  value: ContactChannel;
  label: string;
  description: string;
}[] = [
  {
    value: "whatsapp",
    label: "WhatsApp",
    description: "Receive your delivery PIN on WhatsApp.",
  },
  {
    value: "sms",
    label: "SMS / Text message",
    description: "Receive your PIN by ordinary text message.",
  },
  {
    value: "email",
    label: "Email",
    description: "Receive your PIN by email.",
  },
];

export const Route = createFileRoute("/cart")({
  loader: () => fetchStoreCatalogue(),

  head: () => ({
    meta: [
      { title: brandPageTitle("Your cart") },
      {
        name: "description",
        content: `Review your ${BRAND.shortName} cart and enquire about ordering on WhatsApp.`,
      },
      {
        property: "og:title",
        content: brandPageTitle("Cart"),
      },
      {
        property: "og:description",
        content: `Your ${BRAND.shortName} shopping cart.`,
      },
    ],
  }),

  component: CartPageComponent,
});

function CartPageComponent() {
  const catalogue = Route.useLoaderData();

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <CartView catalogue={catalogue} />
    </div>
  );
}

export function CartView({ catalogue }: { catalogue?: StoreCatalogue }) {
  const cart = useLocalList("nexa-cart");
  const isOffline = !useOnlineStatus();

  const [deliveryChannels, setDeliveryChannels] = useState<ContactChannel[]>([]);

  if (!cart.ready || !catalogue) {
    return <SkeletonGrid count={2} />;
  }

  const items = cart.ids.flatMap((id) => {
    const product = catalogue.products.find((item) => item.id === id);

    if (!product) return [];

    return [
      {
        product,
        quantity: Math.max(1, cart.quantities[id] ?? 1),
      },
    ];
  });

  const missingCount = cart.ids.length - items.length;

  const total = items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0,
  );

  function toggleDeliveryChannel(channel: ContactChannel) {
    setDeliveryChannels((current) =>
      current.includes(channel)
        ? current.filter((item) => item !== channel)
        : [...current, channel],
    );
  }

  function orderOnWhatsApp() {
    const selectedChannels = [
      "In-app Delivery Centre",
      ...CONTACT_OPTIONS
        .filter((option) => deliveryChannels.includes(option.value))
        .map((option) => option.label),
    ];

    const message = [
      buildCartWhatsAppMessage(items),
      "",
      "DELIVERY PIN CONTACT PREFERENCES",
      ...selectedChannels.map((channel) => `- ${channel}`),
      "",
      "Please use my selected contact methods for delivery PIN notifications.",
      "I understand that external contact methods require a verified phone number or email address.",
    ].join("\n");

    openWhatsApp(message);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Your Cart</h1>

      <PreviewNotice>
        Your cart is saved on this device. WhatsApp opens a message for you to
        review and send; it does not automatically place or confirm an order.
      </PreviewNotice>

      {items.length === 0 ? (
        <EmptyState
          title="Your cart is empty"
          body="Browse the shop and add products you'd like to order."
          action={
            <Link to="/shop" search={{ page: 1 }} className="btn btn-primary">
              Shop now
            </Link>
          }
        />
      ) : (
        <>
          <ul className="space-y-3">
            {items.map(({ product, quantity }) => (
              <li
                key={product.id}
                className="surface flex items-center gap-3 p-3"
              >
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg">
                  <ProductTile p={product} className="h-16 w-16" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{product.name}</p>

                  <p className="text-sm text-muted-foreground">
                    {formatStorePrice(product.price)} each
                  </p>

                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        cart.setQuantity(product.id, quantity - 1)
                      }
                      aria-label={`Decrease ${product.name} quantity`}
                      className="grid h-8 w-8 place-items-center rounded-md border border-border hover:bg-muted"
                    >
                      −
                    </button>

                    <span className="min-w-5 text-center text-sm font-semibold">
                      {quantity}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        cart.setQuantity(
                          product.id,
                          Math.min(quantity + 1, product.stock),
                        )
                      }
                      disabled={quantity >= product.stock}
                      aria-label={`Increase ${product.name} quantity`}
                      className="grid h-8 w-8 place-items-center rounded-md border border-border hover:bg-muted disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <p className="text-sm font-bold">
                    {formatStorePrice(product.price * quantity)}
                  </p>

                  <button
                    type="button"
                    onClick={() => cart.remove(product.id)}
                    className="text-xs font-medium text-destructive underline underline-offset-4"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {missingCount > 0 && (
            <p
              role="status"
              className="rounded-lg border border-border p-3 text-sm text-muted-foreground"
            >
              {missingCount} cart item(s) are no longer available in the active
              catalogue. Remove those items and add current products before
              ordering.
            </p>
          )}

          <div className="surface space-y-4 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold">Estimated item total</span>
              <span className="text-lg font-bold">
                {formatStorePrice(total)}
              </span>
            </div>

            <p className="text-xs text-muted-foreground">
              Delivery charges and final availability must be confirmed with
              {` ${BRAND.name}`}.
            </p>

            <section className="space-y-3 rounded-xl border border-border p-3">
              <div>
                <h2 className="text-sm font-bold">
                  How would you like to receive your delivery PIN?
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Choose one or more methods. You can select all of them.
                </p>
              </div>

              <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
                <input
                  type="checkbox"
                  checked
                  disabled
                  aria-label="In-app Delivery Centre always included"
                  className="mt-0.5 h-4 w-4"
                />
                <div>
                  <p className="text-sm font-semibold">
                    In-app Delivery Centre
                    <span className="ml-2 text-xs text-emerald-600 dark:text-emerald-400">
                      Always included
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Your PIN will also be available securely in your customer
                    account.
                  </p>
                </div>
              </div>

              {CONTACT_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 hover:bg-muted/40"
                >
                  <input
                    type="checkbox"
                    checked={deliveryChannels.includes(option.value)}
                    onChange={() => toggleDeliveryChannel(option.value)}
                    className="mt-0.5 h-4 w-4"
                  />
                  <span>
                    <span className="block text-sm font-semibold">
                      {option.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  </span>
                </label>
              ))}

              <p className="text-xs leading-5 text-muted-foreground">
                We will only send PIN notifications to contact details that
                have been verified. Your selected methods will be included
                with your order enquiry.
              </p>
            </section>

            {isOffline && (
              <div className="flex items-start gap-2 rounded-lg border border-gold/40 bg-ink p-3 text-xs text-slate-200">
                <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                <p>
                  <strong>You are currently offline.</strong> Your cart items
                  are saved locally on this device. WhatsApp will prepare your
                  draft order message now, but sending it requires mobile data
                  or an internet connection. No payment has been processed.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={orderOnWhatsApp}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#1DA851]"
            >
              <WhatsAppIcon className="h-5 w-5" />
              Continue Order on WhatsApp
            </button>

            <p className="text-center text-xs text-muted-foreground">
              WhatsApp will open with your items, quantities, estimated total,
              and selected delivery PIN contact methods. You must send the
              message to contact the business.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
