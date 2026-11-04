import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import type { Plugin } from "vite";
import { buildWebManifest } from "./src/lib/pwa-manifest";

/**
 * Serves /manifest.json in development and emits it into the client build.
 * Both use the central brand configuration, so the PWA name stays in sync
 * with the site brand and no separate hardcoded copy is needed.
 */
function brandWebManifest(): Plugin {
  const source = `${JSON.stringify(buildWebManifest(), null, 2)}\n`;

  return {
    name: "nexa-brand-web-manifest",
    configureServer(server) {
      server.middlewares.use("/manifest.json", (_req, res) => {
        res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
        res.end(source);
      });
    },
    generateBundle() {
      if (this.environment?.name !== "client") return;
      this.emitFile({ type: "asset", fileName: "manifest.json", source });
    },
  };
}

/**
 * Public storefront route modules that must open offline. Account, admin,
 * workspace and sign-in code is deliberately not listed.
 */
const STOREFRONT_ROUTE_MODULES = [
  "src/routes/index.tsx",
  "src/routes/shop.tsx",
  "src/routes/cart.tsx",
  "src/routes/product.$id.tsx",
  "src/routes/about.tsx",
  "src/routes/policies.tsx",
  "src/routes/support.tsx",
  "src/routes/wishlist.tsx",
];

/**
 * Emits sw-precache.json: the JavaScript chunks for the public storefront
 * routes (with their static dependencies) and the CSS files. The service
 * worker caches them at install so those routes can load without a connection.
 */
function storefrontPrecacheList(): Plugin {
  return {
    name: "nexa-storefront-precache-list",
    generateBundle(_options, bundle) {
      if (this.environment?.name !== "client") return;

      const files = new Set<string>();

      const addChunk = (fileName: string) => {
        if (files.has(fileName)) return;
        files.add(fileName);
        const item = bundle[fileName];
        if (item?.type === "chunk") item.imports.forEach(addChunk);
      };

      for (const item of Object.values(bundle)) {
        if (item.type !== "chunk" || !item.facadeModuleId) continue;
        const id = item.facadeModuleId.replaceAll("\\", "/").split("?")[0] ?? "";
        if (STOREFRONT_ROUTE_MODULES.some((route) => id.endsWith(route))) {
          addChunk(item.fileName);
        }
      }

      for (const item of Object.values(bundle)) {
        if (item.type === "asset" && item.fileName.endsWith(".css")) {
          files.add(item.fileName);
        }
      }

      this.emitFile({
        type: "asset",
        fileName: "sw-precache.json",
        source: JSON.stringify([...files].map((file) => `/${file}`), null, 2),
      });
    },
  };
}

export default defineConfig({
plugins: [
brandWebManifest(),
storefrontPrecacheList(),
tanstackStart({
server: {
entry: "server",
},
}),
nitro({
preset: "cloudflare_module",
}),
viteReact(),
tailwindcss(),
tsconfigPaths(),
],
});
