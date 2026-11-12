
import type { FeatureRegistration } from "@/lib/feature-status";

/**
 * FleJexa Central Feature Registry
 *
 * Register each public-facing page or service here once.
 *
 * Private routes are deliberately not registered as public features.
 * A route not found in this registry must remain excluded by default.
 *
 * Keep policy-document approval separate from the availability
 * of the public Policy Centre page.
 *
 * Indexing automation:
 * - sitemap.xml is generated only from features that pass
 *   isFeaturePubliclyDiscoverable() (see src/lib/seo-sitemap.ts).
 * - When policies are approved for public search, set indexable: true.
 * - Thin "coming soon" pages stay indexable: false until content is useful.
 */

export const FEATURE_REGISTRY: readonly FeatureRegistration[] = [
  {
    id: "home",
    route: "/",
    name: "FleJexa Global Mart",
    description:
      "Discover products and global shopping opportunities at FleJexa Global Mart.",
    status: "active",
    audience: "public",
    published: true,
    indexable: true,
  },
  {
    id: "about",
    route: "/about",
    name: "About FleJexa",
    description:
      "Discover FleJexa's story, purpose, values and marketplace vision.",
    status: "active",
    audience: "public",
    published: true,
    indexable: true,
  },
  {
    id: "shop",
    route: "/shop",
    name: "Shop",
    description:
      "Browse available products and categories across FleJexa Global Mart.",
    status: "active",
    audience: "public",
    published: true,
    indexable: true,
  },
  {
    id: "sell",
    route: "/sell",
    name: "Become a Business Partner",
    description:
      "Learn about becoming a FleJexa business partner.",
    status: "coming_soon",
    audience: "public",
    published: true,
    // Not useful enough for search until partner content is complete.
    indexable: false,
  },
  {
    id: "support",
    route: "/support",
    name: "Contact and Support",
    description:
      "Find information about FleJexa customer assistance and support availability.",
    status: "coming_soon",
    audience: "public",
    published: true,
    // Index after support content is real (not a thin shell).
    indexable: false,
  },
  {
    id: "policies",
    route: "/policies",
    name: "Policy Centre",
    description:
      "Review FleJexa's marketplace policy documents and their publication status.",
    status: "active",
    audience: "public",
    published: true,
    // Policies remain pending / draft — do not index until legal approval.
    indexable: false,
  },
] as const;
    
