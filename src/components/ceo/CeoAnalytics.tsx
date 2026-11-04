import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import {
  ANALYTICS_MAX_DAYS,
  asRecord,
  asText,
  callCeoRpc,
  countRows,
  rangeForDays,
  useCeoResource,
  type CeoResult,
  type CountRow,
} from "@/lib/ceo-dashboard";
import { CountTable, EmptyNotice, Notice, Panel, RefreshButton, ResourceNotice } from "./ceo-ui";

const RANGE_OPTIONS = [
  { days: 7, label: "Last 7 days" },
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 90 days" },
  { days: 180, label: "Last 180 days" },
  { days: ANALYTICS_MAX_DAYS, label: "Last 365 days" },
];

interface AnalyticsData {
  dailyOrders: CountRow[];
  dailyRegistrations: CountRow[];
  statusBreakdown: CountRow[];
  categories: CountRow[];
  financialAvailable: boolean | null;
  financialNote: string | null;
}

function parseAnalytics(raw: unknown): AnalyticsData {
  const record = asRecord(raw) ?? {};
  return {
    dailyOrders: countRows(record["daily_orders"]),
    dailyRegistrations: countRows(record["daily_customer_registrations"]),
    statusBreakdown: countRows(record["order_status_breakdown"]),
    categories: countRows(record["product_categories"]),
    financialAvailable: typeof record["financial_reporting_available"] === "boolean" ? (record["financial_reporting_available"] as boolean) : null,
    financialNote: asText(record["financial_reporting_note"]),
  };
}

function AnalyticsBody({ start, end }: { start: string; end: string }) {
  const analytics = useCeoResource(
    async (): Promise<CeoResult<AnalyticsData>> =>
      callCeoRpc(
        () => supabase.rpc("get_ceo_dashboard_analytics", { p_start_date: start, p_end_date: end }),
        parseAnalytics,
      ),
    true,
  );
  const data = analytics.data;

  return (
    <div className="space-y-6">
      <ResourceNotice status={analytics.status} error={analytics.error} onRetry={analytics.reload} />
      {analytics.status === "ready" && data && (
        <>
          <div className="grid gap-6 xl:grid-cols-2">
            <ChartPanel id="ceo-daily-orders" title="Daily orders" rows={data.dailyOrders} emptyText="No orders were recorded in this range." labelHeading="Day" countHeading="Orders" />
            <ChartPanel id="ceo-daily-registrations" title="Customer registrations" rows={data.dailyRegistrations} emptyText="No registrations were recorded in this range." labelHeading="Day" countHeading="Registrations" />
            <ChartPanel id="ceo-status" title="Order status breakdown" rows={data.statusBreakdown} emptyText="No order statuses are reported for this range." labelHeading="Status" countHeading="Orders" />
            <ChartPanel id="ceo-categories" title="Product categories" rows={data.categories} emptyText="No product categories are reported." labelHeading="Category" countHeading="Products" />
          </div>
          <Notice tone={data.financialAvailable === false ? "muted" : "gold"}>
            {data.financialAvailable === false
              ? data.financialNote ?? "Financial reporting isn't available. These charts show activity counts only, not revenue."
              : "These charts show activity counts for the selected range. They are not revenue or financial figures."}
          </Notice>
        </>
      )}
    </div>
  );
}

function ChartPanel({
  id,
  title,
  rows,
  emptyText,
  labelHeading,
  countHeading,
}: {
  id: string;
  title: string;
  rows: CountRow[];
  emptyText: string;
  labelHeading: string;
  countHeading: string;
}) {
  return (
    <Panel id={id} title={title}>
      {rows.length === 0 ? (
        <EmptyNotice>{emptyText}</EmptyNotice>
      ) : (
        <>
          <div className="h-64 w-full" role="img" aria-label={`${title}: ${rows.map((row) => `${row.label} ${row.count}`).join(", ")}`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeOpacity={0.15} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={40} />
                <Tooltip />
                <Bar dataKey="count" name={countHeading} fill="var(--gold)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">View as table</summary>
            <div className="mt-3">
              <CountTable title={title} rows={rows} labelHeading={labelHeading} />
            </div>
          </details>
        </>
      )}
    </Panel>
  );
}

export function CeoAnalytics() {
  const [days, setDays] = useState(30);
  const [refreshKey, setRefreshKey] = useState(0);
  // The range is computed when the user picks it; changing it remounts the query for the new dates.
  const [range, setRange] = useState(() => rangeForDays(30));

  function chooseRange(nextDays: number) {
    setDays(nextDays);
    setRange(rangeForDays(nextDays));
    setRefreshKey((key) => key + 1);
  }

  function refreshRange() {
    setRange(rangeForDays(days));
    setRefreshKey((key) => key + 1);
  }

  return (
    <Panel
      id="ceo-analytics"
      title="Business Analytics"
      description={`Activity for ${range.start} to ${range.end}. Ranges are capped at ${ANALYTICS_MAX_DAYS} days.`}
      actions={
        <>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Range</span>
            <select
              value={days}
              onChange={(event) => chooseRange(Number(event.target.value))}
              className="field min-h-10"
            >
              {RANGE_OPTIONS.map((option) => (
                <option key={option.days} value={option.days}>{option.label}</option>
              ))}
            </select>
          </label>
          <RefreshButton onClick={refreshRange} busy={false} />
        </>
      }
    >
      <AnalyticsBody key={`${range.start}-${range.end}-${refreshKey}`} start={range.start} end={range.end} />
    </Panel>
  );
}

