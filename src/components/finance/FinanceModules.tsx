import type { ReactNode } from "react";
import { FINANCE_REAL_MONEY_DISABLED, type FinanceModule, type FinanceModuleId } from "@/lib/finance-command";
import { FinanceReadPanel } from "./FinanceResultView";
import { FinanceActionForm } from "./FinanceActionForm";
import { ExpenseReceipts } from "./ExpenseReceipts";
import { ApprovalCentre } from "./ApprovalCentre";
import { ActionCard, AwaitingCard, FinCard, Notice, requireSpec } from "./FinanceCards";

export function RealMoneySafetyNotice() {
  return (
    <Notice tone="warning">
      <p className="font-semibold">Real-money operations are disabled.</p>
      <p className="mt-1">
        {FINANCE_REAL_MONEY_DISABLED.join(", ")}. Finance records and approvals never move money on their own. Each will stay disabled until a separately approved backend flow exists.
      </p>
    </Notice>
  );
}

const KPI_NAMES = [
  "Verified cash position",
  "Posted revenue",
  "Settled payments",
  "Open refunds",
  "Pending approvals",
  "Unreconciled wallet entries",
  "Open payables",
  "Stock reconciliation exceptions",
];

function Overview() {
  return (
    <div className="space-y-6">
      <FinCard
        title="Key figures"
        description="These figures appear only when Finance Core returns them in a verified field. Until then they show as awaiting."
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {KPI_NAMES.map((name) => (
            <div key={name} className="rounded-xl border border-dashed border-[#C5CEDA] bg-[#F5F7FA] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#5B6B80]">{name}</p>
              <p className="mt-2 text-sm text-[#5B6B80]">Awaiting verified field</p>
            </div>
          ))}
        </div>
      </FinCard>
      <FinCard title="Executive overview" description="Response from the overview action.">
        <FinanceReadPanel action="get_overview" emptyText="Finance Core returned no overview fields." />
      </FinCard>
      <FinCard title="Work queues" description="Items waiting for Finance attention.">
        <FinanceReadPanel action="get_finance_work_queues" emptyText="Finance Core reports nothing waiting." />
      </FinCard>
      <Notice tone="info">
        <p className="font-semibold">Record states</p>
        <p className="mt-1">
          Draft, pending, submitted, approved, posted, rejected, unverified, exception and blocked. A state is shown only as the backend reports it.
        </p>
      </Notice>
    </div>
  );
}

const PAGES: Record<FinanceModuleId, () => ReactNode> = {
  overview: () => <Overview />,
  journals: () => (
    <div className="space-y-6">
      <AwaitingCard
        title="Draft journal with lines"
        note="Creating a journal needs its line structure confirmed before a form is built."
        actions={["create_draft_journal"]}
      />
      <ActionCard action="post_journal" />
      <ActionCard action="create_reversal_draft" />
      <AwaitingCard title="Journal list" note="A read contract for journal entries has not been supplied." />
    </div>
  ),
  "trial-balance": () => (
    <FinCard title="Trial balance" description="Choose a period. Finance Core returns the figures.">
      <FinanceActionForm spec={requireSpec("get_trial_balance")} />
    </FinCard>
  ),
  reports: () => (
    <FinCard title="Management report" description="Choose a period. Finance Core returns the report.">
      <FinanceActionForm spec={requireSpec("get_management_report")} />
    </FinCard>
  ),
  orders: () => (
    <div className="space-y-6">
      <Notice tone="info">Order intake is not revenue. Revenue is recognised only by the backend's own rules.</Notice>
      <FinCard title="Order intake" description="Orders as Finance Core reports them.">
        <FinanceReadPanel action="get_order_intake" emptyText="Finance Core returned no orders." />
      </FinCard>
    </div>
  ),
  "provider-events": () => (
    <div className="space-y-6">
      <ActionCard action="stage_unverified_provider_event" />
    </div>
  ),
  settlements: () => (
    <div className="space-y-6">
      <ActionCard action="reconcile_settlement_batch" />
      <AwaitingCard
        title="Import settlement batch"
        note="Importing needs the item structure confirmed. An imported batch is not proof of payment."
        actions={["import_settlement_batch"]}
      />
    </div>
  ),
  "wallet-reconciliation": () => (
    <div className="space-y-6">
      <ActionCard action="link_wallet_entries_pending" />
    </div>
  ),
  refunds: () => (
    <div className="space-y-6">
      <ActionCard action="request_refund" />
      <Notice tone="info">Refund decisions are made in the Approval Centre. Approval does not move money.</Notice>
    </div>
  ),
  expenses: () => (
    <div className="space-y-6">
      <ActionCard action="create_expense" />
      <ActionCard action="submit_expense" />
      <FinCard title="Receipts" description="Private receipt files attached to an expense.">
        <ExpenseReceipts />
      </FinCard>
      <AwaitingCard title="Expense list" note="A read contract for listing expenses has not been supplied." />
    </div>
  ),
  suppliers: () => (
    <div className="space-y-6">
      <ActionCard action="create_supplier" />
      <ActionCard action="register_product" />
      <ActionCard action="set_product_cost" description="Each landed-cost component is stored separately. Amounts are stored as integer cents." />
      <AwaitingCard title="Supplier and product cost lists" note="Read contracts for suppliers and cost history have not been supplied." />
    </div>
  ),
  "purchase-orders": () => (
    <div className="space-y-6">
      <AwaitingCard
        title="Create purchase order"
        note="Creating a purchase order needs its line structure confirmed. Approvals are in the Approval Centre."
        actions={["create_purchase_order"]}
      />
      <AwaitingCard title="Purchase order list" note="A read contract for purchase orders has not been supplied." />
    </div>
  ),
  inventory: () => (
    <div className="space-y-6">
      <ActionCard action="receive_purchase_order_line" />
      <AwaitingCard title="Inventory lots" note="A read contract for inventory lots has not been supplied." />
    </div>
  ),
  "stock-reconciliation": () => (
    <div className="space-y-6">
      <ActionCard action="open_inventory_reconciliation" />
      <ActionCard action="apply_inventory_stock_sync" />
      <Notice tone="info">Reconciliation decisions are made in the Approval Centre.</Notice>
    </div>
  ),
  commissions: () => (
    <div className="space-y-6">
      <ActionCard action="create_commission_rule" />
      <ActionCard action="accrue_commission" />
      <Notice tone="info">An accrual is not a payment. Rule and accrual decisions are in the Approval Centre.</Notice>
    </div>
  ),
  approvals: () => <ApprovalCentre />,
  payables: () => (
    <div className="space-y-6">
      <ActionCard action="create_payable" />
      <ActionCard action="submit_payable" />
      <Notice tone="warning">Approving a payable does not pay it. Payments are disabled.</Notice>
    </div>
  ),
  payroll: () => (
    <div className="space-y-6">
      <Notice tone="warning">Payroll payments are disabled. Submitting or approving a run pays no one.</Notice>
      <ActionCard action="submit_payroll_run" />
      <AwaitingCard
        title="Create payroll run"
        note="Creating a payroll run needs its line structure confirmed before a form is built."
        actions={["create_payroll_run"]}
      />
    </div>
  ),
  tax: () => (
    <div className="space-y-6">
      <ActionCard action="create_tax_configuration" />
      <ActionCard action="submit_tax_configuration" />
      <Notice tone="info">No default tax rates are inserted. Each configuration is a versioned draft until approved.</Notice>
    </div>
  ),
  "work-queues": () => (
    <FinCard title="Work queues" description="Items waiting for Finance attention.">
      <FinanceReadPanel action="get_finance_work_queues" emptyText="Finance Core reports nothing waiting." />
    </FinCard>
  ),
  controls: () => (
    <div className="space-y-6">
      <FinCard title="Control snapshot" description="The control snapshot Finance Core returns.">
        <FinanceReadPanel action="get_control_snapshot" emptyText="Finance Core returned no control fields." />
      </FinCard>
      <AwaitingCard title="Audit history" note="A read contract for audit history has not been supplied." />
    </div>
  ),
};

export function FinanceModulePage({ module }: { module: FinanceModule }) {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#8A6D12]">{module.group}</p>
        <h2 className="text-2xl font-semibold text-[#101C2D]">{module.label}</h2>
        <p className="text-sm text-[#5B6B80]">{module.description}</p>
      </header>
      {PAGES[module.id]()}
    </div>
  );
}
