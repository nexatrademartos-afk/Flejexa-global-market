import { describe, expect, it } from "bun:test";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

describe("Offline shopping functionality and boundaries", () => {
  it("includes public/manifest.json with PWA standalone configuration", () => {
    const manifestPath = join(process.cwd(), "public/manifest.json");
    expect(existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
    expect(manifest.name).toBe("NEXA GLOBAL MART");
    expect(manifest.short_name).toBe("NEXA");
    expect(manifest.start_url).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThan(0);
  });

  it("links manifest.json in root route head", () => {
    const rootPath = join(process.cwd(), "src/routes/__root.tsx");
    const content = readFileSync(rootPath, "utf-8");
    expect(content).toContain('href: "/manifest.json"');
  });

  it("protects private boundaries and isolates public routes in service-worker.js", () => {
    const swPath = join(process.cwd(), "public/service-worker.js");
    const content = readFileSync(swPath, "utf-8");

    // Guard private endpoints
    expect(content).toContain('/admin');
    expect(content).toContain('/account');
    expect(content).toContain('/workspace');
    expect(content).toContain('supabase.co');

    // Caches and serves public navigations
    expect(content).toContain('request.mode === "navigate"');
    expect(content).toContain('OFFLINE_URL');
    expect(content).toContain('ROOT_URL');
  });

  it("has branded offline.html fallback that links to saved storefront", () => {
    const offlineHtmlPath = join(process.cwd(), "public/offline.html");
    const content = readFileSync(offlineHtmlPath, "utf-8");

    expect(content).toContain("NEXA Offline Shopping");
    expect(content).toContain('href="/"');
    expect(content).toContain('Open Saved Storefront');
    expect(content).toContain('href="/manifest.json"');
  });

  it("handles offline state specifically in product route notFoundComponent", () => {
    const productRoutePath = join(process.cwd(), "src/routes/product.$id.tsx");
    const content = readFileSync(productRoutePath, "utf-8");

    expect(content).toContain("Product unavailable offline");
    expect(content).toContain("This product has not been saved on your device yet");
  });

  it("provides clear offline disclaimer in cart before WhatsApp ordering", () => {
    const cartRoutePath = join(process.cwd(), "src/routes/cart.tsx");
    const content = readFileSync(cartRoutePath, "utf-8");

    expect(content).toContain("You are currently offline");
    expect(content).toContain("sending it requires mobile data or an internet connection");
    expect(content).toContain("No payment has been processed");
  });
});
