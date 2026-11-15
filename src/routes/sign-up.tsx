
import { createFileRoute, Link } from "@tanstack/react-router";
import { BRAND, brandPageTitle } from "@/lib/brand";
import { AuthForm } from "@/components/AuthForm";
import { getFeatureRobotsMeta } from "@/lib/feature-seo";

const canonicalUrl = "https://flejexa-global-mart.tjc-os.workers.dev/sign-up";

export const Route = createFileRoute("/sign-up")({
  head: () => ({
    meta: [
      { title: brandPageTitle("Create an account") },
      {
        name: "description",
        content: `Create a customer account with ${BRAND.name} and start exploring the marketplace.`,
      },
      ...getFeatureRobotsMeta("/sign-up"),
      {
        property: "og:type",
        content: "website",
      },
      {
        property: "og:title",
        content: brandPageTitle("Create an account"),
      },
      {
        property: "og:description",
        content: BRAND.tagline,
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
      title="Create your account"
      cta="Create customer account"
      withName
      note="New accounts are customer accounts. Business partner, delivery and commission roles require a separate application and approval."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/sign-in" className="font-semibold underline">
            Sign in
          </Link>
        </>
      }
    />
  ),
});
