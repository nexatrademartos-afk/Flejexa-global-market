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

     
    // Fully available services
    expect(SERVICES.find((s) => s.title === "Shop Products")?.status).toBe("available");
    expect(SERVICES.find((s) => s.title === "My Profile")?.status).toBe("available");
    expect(SERVICES.find((s) => s.title === "Delivery Addresses")?.status).toBe("available");
    expect(SERVICES.find((s) => s.title === "Help & Support")?.status).toBe("available");
    expect(SERVICES.find((s) => s.title === "Role Applications")?.status).toBe("available");
    expect(SERVICES.find((s) => s.title === "My Orders")?.status).toBe("available");
    expect(SERVICES.find((s) => s.title === "My Cart")?.status).toBe("partial");
    expect(SERVICES.find((s) => s.title === "Shopping & Savings")?.status).toBe("partial");
    expect(SERVICES.find((s) => s.title === "Security & Privacy")?.status).toBe("partial");
    expect(SERVICES.find((s) => s.title === "Delivery Centre")?.status).toBe("partial");
    expect(SERVICES.find((s) => s.title === `${BRAND.shortName} Wallet`)?.status).toBe("partial");
    expect(SERVICES.find((s) => s.title === "Q Points")?.status).toBe("partial");
    expect(SERVICES.find((s) => s.title === "Notifications")?.status).toBe("partial");
    expect(SERVICES.find((s) => s.title === "Coupons")?.status).toBe("planned");
    
