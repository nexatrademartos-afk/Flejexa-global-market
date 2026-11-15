/**
 * Dynamic sitemap endpoint.
 *
 * Reads public pages from the central feature registry and every eligible
 * product directly from the live public catalogue.
 */

import { createFileRoute } from "@tanstack/react-router";
import { buildSitemapXml } from "@/lib/seo-sitemap";
import { fetchPublicSitemapProducts } from "@/lib/preview-data";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const products = await fetchPublicSitemapProducts();
          const xml = buildSitemapXml(products);

          return new Response(xml, {
            status: 200,
            headers: {
              "Content-Type": "application/xml; charset=utf-8",
              "Cache-Control": "public, max-age=900, s-maxage=900",
              "X-Robots-Tag": "noindex",
            },
          });
        } catch (error) {
          console.error(
            "Unable to generate the complete FleJexa sitemap:",
            error,
          );

          return new Response(
            "The sitemap is temporarily unavailable. Please try again later.",
            {
              status: 503,
              headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Cache-Control": "no-store",
                "Retry-After": "300",
              },
            },
          );
        }
      },
    },
  },
});
