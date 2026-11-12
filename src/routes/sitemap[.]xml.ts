/**
 * Dynamic sitemap.xml
 *
 * Built from FEATURE_REGISTRY via isFeaturePubliclyDiscoverable().
 * When you flip indexable / published / status on a feature, this response
 * changes automatically — no second hardcoded URL list.
 */

import { createFileRoute } from "@tanstack/react-router";
import { buildSitemapXml } from "@/lib/seo-sitemap";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const xml = buildSitemapXml();

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
