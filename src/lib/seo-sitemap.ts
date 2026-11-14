
/**
 * Sitemap built only from the central feature registry.
 *
 * Rules:
 * - A route appears only when it is publicly discoverable.
 * - The root route "/" is excluded because it redirects to "/shop".
 * - Private, unregistered and non-indexable routes never appear.
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
 * Returns every public, published, indexable feature route.
 * The root route is omitted because it redirects to the shop.
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
 * Full sitemap XML document. Safe to serve as application/xml.
 */
export function buildSitemapXml(lastmod?: string): string {
  const day = lastmod ?? new Date().toISOString().slice(0, 10);

  const paths = getDiscoverableSitemapPaths();

  const urls = paths
    .map((path) => {
      const loc = escapeXml(absoluteUrl(path));
      const priority = PRIORITY_BY_ROUTE[path] ?? "0.5";

      return [
        "  <url>",
        `    <loc>${loc}</loc>`,
        `    <lastmod>${day}</lastmod>`,
        `    <priority>${priority}</priority>`,
        "  </url>",
      ].join("\n");
    })
    .join("\n");

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    urls,
    `</urlset>`,
    "",
  ].join("\n");
}

/** Base origin currently used for sitemap loc values. */
export function sitemapBaseUrl(): string {
  return getSiteUrl();
    }
