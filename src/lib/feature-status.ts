
/**
 * FleJexa Unified Feature Status System
 *
 * This file defines the central rules for feature availability
 * and public search eligibility.
 *
 * Important:
 * - Feature availability is not the same as user access permission.
 * - A feature is never public merely because its route exists.
 * - Private and unregistered routes must remain noindex.
 * - Only explicitly published, public and indexable features
 *   can qualify for search visibility.
 */

export const FEATURE_STATUSES = [
  "planned",
  "in_development",
  "coming_soon",
  "testing",
  "active",
  "temporarily_unavailable",
  "retired",
] as const;

export type FeatureStatus = (typeof FEATURE_STATUSES)[number];

export const FEATURE_AUDIENCES = [
  "public",
  "authenticated",
  "staff",
  "admin",
] as const;

export type FeatureAudience = (typeof FEATURE_AUDIENCES)[number];

/**
 * Every feature added to the central registry must explicitly
 * declare its route, status, audience and publication settings.
 */
export interface FeatureRegistration {
  id: string;
  route: string;
  name: string;
  description: string;
  status: FeatureStatus;
  audience: FeatureAudience;

  /**
   * Whether the feature's public-facing page is approved
   * for publication.
   */
  published: boolean;

  /**
   * Whether search engines may index this public page.
   * This must never override private access restrictions.
   */
  indexable: boolean;
}

/**
 * Only these lifecycle statuses can qualify for public discovery.
 *
 * "coming_soon" is eligible only when the page is deliberately
 * published and useful to visitors.
 *
 * "temporarily_unavailable" can remain discoverable so visitors
 * can still find the page and see its availability notice.
 */
const PUBLIC_DISCOVERABLE_STATUSES: readonly FeatureStatus[] = [
  "coming_soon",
  "active",
  "temporarily_unavailable",
];

/**
 * The single eligibility rule used by future SEO, sitemap
 * and public-page integrations.
 *
 * Missing or unregistered features are never discoverable.
 */
export function isFeaturePubliclyDiscoverable(
  feature: FeatureRegistration | undefined,
): boolean {
  if (!feature) {
    return false;
  }

  return (
    feature.audience === "public" &&
    feature.published === true &&
    feature.indexable === true &&
    PUBLIC_DISCOVERABLE_STATUSES.includes(feature.status)
  );
}

/**
 * Safe robots directive for a registered feature.
 *
 * Anything that does not pass the public-discovery rule
 * receives noindex, nofollow.
 */
export function getFeatureRobotsDirective(
  feature: FeatureRegistration | undefined,
): "index, follow" | "noindex, nofollow" {
  return isFeaturePubliclyDiscoverable(feature)
    ? "index, follow"
    : "noindex, nofollow";
}

/**
 * Find a feature by its exact registered route.
 *
 * Routes that have not been registered return undefined
 * and therefore remain excluded by the default rules.
 */
export function getFeatureByRoute(
  registry: readonly FeatureRegistration[],
  route: string,
): FeatureRegistration | undefined {
  return registry.find((feature) => feature.route === route);
}
