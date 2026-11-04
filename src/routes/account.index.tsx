import { BRAND } from "@/lib/brand";
import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Bell,
  CircleHelp,
  Compass,
  Gift,
  Heart,
  MapPin,
  Package,
  Search,
  ShieldCheck,
  ShoppingBag,
  TicketPercent,
  Truck,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchCanonicalCustomerCode } from "@/lib/customer-identity";
import { resolveCustomerCode } from "@/lib/customer-code";
import { PlannedBadge } from "@/components/states";

type CustomerProfile = {
  full_name: string | null;
  customer_code: string | null;
};

export type Service = {
  title: string;
  description?: string;
  to:
    | "/shop"
    | "/account/orders"
    | "/account/cart"
    | "/account/wishlist"
    | "/account/profile"
    | "/account/addresses"
    | "/account/rewards"
    | "/account/notifications"
    | "/account/returns"
    | "/account/settings"
    | "/account/applications"
    | "/account/wallet";
  icon: typeof ShoppingBag;
  available: boolean;
};

export const SERVICES: Service[] = [
  {
    title: "Shop Products",
    description: "Browse live products and catalogue",
    to: "/shop",
    icon: ShoppingBag,
    available: true,
  },
  {
    title: "My Cart",
    description: "View and adjust items in your cart",
    to: "/account/cart",
    icon: ShoppingBag,
    available: true,
  },
  {
    title: "Shopping & Savings",
    description: "Your saved items and wishlist",
    to: "/account/wishlist",
    icon: Heart,
    available: true,
  },
  {
    title: "My Profile",
    description: "Manage personal details and contact info",
    to: "/account/profile",
    icon: UserRound,
    available: true,
  },
  {
    title: "Delivery Addresses",
    description: "Manage saved shipping addresses",
    to: "/account/addresses",
    icon: MapPin,
    available: true,
  },
  {
    title: "Security & Privacy",
    description: "Password reset and account preferences",
    to: "/account/settings",
    icon: ShieldCheck,
    available: true,
  },
  {
    title: "Help & Support",
    description: "Customer service and WhatsApp enquiries",
    to: "/account/returns",
    icon: CircleHelp,
    available: true,
  },
  {
    title: "Role Applications",
    description: "Apply for Partner and Delivery roles",
    to: "/account/applications",
    icon: Compass,
    available: true,
  },
  {
    title: "My Orders",
    description: "Order history and status",
    to: "/account/orders",
    icon: Package,
    available: false,
  },
  {
    title: "Delivery & Tracking",
    description: "Live courier tracking",
    to: "/account/orders",
    icon: Truck,
    available: false,
  },
    {
    title: `${BRAND.shortName} Wallet`,
    description: "Wallet overview, deposits and financial activity",
    to: "/account/wallet",
    icon: Wallet,
    available: true,
  },
  {
    title: "Q Points",
    description: "Earn and redeem loyalty points",
    to: "/account/rewards",
    icon: Gift,
    available: false,
  },
  {
    title: "Coupons",
    description: "Discounts and promotional vouchers",
    to: "/account/rewards",
    icon: TicketPercent,
    available: false,
  },
  {
    title: "Notifications",
    description: "Account alerts and order updates",
    to: "/account/notifications",
    icon: Bell,
    available: false,
  },
];

export const Route = createFileRoute("/account/")({
  head: () => ({
    meta: [
      { title: "My Account — NEXA GLOBAL MART" },
      {
        name: "description",
        content: "Your NEXA customer account and services.",
      },
    ],
  }),
  component: CustomerDashboard,
});

function CustomerDashboard() {
  const [fullName, setFullName] = useState("");
  const [customerCode, setCustomerCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showIdInfo, setShowIdInfo] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();

        if (authError) throw authError;

        const user = authData.user;

        if (!user) {
          if (active) {
            setError("Please sign in again to view your account.");
          }
          return;
        }

        const metadataName =
          typeof user.user_metadata?.full_name === "string"
            ? user.user_metadata.full_name.trim()
            : "";

        const { data, error: profileError } = await supabase
          .from("profiles")
          .select("full_name, customer_code")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) throw profileError;
        if (!active) return;

        const profile = data as CustomerProfile | null;

        setFullName(profile?.full_name?.trim() || metadataName);
        const canonicalCode = await fetchCanonicalCustomerCode();
        if (!active) return;
        setCustomerCode(resolveCustomerCode(canonicalCode, profile?.customer_code));
      } catch {
        if (active) {
          setError("We couldn't load all your account details. Please refresh and try again.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, []);

  const firstName = fullName.trim().split(/\s+/)[0] || "there";

  const filteredServices = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return SERVICES;

    return SERVICES.filter(
      (service) =>
        service.title.toLowerCase().includes(term) ||
        (service.description && service.description.toLowerCase().includes(term)),
    );
  }, [search]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-4 pb-8 sm:space-y-5 sm:py-6">
      <section className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
            {loading ? "Welcome back" : `Welcome back, ${firstName}`}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Your account, all in one place.</p>
        </div>

        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-gold/50 bg-gold-soft"
          aria-label="Signed-in customer"
          title="Signed-in customer"
        >
          <UserRound className="h-5 w-5 text-gold" />
        </span>
      </section>

      <section className="surface rounded-2xl border border-gold/40 px-3 py-3 sm:px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">Your NEXA Customer ID</p>

            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <p className="break-all font-mono text-base font-bold tracking-wide sm:text-lg">
                {loading ? "Loading..." : customerCode || "ID unavailable"}
              </p>

              <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-gold" aria-hidden="true" />
                Signed in
              </span>
            </div>
          </div>

          <button
            type="button"
            aria-label="About your NEXA Customer ID"
            aria-expanded={showIdInfo}
            aria-controls="customer-id-information"
            title="About your ID"
            onClick={() => setShowIdInfo((current) => !current)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-gold/40 text-gold transition-colors hover:bg-gold-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            {showIdInfo ? (
              <X className="h-4 w-4" aria-hidden="true" />
            ) : (
              <CircleHelp className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>

        {showIdInfo && (
          <p
            id="customer-id-information"
            className="mt-3 rounded-xl bg-muted/50 p-3 text-sm leading-5 text-muted-foreground"
          >
            Your NEXA Customer ID identifies your customer account when you contact support. Keep
            your sign-in details private. Your ID is not your password or a payment credential.
          </p>
        )}
      </section>

      {error && (
        <p role="alert" className="rounded-xl border border-red-500/40 p-3 text-sm text-red-500">
          {error}
        </p>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold sm:text-lg">Explore services</h2>
          <span className="text-xs text-muted-foreground">
            {filteredServices.length} {filteredServices.length === 1 ? "service" : "services"}
          </span>
        </div>

        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="field pl-10 pr-10"
            placeholder="Find a service"
            aria-label="Search all account services"
          />

          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:text-foreground"
              aria-label="Clear service search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </label>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filteredServices.map((service, index) => (
            <ServiceCard
              key={service.title}
              service={service}
              featured={index < 4 && !search.trim()}
            />
          ))}
        </div>

        {filteredServices.length === 0 && (
          <div className="surface rounded-xl p-5 text-center">
            <h3 className="font-semibold text-foreground">
              <Link to="/account/secure-access" className="text-foreground no-underline hover:no-underline">
                No matching services
              </Link>
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Try another search term to find a service.
            </p>
            <div className="mt-3 flex items-center justify-center">
              <button
                type="button"
                className="inline-flex items-center gap-1 text-sm font-semibold text-gold hover:underline"
                onClick={() => setSearch("")}
              >
                Clear search
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function ServiceCard({ service, featured = false }: { service: Service; featured?: boolean }) {
  const Icon = service.icon;

  return (
    <Link
      to={service.to}
      className={[
        "group flex min-h-32 min-w-0 flex-col rounded-2xl border p-3 transition-colors",
        "hover:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
        "sm:min-h-36 sm:p-4",
        featured
          ? "border-gold/50 bg-gold-soft"
          : service.available
            ? "surface"
            : "surface border-border",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold/40 bg-background/50">
          <Icon className="h-5 w-5 text-gold" aria-hidden="true" />
        </span>

        {!service.available && <PlannedBadge label="Coming soon" />}
      </div>

      <span className="mt-3 text-sm font-bold leading-5 sm:text-base">{service.title}</span>

      <span className="mt-auto flex items-center gap-1 pt-3 text-xs font-semibold text-muted-foreground transition-colors group-hover:text-gold">
        {service.available ? "Open" : "View"}
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
