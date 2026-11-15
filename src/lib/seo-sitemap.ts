
/**
 * Central FleJexa sitemap generator.
 *
 * Includes:
 * - Public, published and indexable feature routes.
 * - Every eligible live product supplied by the sitemap data query.
 *
 * Private routes and the root redirect are never included.
 */

import { FEATURE_REGISTRY } from "@/lib/feature-registry";
import { isFeaturePubliclyDiscoverable } from "@/lib/feature-status";
import { absoluteUrl, getSiteUrl } from "@/lib/site";
import type { SitemapProduct } from "@/lib/preview-data";

const PRIORITY_BY_ROUTE: Record<string, string> = {
  "/shop": "1.0",
  "/about": "0.8",
  "/sell": "0.6",
  "/support": "0.6",
  "/policies": "0.5",
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatLastmod(value: string | null | undefined): string | null {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

/**
 * Returns every public, published and indexable feature route.
 */
export function getDiscoverableSitemapPaths(): string[] {
  return FEATURE_REGISTRY
    .filter(
      (feature) =>
        feature.route !== "/" &&
        isFeaturePubliclyDiscoverable(feature),
    )
    .map((feature) => feature.route);
}

/**
 * Generates XML from the central feature registry and live product records.
 */
export function buildSitemapXml(
  products: readonly SitemapProduct[] = [],
  lastmod?: string,
): string {
  const defaultLastmod =
    formatLastmod(lastmod) ?? new Date().toISOString().slice(0, 10);

  const featureUrls = getDiscoverableSitemapPaths().map((path) => {
    const loc = escapeXml(absoluteUrl(path));
    const priority = PRIORITY_BY_ROUTE[path] ?? "0.5";

    return [
      "  <url>",
      `    <loc>${loc}</loc>`,
      `    <lastmod>${defaultLastmod}</lastmod>`,
      `    <priority>${priority}</priority>`,
      "  </url>",
    ].join("\n");
  });

  const uniqueProducts = new Map<string, SitemapProduct>();

  for (const product of products) {
    if (
      typeof product.id !== "string" ||
      !product.id.trim()
    ) {
      continue;
    }

    uniqueProducts.set(product.id, product);
  }

  const productUrls = [...uniqueProducts.values()].map((product) => {
    const loc = escapeXml(
      absoluteUrl(`/product/${encodeURIComponent(product.id)}`),
    );

    const lastmod = formatLastmod(product.updated_at);

    return [
      "  <url>",
      `    <loc>${loc}</loc>`,
      ...(lastmod ? [`    <lastmod>${lastmod}</lastmod>`] : []),
      "    <priority>0.7</priority>",
      "  </url>",
    ].join("\n");
  });

  const urls = [...featureUrls, ...productUrls].join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    "</urlset>",
    "",
  ].join("\n");
}

/** Base origin used by sitemap URLs. */
export function sitemapBaseUrl(): string {
  return getSiteUrl();
}
