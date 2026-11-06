import type { ReactNode } from "react";
import { Notice, Panel, Metric } from "@/components/ceo/ceo-ui";
import { FINANCE_REAL_MONEY_DISABLED, type FinanceModule } from "@/lib/finance-command";

const AWAITING = "Awaiting contract";
const AWAITING_NOTE = "Shown only from verified Finance Core data.";

const OVERVIEW_CARDS: { label: string; note: string }[] = [
  { label: "Finance control snapshot", note: "Checks reported by the Finance Core." },
  { label: "Accounting status", note: "Posted figures are separate from drafts." },
  { label: "Order intake & payments", note: "Payment states as returned by the backend." },
  { label: "Expense workflow", note: "Draft, submitted and decided expenses." },
  { label: "Procurement & inventory", note: "Purchase orders and stock reconciliations." },
  { label: "Pending approvals", note: "Requests awaiting a separate approver." },
  { label: "Settlement reconciliation", note: "Batches and exceptions. Not proof of payment." },
  { label: "Payables & payroll", note: "Submitted and approved items. Not paid." },
  { label: "Tax configuration", note: "Versioned configurations awaiting approval." },
  { label: "Finance work queues", note: "Items waiting for Finance attention." },
];

const RECORD_STATES: { label: string; meaning: string }[] = [
  { label: "Posted", meaning: "Final accounting record" },
  { label: "Pending", meaning: "Waiting on a payment, approval or match" },
  { label: "Draft", meaning: "Not yet submitted or posted" },
  { label: "Unverified", meaning: "Provider event not yet verified" },
  { label: "Exception", meaning: "Reconciliation difference needing review" },
  { label: "Not configured", meaning: "Setup needed before figures can appear" },
];

export function RealMoneySafetyNotice() {
  return (
    <Notice tone="muted">
      <strong className="font-semibold">Real-money operations are disabled.</strong> Approving a record does not move money.
      Disabled: {FINANCE_REAL_MONEY_DISABLED.join(", ")}.
    </Notice>
  );
}

function AwaitingBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-gold/50 bg-gold-soft px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent-foreground">
      {AWAITING}
    </span>
  );
}

function OverviewPage() {
  return (
    <>
      <Panel id="finance-overview-status" title="Executive overview" description="Figures appear here only after verified Finance Core data is connected.">
        <Notice tone="gold">
          <strong className="font-semibold">Awaiting the verified Finance Core contract.</strong> No balances, revenue or totals are shown until
          the backend supplies them. Orders that are unpaid, awaiting EFT or pending cash are never counted as revenue.
        </Notice>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {OVERVIEW_CARDS.map((card) => (
            <Metric key={card.label} label={card.label} value={AWAITING} note={`${card.note} ${AWAITING_NOTE}`} />
          ))}
        </div>
      </Panel>
      <Panel id="finance-record-states" title="How records are labelled" description="Each figure will carry one of these states so drafts, pending items and posted results are never mixed.">
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {RECORD_STATES.map((state) => (
            <li key={state.label} className="flex items-start gap-3 rounded-xl border border-border bg-background p-3">
              <span className="font-semibold text-foreground">{state.label}</span>
              <span className="text-sm text-muted-foreground">{state.meaning}</span>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel id="finance-safety" title="Real-money safety" description="These operations are not available in this Finance Command Centre.">
        <RealMoneySafetyNotice />
      </Panel>
    </>
  );
}

function ModuleShell({ module, children }: { module: FinanceModule; children?: ReactNode }) {
  return (
    <Panel
      id={`finance-${module.id}`}
      title={module.label}
      description={module.description}
      actions={<AwaitingBadge />}
    >
      <Notice tone="gold">
        <strong className="font-semibold">Awaiting the verified Finance Core contract.</strong> This screen is a shell. It has no
        records, forms or figures until the backend contract for it is supplied and verified.
      </Notice>
      {children}
    </Panel>
  );
}

export function FinanceModulePage({ module }: { module: FinanceModule }) {
  if (module.id === "overview") return <OverviewPage />;
  if (module.id === "payroll" || module.id === "refunds" || module.id === "payables") {
    return (
      <ModuleShell module={module}>
        <RealMoneySafetyNotice />
      </ModuleShell>
    );
  }
  return <ModuleShell module={module} />;
}
