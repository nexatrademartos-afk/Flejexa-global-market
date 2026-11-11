
import { FEATURE_REGISTRY } from "@/lib/feature-registry";
import {
  getFeatureByRoute,
  getFeatureRobotsDirective,
} from "@/lib/feature-status";

/**
 * Returns the robots metadata for a route using the central
 * feature registry.
 *
 * Unregistered routes automatically receive noindex, nofollow.
 */
export function getFeatureRobotsMeta(route: string) {
  const feature = getFeatureByRoute(FEATURE_REGISTRY, route);

  return {
    name: "robots",
    content: getFeatureRobotsDirective(feature),
  };
}
