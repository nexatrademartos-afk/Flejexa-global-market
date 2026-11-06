import { APPROVAL_GROUPS, requireSpecForApproval } from "@/lib/finance-forms";
import { FinanceActionForm } from "./FinanceActionForm";
import { FinanceReadPanel } from "./FinanceResultView";
import { FinCard, Notice } from "./FinanceCards";

/** Central approvals: one section per record type, each using its own backend decision action. */
export function ApprovalCentre() {
  return (
    <div className="space-y-6">
      <FinCard title="Pending work from Finance Core" description="What the backend reports as waiting for Finance attention.">
        <FinanceReadPanel action="get_finance_work_queues" emptyText="Finance Core reports nothing waiting." />
      </FinCard>

      <Notice tone="info">
        Approvals are checked by the backend. A requester cannot approve their own work, and an approval never moves money. If Finance Core refuses a decision, its reason is shown on the record.
      </Notice>

      <div className="space-y-3">
        {APPROVAL_GROUPS.map((group) => (
          <details key={group.action} className="group rounded-2xl border border-[#D5DCE6] bg-white shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-base font-semibold text-[#101C2D]">
              <span>{group.label}</span>
              <span className="text-xs font-medium text-[#1B2B40] group-open:hidden">Decide</span>
              <span className="hidden text-xs font-medium text-[#1B2B40] group-open:inline">Close</span>
            </summary>
            <div className="space-y-4 border-t border-[#E3E8EF] px-5 py-4">
              {group.note && <p className="text-sm text-[#5B6B80]">{group.note}</p>}
              <FinanceActionForm spec={requireSpecForApproval(group.action)} />
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
