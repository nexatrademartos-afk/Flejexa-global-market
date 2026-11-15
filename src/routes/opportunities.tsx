
import { createFileRoute, Link } from "@tanstack/react-router";
import { BRAND, brandPageTitle } from "@/lib/brand";
import { getFeatureRobotsMeta } from "@/lib/feature-seo";

const canonicalUrl =
  "https://flejexa-global-mart.tjc-os.workers.dev/opportunities";

export const Route = createFileRoute("/opportunities")({
  head: () => ({
    meta: [
      {
        title: brandPageTitle("Partner and Delivery Opportunities"),
      },
      {
        name: "description",
        content:
          "Explore FleJexa business partner, delivery partner and commission partner opportunities. Learn about the roles, application review and approval process.",
      },
      ...getFeatureRobotsMeta("/opportunities"),
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
        content: brandPageTitle("Partner and Delivery Opportunities"),
      },
      {
        property: "og:description",
        content:
          "Discover ways to work with FleJexa as a business partner, delivery partner or commission partner.",
      },
      {
        property: "og:url",
        content: canonicalUrl,
      },
    ],
    links: [{ rel: "canonical", href: canonicalUrl }],
  }),
  component: OpportunitiesPage,
});

function OpportunitiesPage() {
  const opportunities = [
    {
      number: "01",
      title: "Business Partner",
      description:
        "For shops, brands and businesses interested in selling products through the FleJexa marketplace.",
      details: [
        "Business profile and verification",
        "Product listing preparation and review",
        "Fulfilment arrangements discussed during onboarding",
      ],
      route: "/sell" as const,
      linkLabel: "Learn about selling",
    },
    {
      number: "02",
      title: "Delivery Partner",
      description:
        "For individuals or delivery businesses interested in supporting marketplace pickups and deliveries.",
      details: [
        "Assigned pickup and drop-off work",
        "Delivery confirmation processes",
        "Access subject to application review and approval",
      ],
      route: null,
      linkLabel: null,
    },
    {
      number: "03",
      title: "Commission Partner",
      description:
        "For people interested in referring customers and participating in a tracked referral programme.",
      details: [
        "Referral links are part of the planned workspace",
        "Attributed sales and commission statements are planned",
        "Participation terms and rates must be confirmed by FleJexa",
      ],
      route: null,
      linkLabel: null,
    },
  ];

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
          Work with FleJexa
        </p>

        <h1 className="text-3xl font-bold sm:text-4xl">
          Explore FleJexa Opportunities
        </h1>

        <p className="max-w-3xl leading-relaxed text-muted-foreground">
          {BRAND.name} is building opportunities for businesses, delivery
          partners and commission partners. Explore the different roles and
          understand the approval process before applying.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        {opportunities.map((item) => (
          <article
            key={item.number}
            className="surface flex flex-col rounded-2xl border p-5"
          >
            <p className="text-xs font-bold tracking-widest text-gold">
              OPPORTUNITY {item.number}
            </p>

            <h2 className="mt-3 text-xl font-bold">{item.title}</h2>

            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {item.description}
            </p>

            <ul className="mt-4 flex-1 space-y-2 text-sm">
              {item.details.map((detail) => (
                <li key={detail} className="flex gap-2">
                  <span className="text-gold">•</span>
                  <span>{detail}</span>
                </li>
              ))}
            </ul>

            {item.route && item.linkLabel && (
              <Link to={item.route} className="btn btn-outline mt-5">
                {item.linkLabel}
              </Link>
            )}
          </article>
        ))}
      </section>

      <section className="surface space-y-4 rounded-2xl border p-5">
        <h2 className="text-xl font-bold">
          How to access role applications
        </h2>

        <p className="text-sm leading-relaxed text-muted-foreground">
          Create a FleJexa customer account or sign in to an existing account.
          Role applications are handled inside the account area. Each
          application is reviewed, and submitting one does not guarantee
          approval or immediate access to a partner workspace.
        </p>

        <div className="flex flex-wrap gap-3">
          <Link to="/sign-up" className="btn btn-primary">
            Create an account
          </Link>

          <Link to="/sign-in" className="btn btn-outline">
            Sign in
          </Link>

          <Link to="/account/applications" className="btn btn-outline">
            Role applications
          </Link>
        </div>
      </section>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Partner, delivery and commission workspace features are being
        developed. Availability, eligibility and operating terms will be
        confirmed by FleJexa during the application process.
      </p>
    </main>
  );
}
