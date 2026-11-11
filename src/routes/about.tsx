import { BRAND, brandPageTitle } from "@/lib/brand";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Globe2,
  HeartHandshake,
  Lightbulb,
  ShoppingBag,
  Store,
  Target,
  Wallet,
  BriefcaseBusiness,
  Handshake,
} from "lucide-react";

export const Route = createFileRoute("/about")({
  
  head: () => ({
    meta: [
      {
        title: brandPageTitle("About Us"),
      },
      {
        name: "description",
        content: `Discover ${BRAND.name}, a South African marketplace built around accessible shopping, business connections, useful products and opportunities.`,
      },
      {
        name: "robots",
        content: "index, follow",
      },
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
        content: brandPageTitle("About Us"),
      },
      {
        property: "og:description",
        content: `${BRAND.name} is a marketplace built around people, inclusive opportunity, useful products and a more connected business future.`,
      },
      {
        property: "og:url",
        content: "https://flejexa-global-mart.tjc-os.workers.dev/about",
      },
      {
        property: "og:image",
        content: "https://flejexa-global-mart.tjc-os.workers.dev/og-image.png",
      },
      {
        property: "og:image:alt",
        content: `${BRAND.name} — Our story, purpose and vision`,
      },
      {
        name: "twitter:card",
        content: "summary_large_image",
      },
      {
        name: "twitter:title",
        content: brandPageTitle("About Us"),
      },
      {
        name: "twitter:description",
        content: `Learn about the story, purpose and vision behind ${BRAND.name}.`,
      },
      {
        name: "twitter:image",
        content: "https://flejexa-global-mart.tjc-os.workers.dev/og-image.png",
      },
    ],
    links: [
      {
        rel: "canonical",
        href: "https://flejexa-global-mart.tjc-os.workers.dev/about",
      },
    ],
  }),
  component: AboutPage,
});

const values = [
  {
    icon: HeartHandshake,
    title: "People first",
    description:
      "We believe shopping and access to useful services should consider the needs of people from different backgrounds and income levels.",
  },
  {
    icon: Target,
    title: "Affordability and value",
    description:
      "We aim to make useful products and services more accessible while keeping value and quality in focus.",
  },
  {
    icon: Lightbulb,
    title: "Innovation",
    description:
      "We are building with a forward-looking mindset, exploring new ways to connect everyday needs with practical opportunities.",
  },
  {
    icon: Handshake,
    title: "Business opportunity",
    description:
      "We want to help shoppers, sellers, suppliers and businesses connect, participate and find opportunities to grow.",
  },
];

function AboutPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="relative overflow-hidden border-b border-gold/30 bg-ink">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-gold">
            Our story · Our purpose · Our vision
          </p>

          <h1 className="mt-4 max-w-4xl text-4xl font-bold leading-tight text-white sm:text-6xl">
            A marketplace built around{" "}
            <span className="text-gold">people and possibility.</span>
          </h1>

          <p className="mt-6 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
            {BRAND.name} is a global e-commerce vision rooted in a simple
            belief: opportunity, useful products and access to services should
            not be reserved for only a particular group of people.
          </p>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
            From everyday shopping to connections between businesses, our
            ambition is to build a marketplace that serves different needs,
            supports participation and makes room for more people to benefit
            from commerce.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/shop" className="btn btn-gold">
              <ShoppingBag className="h-4 w-4" />
              Explore the marketplace
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link to="/sell" className="btn btn-on-ink">
              <Store className="h-4 w-4" />
              Explore selling on FleJexa
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <div className="grid gap-8 md:grid-cols-[1.1fr_0.9fr] md:items-start">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">
              Who we are
            </p>

            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
              More than a place to shop
            </h2>

            <div className="mt-5 space-y-4 text-sm leading-7 text-muted-foreground sm:text-base">
              <p>
                {BRAND.name} is being built to bring shopping, sellers,
                suppliers and business opportunities together in one
                marketplace environment. We want to serve individuals,
                families, everyday shoppers, small businesses, retailers,
                wholesalers and buyers interested in international trade.
              </p>

              <p>
                Our purpose goes beyond listing products. We want to explore
                ways for people and businesses to participate in commerce,
                discover useful services and build connections that can create
                new possibilities.
              </p>

              <p>
                We recognise that people have different needs and budgets.
                Our guiding ambition is to make the marketplace useful to
                people across different income levels, without suggesting
                that a person's worth or potential depends on how much money
                they have.
              </p>
            </div>
          </div>

          <aside className="rounded-3xl border border-gold/30 bg-card p-6 sm:p-8">
            <div className="grid h-12 w-12 place-items-center rounded-2xl border border-gold/40 bg-gold/10">
              <Globe2 className="h-6 w-6 text-gold" />
            </div>

            <h2 className="mt-5 text-2xl font-bold">
              Our vision
            </h2>

            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              To grow {BRAND.name} into a trusted marketplace and service
              ecosystem serving South Africa, expanding across Africa and
              reaching international markets over time.
            </p>

            <div className="my-6 border-t border-border" />

            <h3 className="font-semibold">Our mission</h3>

            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              To respond to people's needs with useful products, value,
              professional service ambitions and opportunities for shoppers,
              sellers, suppliers and businesses to connect and grow.
            </p>
          </aside>
        </div>
      </section>

      <section className="border-y border-gold/20 bg-secondary/30">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">
            What guides us
          </p>

          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
            The values behind our vision
          </h2>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
  These are the principles we want to carry into how {BRAND.name}{" "}
  develops, serves people and builds business relationships.
</p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((value) => {
              const Icon = value.icon;

              return (
                <article
                  key={value.title}
                  className="rounded-2xl border border-border bg-card p-5"
                >
                  <div className="grid h-11 w-11 place-items-center rounded-xl border border-gold/30">
                    <Icon className="h-5 w-5 text-gold" />
                  </div>

                  <h3 className="mt-4 font-semibold">
                    {value.title}
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {value.description}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">
          How we hope to create opportunity
        </p>

        <h2 className="mt-3 max-w-3xl text-3xl font-bold sm:text-4xl">
          Connecting everyday needs with wider possibilities
        </h2>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-border p-5 sm:p-6">
            <ShoppingBag className="h-6 w-6 text-gold" />
            <h3 className="mt-4 text-lg font-semibold">
              Shopping and value
            </h3>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              We aim to bring customers a useful range of products and
              shopping choices, with affordability and value at the heart
              of our marketplace vision.
            </p>
          </article>

          <article className="rounded-2xl border border-border p-5 sm:p-6">
            <Store className="h-6 w-6 text-gold" />
            <h3 className="mt-4 text-lg font-semibold">
              Sellers and businesses
            </h3>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              We want to connect businesses, including smaller businesses
              looking for ways to reach customers, showcase products and
              build relationships through commerce.
            </p>
          </article>

          <article className="rounded-2xl border border-border p-5 sm:p-6">
            <BriefcaseBusiness className="h-6 w-6 text-gold" />
            <h3 className="mt-4 text-lg font-semibold">
              Work and earning opportunities
            </h3>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              Our wider ambition includes exploring opportunities in
              advertising, product promotion, sales commissions, delivery
              and other roles as relevant services become available.
            </p>
          </article>

          <article className="rounded-2xl border border-border p-5 sm:p-6">
            <Wallet className="h-6 w-6 text-gold" />
            <h3 className="mt-4 text-lg font-semibold">
              A broader service ecosystem
            </h3>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              Our future vision includes a proposed {BRAND.shortName} Wallet
              concept for setting money aside for a later purchase, alongside
              additional services we may introduce as the platform grows.
              These ideas are not presented as currently available services.
            </p>
          </article>
        </div>

        <p className="mt-5 text-xs leading-6 text-muted-foreground">
          The opportunities and future services described here express our
          direction and ambitions. Availability, eligibility and terms will
          depend on the services officially introduced.
        </p>
      </section>

      <section className="border-y border-gold/20 bg-secondary/30">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">
                Where we are heading
              </p>

              <h2 className="mt-3 text-3xl font-bold">
                Rooted in South Africa. Looking outward.
              </h2>

              <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
                {BRAND.name} is based on a South African starting point.
                Our ambition is to expand our reach across other African
                countries and, over time, into wider international markets.
                We want to build connections that can help shoppers and
                businesses participate in a more connected marketplace.
              </p>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">
                The people and technology behind {BRAND.shortName}
              </p>

              <h2 className="mt-3 text-3xl font-bold">
                Built with a wider purpose
              </h2>

              <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
                {BRAND.name} was created through the work of Joseph
                Chivandire and Thulani Joseph, with a shared ambition to
                build a marketplace focused on people's needs, business
                connections and opportunity.
              </p>

              <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
                The platform is powered by TJC-OS, an independent underlying
                powering system that, according to our founding story, dates
                back to 2015. TJC-OS is the powering system behind the
                marketplace, not the marketplace brand itself.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-14 text-center sm:py-20">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">
          Our promise of purpose
        </p>

        <h2 className="mt-4 text-3xl font-bold sm:text-5xl">
          Shop More. Save More. Get Rewarded.
        </h2>

        <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
          For us, this slogan represents the ambition to help people find
          value, make considered choices and benefit from the opportunities
          a marketplace can create. Our wider goal is to build a service
          ecosystem where people and businesses can take part, connect and
          grow.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/shop" className="btn btn-gold">
            Explore products
            <ArrowRight className="h-4 w-4" />
          </Link>

          <Link to="/" className="btn btn-outline">
            Return to home
          </Link>
        </div>
      </section>
    </main>
  );
}

