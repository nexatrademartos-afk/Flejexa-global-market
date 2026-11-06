import { supabase } from "@/integrations/supabase/client";

/**
 * Finance Core client. Calls the deployed "finance-core" Edge Function through the existing
 * authenticated Supabase client. Success is shown only when the backend returns success: true.
 * No service credentials, private-schema queries or invented actions live here.
 */

export const FINANCE_CORE_FUNCTION = "finance-core";

/** The 44 deployed Finance Core actions. */
export const FINANCE_ACTION_NAMES = [
  "get_overview",
  "get_trial_balance",
  "create_draft_journal",
  "post_journal",
  "create_reversal_draft",
  "register_product",
  "create_supplier",
  "set_product_cost",
  "create_purchase_order",
  "approve_purchase_order",
  "receive_purchase_order_line",
  "create_expense",
  "submit_expense",
  "decide_expense",
  "register_expense_receipt",
  "get_expense_receipts",
  "create_commission_rule",
  "decide_commission_rule",
  "accrue_commission",
  "decide_commission_accrual",
  "create_approval_request",
  "decide_approval_request",
  "request_refund",
  "decide_refund",
  "get_control_snapshot",
  "import_settlement_batch",
  "reconcile_settlement_batch",
  "link_wallet_entries_pending",
  "get_management_report",
  "open_inventory_reconciliation",
  "decide_inventory_reconciliation",
  "apply_inventory_stock_sync",
  "create_payable",
  "submit_payable",
  "decide_payable",
  "create_payroll_run",
  "submit_payroll_run",
  "decide_payroll_run",
  "create_tax_configuration",
  "submit_tax_configuration",
  "decide_tax_configuration",
  "get_order_intake",
  "get_finance_work_queues",
  "stage_unverified_provider_event",
] as const;

export type FinanceActionName = (typeof FINANCE_ACTION_NAMES)[number];

export type FinanceErrorKind = "unauthenticated" | "forbidden" | "validation" | "service" | "network" | "unknown";

export type FinanceFailure = { ok: false; kind: FinanceErrorKind; message: string };
export type FinanceResult = { ok: true; data: Record<string, unknown> } | FinanceFailure;

const SAFE_MESSAGES: Record<FinanceErrorKind, string> = {
  unauthenticated: "Your session has ended. Sign in again to continue.",
  forbidden: "Finance Core did not allow this action for your account. The backend makes this decision.",
  validation: "Finance Core rejected these details. Check the highlighted fields and try again.",
  service: "Finance Core could not complete the request. Nothing was confirmed. Try again shortly.",
  network: "Could not reach Finance Core. Check your connection and try again.",
  unknown: "Finance Core returned an unexpected response. Nothing was confirmed.",
};

export function kindForStatus(status: number | undefined): FinanceErrorKind {
  if (status === 401) return "unauthenticated";
  if (status === 403) return "forbidden";
  if (status === 400 || status === 422) return "validation";
  if (status !== undefined && status >= 500) return "service";
  return "unknown";
}

function shortBackendMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  for (const key of ["message", "error", "detail"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim() && value.length <= 300) return value.trim();
  }
  return null;
}

function isResponseLike(value: unknown): value is { status: number; json: () => Promise<unknown> } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { status?: unknown }).status === "number" &&
    typeof (value as { json?: unknown }).json === "function"
  );
}

/** Maps a Supabase Functions error to a safe, user-facing failure. Backend detail is shown only for validation and permission refusals. */
export async function mapFinanceError(error: unknown): Promise<FinanceFailure> {
  const context = (error as { context?: unknown } | null)?.context;
  if (isResponseLike(context)) {
    const kind = kindForStatus(context.status);
    let detail: string | null = null;
    try {
      detail = shortBackendMessage(await context.json());
    } catch {
      detail = null;
    }
    const showDetail = (kind === "validation" || kind === "forbidden") && detail !== null;
    return { ok: false, kind, message: showDetail ? (detail as string) : SAFE_MESSAGES[kind] };
  }
  if ((error as { name?: string } | null)?.name === "FunctionsFetchError") {
    return { ok: false, kind: "network", message: SAFE_MESSAGES.network };
  }
  return { ok: false, kind: "unknown", message: SAFE_MESSAGES.unknown };
}

/** Calls one Finance Core action. Resolves with the backend's own data only when it confirms success. */
export async function callFinanceCore(action: FinanceActionName, body: Record<string, unknown> = {}): Promise<FinanceResult> {
  let response: { data: unknown; error: unknown };
  try {
    response = await supabase.functions.invoke(FINANCE_CORE_FUNCTION, { body: { ...body, action } });
  } catch {
    return { ok: false, kind: "network", message: SAFE_MESSAGES.network };
  }
  if (response.error) return mapFinanceError(response.error);
  const data = response.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, kind: "unknown", message: SAFE_MESSAGES.unknown };
  }
  const record = data as Record<string, unknown>;
  if (record["success"] !== true) {
    return { ok: false, kind: "validation", message: shortBackendMessage(record) ?? SAFE_MESSAGES.validation };
  }
  return { ok: true, data: record };
}

/** Parses rand text such as "100", "100.5" or "1 250.50" into integer cents. Returns null when unsafe or ambiguous. */
export function parseRandsToCents(input: string): number | null {
  const cleaned = input.trim().replace(/^R\s?/i, "").replace(/[\s,]/g, "");
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const total = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(total) ? total : null;
}

export function parseWholeNumber(input: string): number | null {
  if (!/^\d+$/.test(input.trim())) return null;
  const value = Number(input.trim());
  return Number.isSafeInteger(value) ? value : null;
}

/** A fresh key for each new submission. Reused only when retrying the same submission. */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
