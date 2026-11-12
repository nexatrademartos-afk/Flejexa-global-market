/**
 * Sitemap built only from the central feature registry.
 *
 * Rules:
 * - A route appears only when isFeaturePubliclyDiscoverable(feature) is true.
 * - Private / unregistered / non-indexable routes never appear.
 * - When policies (or any feature) become indexable, flip the registry flag —
 *   the sitemap updates automatically. Do not maintain a second hardcoded list.
 */

import { FEATURE_REGISTRY } from "@/lib/feature-registry";
import { isFeaturePubliclyDiscoverable } from "@/lib/feature-status";
import { absoluteUrl, getSiteUrl } from "@/lib/site";

const PRIORITY_BY_ROUTE: Record<string, string> = {
  "/": "1.0",
  "/shop": "0.9",
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
 * Returns every public, published, indexable feature route for the sitemap.
 */
export function getDiscoverableSitemapPaths(): string[] {
  return FEATURE_REGISTRY.filter((feature) =>
    isFeaturePubliclyDiscoverable(feature),
  ).map((feature) => feature.route);
}

/**
 * Full sitemap XML document. Safe to serve as application/xml.
 */
export function buildSitemapXml(lastmod?: string): string {
  const day =
    lastmod ??
    new Date().toISOString().slice(0, 10);

  const paths = getDiscoverableSitemapPaths();

  const urls = paths
    .map((path) => {
      const loc = escapeXml(absoluteUrl(path === "/" ? "/" : path));
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

/** Base origin currently used for sitemap loc values (for logging / tests). */
export function sitemapBaseUrl(): string {
  return getSiteUrl();
}
