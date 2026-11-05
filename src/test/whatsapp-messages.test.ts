import { describe, expect, it } from "vitest";
import {
  buildProductWhatsAppMessage,
  buildCartWhatsAppMessage,
  NEXA_WHATSAPP_NUMBER,
} from "@/lib/whatsapp";
import { formatStorePrice, type StoreProduct } from "@/lib/preview-data";

const sampleProduct: StoreProduct = {
  id: "prod-1",
  name: "Organic Coffee Beans",
  slug: "organic-coffee-beans",
  price: 15000,
  compare_at_price: 18000,
  category_id: "cat-1",
  image_url: null,
  stock: 10,
  origin: "Ethiopia",
  featured: false,
};

describe("WhatsApp enquiry message builders", () => {
  it("uses the verified NEXA WhatsApp number", () => {
    expect(NEXA_WHATSAPP_NUMBER).toBe("27684963972");
  });

  it("builds a single product enquiry message with price and quantity", () => {
    const msg = buildProductWhatsAppMessage(sampleProduct, 2);
    expect(msg).toContain("Organic Coffee Beans");
    expect(msg).toContain("Quantity: 2");
    expect(msg).toContain(`Subtotal: ${formatStorePrice(30000)}`);
    expect(msg).toContain("Please confirm availability and delivery options.");
  });

  it("builds a multi-item cart message with items, quantities, and totals", () => {
    const secondProduct: StoreProduct = {
      ...sampleProduct,
      id: "prod-2",
      name: "Green Tea Pack",
      price: 8000,
      stock: 5,
    };

    const msg = buildCartWhatsAppMessage([
      { product: sampleProduct, quantity: 2 },
      { product: secondProduct, quantity: 1 },
    ]);

    expect(msg).toContain("1. Organic Coffee Beans");
    expect(msg).toContain("Quantity: 2");
    expect(msg).toContain("2. Green Tea Pack");
    expect(msg).toContain("Quantity: 1");
    expect(msg).toContain(`Estimated item total: ${formatStorePrice(38000)}`);
  });

  it("includes the explicit enquiry disclaimer in cart messages", () => {
    const msg = buildCartWhatsAppMessage([{ product: sampleProduct, quantity: 1 }]);
    expect(msg).toContain("This message is an order enquiry and does not itself confirm an order.");
  });

  it("handles an empty cart gracefully without fabricated items", () => {
    const msg = buildCartWhatsAppMessage([]);
    expect(msg).toContain("I'd like help placing an order.");
    expect(msg).not.toContain("Estimated item total");
  });
});

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

describe("WhatsApp Click to Chat link", () => {
  it("builds a wa.me link to the configured number with the message encoded", () => {
    const url = buildWhatsAppUrl("Hi & “hello” 100% — Order My Cart\nLine 2");
    expect(url.startsWith(`https://wa.me/${NEXA_WHATSAPP_NUMBER}?text=`)).toBe(true);
    expect(url).toContain("Hi%20%26%20");
    expect(url).toContain("%0ALine%202");
    expect(new URL(url).searchParams.get("text")).toBe("Hi & “hello” 100% — Order My Cart\nLine 2");
  });

  it("has a single helper file, so case-insensitive systems cannot load two versions", () => {
    const names = readdirSync(join(process.cwd(), "src/lib")).map((name) => name.toLowerCase());
    expect(names.filter((name) => name === "whatsapp.ts")).toHaveLength(1);
  });

  it("does not open WhatsApp in a popup window", () => {
    expect(readFileSync(join(process.cwd(), "src/lib/whatsapp.ts"), "utf8")).not.toContain("window.open");
  });
});
