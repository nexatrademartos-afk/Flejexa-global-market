import type { ReactNode } from "react";
import { FINANCE_FORM_SPECS, type ActionFormSpec } from "@/lib/finance-forms";
import type { FinanceActionName } from "@/lib/finance-core";
import { FinanceActionForm } from "./FinanceActionForm";

export function FinCard({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border border-[#D5DCE6] bg-white p-5 shadow-sm">
      <header className="space-y-1">
        <h3 className="text-base font-semibold text-[#101C2D]">{title}</h3>
        {description && <p className="text-sm text-[#5B6B80]">{description}</p>}
      </header>
      {children}
    </section>
  );
}

/** Returns the verified spec for an action. Throws during development if a page references an unknown action. */
export function requireSpec(action: FinanceActionName): ActionFormSpec {
  const spec = FINANCE_FORM_SPECS[action];
  if (!spec) throw new Error(`No verified form definition for ${action}`);
  return spec;
}

export function ActionCard({ action, title, description }: { action: FinanceActionName; title?: string; description?: string }) {
  const spec = requireSpec(action);
  return (
    <FinCard title={title ?? spec.title} description={description ?? spec.description}>
      <FinanceActionForm spec={spec} />
    </FinCard>
  );
}

/** Honest placeholder for a list or nested-structure form whose contract is not verified yet. */
export function AwaitingCard({ title, note, actions }: { title: string; note: string; actions?: readonly FinanceActionName[] }) {
  return (
    <section className="space-y-2 rounded-2xl border border-dashed border-[#9AA8BA] bg-[#F5F7FA] p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold text-[#101C2D]">{title}</h3>
        <span className="rounded-full bg-[#E3E8EF] px-2.5 py-0.5 text-xs font-semibold text-[#3D4B5F]">Awaiting contract</span>
      </div>
      <p className="text-sm text-[#5B6B80]">{note}</p>
      {actions && actions.length > 0 && (
        <p className="text-xs text-[#5B6B80]">Finance Core action: {actions.join(", ")}. Not called until its payload structure is confirmed.</p>
      )}
    </section>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warning" | "danger"; children: ReactNode }) {
  const styles = {
    info: "border-[#C5D3E4] bg-[#EEF3F9] text-[#1B2B40]",
    warning: "border-[#E0C766] bg-[#FFF9E6] text-[#5A4A10]",
    danger: "border-[#E7B7B7] bg-[#FDF2F2] text-[#8A1F1F]",
  } as const;
  return <div className={`rounded-xl border p-4 text-sm ${styles[tone]}`}>{children}</div>;
}
