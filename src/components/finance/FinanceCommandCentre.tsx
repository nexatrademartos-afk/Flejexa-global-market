import { useEffect, useId, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { FINANCE_GROUPS, FINANCE_MODULES, type FinanceModuleId } from "@/lib/finance-command";
import { FinanceModulePage, RealMoneySafetyNotice } from "./FinanceModules";

const HEADER_LINK =
  "inline-flex min-h-10 items-center rounded-lg border border-white/25 px-3 text-sm font-semibold text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]";

/** Corporate Finance workspace: persistent navigation on desktop, a drawer on mobile, one module open at a time. */
export function FinanceCommandCentre({
  name,
  accountCode,
  roles,
}: {
  name: string;
  accountCode: string | null;
  roles: readonly string[];
}) {
  const [active, setActive] = useState<FinanceModuleId>("overview");
  const [navOpen, setNavOpen] = useState(false);
  const navId = useId();
  const isCeo = roles.includes("ceo");
  const isFinance = roles.includes("finance");
  const activeModule = FINANCE_MODULES.find((module) => module.id === active) ?? FINANCE_MODULES[0];

  useEffect(() => {
    if (!navOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [navOpen]);

  if (!activeModule) return null;

  function openModule(id: FinanceModuleId) {
    setActive(id);
    setNavOpen(false);
  }

  const accessLabel = [isCeo && "CEO authority", isFinance && "Finance team"].filter(Boolean).join(" · ") || "Verified Finance access";

  return (
    <div className="overflow-hidden rounded-3xl bg-[#F5F7FA] text-[#101C2D] shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 bg-[#101C2D] px-4 py-4 text-white md:px-6">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D8B95A]">NEXA Global Mart · Finance</p>
          <p className="truncate text-sm font-semibold">
            {name.trim() || "Finance team"}
            <span className="font-normal text-white/70"> · Finance ID {accountCode ?? "Unavailable"}</span>
          </p>
          <p className="text-xs text-white/70">Access: {accessLabel}. The backend checks your role on every action.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isCeo && (
            <Link to="/workspace/$role" params={{ role: "ceo" }} className={HEADER_LINK}>
              CEO dashboard
            </Link>
          )}
          <details className="relative">
            <summary className={`${HEADER_LINK} cursor-pointer list-none`}>Account</summary>
            <div className="absolute right-0 z-30 mt-2 w-56 rounded-xl bg-white p-2 text-[#101C2D] shadow-xl">
              <Link to="/account" className="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-[#F5F7FA]">
                Customer dashboard
              </Link>
            </div>
          </details>
        </div>
      </header>

      <div className="lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
        {navOpen && (
          <button
            type="button"
            aria-label="Close module menu"
            onClick={() => setNavOpen(false)}
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          />
        )}

        <nav
          id={navId}
          aria-label="Finance modules"
          className={`fixed inset-y-0 left-0 z-50 w-[85vw] max-w-72 overflow-y-auto bg-[#101C2D] p-4 text-white shadow-2xl transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:max-h-screen lg:w-auto lg:max-w-none lg:translate-x-0 lg:visible lg:shadow-none ${
            navOpen ? "visible translate-x-0" : "invisible -translate-x-full"
          }`}
        >
          <div className="mb-3 flex items-center justify-between lg:hidden">
            <p className="text-sm font-semibold">Finance modules</p>
            <button type="button" onClick={() => setNavOpen(false)} className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-sm hover:bg-white/10">
              <X className="h-4 w-4" aria-hidden="true" />
              Close
            </button>
          </div>
          {FINANCE_GROUPS.map((group) => (
            <div key={group} className="mb-4 last:mb-0">
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#D8B95A]">{group}</p>
              <ul className="space-y-1">
                {FINANCE_MODULES.filter((module) => module.group === group).map((module) => {
                  const isActive = module.id === active;
                  return (
                    <li key={module.id}>
                      <button
                        type="button"
                        onClick={() => openModule(module.id)}
                        aria-current={isActive ? "page" : undefined}
                        className={`flex min-h-11 w-full items-center rounded-lg px-3 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227] ${
                          isActive ? "bg-[#C9A227] font-semibold text-[#101C2D]" : "text-white/85 hover:bg-white/10"
                        }`}
                      >
                        {module.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <main className="min-w-0 space-y-6 p-4 md:p-6">
          <div className="flex items-center justify-between gap-3 lg:hidden">
            <p className="min-w-0 truncate text-sm font-semibold" aria-live="polite">
              {activeModule.label}
            </p>
            <button
              type="button"
              onClick={() => setNavOpen((open) => !open)}
              aria-expanded={navOpen}
              aria-controls={navId}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#1B2B40] bg-white px-3 text-sm font-semibold text-[#1B2B40]"
            >
              <Menu className="h-4 w-4" aria-hidden="true" />
              Modules
            </button>
          </div>
          <nav aria-label="Breadcrumb" className="text-xs text-[#5B6B80]">
            Finance / {activeModule.group} / {activeModule.label}
          </nav>
          <RealMoneySafetyNotice />
          <FinanceModulePage module={activeModule} />
        </main>
      </div>
    </div>
  );
}
