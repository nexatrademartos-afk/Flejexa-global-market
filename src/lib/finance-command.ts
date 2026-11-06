/**
 * Finance Command Centre definitions. Frontend only: action names and payload rules live in
 * finance-core.ts and finance-forms.ts, and every figure comes from a verified Finance Core response.
 * The backend remains the final authority on every Finance action.
 */

/** Roles allowed to open /workspace/finance. Admin is deliberately not included. */
export const FINANCE_ACCESS_ROLES = ["ceo", "finance"] as const;

export function canOpenFinanceCommandCentre(roles: readonly string[]): boolean {
  return roles.some((role) => (FINANCE_ACCESS_ROLES as readonly string[]).includes(role));
}

export type FinanceModuleGroup =
  | "Executive"
  | "Accounting"
  | "Revenue & payments"
  | "Expenses & procurement"
  | "Operations"
  | "Governance";

export type FinanceModuleId =
  | "overview"
  | "journals"
  | "trial-balance"
  | "reports"
  | "orders"
  | "provider-events"
  | "settlements"
  | "wallet-reconciliation"
  | "refunds"
  | "expenses"
  | "suppliers"
  | "purchase-orders"
  | "inventory"
  | "stock-reconciliation"
  | "commissions"
  | "approvals"
  | "payables"
  | "payroll"
  | "tax"
  | "work-queues"
  | "controls";

export interface FinanceModule {
  id: FinanceModuleId;
  label: string;
  group: FinanceModuleGroup;
  description: string;
}

export const FINANCE_MODULES: readonly FinanceModule[] = [
  { id: "overview", label: "Overview", group: "Executive", description: "Executive overview from the verified Finance Core responses." },
  { id: "journals", label: "Journal Entries", group: "Accounting", description: "Draft, post and reverse journals. Posted journals are final." },
  { id: "trial-balance", label: "Trial Balance", group: "Accounting", description: "Trial balance for a date range, as returned by Finance Core." },
  { id: "reports", label: "Management Reports", group: "Accounting", description: "Management reports for a date range, as returned by Finance Core." },
  { id: "orders", label: "Order Intake", group: "Revenue & payments", description: "Orders as the backend reports them. Order intake is never revenue." },
  { id: "provider-events", label: "Provider Events", group: "Revenue & payments", description: "Staged provider events are unverified and are not proof of payment." },
  { id: "settlements", label: "Settlements", group: "Revenue & payments", description: "Settlement reconciliation. An imported batch is not proof of payment." },
  { id: "wallet-reconciliation", label: "Wallet Reconciliation", group: "Revenue & payments", description: "Creates pending accounting links only. Wallet balances are not changed." },
  { id: "refunds", label: "Refunds", group: "Revenue & payments", description: "Refund requests. Approving a refund does not move money." },
  { id: "expenses", label: "Expenses & Receipts", group: "Expenses & procurement", description: "Expenses, their submission and private receipt files." },
  { id: "suppliers", label: "Suppliers & Product Costs", group: "Expenses & procurement", description: "Supplier registration and product cost profiles with landed costs shown separately." },
  { id: "purchase-orders", label: "Purchase Orders", group: "Expenses & procurement", description: "Purchase order approvals sit in the Approval Centre." },
  { id: "inventory", label: "Inventory", group: "Operations", description: "Receiving purchase order lines into inventory lots." },
  { id: "stock-reconciliation", label: "Stock Reconciliation", group: "Operations", description: "Inventory reconciliations. Stock sync never bypasses backend checks." },
  { id: "commissions", label: "Commissions", group: "Operations", description: "Commission rules and accruals. Accrued or approved is not paid." },
  { id: "approvals", label: "Approval Centre", group: "Governance", description: "Every approval decision, by record type. Requesters cannot approve their own work." },
  { id: "payables", label: "Payables", group: "Governance", description: "Amounts owed. Approved payables are not paid." },
  { id: "payroll", label: "Payroll", group: "Governance", description: "Payroll runs. Payroll payments are disabled." },
  { id: "tax", label: "Tax Configuration", group: "Governance", description: "Versioned tax configurations. No default rates are inserted." },
  { id: "work-queues", label: "Work Queues", group: "Governance", description: "Items waiting for Finance attention, as returned by the backend." },
  { id: "controls", label: "Controls & Audit", group: "Governance", description: "Control snapshot from Finance Core. Audit history awaits a verified read contract." },
];

export const FINANCE_GROUPS: readonly FinanceModuleGroup[] = [
  "Executive",
  "Accounting",
  "Revenue & payments",
  "Expenses & procurement",
  "Operations",
  "Governance",
];

/** Real-money operations that stay disabled until separately approved backend flows exist. */
export const FINANCE_REAL_MONEY_DISABLED = [
  "Customer deposits",
  "Withdrawals",
  "Transfers",
  "Customer payouts",
  "Supplier payments",
  "Payroll payments",
  "Refund execution",
  "Any real payment-provider execution",
] as const;

/**
 * Formats an integer amount in cents using the record's own currency code. Never uses floating point.
 * Returns explicit placeholders instead of guessing a currency or figure.
 */
export function formatMoneyCents(cents: number | null | undefined, currencyCode: string | null | undefined): string {
  if (cents === null || cents === undefined || !Number.isSafeInteger(cents)) return "Not reported";
  if (!currencyCode || !/^[A-Z]{3}$/.test(currencyCode)) return "Currency not reported";
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  const major = Math.floor(absolute / 100).toLocaleString("en-ZA");
  const minor = String(absolute % 100).padStart(2, "0");
  const prefix = currencyCode === "ZAR" ? "R " : `${currencyCode} `;
  return `${sign}${prefix}${major},${minor}`;
}

/** South African rand formatting for integer cents. */
export function formatZarCents(cents: number | null | undefined): string {
  return formatMoneyCents(cents, "ZAR");
}
