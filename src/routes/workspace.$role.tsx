
import { useEffect, useMemo, useState } from "react";
import {
  createFileRoute,
  Link,
  notFound,
} from "@tanstack/react-router";
import {
  BadgePercent,
  BrainCircuit,
  Headset,
  Package,
  Search,
  ShoppingBag,
  Tags,
  Truck,
  Users,
  Wallet,
  Warehouse,
  Workflow,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getWorkspace, type WorkspaceKey } from "@/lib/workspaces";
import { PlannedBadge } from "@/components/states";
import { CeoDashboard } from "@/components/ceo/CeoDashboard";
import { AdminPage, type AdminTab } from "@/routes/admin";

type AccessState =
  | { status: "checking" }
  | { status: "signed-out" }
  | { status: "error" }
  | { status: "denied"; roles: WorkspaceKey[] }
  | {
      status: "allowed";
      roles: WorkspaceKey[];
      name: string;
      accountCode: string | null;
      userId: string;
    };

const ROLE_LABELS: Record<WorkspaceKey, string> = {
  customer: "Customer",
  partner: "Business Partner",
  delivery: "Delivery",
  commission: "Commission",
  admin: "Admin",
  ceo: "CEO",
  finance: "Finance",
  security: "Security",
};

const ROLE_CODE_PREFIX: Record<WorkspaceKey, string> = {
  customer: "Cust",
  partner: "BP",
  delivery: "Del",
  commission: "Comm",
  admin: "Adm",
  ceo: "CEO",
  finance: "Fin",
  security: "Sec",
};

function roleDisplayCode(
  accountCode: string | null,
  role: WorkspaceKey,
): string | null {
  if (!accountCode) return null;

  const match = accountCode.match(
    /^NTM-(?:Cust|Customer|Adm|Admin|Comm|Del|BP|CEO|Fin|Finance|Sec|Security)-(.+)$/i,
  );

  return match
    ? `NTM-${ROLE_CODE_PREFIX[role]}-${match[1]}`
    : accountCode;
}

const ADMIN_SERVICES = [
  {
    id: "products",
    name: "Products",
    description: "Listings, pricing, publishing and product details.",
    icon: Package,
    live: true,
    keywords: "product items edit add publish price images feature",
    tab: "products",
  },
  {
    id: "catalogue",
    name: "Catalogue & Categories",
    description: "Organise categories and product collections.",
    icon: Tags,
    live: true,
    keywords: "catalogue catalog categories collections organise",
    tab: "catalogue",
  },
  {
    id: "orders",
    name: "Orders & Returns",
    description: "Customer orders, returns and order issues.",
    icon: ShoppingBag,
    live: true,
    keywords: "orders returns cancellations refunds customers",
    tab: "orders",
  },
  {
    id: "inventory",
    name: "Inventory & Warehouses",
    description: "Stock visibility and warehouse operations.",
    icon: Warehouse,
    live: true,
    keywords: "inventory stock warehouse warehouses applicants",
    tab: "inventory",
  },
  {
    id: "staff",
    name: "Staff & Approvals",
    description: "Eligible staff accounts, applications and access.",
    icon: Users,
    live: true,
    keywords: "staff accounts roles permissions applications approvals suspend",
    tab: "staff",
  },
  {
    id: "suppliers",
    name: "Suppliers & Partners",
    description: "Supplier onboarding and partner relationships.",
    icon: Truck,
    live: true,
    keywords: "suppliers partners businesses onboarding connections",
    tab: "suppliers",
  },
  {
    id: "marketing",
    name: "Marketing & Campaigns",
    description: "Promotions, banners, discounts and campaigns.",
    icon: BadgePercent,
    live: true,
    keywords: "marketing promotions campaigns banners discounts offers",
    tab: "marketing",
  },
  {
    id: "support",
    name: "Support & Policies",
    description: "Customer care, support requests and policies.",
    icon: Headset,
    live: true,
    keywords: "support customer care policies legal help complaints",
    tab: "support",
  },
  {
    id: "finance",
    name: "Finance & Wallets",
    description: "Wallets, commissions and financial oversight.",
    icon: Wallet,
    live: true,
    keywords: "finance wallet wallets money balances commissions transactions",
    tab: "finance",
  },
  {
    id: "intelligence",
    name: "AI & Intelligence",
    description: "Future AI assistance, alerts and operational insights.",
    icon: BrainCircuit,
    live: true,
    keywords: "AI artificial intelligence assistant insights analytics alerts",
    tab: "intelligence",
  },
] as const;

export const Route = createFileRoute("/workspace/$role")({
  validateSearch: (search: Record<string, unknown>): { tab?: string } => ({
    ...(typeof search["tab"] === "string" ? { tab: search["tab"] } : {}),
  }),
  loader: ({ params }) => {
    const workspace = getWorkspace(params.role);

    if (!workspace || workspace.key === "customer") {
      throw notFound();
    }

    return { key: workspace.key };
  },

  head: ({ loaderData }) => {
    const workspace = loaderData && getWorkspace(loaderData.key);

    if (!workspace) {
      return {
        meta: [
          { title: "Workspace not found — NEXA" },
          { name: "robots", content: "noindex" },
        ],
      };
    }

    return {
      meta: [
        { title: `${workspace.name} dashboard — NEXA` },
        { name: "robots", content: "noindex" },
        {
          name: "description",
          content: workspace.description,
        },
      ],
    };
  },

  notFoundComponent: () => (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">Workspace not found</h1>
      <Link to="/account" className="btn btn-primary mt-4">
        Go to my account
      </Link>
    </div>
  ),

  component: WorkspacePage,
});

function WorkspacePage() {
  const workspace = getWorkspace(Route.useLoaderData().key)!;
  const { tab: requestedTab } = Route.useSearch();

  const [access, setAccess] = useState<AccessState>({
    status: "checking",
  });


  useEffect(() => {
    let active = true;

    async function verifyAccess() {
      setAccess({ status: "checking" });

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!active) return;

      if (userError || !user) {
        setAccess({ status: "signed-out" });
        return;
      }

      const [rolesResult, profileResult] = await Promise.all([
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id),

        supabase
          .from("profiles")
          .select("full_name, customer_code")
          .eq("id", user.id)
          .maybeSingle(),
      ]);

      if (!active) return;

      if (rolesResult.error || !rolesResult.data) {
        console.error(
          "Workspace role verification failed:",
          rolesResult.error,
        );
        setAccess({ status: "error" });
        return;
      }

      const assignedRoles = [
        ...new Set(rolesResult.data.map((row) => row.role)),
      ].filter((role): role is WorkspaceKey =>
        Object.prototype.hasOwnProperty.call(ROLE_LABELS, role),
      );

      if (!assignedRoles.includes(workspace.key)) {
        setAccess({
          status: "denied",
          roles: assignedRoles,
        });
        return;
      }

      if (profileResult.error) {
        console.error(
          "Workspace profile lookup failed:",
          profileResult.error,
        );
      }

      const profile = profileResult.data;

      setAccess({
        status: "allowed",
        roles: assignedRoles,
        name:
          profile?.full_name?.trim() ||
          user.user_metadata?.full_name ||
          user.email?.split("@")[0] ||
          "NEXA member",
        accountCode: profile?.customer_code ?? null,
        userId: user.id,
      });
    }

    void verifyAccess();

    return () => {
      active = false;
    };
  }, [workspace.key]);

  return (
    <main
      className={`mx-auto space-y-6 px-4 py-6 md:py-9 ${
        workspace.key === "ceo" ? "max-w-7xl" : "max-w-6xl"
      } ${
        workspace.key === "admin" ? "pb-24 md:pb-9" : ""
      }`}
    >
      {access.status === "checking" && (
        <section className="surface rounded-2xl p-6" role="status">
          Verifying your account and approved workspace…
        </section>
      )}

      {access.status === "signed-out" && (
        <section className="surface rounded-2xl border border-gold/30 p-6">
          <h1 className="text-2xl font-bold">Sign in to continue</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to the account approved for the {workspace.name} workspace.
          </p>
          <Link to="/sign-in" className="btn btn-primary mt-4">
            Sign in
          </Link>
        </section>
      )}

      {access.status === "error" && (
        <section className="surface rounded-2xl border border-red-500/30 p-6">
          <h1 className="text-xl font-bold">
            We couldn't verify your access
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your workspace has not been opened. Refresh and try again. If
            the problem continues, the role lookup or account permissions
            need investigation.
          </p>
          <button
            type="button"
            className="btn btn-outline mt-4"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        </section>
      )}

      {access.status === "denied" && (
        <section className="surface rounded-2xl border border-gold/30 p-6 md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            NEXA · Protected workspace
          </p>

          <>
              <h1 className="mt-2 text-2xl font-bold">
                Your account is not authorised to access this workspace
              </h1>

              <p className="mt-3 text-sm text-muted-foreground">
                Your account does not have the approved role required to
                access the {workspace.name} workspace. Access is granted only
                after the appropriate authorisation.
              </p>

              {access.roles.length > 0 && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Your currently assigned role
                  {access.roles.length === 1 ? " is " : "s are "}
                  <strong className="text-foreground">
                    {access.roles.map((role) => ROLE_LABELS[role]).join(", ")}
                  </strong>.
                </p>
              )}

              <div className="mt-5 flex flex-wrap gap-3">
                {access.roles.map((role) =>
                  role === "customer" ? (
                    <Link
                      key={role}
                      to="/account"
                      className="btn btn-outline"
                    >
                      Open Customer Dashboard
                    </Link>
                  ) : (
                    <a
                      key={role}
                      href={`/workspace/${role}`}
                      className="btn btn-outline"
                    >
                      Open {ROLE_LABELS[role]}
                    </a>
                  ),
                )}

                {workspace.key === "admin" && (
                  <Link to="/account/admin-application" className="btn btn-primary">
                    Apply for Admin Access
                  </Link>
                )}

                <Link to="/account" className="btn btn-outline">
                  Return to Customer Dashboard
                </Link>
              </div>
          </>
        </section>
      )}

      {access.status === "allowed" && (
        <>
          {workspace.key === "admin" ? (
            <AdminDashboard
              name={access.name}
              accountCode={roleDisplayCode(access.accountCode, "admin")}
              requestedTab={requestedTab}
            />
          ) : workspace.key === "ceo" ? (
            <CeoDashboard
              name={access.name}
              accountCode={roleDisplayCode(access.accountCode, "ceo")}
              userId={access.userId}
            />
          ) : (
            <StandardWorkspace
              workspace={workspace}
              access={access}
            />
          )}
        </>
      )}
    </main>
  );
}

function AdminDashboard({
  name,
  accountCode,
  requestedTab,
}: {
  name: string;
  accountCode: string | null;
  requestedTab?: string | undefined;
}) {
  const [search, setSearch] = useState("");
  const validInitialTab = ADMIN_SERVICES.some((service) => service.tab === requestedTab)
    ? (requestedTab as AdminTab)
    : null;
  const [selectedTab, setSelectedTab] = useState<AdminTab | null>(validInitialTab);

  useEffect(() => {
    setSelectedTab(validInitialTab);
  }, [requestedTab]);

  useEffect(() => {
    if (selectedTab) {
      document.getElementById("admin-module")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selectedTab]);

  const firstName = name.trim().split(/\s+/)[0] || "Admin";

  const filteredServices = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return ADMIN_SERVICES;

    return ADMIN_SERVICES.filter((service) =>
      (service.name + " " + service.description + " " + service.keywords)
        .toLowerCase()
        .includes(query),
    );
  }, [search]);

  return (
    <>
      <header
        id="admin-home"
        className="rounded-2xl border border-gold/40 bg-ink px-4 py-4 text-ink-foreground shadow-[0_8px_30px_rgba(0,0,0,0.16)] sm:px-5 sm:py-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold sm:text-2xl">
              Welcome back, {firstName}
            </h1>
            <p className="mt-2 text-xs text-ink-foreground/70">
              Admin ID{" "}
              <span className="break-all font-semibold text-gold">
                {accountCode ?? "Unavailable"}
              </span>
            </p>
          </div>

          <button
            type="button"
            title="Admin Workflow"
            aria-label="Admin Workflow"
            onClick={() => document.getElementById("admin-services")?.scrollIntoView({ behavior: "smooth" })}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-gold/40 bg-gold/10 text-gold transition hover:bg-gold/20"
          >
            <Workflow className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      {!selectedTab && <section id="admin-services" aria-label="Admin services" className="space-y-4">
        <label className="flex min-h-12 items-center gap-3 rounded-xl border border-border bg-background px-4 focus-within:border-gold">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Find the tool you need"
            aria-label="Find the tool you need"
            className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="rounded-md p-1 text-muted-foreground hover:bg-secondary"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </label>

        {filteredServices.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {filteredServices.map((service) => {
              const Icon = service.icon;
              const cardClass =
                "group flex min-h-28 w-full flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card p-4 text-center transition hover:border-gold/70 hover:shadow-[0_4px_20px_rgba(212,175,55,0.08)]";

              return (
                <button
                  key={service.id}
                  type="button"
                  aria-label={`Open ${service.name}`}
                  onClick={() => setSelectedTab(service.tab as AdminTab)}
                  className={cardClass}
                >
                  <span className="grid h-11 w-11 place-items-center rounded-xl border border-gold/25 bg-gold/10 text-gold">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="text-sm font-semibold sm:text-base">
                    {service.name}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="surface rounded-xl border p-6 text-center">
            <Search className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-2 font-semibold">No matching services</p>
            <button
              type="button"
              onClick={() => setSearch("")}
              className="btn btn-outline mt-4"
            >
              Clear search
            </button>
          </div>
        )}
      </section>}

      {selectedTab && (
        <section id="admin-module" className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Administration</p>
              <h2 className="mt-1 text-xl font-bold">{ADMIN_SERVICES.find((service) => service.tab === selectedTab)?.name}</h2>
            </div>
            <button type="button" className="btn btn-outline" onClick={() => setSelectedTab(null)}>Back to overview</button>
          </div>
          <AdminPage requestedTab={selectedTab} embedded onTabChange={(tab) => setSelectedTab(tab)} />
        </section>
      )}

    </>
  );
}

function StandardWorkspace({
  workspace,
  access,
}: {
  workspace: NonNullable<ReturnType<typeof getWorkspace>>;
  access: Extract<AccessState, { status: "allowed" }>;
}) {
  return (
    <>
      <header className="overflow-hidden rounded-3xl border border-gold/40 bg-ink p-6 text-ink-foreground md:p-9">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">
          NEXA · {workspace.short} workspace
        </p>

        <h1 className="mt-3 text-3xl font-bold md:text-4xl">
          Welcome back, {access.name.trim().split(/\s+/)[0]}
        </h1>

        <p className="mt-3 text-sm leading-6 text-ink-foreground/75">
          Hello, {access.name}. You are in your authorised{" "}
          {workspace.name} workspace. Your NEXA account and shared
          platform connection remain the same.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="rounded-xl border border-white/15 px-4 py-3">
            <p className="text-xs text-ink-foreground/65">
              Your {ROLE_LABELS[workspace.key]} ID
            </p>
            <p className="mt-1 font-semibold text-gold">
              {roleDisplayCode(access.accountCode, workspace.key) ??
                "Existing account ID not available"}
            </p>
          </div>

          <div className="rounded-xl border border-white/15 px-4 py-3">
            <p className="text-xs text-ink-foreground/65">
              Verified workspace
            </p>
            <p className="mt-1 font-semibold">
              {ROLE_LABELS[workspace.key]}
            </p>
          </div>
        </div>
      </header>

      <section>
        <h2 className="mb-3 text-xl font-bold">
          Your {workspace.name} workspace
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Your workspace is connected to the same NEXA platform. Modules
          marked Coming soon are not yet operational.
        </p>

        {workspace.modules.length > 0 ? (
          <ul className="grid gap-3 md:grid-cols-2">
            {workspace.modules.map((module) => (
              <li
                key={module.name}
                className="surface flex items-start justify-between gap-3 rounded-xl border p-4"
              >
                <div className="min-w-0">
                  <p className="font-semibold">{module.name}</p>
                  {module.note && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {module.note}
                    </p>
                  )}
                </div>
                <PlannedBadge label="Coming soon" />
              </li>
            ))}
          </ul>
        ) : (
          <div className="surface rounded-xl border p-5">
            <p className="font-semibold">Workspace ready</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Your authorised workspace is open.
            </p>
          </div>
        )}
      </section>

      <section className="surface rounded-2xl border p-5">
        <h2 className="font-bold">Switch workspace</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Move to another workspace assigned to this same account without
          signing out.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          {access.roles.map((role) =>
            role === workspace.key ? null : role === "customer" ? (
              <Link
                key={role}
                to="/account"
                className="btn btn-outline"
              >
                Open Customer
              </Link>
            ) : (
              <a
                key={role}
                href={`/workspace/${role}`}
                className="btn btn-outline"
              >
                Open {ROLE_LABELS[role]}
              </a>
            ),
          )}

          <a href="/shop" className="btn btn-outline">
            Browse marketplace
          </a>
        </div>
      </section>
    </>
  );
}
