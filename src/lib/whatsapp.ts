import { BRAND } from "@/lib/brand";

import {
  formatStorePrice,
  type StoreProduct,
} from "@/lib/preview-data";

export const NEXA_WHATSAPP_NUMBER = BRAND.contact.whatsappDigits;

/** Standard WhatsApp Click to Chat link with the message safely URL-encoded. */
export function buildWhatsAppUrl(message: string): string {
  return `https://wa.me/${NEXA_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

/**
 * Opens WhatsApp in the same tab. A new-window request can produce a blank or blocked
 * page in Android browsers and embedded web views, so the browser navigates directly instead.
 */
export function openWhatsApp(message: string): void {
  if (typeof window === "undefined") return;
  window.location.assign(buildWhatsAppUrl(message));
}

export function buildProductWhatsAppMessage(
  product: StoreProduct,
  quantity = 1,
): string {
  const safeQuantity = Math.max(1, Math.floor(quantity));

  return [
    `Hello ${BRAND.name}!`,
    "",
    "I'd like to enquire about this product:",
    `Product: ${product.name}`,
    `Unit price: ${formatStorePrice(product.price)}`,
    `Quantity: ${safeQuantity}`,
    `Subtotal: ${formatStorePrice(product.price * safeQuantity)}`,
    "",
    "Please confirm availability and delivery options.",
  ].join("\n");
}

export interface WhatsAppCartItem {
  product: StoreProduct;
  quantity: number;
}

export function buildCartWhatsAppMessage(
  items: WhatsAppCartItem[],
): string {
  const validItems = items.filter(
    ({ product, quantity }) =>
      Number.isFinite(product.price) &&
      product.price > 0 &&
      Number.isFinite(quantity) &&
      quantity > 0,
  );

  if (validItems.length === 0) {
    return [
      `Hello ${BRAND.name}!`,
      "",
      "I'd like help placing an order.",
      "Please assist me with your available products.",
    ].join("\n");
  }

  const total = validItems.reduce(
    (sum, { product, quantity }) =>
      sum + product.price * quantity,
    0,
  );

  return [
    `Hello ${BRAND.name}!`,
    "",
    "I'd like to place an order for these items:",
    "",
    ...validItems.flatMap(({ product, quantity }, index) => [
      `${index + 1}. ${product.name}`,
      `Unit price: ${formatStorePrice(product.price)}`,
      `Quantity: ${quantity}`,
      `Subtotal: ${formatStorePrice(product.price * quantity)}`,
      "",
    ]),
    `Estimated item total: ${formatStorePrice(total)}`,
    "",
    "Please confirm stock, delivery fees, final total, and payment instructions.",
    "",
    "This message is an order enquiry and does not itself confirm an order.",
  ].join("\n");
}

export const NEXA_QUICK_MESSAGE = [
  `Hello ${BRAND.name}!`,
  "",
  "I'd like help with your products and services.",
].join("\n");
