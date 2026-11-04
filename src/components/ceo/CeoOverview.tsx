import { supabase } from "@/integrations/supabase/client";
import {
  asRecord,
  asText,
  callCeoRpc,
  countRows,
  formatCount,
  numberAt,
  useCeoResource,
  valueAt,
  type CeoResult,
  type JsonRecord,
} from "@/lib/ceo-dashboard";
import { formatRecordDateTime } from "@/lib/admin-application";
import { CountTable, Metric, Notice, Panel, RefreshButton, ResourceNotice } from "./ceo-ui";

const METRICS: { label: string; path: string; note: string }[] = [
  { label: "Customers", path: "customers.total", note: "Registered customer accounts" },
  { label: "Operational staff", path: "staff.total", note: "Accounts with an operational role" },
  { label: "Role assignments", path: "role_assignments.total", note: "Roles currently assigned" },
  { label: "Products", path: "products.total", note: "All catalogue products" },
  { label: "Active products", path: "products.active", note: "Published and active" },
  { label: "Active, out of stock", path: "products.out_of_stock_active", note: "Need restocking" },
  { label: "Orders", path: "orders.total", note: "Order count, not revenue" },
  { label: "Applications", path: "applications.total", note: "All role applications" },
  { label: "Pending applications", path: "applications.pending", note: "Awaiting a decision" },
  { label: "Open support cases", path: "customer_experience.support_cases_open", note: "Not yet closed" },
  { label: "Unread messages", path: "customer_experience.unread_contact_messages", note: "Contact enquiries" },
  { label: "Wallets", path: "wallet_operations.wallet_count", note: "Wallet records, not balances" },
  { label: "Ledger entries", path: "wallet_operations.ledger_entry_count", note: "Recorded ledger lines" },
];

async function loadOverview(): Promise<CeoResult<JsonRecord>> {
  return callCeoRpc(() => supabase.rpc("get_ceo_dashboard_overview"), (raw) => asRecord(raw) ?? {});
}

function qualityLines(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap((item) => (asText(item) ? [asText(item) as string] : []));
  const record = asRecord(value);
  if (!record) return [];
  return Object.entries(record).flatMap(([key, item]) => {
    const text = asText(item);
    return text ? [`${key.replace(/_/g, " ")}: ${text}`] : [];
  });
}

export function CeoOverview() {
  const overview = useCeoResource(loadOverview, true);
  const data = overview.data ?? {};
  const revenueAvailable = valueAt(data, "wallet_operations.revenue_reporting_available");
  const revenueNote = asText(valueAt(data, "wallet_operations.revenue_reporting_note"));
  const quality = qualityLines(valueAt(data, "data_quality"));

  return (
    <div className="space-y-6">
      <Panel
        id="ceo-overview"
        title="Executive Overview"
        description="Live counts from the CEO-only overview. Values appear only when the backend reports them."
        actions={
          <>
            {overview.loadedAt && (
              <p className="text-xs text-muted-foreground">Loaded {formatRecordDateTime(overview.loadedAt)}</p>
            )}
            <RefreshButton onClick={overview.reload} busy={overview.status === "loading"} />
          </>
        }
      >
        <ResourceNotice status={overview.status} error={overview.error} onRetry={overview.reload} />
        {overview.status === "ready" && (
          <>
            {asText(valueAt(data, "generated_at")) && (
              <p className="text-xs text-muted-foreground">
                Backend generated {formatRecordDateTime(asText(valueAt(data, "generated_at")) as string)}
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {METRICS.map((metric) => (
                <Metric
                  key={metric.path}
                  label={metric.label}
                  value={formatCount(numberAt(data, metric.path))}
                  note={metric.note}
                />
              ))}
            </div>
          </>
        )}
      </Panel>

      {overview.status === "ready" && (
        <>
          <div className="grid gap-6 xl:grid-cols-2">
            <CountTable title="Orders by status" labelHeading="Status" rows={countRows(valueAt(data, "orders.by_status"))} />
            <CountTable title="Orders by payment status" labelHeading="Payment status" rows={countRows(valueAt(data, "orders.by_payment_status"))} />
            <CountTable title="Pending applications by role" labelHeading="Requested role" rows={countRows(valueAt(data, "applications.pending_by_role"))} />
            <CountTable title="Wallets by status" labelHeading="Wallet status" rows={countRows(valueAt(data, "wallet_operations.wallets_by_status"))} />
          </div>

          {revenueAvailable === false && (
            <Notice tone="muted">
              <strong className="font-semibold">Revenue reporting is not available.</strong>{" "}
              {revenueNote ?? "Revenue can't be reported until a verified payment settlement source is connected."} Order totals
              are not treated as revenue.
            </Notice>
          )}

          {quality.length > 0 && (
            <Panel id="ceo-data-quality" title="Data quality" description="Notes the backend reports about the source data.">
              <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                {quality.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
