/**
 * FleJexa public site origin.
 *
 * Single place for the canonical base URL used by sitemap, JSON-LD,
 * canonical links and Open Graph absolute URLs.
 *
 * Override in production with VITE_SITE_URL (no trailing slash), e.g.
 *   VITE_SITE_URL=https://flejexa.com
 *
 * Default matches the current Cloudflare Workers deployment.
 */

const DEFAULT_SITE_URL =
  "https://flejexa-global-mart.tjc-os.workers.dev";

function normalizeSiteUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export function getSiteUrl(): string {
  const fromEnv =
    typeof import.meta !== "undefined" &&
    import.meta.env &&
    typeof import.meta.env.VITE_SITE_URL === "string"
      ? import.meta.env.VITE_SITE_URL
      : "";

  if (fromEnv.trim()) {
    return normalizeSiteUrl(fromEnv);
  }

  return DEFAULT_SITE_URL;
}

/** Absolute URL for a path that already starts with `/`. */
export function absoluteUrl(path: string): string {
  const base = getSiteUrl();
  if (!path || path === "/") return `${base}/`;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
