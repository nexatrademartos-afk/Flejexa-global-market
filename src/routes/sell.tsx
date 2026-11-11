import { createFileRoute, Link } from "@tanstack/react-router";
import { BRAND, brandPageTitle } from "@/lib/brand";
import { PlannedBadge } from "@/components/states";
import { getFeatureRobotsMeta } from "@/lib/feature-seo";

export const Route = createFileRoute("/sell")({
  
  head: () => ({
    meta: [
      {
        title: brandPageTitle("Become a Business Partner"),
      },
      {
        name: "description",
        content: `Discover how your shop, brand or business can become a ${BRAND.shortName} Business Partner. Learn about approval, product listings and fulfilment.`,
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
        content: brandPageTitle("Become a Business Partner"),
      },
      {
        property: "og:description",
        content: `Explore the business partnership process at ${BRAND.name}, from approval and product listings to fulfilment options.`,
      },
      {
        property: "og:url",
        content: "https://flejexa-global-mart.tjc-os.workers.dev/sell",
      },
      {
        property: "og:image",
        content: "https://flejexa-global-mart.tjc-os.workers.dev/og-image.png",
      },
      {
        property: "og:image:alt",
        content: `${BRAND.name} — Business Partnerships`,
      },
      {
        name: "twitter:card",
        content: "summary_large_image",
      },
      {
        name: "twitter:title",
        content: brandPageTitle("Become a Business Partner"),
      },
      {
        name: "twitter:description",
        content: `Learn how to become a business partner with ${BRAND.name}.`,
      },
      {
        name: "twitter:image",
        content: "https://flejexa-global-mart.tjc-os.workers.dev/og-image.png",
      },
    ],
    links: [
      {
        rel: "canonical",
        href: "https://flejexa-global-mart.tjc-os.workers.dev/sell",
      },
    ],
  }),
  
  component: Sell,
});

function Sell() {
  const steps = [
    ["Apply", "Submit your business details for review."],
    ["Get approved", `${BRAND.shortName} verifies and approves business accounts.`],
    ["List products", "Each listing is reviewed before going live."],
    ["Choose fulfilment", `Own fulfilment, ${BRAND.shortName} pickup/delivery, ${BRAND.shortName} warehouse or an approved courier.`],
  ];
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <h1 className="text-3xl font-bold">Sell on {BRAND.shortName}</h1>
      <ol className="space-y-2">
        {steps.map(([t, b], i) => (
          <li key={t} className="surface flex gap-3 p-4">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink font-bold text-gold">{i + 1}</span>
            <div><p className="font-semibold">{t}</p><p className="text-sm text-muted-foreground">{b}</p></div>
          </li>
        ))}
      </ol>
      <div className="flex items-center gap-3"><Link to="/account/applications" className="btn btn-primary">Start application</Link><PlannedBadge label="Applications open soon" /></div>
    </div>
  );
}
