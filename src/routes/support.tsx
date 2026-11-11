import { createFileRoute, Link } from "@tanstack/react-router";
import { BRAND, brandPageTitle } from "@/lib/brand";
import { Mail, MessageCircle, ShieldCheck, ArrowLeft } from "lucide-react";
import { getFeatureRobotsMeta } from "@/lib/feature-seo";

export const Route = createFileRoute("/support")({
head: () => ({
meta: [
{ title: brandPageTitle("Contact & Support") },
{
name: "description",
content: `Find contact and support information for ${BRAND.name}.`,
},
  ...getFeatureRobotsMeta("/support"),
],
}),
component: SupportPage,
});

function SupportPage() {
return (
<main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
<Link
to="/"
className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
>
<ArrowLeft className="h-4 w-4" />
Back to shopping
</Link>

  <header className="space-y-3">
    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
      FleJexa GLOBAL MART
    </p>
    <h1 className="font-display text-3xl font-bold">
      Contact & Support
    </h1>
    <p className="leading-7 text-muted-foreground">
      Need help while browsing {BRAND.shortName}? This page will be your starting point
      for marketplace assistance, account questions and general enquiries.
    </p>
  </header>

  <section className="grid gap-4 sm:grid-cols-2">
    <article className="rounded-2xl border p-5">
      <span className="grid h-11 w-11 place-items-center rounded-xl border border-gold/40">
        <MessageCircle className="h-5 w-5 text-gold" />
      </span>
      <h2 className="mt-4 font-semibold">General enquiries</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Support contact channels are being prepared. Please check back
        when the official support service becomes available.
      </p>
      <span className="mt-4 inline-flex rounded-full border px-3 py-1 text-xs font-semibold">
        Support coming soon
      </span>
    </article>

    <article className="rounded-2xl border p-5">
      <span className="grid h-11 w-11 place-items-center rounded-xl border border-gold/40">
        <Mail className="h-5 w-5 text-gold" />
      </span>
      <h2 className="mt-4 font-semibold">Email support</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        An official customer support email address will be displayed here
        once it has been confirmed for public use.
      </p>
      <span className="mt-4 inline-flex rounded-full border px-3 py-1 text-xs font-semibold">
        Contact details pending
      </span>
    </article>
  </section>

  <section className="rounded-2xl border border-gold/30 bg-gold-soft p-5">
    <div className="flex items-start gap-3">
      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
      <div>
        <h2 className="font-semibold">Account and policy information</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          You can review the policies relevant to using {BRAND.shortName} or open the
          account access page if you want to register or sign in.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link to="/policies" className="btn btn-outline">
            View policies
          </Link>
          <Link to="/sign-in" className="btn btn-gold">
            Sign in or create account
          </Link>
        </div>
      </div>
    </div>
  </section>

  <p className="border-t pt-4 text-xs leading-5 text-muted-foreground">
    {BRAND.name} is still being developed. This page does not claim
    that a live support team or contact channel is available yet.
  </p>
</main>

);
        }
