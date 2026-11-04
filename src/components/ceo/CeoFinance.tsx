import { supabase } from "@/integrations/supabase/client";
import { asNumber, asRecord, asText, callCeoRpc, countRows, useCeoResource, valueAt, type CeoResult, type JsonRecord } from "@/lib/ceo-dashboard";
import { CountTable, Metric, Notice, Panel, RefreshButton, ResourceNotice } from "./ceo-ui";

async function loadFinance(): Promise<CeoResult<JsonRecord>> {
  return callCeoRpc(() => supabase.rpc("get_ceo_finance_snapshot"), (raw) => asRecord(raw) ?? {});
}

export function CeoFinance() {
  const finance = useCeoResource(loadFinance, true);
  const data = finance.data ?? {};
  const revenueAvailable = valueAt(data, "revenue_reporting_available") === true;
  const reason = asText(valueAt(data, "reason"));
  const currency = asText(valueAt(data, "currency"));
  const walletCount = asNumber(valueAt(data, "wallet_count"));
  const ledgerCount = asNumber(valueAt(data, "ledger_entry_count"));

  return (
    <div className="space-y-6">
      <Panel
        id="ceo-finance"
        title="Finance & Wallet Oversight"
        description="Record counts for wallets and the ledger. No balances or revenue figures are calculated here."
        actions={<RefreshButton onClick={finance.reload} busy={finance.status === "loading"} />}
      >
        <ResourceNotice status={finance.status} error={finance.error} onRetry={finance.reload} />
        {finance.status === "ready" && (
          <>
            <Notice tone={revenueAvailable ? "gold" : "red"}>
              <strong className="font-semibold">
                {revenueAvailable ? "Revenue reporting is available." : "Revenue reporting is not available yet."}
              </strong>{" "}
              {revenueAvailable
                ? reason ?? "Figures are based on the connected settlement source."
                : reason ?? "Revenue can't be reported until a verified payment-provider settlement and reconciliation source is connected."}
            </Notice>
            <div className="grid gap-3 sm:grid-cols-2">
              <Metric label="Wallet records" value={walletCount === null ? "Not reported" : walletCount.toLocaleString("en-ZA")} note="Count of wallet accounts, not money" />
              <Metric label="Ledger entries" value={ledgerCount === null ? "Not reported" : ledgerCount.toLocaleString("en-ZA")} note="Count of ledger lines, not balances" />
            </div>
            <div className="grid gap-6 xl:grid-cols-3">
              <CountTable title="Wallet statuses" labelHeading="Status" rows={countRows(valueAt(data, "wallet_statuses"))} />
              <CountTable title="Ledger statuses" labelHeading="Status" rows={countRows(valueAt(data, "ledger_statuses"))} />
              <CountTable title="Ledger categories" labelHeading="Category" rows={countRows(valueAt(data, "ledger_categories"))} />
            </div>
            <Notice tone="muted">
              Pending payments aren't settled funds. Order totals aren't revenue. Wallet and ledger counts aren't balances.
              {currency ? ` Currency reported by the backend: ${currency}.` : ""}
            </Notice>
          </>
        )}
      </Panel>
    </div>
  );
}
