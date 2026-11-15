
import type { FeatureRegistration } from "@/lib/feature-status";

/**
 * FleJexa Central Feature Registry
 *
 * Only explicitly published public pages may enter the sitemap.
 * Private dashboards and account routes must never be registered here.
 */
export const FEATURE_REGISTRY: readonly FeatureRegistration[] = [
  {
    id: "home",
    route: "/",
    name: "FleJexa Global Mart",
    description: "Discover products and global shopping opportunities at FleJexa Global Mart.",
    status: "active",
    audience: "public",
    published: true,
    indexable: true,
  },
  {
    id: "about",
    route: "/about",
    name: "About FleJexa",
    description: "Discover FleJexa's story, purpose, values and marketplace vision.",
    status: "active",
    audience: "public",
    published: true,
    indexable: true,
  },
  {
    id: "shop",
    route: "/shop",
    name: "Shop",
    description: "Browse available products and categories across FleJexa Global Mart.",
    status: "active",
    audience: "public",
    published: true,
    indexable: true,
  },
  {
    id: "sign-in",
    route: "/sign-in",
    name: "Sign in to FleJexa",
    description: "Sign in to your FleJexa Global Mart customer account.",
    status: "active",
    audience: "public",
    published: true,
    indexable: true,
  },
  {
    id: "sign-up",
    route: "/sign-up",
    name: "Create a FleJexa account",
    description: "Create a customer account with FleJexa Global Mart.",
    status: "active",
    audience: "public",
    published: true,
    indexable: true,
  },
  {
    id: "sell",
    route: "/sell",
    name: "Sell on FleJexa",
    description: "Learn how shops, brands and businesses can become FleJexa business partners.",
    status: "coming_soon",
    audience: "public",
    published: true,
    indexable: true,
  },
  {
    id: "opportunities",
    route: "/opportunities",
    name: "FleJexa Partner and Delivery Opportunities",
    description: "Explore business partner, delivery partner and commission partner opportunities with FleJexa.",
    status: "coming_soon",
    audience: "public",
    published: true,
    indexable: true,
  },
  {
    id: "support",
    route: "/support",
    name: "Contact and Support",
    description: "Find information about FleJexa customer assistance and support availability.",
    status: "coming_soon",
    audience: "public",
    published: true,
    indexable: false,
  },
  {
    id: "policies",
    route: "/policies",
    name: "Policy Centre",
    description: "Review FleJexa's marketplace policy documents and their publication status.",
    status: "active",
    audience: "public",
    published: true,
    indexable: false,
  },
] as const;
