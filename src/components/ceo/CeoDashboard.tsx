import { useEffect, useId, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  BarChart3,
  BrainCircuit,
  Boxes,
  ClipboardCheck,
  Handshake,
  Headset,
  History,
  LayoutDashboard,
  Menu,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  callCeoRpc,
  parsePeople,
  parseRoleApplications,
  useCeoResource,
  type CeoResult,
  type DirectoryPerson,
  type RoleApplication,
} from "@/lib/ceo-dashboard";
import { CeoOverview } from "./CeoOverview";
import { CeoAnalytics } from "./CeoAnalytics";
import { CeoOperations } from "./CeoOperations";
import { CeoPeople } from "./CeoPeople";
import { CeoApplications } from "./CeoApplications";
import { CeoRolesAccess } from "./CeoRolesAccess";
import { CeoPolicies } from "./CeoPolicies";
import { CeoFinance } from "./CeoFinance";
import { CeoIntelligence } from "./CeoIntelligence";
import { CeoCustomerExperience } from "./CeoCustomerExperience";
import { CeoExpansion } from "./CeoExpansion";
import { CeoAudit } from "./CeoAudit";
import { CeoSettings } from "./CeoSettings";

export const CEO_SECTIONS = [
  { id: "overview", label: "Executive Overview", icon: LayoutDashboard },
  { id: "analytics", label: "Business Analytics", icon: BarChart3 },
  { id: "operations", label: "Business Operations", icon: Boxes },
  { id: "people", label: "People & Workforce", icon: Users },
  { id: "applications", label: "Applications & Approvals", icon: ClipboardCheck },
  { id: "access", label: "Roles, Access & Security", icon: ShieldCheck },
  { id: "policies", label: "Policies & Compliance", icon: ScrollText },
  { id: "finance", label: "Finance & Wallet Oversight", icon: Wallet },
  { id: "intelligence", label: "AI Executive Intelligence", icon: BrainCircuit },
  { id: "customer", label: "Customer Experience", icon: Headset },
  { id: "partners", label: "Partners & Expansion", icon: Handshake },
  { id: "audit", label: "Executive Activity & Audit", icon: History },
  { id: "settings", label: "CEO Settings", icon: Settings },
] as const;

export type CeoSectionId = (typeof CEO_SECTIONS)[number]["id"];

async function loadRoleApplications(): Promise<CeoResult<RoleApplication[]>> {
  return callCeoRpc(() => supabase.rpc("get_ceo_role_applications"), parseRoleApplications);
}

async function loadPeople(): Promise<CeoResult<DirectoryPerson[]>> {
  return callCeoRpc(() => supabase.rpc("get_ceo_people_directory", { p_limit: 100 }), parsePeople);
}

export function CeoDashboard({
  name,
  accountCode,
  userId,
}: {
  name: string;
  accountCode: string | null;
  userId: string;
}) {
  const [active, setActive] = useState<CeoSectionId>("overview");
  const [visited, setVisited] = useState<Partial<Record<CeoSectionId, boolean>>>({ overview: true });
  const [navOpen, setNavOpen] = useState(false);
  const navId = useId();

  // Shared records are loaded once, when a section that needs them is first opened.
  const needsApplications = Boolean(visited.applications || visited.policies || visited.partners);
  const needsPeople = Boolean(visited.people || visited.access || visited.partners || visited.policies);
  const roleApplications = useCeoResource(loadRoleApplications, needsApplications);
  const people = useCeoResource(loadPeople, needsPeople);

  useEffect(() => {
    if (!navOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [navOpen]);

  function openSection(id: CeoSectionId) {
    setActive(id);
    setVisited((previous) => ({ ...previous, [id]: true }));
    setNavOpen(false);
  }

  const activeSection = CEO_SECTIONS.find((section) => section.id === active) ?? CEO_SECTIONS[0];
  const isVisited = (id: CeoSectionId) => Boolean(visited[id]);

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-3xl border border-gold/40 bg-ink p-5 text-ink-foreground shadow-[0_8px_30px_rgba(0,0,0,0.16)] md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">NEXA · Executive workspace</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold md:text-3xl">Welcome back, {name.trim().split(/\s+/)[0] || "CEO"}</h1>
            <p className="mt-2 text-sm text-ink-foreground/75">
              CEO ID <span className="break-all font-semibold text-gold">{accountCode ?? "Unavailable"}</span>
            </p>
          </div>
          <Link to="/account" className="btn btn-outline min-h-10 border-white/20 text-sm text-ink-foreground hover:bg-white/10">
            Customer Dashboard
          </Link>
          <Link
            to="/workspace/$role"
            params={{ role: "finance" }}
            className="btn btn-primary min-h-10 text-sm"
            data-testid="ceo-finance-command-link"
          >
            Finance Command Centre
          </Link>
        </div>
      </header>

      <div className="flex items-center justify-between gap-3 lg:hidden">
        <p className="text-sm font-semibold text-foreground" aria-live="polite">{activeSection.label}</p>
        <button
          type="button"
          onClick={() => setNavOpen((open) => !open)}
          aria-expanded={navOpen}
          aria-controls={navId}
          className="btn btn-outline min-h-10 gap-2 text-sm"
        >
          {navOpen ? <X className="h-4 w-4" aria-hidden="true" /> : <Menu className="h-4 w-4" aria-hidden="true" />}
          {navOpen ? "Close sections" : "Sections"}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
        <nav
          id={navId}
          aria-label="CEO sections"
          className={`${navOpen ? "block" : "hidden"} rounded-2xl border border-border bg-background p-2 lg:block lg:self-start lg:sticky lg:top-6`}
        >
          <ul className="space-y-1">
            {CEO_SECTIONS.map((section) => {
              const Icon = section.icon;
              const isActive = section.id === active;
              return (
                <li key={section.id}>
                  <button
                    type="button"
                    onClick={() => openSection(section.id)}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${
                      isActive ? "bg-ink font-semibold text-gold" : "text-foreground hover:bg-muted"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden={true} />
                    <span>{section.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-2 border-t border-border pt-2">
            <Link
              to="/workspace/$role"
              params={{ role: "finance" }}
              className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-foreground transition hover:bg-muted"
            >
              <Wallet className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Finance Command Centre</span>
            </Link>
          </div>
        </nav>

        <main className="min-w-0 space-y-6" aria-label={activeSection.label}>
          <div hidden={active !== "overview"}>{isVisited("overview") && <CeoOverview />}</div>
          <div hidden={active !== "analytics"}>{isVisited("analytics") && <CeoAnalytics />}</div>
          <div hidden={active !== "operations"}>{isVisited("operations") && <CeoOperations />}</div>
          <div hidden={active !== "people"}>{isVisited("people") && <CeoPeople />}</div>
          <div hidden={active !== "applications"}>
            {isVisited("applications") && <CeoApplications roleApplications={roleApplications} userId={userId} />}
          </div>
          <div hidden={active !== "access"}>
            {isVisited("access") && <CeoRolesAccess people={people} userId={userId} />}
          </div>
          <div hidden={active !== "policies"}>
            {isVisited("policies") && <CeoPolicies roleApplications={roleApplications} people={people} />}
          </div>
          <div hidden={active !== "finance"}>{isVisited("finance") && <CeoFinance />}</div>
          <div hidden={active !== "intelligence"}>{isVisited("intelligence") && <CeoIntelligence />}</div>
          <div hidden={active !== "customer"}>{isVisited("customer") && <CeoCustomerExperience />}</div>
          <div hidden={active !== "partners"}>
            {isVisited("partners") && <CeoExpansion roleApplications={roleApplications} people={people} />}
          </div>
          <div hidden={active !== "audit"}>{isVisited("audit") && <CeoAudit />}</div>
          <div hidden={active !== "settings"}>{isVisited("settings") && <CeoSettings />}</div>
        </main>
      </div>
    </div>
  );
}
