
import { describe, expect, it } from "vitest";
import {
  getFeatureByRoute,
  getFeatureRobotsDirective,
  isFeaturePubliclyDiscoverable,
  type FeatureRegistration,
} from "@/lib/feature-status";
import { FEATURE_REGISTRY } from "@/lib/feature-registry";

const publicFeature: FeatureRegistration = {
  id: "test-feature",
  route: "/test-feature",
  name: "Test Feature",
  description: "A test public feature.",
  status: "active",
  audience: "public",
  published: true,
  indexable: true,
};

describe("FleJexa unified feature status rules", () => {
  it("allows an approved, published, active public feature", () => {
    expect(isFeaturePubliclyDiscoverable(publicFeature)).toBe(true);
    expect(getFeatureRobotsDirective(publicFeature)).toBe("index, follow");
  });

  it("allows eligible coming-soon public pages", () => {
    const feature = { ...publicFeature, status: "coming_soon" as const };

    expect(isFeaturePubliclyDiscoverable(feature)).toBe(true);
  });

  it("allows temporarily unavailable public pages to remain discoverable", () => {
    const feature = {
      ...publicFeature,
      status: "temporarily_unavailable" as const,
    };

    expect(isFeaturePubliclyDiscoverable(feature)).toBe(true);
  });

  it("blocks private audiences", () => {
    for (const audience of ["authenticated", "staff", "admin"] as const) {
      const feature = { ...publicFeature, audience };

      expect(isFeaturePubliclyDiscoverable(feature)).toBe(false);
      expect(getFeatureRobotsDirective(feature)).toBe("noindex, nofollow");
    }
  });

  it("blocks unpublished or non-indexable pages", () => {
    expect(
      isFeaturePubliclyDiscoverable({
        ...publicFeature,
        published: false,
      }),
    ).toBe(false);

    expect(
      isFeaturePubliclyDiscoverable({
        ...publicFeature,
        indexable: false,
      }),
    ).toBe(false);
  });

  it("blocks planned, in-development, testing and retired features", () => {
    const blockedStatuses = [
      "planned",
      "in_development",
      "testing",
      "retired",
    ] as const;

    for (const status of blockedStatuses) {
      expect(
        isFeaturePubliclyDiscoverable({ ...publicFeature, status }),
      ).toBe(false);
    }
  });

  it("blocks missing or unregistered features", () => {
    expect(isFeaturePubliclyDiscoverable(undefined)).toBe(false);
    expect(getFeatureRobotsDirective(undefined)).toBe("noindex, nofollow");
  });

  it("finds registered routes and rejects unknown routes", () => {
    expect(getFeatureByRoute(FEATURE_REGISTRY, "/")).toBeDefined();
    expect(getFeatureByRoute(FEATURE_REGISTRY, "/about")?.id).toBe("about");
    expect(getFeatureByRoute(FEATURE_REGISTRY, "/not-registered")).toBeUndefined();
  });

  it("keeps the draft Policy Centre excluded from indexing", () => {
    const policies = getFeatureByRoute(FEATURE_REGISTRY, "/policies");

    expect(policies?.published).toBe(true);
    expect(policies?.indexable).toBe(false);
    expect(getFeatureRobotsDirective(policies)).toBe("noindex, nofollow");
  });
});
        
