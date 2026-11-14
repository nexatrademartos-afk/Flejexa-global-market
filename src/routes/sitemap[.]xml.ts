
/**
 * Dynamic sitemap endpoint.
 *
 * Reads public pages from the central feature registry and products
 * from the live public storefront catalogue.
 */

import { createFileRoute } from "@tanstack/react-router";
import { buildSitemapXml } from "@/lib/seo-sitemap";
import { fetchStoreCatalogue } from "@/lib/preview-data";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        let productIds: string[] = [];

        try {
          const catalogue = await fetchStoreCatalogue();

          productIds = catalogue.products
            .filter(
              (product) =>
                typeof product.id === "string" &&
                product.id.trim().length > 0,
            )
            .map((product) => product.id);
        } catch (error) {
          // Keep the public-page sitemap available if the catalogue
          // service is temporarily unavailable.
          console.error(
            "Unable to load products for the sitemap:",
            error,
          );
        }

        const xml = buildSitemapXml(productIds);

        return new Response(xml, {
          status: 200,
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
