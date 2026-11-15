
import { createFileRoute, Link } from "@tanstack/react-router";
import { BRAND, brandPageTitle } from "@/lib/brand";
import { PlannedBadge } from "@/components/states";
import { getFeatureRobotsMeta } from "@/lib/feature-seo";

const canonicalUrl = "https://flejexa-global-mart.tjc-os.workers.dev/sell";

export const Route = createFileRoute("/sell")({
  head: () => ({
    meta: [
      {
        title: brandPageTitle("Sell on FleJexa"),
      },
      {
        name: "description",
        content: `Learn how shops, brands and businesses can become FleJexa business partners, submit products and explore marketplace fulfilment options.`,
      },
      ...getFeatureRobotsMeta("/sell"),
      {
        property: "og:type",
        content: "website",
      },
      {
        property: "og:site_name",
        content: BRAND.name,
      },
      {
        property: "og:title",
        content: brandPageTitle("Sell on FleJexa"),
      },
      {
        property: "og:description",
        content: `Discover business partnership opportunities with ${BRAND.name}.`,
      },
      {
        property: "og:url",
        content: canonicalUrl,
      },
      {
        property: "og:image",
        content: "https://flejexa-global-mart.tjc-os.workers.dev/og-image.png",
      },
      {
        name: "twitter:card",
        content: "summary_large_image",
      },
    ],
    links: [{ rel: "canonical", href: canonicalUrl }],
  }),
  component: Sell,
});

function Sell() {
  const steps = [
    {
      title: "Submit your business details",
      description:
        "Provide information about your shop, brand or business for consideration.",
    },
    {
      title: "Application review",
      description:
        "FleJexa reviews business applications before granting partner access.",
    },
    {
      title: "Product onboarding",
      description:
        "Approved partners can prepare product listings for review before publication.",
    },
    {
      title: "Fulfilment planning",
      description:
        "Available fulfilment arrangements are discussed and confirmed during onboarding.",
    },
  ];

  return (
    <main className="mx-auto max-w-3xl space-y-7 px-4 py-8">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
          FleJexa Business Partnerships
        </p>

        <h1 className="text-3xl font-bold">
          Sell on {BRAND.shortName}
        </h1>

        <p className="leading-relaxed text-muted-foreground">
          Are you a shop, brand or business interested in reaching customers
          through {BRAND.name}? Explore the business partnership process and
          learn how product onboarding works.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">
          How business partnership works
        </h2>

        <ol className="space-y-3">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className="surface flex gap-3 rounded-xl border p-4"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink font-bold text-gold">
                {index + 1}
              </span>

              <div>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="surface space-y-3 rounded-xl border p-5">
        <h2 className="text-lg font-semibold">
          Interested in becoming a business partner?
        </h2>

        <p className="text-sm leading-relaxed text-muted-foreground">
          Partner access is subject to application review and approval.
          Applications are not being advertised as generally open yet.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Link to="/opportunities" className="btn btn-outline">
            Explore all opportunities
          </Link>

          <Link to="/sign-up" className="btn btn-primary">
            Create an account
          </Link>

          <PlannedBadge label="Applications open soon" />
        </div>
      </section>
    </main>
  );
}
