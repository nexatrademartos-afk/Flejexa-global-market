import { useEffect, useId, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { FINANCE_GROUPS, FINANCE_MODULES, type FinanceModuleId } from "@/lib/finance-command";
import { FinanceModulePage, RealMoneySafetyNotice } from "./FinanceModules";

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

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-3xl border border-gold/40 bg-ink p-5 text-ink-foreground shadow-[0_8px_30px_rgba(0,0,0,0.16)] md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">NEXA · Finance Command Centre</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold md:text-3xl">Welcome back, {name.trim().split(/\s+/)[0] || "team"}</h1>
            <p className="mt-2 text-sm text-ink-foreground/75">
              Finance ID <span className="break-all font-semibold text-gold">{accountCode ?? "Unavailable"}</span>
            </p>
            <p className="mt-1 text-xs text-ink-foreground/65">
              Access: {[isCeo && "CEO authority", isFinance && "Finance"].filter(Boolean).join(" · ") || "Verified Finance access"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isCeo && (
              <Link
                to="/workspace/$role"
                params={{ role: "ceo" }}
                className="btn btn-outline min-h-10 border-white/20 text-sm text-ink-foreground hover:bg-white/10"
              >
                CEO dashboard
              </Link>
            )}
            <Link
              to="/account"
              className="btn btn-outline min-h-10 border-white/20 text-sm text-ink-foreground hover:bg-white/10"
            >
              Customer Dashboard
            </Link>
          </div>
        </div>
      </header>

      <RealMoneySafetyNotice />

      <div className="flex items-center justify-between gap-3 lg:hidden">
        <p className="text-sm font-semibold text-foreground" aria-live="polite">{activeModule.label}</p>
        <button
          type="button"
          onClick={() => setNavOpen((open) => !open)}
          aria-expanded={navOpen}
          aria-controls={navId}
          className="btn btn-outline min-h-10 gap-2 text-sm"
        >
          {navOpen ? <X className="h-4 w-4" aria-hidden="true" /> : <Menu className="h-4 w-4" aria-hidden="true" />}
          {navOpen ? "Close modules" : "Modules"}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <nav
          id={navId}
          aria-label="Finance modules"
          className={`${navOpen ? "block" : "hidden"} rounded-2xl border border-border bg-background p-3 lg:block lg:self-start lg:sticky lg:top-6`}
        >
          {FINANCE_GROUPS.map((group) => (
            <div key={group} className="mb-3 last:mb-0">
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{group}</p>
              <ul className="space-y-1">
                {FINANCE_MODULES.filter((module) => module.group === group).map((module) => {
                  const isActive = module.id === active;
                  return (
                    <li key={module.id}>
                      <button
                        type="button"
                        onClick={() => openModule(module.id)}
                        aria-current={isActive ? "page" : undefined}
                        className={`flex min-h-11 w-full items-center rounded-xl px-3 py-2 text-left text-sm transition ${
                          isActive ? "bg-ink font-semibold text-gold" : "text-foreground hover:bg-muted"
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

        <main className="min-w-0 space-y-6" aria-label={activeModule.label}>
          <FinanceModulePage module={activeModule} />
        </main>
      </div>
    </div>
  );
}
