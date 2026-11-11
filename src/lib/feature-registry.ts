
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
    indexable: true,
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
    indexable: true,
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
    indexable: false,
  },
] as const;
    
