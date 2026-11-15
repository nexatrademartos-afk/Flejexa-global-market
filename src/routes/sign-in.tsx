
import { createFileRoute, Link } from "@tanstack/react-router";
import { BRAND, brandPageTitle } from "@/lib/brand";
import { AuthForm } from "@/components/AuthForm";
import { getFeatureRobotsMeta } from "@/lib/feature-seo";

const canonicalUrl = "https://flejexa-global-mart.tjc-os.workers.dev/sign-in";

export const Route = createFileRoute("/sign-in")({
  head: () => ({
    meta: [
      { title: brandPageTitle("Sign in") },
      {
        name: "description",
        content: `Sign in to your ${BRAND.name} customer account to access your shopping account and services.`,
      },
      ...getFeatureRobotsMeta("/sign-in"),
      {
        property: "og:type",
        content: "website",
      },
      {
        property: "og:title",
        content: brandPageTitle("Sign in"),
      },
      {
        property: "og:description",
        content: `Access your ${BRAND.name} account.`,
      },
      {
        property: "og:site_name",
        content: BRAND.name,
      },
      {
        property: "og:url",
        content: canonicalUrl,
      },
    ],
    links: [{ rel: "canonical", href: canonicalUrl }],
  }),
  component: () => (
    <AuthForm
      title="Sign in"
      cta="Sign in"
      footer={
        <>
          New to {BRAND.shortName}?{" "}
          <Link to="/sign-up" className="font-semibold underline">
            Create an account
          </Link>
        </>
      }
    />
  ),
});
