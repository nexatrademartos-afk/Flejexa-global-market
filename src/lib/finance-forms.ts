import {
  FINANCE_ACTION_NAMES,
  parseRandsToCents,
  parseWholeNumber,
  type FinanceActionName,
} from "@/lib/finance-core";

/**
 * Form definitions for the verified flat Finance Core actions. Field names are the payload keys
 * the supplied contracts expect. Nested-structure actions (journal lines, PO lines, settlement
 * items, payroll lines) are listed as awaiting contract and have no form here.
 */

export type FieldKind = "text" | "textarea" | "date" | "amount" | "integer" | "select";

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldSpec {
  name: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  /** Amount fields only: allow an explicit zero (for example a tax amount of zero). */
  allowZero?: boolean;
  min?: number;
  max?: number;
  options?: readonly FieldOption[];
  defaultValue?: string;
  help?: string;
  /** Show this field only when another field has the given value. */
  showWhen?: { field: string; equals: string };
}

export interface ActionFormSpec {
  action: FinanceActionName;
  title: string;
  description: string;
  submitLabel: string;
  successMessage: string;
  fields: readonly FieldSpec[];
  /** approve-reject sends approve: true or false from the chosen button. */
  decision?: "approve-reject";
  /** Adds an idempotencyKey generated once per submission. */
  idempotent?: boolean;
  warning?: string | undefined;
}

const CURRENCY: FieldSpec = {
  name: "currencyCode",
  label: "Currency",
  kind: "text",
  required: true,
  defaultValue: "ZAR",
  help: "Three-letter code, for example ZAR.",
};

const REASON: FieldSpec = { name: "reason", label: "Reason", kind: "textarea", required: true, help: "At least 3 characters. Recorded with the decision." };

const DECISION_ID = (name: string, label: string): FieldSpec => ({ name, label, kind: "text", required: true });

const READ_ONLY_CURRENCY: FieldSpec = { ...CURRENCY, required: false };

const DECIDE = (action: FinanceActionName, title: string, idField: FieldSpec, warning?: string): ActionFormSpec => ({
  action,
  title,
  description: "Approve or reject this record. The backend blocks decisions that break separation of duties.",
  submitLabel: "Decide",
  successMessage: "Decision recorded by Finance Core.",
  fields: [idField, REASON],
  decision: "approve-reject",
  warning,
});

const SPECS: Partial<Record<FinanceActionName, ActionFormSpec>> = {
  get_overview: { action: "get_overview", title: "Executive overview", description: "Reads the overview from Finance Core.", submitLabel: "Refresh overview", successMessage: "Overview refreshed from Finance Core.", fields: [] },
  get_control_snapshot: { action: "get_control_snapshot", title: "Control snapshot", description: "Reads the control snapshot from Finance Core.", submitLabel: "Refresh snapshot", successMessage: "Control snapshot refreshed.", fields: [] },
  get_finance_work_queues: { action: "get_finance_work_queues", title: "Work queues", description: "Reads pending Finance work from Finance Core.", submitLabel: "Refresh queues", successMessage: "Work queues refreshed.", fields: [] },
  get_order_intake: {
    action: "get_order_intake",
    title: "Order intake",
    description: "Reads orders as the backend reports them. Order intake is not revenue.",
    submitLabel: "Load order intake",
    successMessage: "Order intake loaded.",
    fields: [{ name: "limit", label: "Number of orders", kind: "integer", min: 1, max: 100, help: "Optional. Up to 100." }],
  },
  get_trial_balance: {
    action: "get_trial_balance",
    title: "Trial balance",
    description: "Reads the trial balance for a period from Finance Core.",
    submitLabel: "Load trial balance",
    successMessage: "Trial balance loaded.",
    fields: [
      { name: "fromDate", label: "From", kind: "date", required: true },
      { name: "toDate", label: "To", kind: "date", required: true },
      READ_ONLY_CURRENCY,
    ],
  },
  get_management_report: {
    action: "get_management_report",
    title: "Management report",
    description: "Reads the management report for a period from Finance Core.",
    submitLabel: "Load report",
    successMessage: "Management report loaded.",
    fields: [
      { name: "startDate", label: "Start date", kind: "date", required: true },
      { name: "endDate", label: "End date", kind: "date", required: true },
      READ_ONLY_CURRENCY,
    ],
  },
  post_journal: {
    action: "post_journal",
    title: "Post journal",
    description: "Posts a draft journal entry.",
    submitLabel: "Post journal",
    successMessage: "Journal posted by Finance Core.",
    fields: [{ name: "entryId", label: "Journal entry ID", kind: "text", required: true }],
    warning: "Posting is final. A posted journal cannot be edited, only reversed.",
  },
  create_reversal_draft: {
    action: "create_reversal_draft",
    title: "Reversal draft",
    description: "Creates a draft reversal for a posted journal. It is not posted until a separate post step.",
    submitLabel: "Create reversal draft",
    successMessage: "Reversal draft created.",
    idempotent: true,
    fields: [
      { name: "originalEntryId", label: "Original journal ID", kind: "text", required: true },
      { name: "reversalDate", label: "Reversal date", kind: "date", required: true },
      { name: "reversalPeriodId", label: "Reversal period ID", kind: "text", required: true },
      REASON,
    ],
  },
  register_product: {
    action: "register_product",
    title: "Register product",
    description: "Registers a product for cost tracking.",
    submitLabel: "Register product",
    successMessage: "Product registered.",
    fields: [{ name: "productId", label: "Product ID", kind: "text", required: true }],
  },
  create_supplier: {
    action: "create_supplier",
    title: "New supplier",
    description: "Registers a supplier record.",
    submitLabel: "Create supplier",
    successMessage: "Supplier created.",
    fields: [
      { name: "supplierCode", label: "Supplier code", kind: "text", required: true },
      { name: "legalName", label: "Legal name", kind: "text", required: true },
      { name: "tradingName", label: "Trading name", kind: "text" },
      { name: "email", label: "Email", kind: "text" },
      { name: "phone", label: "Phone", kind: "text" },
      { name: "countryCode", label: "Country code", kind: "text" },
      CURRENCY,
      { name: "paymentTermsDays", label: "Payment terms (days)", kind: "integer", min: 0, max: 365 },
    ],
  },
  set_product_cost: {
    action: "set_product_cost",
    title: "Product cost profile",
    description: "Records a product cost profile. Each landed-cost component is stored separately.",
    submitLabel: "Save cost profile",
    successMessage: "Cost profile saved.",
    fields: [
      { name: "productId", label: "Product ID", kind: "text", required: true },
      CURRENCY,
      { name: "purchaseCostCents", label: "Purchase cost (R)", kind: "amount", required: true },
      { name: "freightCostCents", label: "Freight (R)", kind: "amount", allowZero: true },
      { name: "transportCostCents", label: "Transport (R)", kind: "amount", allowZero: true },
      { name: "importDutyCostCents", label: "Import duty (R)", kind: "amount", allowZero: true },
      { name: "packagingCostCents", label: "Packaging (R)", kind: "amount", allowZero: true },
      { name: "handlingCostCents", label: "Handling (R)", kind: "amount", allowZero: true },
      { name: "otherLandedCostCents", label: "Other landed cost (R)", kind: "amount", allowZero: true },
      { name: "sourceReference", label: "Source reference", kind: "text" },
      { name: "notes", label: "Notes", kind: "textarea" },
    ],
  },
  approve_purchase_order: {
    action: "approve_purchase_order",
    title: "Approve purchase order",
    description: "Approves a purchase order. Finance Core does not offer a rejection action for purchase orders.",
    submitLabel: "Approve purchase order",
    successMessage: "Purchase order approved.",
    fields: [{ name: "purchaseOrderId", label: "Purchase order ID", kind: "text", required: true }, REASON],
  },
  receive_purchase_order_line: {
    action: "receive_purchase_order_line",
    title: "Receive purchase order line",
    description: "Receives stock against an approved purchase order line into a lot.",
    submitLabel: "Receive line",
    successMessage: "Line received into inventory.",
    idempotent: true,
    fields: [
      { name: "purchaseOrderLineId", label: "Purchase order line ID", kind: "text", required: true },
      { name: "quantityReceived", label: "Quantity received", kind: "integer", required: true, min: 1 },
      { name: "lotReference", label: "Lot reference", kind: "text", required: true },
      { name: "reason", label: "Note", kind: "textarea" },
    ],
  },
  create_expense: {
    action: "create_expense",
    title: "New expense",
    description: "Creates an expense draft. Amounts are entered in rand and stored as integer cents.",
    submitLabel: "Create expense",
    successMessage: "Expense created as a draft.",
    idempotent: true,
    fields: [
      { name: "expenseDate", label: "Expense date", kind: "date", required: true },
      { name: "categoryCode", label: "Category code", kind: "text", required: true },
      { name: "description", label: "Description", kind: "textarea", required: true },
      { name: "amountCents", label: "Amount (R)", kind: "amount", required: true },
      { name: "taxCents", label: "VAT or tax (R)", kind: "amount", required: true, allowZero: true },
      CURRENCY,
      { name: "supplierId", label: "Supplier ID", kind: "text" },
      { name: "receiptReference", label: "Receipt reference", kind: "text" },
    ],
  },
  submit_expense: {
    action: "submit_expense",
    title: "Submit expense",
    description: "Submits a draft expense for approval.",
    submitLabel: "Submit expense",
    successMessage: "Expense submitted for approval.",
    fields: [{ name: "expenseId", label: "Expense ID", kind: "text", required: true }],
  },
  decide_expense: DECIDE("decide_expense", "Expense decision", DECISION_ID("expenseId", "Expense ID")),
  create_commission_rule: {
    action: "create_commission_rule",
    title: "New commission rule",
    description: "Creates a commission rule as a draft. A rule needs approval before it applies.",
    submitLabel: "Create rule",
    successMessage: "Commission rule created.",
    fields: [
      { name: "ruleCode", label: "Rule code", kind: "text", required: true },
      { name: "ruleName", label: "Rule name", kind: "text", required: true },
      {
        name: "calculationType",
        label: "Calculation",
        kind: "select",
        required: true,
        options: [
          { value: "fixed_cents", label: "Fixed amount" },
          { value: "percentage_basis_points", label: "Percentage (basis points)" },
        ],
      },
      CURRENCY,
      { name: "appliesTo", label: "Applies to", kind: "text", required: true },
      { name: "effectiveFrom", label: "Effective from", kind: "date", required: true },
      { name: "fixedAmountCents", label: "Fixed amount (R)", kind: "amount", required: true, showWhen: { field: "calculationType", equals: "fixed_cents" } },
      { name: "rateBasisPoints", label: "Rate (basis points)", kind: "integer", required: true, min: 1, help: "100 basis points = 1%.", showWhen: { field: "calculationType", equals: "percentage_basis_points" } },
    ],
  },
  decide_commission_rule: DECIDE("decide_commission_rule", "Commission rule decision", DECISION_ID("ruleId", "Rule ID")),
  accrue_commission: {
    action: "accrue_commission",
    title: "Accrue commission",
    description: "Records a commission accrual. An accrual is not a payment.",
    submitLabel: "Accrue commission",
    successMessage: "Commission accrued. Nothing has been paid.",
    idempotent: true,
    fields: [
      { name: "ruleId", label: "Rule ID", kind: "text", required: true },
      { name: "beneficiaryUserId", label: "Beneficiary user ID", kind: "text", required: true },
      { name: "sourceModule", label: "Source module", kind: "text", required: true },
      { name: "sourceReference", label: "Source reference", kind: "text", required: true },
      { name: "basisAmountCents", label: "Basis amount (R)", kind: "amount", required: true },
      CURRENCY,
    ],
  },
  decide_commission_accrual: DECIDE("decide_commission_accrual", "Commission accrual decision", DECISION_ID("accrualId", "Accrual ID")),
  create_approval_request: {
    action: "create_approval_request",
    title: "New approval request",
    description: "Raises a general approval request for a Finance action.",
    submitLabel: "Raise request",
    successMessage: "Approval request raised.",
    idempotent: true,
    fields: [
      { name: "actionCode", label: "Action code", kind: "text", required: true },
      { name: "entityType", label: "Entity type", kind: "text", required: true },
      { name: "entityId", label: "Entity ID", kind: "text" },
      { name: "amountCents", label: "Amount (R)", kind: "amount" },
      { name: "currencyCode", label: "Currency", kind: "text", help: "Three-letter code, for example ZAR." },
      REASON,
    ],
  },
  decide_approval_request: DECIDE("decide_approval_request", "Approval request decision", DECISION_ID("requestId", "Request ID")),
  request_refund: {
    action: "request_refund",
    title: "Request refund",
    description: "Raises a refund request for approval.",
    submitLabel: "Request refund",
    successMessage: "Refund request raised. No money has moved.",
    idempotent: true,
    warning: "Requesting a refund does not move money. Refund execution is disabled.",
    fields: [
      { name: "orderId", label: "Order ID", kind: "text", required: true },
      { name: "paymentProviderEventId", label: "Payment provider event ID", kind: "text", required: true },
      { name: "amountCents", label: "Refund amount (R)", kind: "amount", required: true },
      REASON,
    ],
  },
  decide_refund: DECIDE("decide_refund", "Refund decision", DECISION_ID("refundId", "Refund ID"), "Approval does not execute a refund or move money."),
  reconcile_settlement_batch: {
    action: "reconcile_settlement_batch",
    title: "Reconcile settlement batch",
    description: "Runs reconciliation on an existing settlement batch.",
    submitLabel: "Reconcile batch",
    successMessage: "Settlement batch reconciled by Finance Core.",
    fields: [{ name: "batchId", label: "Batch ID", kind: "text", required: true }],
  },
  link_wallet_entries_pending: {
    action: "link_wallet_entries_pending",
    title: "Link pending wallet entries",
    description: "Creates pending accounting links for eligible wallet ledger records. Balances are not changed.",
    submitLabel: "Create pending links",
    successMessage: "Pending accounting links created.",
    fields: [],
  },
  open_inventory_reconciliation: {
    action: "open_inventory_reconciliation",
    title: "Open stock reconciliation",
    description: "Opens a reconciliation for one product.",
    submitLabel: "Open reconciliation",
    successMessage: "Reconciliation opened.",
    fields: [
      { name: "productId", label: "Product ID", kind: "text", required: true },
      REASON,
    ],
  },
  decide_inventory_reconciliation: DECIDE("decide_inventory_reconciliation", "Stock reconciliation decision", DECISION_ID("reconciliationId", "Reconciliation ID")),
  apply_inventory_stock_sync: {
    action: "apply_inventory_stock_sync",
    title: "Apply stock sync",
    description: "Applies an approved stock reconciliation to inventory.",
    submitLabel: "Apply stock sync",
    successMessage: "Stock sync applied by Finance Core.",
    warning: "The backend blocks the sync if the data is stale or approval is missing.",
    fields: [DECISION_ID("reconciliationId", "Reconciliation ID"), REASON],
  },
  create_payable: {
    action: "create_payable",
    title: "New payable",
    description: "Records an amount owed. Recording a payable does not pay anyone.",
    submitLabel: "Create payable",
    successMessage: "Payable recorded. Nothing has been paid.",
    idempotent: true,
    fields: [
      { name: "payeeType", label: "Payee type", kind: "text", required: true, help: "Payee type code as Finance Core defines it." },
      { name: "payeeUserId", label: "Payee user ID", kind: "text" },
      { name: "supplierId", label: "Supplier ID", kind: "text" },
      { name: "sourceReference", label: "Source reference", kind: "text", required: true },
      { name: "description", label: "Description", kind: "textarea", required: true },
      { name: "amountCents", label: "Amount (R)", kind: "amount", required: true },
      CURRENCY,
      { name: "dueDate", label: "Due date", kind: "date" },
    ],
  },
  submit_payable: {
    action: "submit_payable",
    title: "Submit payable",
    description: "Submits a payable for approval.",
    submitLabel: "Submit payable",
    successMessage: "Payable submitted for approval.",
    fields: [{ name: "payableId", label: "Payable ID", kind: "text", required: true }],
  },
  decide_payable: DECIDE("decide_payable", "Payable decision", DECISION_ID("payableId", "Payable ID"), "Approving a payable does not pay it."),
  submit_payroll_run: {
    action: "submit_payroll_run",
    title: "Submit payroll run",
    description: "Submits a payroll run for approval.",
    submitLabel: "Submit payroll run",
    successMessage: "Payroll run submitted for approval.",
    warning: "Payroll payments are disabled. Submitting a run does not pay anyone.",
    fields: [{ name: "payrollRunId", label: "Payroll run ID", kind: "text", required: true }],
  },
  decide_payroll_run: DECIDE("decide_payroll_run", "Payroll run decision", DECISION_ID("payrollRunId", "Payroll run ID"), "Approval does not pay anyone."),
  create_tax_configuration: {
    action: "create_tax_configuration",
    title: "New tax configuration",
    description: "Creates a versioned tax configuration as a draft. No default rates are inserted.",
    submitLabel: "Create tax configuration",
    successMessage: "Tax configuration created as a draft.",
    fields: [
      { name: "taxCode", label: "Tax code", kind: "text", required: true },
      { name: "taxName", label: "Tax name", kind: "text", required: true },
      { name: "jurisdictionCode", label: "Jurisdiction code", kind: "text", required: true },
      {
        name: "taxType",
        label: "Tax type",
        kind: "select",
        required: true,
        options: [
          { value: "vat", label: "VAT" },
          { value: "income_tax", label: "Income tax" },
          { value: "withholding", label: "Withholding" },
          { value: "customs_duty", label: "Customs duty" },
          { value: "other", label: "Other" },
        ],
      },
      { name: "rateBasisPoints", label: "Rate (basis points)", kind: "integer", min: 0, help: "100 basis points = 1%." },
      { name: "effectiveFrom", label: "Effective from", kind: "date", required: true },
      { name: "effectiveTo", label: "Effective to", kind: "date" },
      { name: "sourceReference", label: "Source reference", kind: "text" },
    ],
  },
  submit_tax_configuration: {
    action: "submit_tax_configuration",
    title: "Submit tax configuration",
    description: "Submits a tax configuration for approval.",
    submitLabel: "Submit tax configuration",
    successMessage: "Tax configuration submitted for approval.",
    fields: [{ name: "taxConfigurationId", label: "Tax configuration ID", kind: "text", required: true }],
  },
  decide_tax_configuration: DECIDE("decide_tax_configuration", "Tax configuration decision", DECISION_ID("taxConfigurationId", "Tax configuration ID")),
  stage_unverified_provider_event: {
    action: "stage_unverified_provider_event",
    title: "Stage provider event",
    description: "Stages a provider event for review.",
    submitLabel: "Stage event",
    successMessage: "Event staged as unverified.",
    warning: "Staging records an unverified event only. It does not verify the signature, settle a payment, update an order or recognise revenue.",
    fields: [
      { name: "providerCode", label: "Provider code", kind: "text", required: true },
      { name: "providerEventId", label: "Provider event ID", kind: "text", required: true },
      { name: "eventType", label: "Event type", kind: "text", required: true },
      { name: "externalPaymentReference", label: "External payment reference", kind: "text" },
      { name: "orderId", label: "Order ID", kind: "text" },
      { name: "amountCents", label: "Amount (R)", kind: "amount" },
      { name: "currencyCode", label: "Currency", kind: "text", help: "Three-letter code, for example ZAR." },
    ],
  },
};

/** Actions whose payloads contain nested structures. Their forms wait for a verified contract. */
export const FINANCE_NESTED_AWAITING: readonly FinanceActionName[] = [
  "create_draft_journal",
  "create_purchase_order",
  "import_settlement_batch",
  "create_payroll_run",
];

/** Actions handled by the receipt workflow component, not a generic form. */
export const FINANCE_COMPONENT_ACTIONS: readonly FinanceActionName[] = ["register_expense_receipt", "get_expense_receipts"];

export const FINANCE_FORM_SPECS: Readonly<Partial<Record<FinanceActionName, ActionFormSpec>>> = SPECS;

export const FINANCE_FORM_ACTIONS: readonly FinanceActionName[] = FINANCE_ACTION_NAMES.filter(
  (action) => action in SPECS,
);

/** Approval Centre groups, one per record type. Each uses the backend's own decision action. */
export const APPROVAL_GROUPS: readonly { label: string; action: FinanceActionName; note?: string }[] = [
  { label: "Purchase orders", action: "approve_purchase_order", note: "Only approval is available. Leave an unwanted order pending." },
  { label: "Expenses", action: "decide_expense" },
  { label: "Commission rules", action: "decide_commission_rule" },
  { label: "Commission accruals", action: "decide_commission_accrual" },
  { label: "General approval requests", action: "decide_approval_request" },
  { label: "Refund requests", action: "decide_refund", note: "Approval does not move money." },
  { label: "Inventory reconciliations", action: "decide_inventory_reconciliation" },
  { label: "Payables", action: "decide_payable", note: "Approval does not pay the payable." },
  { label: "Payroll runs", action: "decide_payroll_run", note: "Approval does not pay anyone." },
  { label: "Tax configurations", action: "decide_tax_configuration" },
];

export function isFieldVisible(field: FieldSpec, values: Record<string, string>): boolean {
  if (!field.showWhen) return true;
  return (values[field.showWhen.field] ?? "") === field.showWhen.equals;
}

export function initialValues(spec: ActionFormSpec): Record<string, string> {
  return Object.fromEntries(spec.fields.map((field) => [field.name, field.defaultValue ?? ""]));
}

export type BuildResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; errors: Record<string, string> };

/**
 * Turns form values into the exact payload for one action. Only declared fields are sent.
 * Amounts become integer cents; visible-but-empty required fields are reported, not sent.
 */
export function buildFinanceBody(
  spec: ActionFormSpec,
  values: Record<string, string>,
  options: { approve?: boolean | undefined; idempotencyKey?: string | undefined } = {},
): BuildResult {
  const errors: Record<string, string> = {};
  const body: Record<string, unknown> = {};

  for (const field of spec.fields) {
    if (!isFieldVisible(field, values)) continue;
    const raw = (values[field.name] ?? "").trim();
    if (!raw) {
      if (field.required) errors[field.name] = "Required.";
      continue;
    }
    switch (field.kind) {
      case "amount": {
        const cents = parseRandsToCents(raw);
        if (cents === null) {
          errors[field.name] = "Enter rand with at most two decimals, for example 100.00.";
        } else if (!field.allowZero && cents === 0) {
          errors[field.name] = "Enter an amount greater than zero.";
        } else {
          body[field.name] = cents;
        }
        break;
      }
      case "integer": {
        const number = parseWholeNumber(raw);
        const belowMin = field.min !== undefined && number !== null && number < field.min;
        const aboveMax = field.max !== undefined && number !== null && number > field.max;
        if (number === null || belowMin || aboveMax) {
          const range = [field.min !== undefined ? `from ${field.min}` : "", field.max !== undefined ? `to ${field.max}` : ""]
            .filter(Boolean)
            .join(" ");
          errors[field.name] = `Enter a whole number${range ? ` ${range}` : ""}.`;
        } else {
          body[field.name] = number;
        }
        break;
      }
      case "date": {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(raw))) {
          errors[field.name] = "Use the date format YYYY-MM-DD.";
        } else {
          body[field.name] = raw;
        }
        break;
      }
      case "select": {
        if (!field.options?.some((option) => option.value === raw)) {
          errors[field.name] = "Choose one of the listed options.";
        } else {
          body[field.name] = raw;
        }
        break;
      }
      default:
        body[field.name] = raw;
    }

    if (!errors[field.name]) {
      if (field.name === "currencyCode" && !/^[A-Z]{3}$/.test(raw)) errors[field.name] = "Use three capital letters, for example ZAR.";
      if (field.name === "reason" && raw.length < 3) errors[field.name] = "Give a short reason of at least 3 characters.";
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  if (spec.decision === "approve-reject") {
    if (typeof options.approve !== "boolean") return { ok: false, errors: { __form: "Choose Approve or Reject." } };
    body["approve"] = options.approve;
  }
  if (spec.idempotent) {
    if (!options.idempotencyKey) return { ok: false, errors: { __form: "Missing submission key. Refresh the page and try again." } };
    body["idempotencyKey"] = options.idempotencyKey;
  }
  return { ok: true, body };
}

/** Returns the verified spec for an approval action, or throws if the definition is missing. */
export function requireSpecForApproval(action: FinanceActionName): ActionFormSpec {
  const spec = FINANCE_FORM_SPECS[action];
  if (!spec) throw new Error(`No verified form definition for ${action}`);
  return spec;
}
