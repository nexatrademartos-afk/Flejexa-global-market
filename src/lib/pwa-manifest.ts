import { BRAND } from "./brand";

/**
 * Brand fields used by the web app manifest. Kept separate so the manifest can
 * be built from any brand object, and tested without changing the real brand.
 */
export type ManifestBrand = {
  name: string;
  shortName: string;
  description: string;
  logoPath: string;
};

/**
 * Builds the PWA manifest from the central brand configuration. Served in
 * development and emitted into the client build by vite.config.ts.
 */
export function buildWebManifest(brand: ManifestBrand = BRAND) {
  return {
    name: brand.name,
    short_name: brand.shortName,
    description: brand.description,
    start_url: "/",
    display: "standalone",
    background_color: "#080808",
    theme_color: "#080808",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "48x48 32x32 16x16",
        type: "image/x-icon",
      },
      {
        src: brand.logoPath,
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  };
}
