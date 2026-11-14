
/**
 * Central FleJexa sitemap generator.
 *
 * Includes:
 * - Public, published and indexable feature routes.
 * - Product URLs supplied by the live public catalogue.
 *
 * Private routes and the root redirect are never included.
 */

import { FEATURE_REGISTRY } from "@/lib/feature-registry";
import { isFeaturePubliclyDiscoverable } from "@/lib/feature-status";
import { absoluteUrl, getSiteUrl } from "@/lib/site";

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
 * Generates XML from the central feature registry and live product IDs.
 */
export function buildSitemapXml(
  productIds: readonly string[] = [],
  lastmod?: string,
): string {
  const day = lastmod ?? new Date().toISOString().slice(0, 10);

  const featureUrls = getDiscoverableSitemapPaths().map((path) => {
    const loc = escapeXml(absoluteUrl(path));
    const priority = PRIORITY_BY_ROUTE[path] ?? "0.5";

    return [
      "  <url>",
      `    <loc>${loc}</loc>`,
      `    <lastmod>${day}</lastmod>`,
      `    <priority>${priority}</priority>`,
      "  </url>",
    ].join("\n");
  });

  const uniqueProductIds = [
    ...new Set(
      productIds.filter(
        (id) => typeof id === "string" && id.trim().length > 0,
      ),
    ),
  ];

  const productUrls = uniqueProductIds.map((id) => {
    const loc = escapeXml(
      absoluteUrl(`/product/${encodeURIComponent(id)}`),
    );

    return [
      "  <url>",
      `    <loc>${loc}</loc>`,
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
