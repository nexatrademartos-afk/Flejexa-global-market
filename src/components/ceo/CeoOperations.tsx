import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  asBoolean,
  callCeoRpc,
  firstNumber,
  firstText,
  formatAmount,
  rowsAt,
  useCeoResource,
  type CeoResult,
  type JsonRecord,
} from "@/lib/ceo-dashboard";
import { formatRecordDateTime } from "@/lib/admin-application";
import { Cell, DataTable, EmptyNotice, Notice, Panel, RefreshButton, ResourceNotice, SearchField } from "./ceo-ui";

interface OperationsData {
  orders: JsonRecord[];
  products: JsonRecord[];
  supportCases: JsonRecord[];
}

type OperationsTab = "orders" | "products" | "support";
const TABS: { key: OperationsTab; label: string }[] = [
  { key: "orders", label: "Recent orders" },
  { key: "products", label: "Product catalogue" },
  { key: "support", label: "Support cases" },
];

async function loadOperations(): Promise<CeoResult<OperationsData>> {
  return callCeoRpc(
    () => supabase.rpc("get_ceo_business_operations", { p_limit: 50 }),
    (raw) => ({
      orders: rowsAt(raw, "orders"),
      products: rowsAt(raw, "products"),
      supportCases: rowsAt(raw, "support_cases"),
    }),
  );
}

const NOT_REPORTED = "Not reported";

function matches(row: JsonRecord, needle: string): boolean {
  return !needle || JSON.stringify(row).toLowerCase().includes(needle);
}

export function CeoOperations() {
  const operations = useCeoResource(loadOperations, true);
  const [tab, setTab] = useState<OperationsTab>("orders");
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const data = operations.data;

  return (
    <Panel
      id="ceo-operations"
      title="Business Operations"
      description="The 50 most recent orders, the product catalogue and open support work. Order values are individual amounts, not revenue."
      actions={<RefreshButton onClick={operations.reload} busy={operations.status === "loading"} />}
    >
      <div role="tablist" aria-label="Operations views" className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            onClick={() => setTab(item.key)}
            className={`min-h-10 rounded-full border px-4 text-sm font-semibold ${tab === item.key ? "border-gold bg-ink text-gold" : "border-border text-foreground hover:bg-muted"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <SearchField label="Filter this view" value={query} onChange={setQuery} />
      <ResourceNotice status={operations.status} error={operations.error} onRetry={operations.reload} loadingLabel="Loading operations data…" />

      {data && operations.status === "ready" && tab === "orders" && (
        <>
          <Notice tone="muted">Order values are shown per order and are not summed or treated as recognised revenue.</Notice>
          {data.orders.filter((row) => matches(row, needle)).length === 0 ? (
            <EmptyNotice>No orders match this view.</EmptyNotice>
          ) : (
            <DataTable caption="Recent orders" headers={["Order", "Placed", "Customer", "Order status", "Payment status", "Payment method", "Source", "Order value"]}>
              {data.orders.filter((row) => matches(row, needle)).map((row, index) => {
                const currency = firstText(row, ["currency"]);
                return (
                  <tr key={firstText(row, ["order_number", "reference", "id"]) ?? index}>
                    <Cell className="font-mono text-xs">{firstText(row, ["order_number", "reference", "id"]) ?? NOT_REPORTED}</Cell>
                    <Cell>{formatRecordDateTime(firstText(row, ["created_at", "placed_at"]))}</Cell>
                    <Cell>
                      <span className="block">{firstText(row, ["customer_name", "customer_full_name", "name"]) ?? NOT_REPORTED}</span>
                      <span className="block text-xs text-muted-foreground">{firstText(row, ["customer_email", "email"]) ?? ""}</span>
                      <span className="block text-xs text-muted-foreground">{firstText(row, ["customer_phone", "phone"]) ?? ""}</span>
                    </Cell>
                    <Cell>{firstText(row, ["status", "order_status"]) ?? NOT_REPORTED}</Cell>
                    <Cell>{firstText(row, ["payment_status"]) ?? NOT_REPORTED}</Cell>
                    <Cell>{firstText(row, ["payment_method"]) ?? NOT_REPORTED}</Cell>
                    <Cell>{firstText(row, ["order_source", "source", "channel"]) ?? NOT_REPORTED}</Cell>
                    <Cell className="tabular-nums">{formatAmount(firstNumber(row, ["total", "total_amount", "order_total", "amount"]), currency)}</Cell>
                  </tr>
                );
              })}
            </DataTable>
          )}
        </>
      )}

      {data && operations.status === "ready" && tab === "products" && (
        data.products.filter((row) => matches(row, needle)).length === 0 ? (
          <EmptyNotice>No products match this view.</EmptyNotice>
        ) : (
          <DataTable caption="Product catalogue" headers={["Product", "SKU", "Category", "Listing", "Stock quantity"]}>
            {data.products.filter((row) => matches(row, needle)).map((row, index) => {
              const active = asBoolean(row["is_active"]) ?? asBoolean(row["active"]);
              const stock = firstNumber(row, ["stock_quantity", "stock", "quantity"]);
              return (
                <tr key={firstText(row, ["id", "sku"]) ?? index}>
                  <Cell>{firstText(row, ["name", "title"]) ?? NOT_REPORTED}</Cell>
                  <Cell className="font-mono text-xs">{firstText(row, ["sku"]) ?? NOT_REPORTED}</Cell>
                  <Cell>{firstText(row, ["category", "category_name"]) ?? NOT_REPORTED}</Cell>
                  <Cell>{active === null ? firstText(row, ["status"]) ?? NOT_REPORTED : active ? "Active" : "Inactive"}</Cell>
                  <Cell className="tabular-nums">{stock === null ? NOT_REPORTED : stock.toLocaleString("en-ZA")}</Cell>
                </tr>
              );
            })}
          </DataTable>
        )
      )}

      {data && operations.status === "ready" && tab === "support" && (
        data.supportCases.filter((row) => matches(row, needle)).length === 0 ? (
          <EmptyNotice>No support cases match this view.</EmptyNotice>
        ) : (
          <DataTable caption="Support cases" headers={["Case", "Subject", "Status", "Priority", "Opened"]}>
            {data.supportCases.filter((row) => matches(row, needle)).map((row, index) => (
              <tr key={firstText(row, ["id", "case_number"]) ?? index}>
                <Cell className="font-mono text-xs">{firstText(row, ["case_number", "reference", "id"]) ?? NOT_REPORTED}</Cell>
                <Cell>{firstText(row, ["subject", "title"]) ?? NOT_REPORTED}</Cell>
                <Cell>{firstText(row, ["status"]) ?? NOT_REPORTED}</Cell>
                <Cell>{firstText(row, ["priority"]) ?? NOT_REPORTED}</Cell>
                <Cell>{formatRecordDateTime(firstText(row, ["created_at", "opened_at"]))}</Cell>
              </tr>
            ))}
          </DataTable>
        )
      )}
    </Panel>
  );
}

