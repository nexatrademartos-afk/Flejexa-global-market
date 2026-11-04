import { BRAND } from "@/lib/brand";
import { describe, expect, it } from "vitest";
import { SERVICES } from "@/routes/account.index";

describe("Customer dashboard services configuration", () => {
  it("includes all primary account services with honest availability flags", () => {
    const titles = SERVICES.map((s) => s.title);

    expect(titles).toContain("Shop Products");
    expect(titles).toContain("My Cart");
    expect(titles).toContain("Shopping & Savings");
    expect(titles).toContain("My Profile");
    expect(titles).toContain("Delivery Addresses");
    expect(titles).toContain("Security & Privacy");
    expect(titles).toContain("Help & Support");
    expect(titles).toContain("Role Applications");

    // Implemented and available features
    const profile = SERVICES.find((s) => s.title === "My Profile");
    expect(profile?.available).toBe(true);

    const addresses = SERVICES.find((s) => s.title === "Delivery Addresses");
    expect(addresses?.available).toBe(true);

    const cart = SERVICES.find((s) => s.title === "My Cart");
    expect(cart?.available).toBe(true);

    const wishlist = SERVICES.find((s) => s.title === "Shopping & Savings");
    expect(wishlist?.available).toBe(true);

    // Unsupported/planned features must be honestly marked false
    const orders = SERVICES.find((s) => s.title === "My Orders");
    expect(orders?.available).toBe(false);

    const wallet = SERVICES.find((s) => s.title === `${BRAND.shortName} Wallet`);
    expect(wallet?.available).toBe(true);

    const coupons = SERVICES.find((s) => s.title === "Coupons");
    expect(coupons?.available).toBe(false);

    const notifications = SERVICES.find((s) => s.title === "Notifications");
    expect(notifications?.available).toBe(false);
  });

  it("filters services by title and description correctly", () => {
    const filter = (term: string) => {
      const lower = term.toLowerCase().trim();
      return SERVICES.filter(
        (s) =>
          s.title.toLowerCase().includes(lower) ||
          (s.description && s.description.toLowerCase().includes(lower)),
      );
    };

    const cartMatches = filter("cart");
    expect(cartMatches.some((s) => s.title === "My Cart")).toBe(true);

    const addressMatches = filter("shipping");
    expect(addressMatches.some((s) => s.title === "Delivery Addresses")).toBe(true);

    const unknownMatches = filter("nonexistent-service-query-xyz");
    expect(unknownMatches).toHaveLength(0);
  });
});
