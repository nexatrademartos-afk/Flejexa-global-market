import { describe, expect, it } from "vitest";
import { FINANCE_ACTION_NAMES } from "@/lib/finance-core";
import {
  APPROVAL_GROUPS,
  FINANCE_COMPONENT_ACTIONS,
  FINANCE_FORM_ACTIONS,
  FINANCE_FORM_SPECS,
  FINANCE_NESTED_AWAITING,
  buildFinanceBody,
  initialValues,
} from "@/lib/finance-forms";
import { receiptStoragePath, validateReceiptFile, isValidExpenseId, safeFilename } from "@/components/finance/ExpenseReceipts";

describe("action coverage", () => {
  it("partitions all 44 actions into forms, receipt component and awaiting-contract items", () => {
    const all = [...FINANCE_FORM_ACTIONS, ...FINANCE_COMPONENT_ACTIONS, ...FINANCE_NESTED_AWAITING].sort();
    expect(all).toEqual([...FINANCE_ACTION_NAMES].sort());
    expect(FINANCE_FORM_ACTIONS).toHaveLength(38);
    expect(FINANCE_NESTED_AWAITING).toEqual(
      expect.arrayContaining(["create_draft_journal", "create_purchase_order", "import_settlement_batch", "create_payroll_run"]),
    );
  });

  it("gives every form action a spec whose action name matches its key", () => {
    for (const action of FINANCE_FORM_ACTIONS) {
      expect(FINANCE_FORM_SPECS[action]?.action).toBe(action);
    }
  });

  it("covers every approval decision action with a verified spec", () => {
    for (const group of APPROVAL_GROUPS) {
      expect(FINANCE_FORM_SPECS[group.action]).toBeDefined();
    }
  });
});

describe("payload building", () => {
  const expense = FINANCE_FORM_SPECS.create_expense!;
  const validExpense = {
    expenseDate: "2026-11-01",
    categoryCode: "OFFICE",
    description: "Printer paper",
    amountCents: "1250.50",
    taxCents: "0",
    currencyCode: "ZAR",
  };

  it("converts amounts to integer cents and keeps explicit zeros where allowed", () => {
    const result = buildFinanceBody(expense, validExpense, { idempotencyKey: "k1" });
    expect(result).toEqual({
      ok: true,
      body: {
        expenseDate: "2026-11-01",
        categoryCode: "OFFICE",
        description: "Printer paper",
        amountCents: 125050,
        taxCents: 0,
        currencyCode: "ZAR",
        idempotencyKey: "k1",
      },
    });
  });

  it("rejects a required amount that is zero or ambiguous", () => {
    const zero = buildFinanceBody(expense, { ...validExpense, amountCents: "0" }, { idempotencyKey: "k" });
    expect(zero.ok).toBe(false);
    if (!zero.ok) expect(zero.errors["amountCents"]).toMatch(/greater than zero/);
    const bad = buildFinanceBody(expense, { ...validExpense, amountCents: "10.555" }, { idempotencyKey: "k" });
    expect(bad.ok).toBe(false);
  });

  it("reports missing required fields without sending anything", () => {
    const result = buildFinanceBody(expense, { ...validExpense, description: "  " }, { idempotencyKey: "k" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors["description"]).toBe("Required.");
  });

  it("sends only the declared keys", () => {
    const built = buildFinanceBody(expense, { ...validExpense, supplierId: "", ignored: "x" }, { idempotencyKey: "k" });
    expect(built.ok).toBe(true);
    if (built.ok) expect(Object.keys(built.body)).not.toContain("ignored");
  });

  it("requires a decision choice and sends approve as a boolean", () => {
    const decide = FINANCE_FORM_SPECS.decide_expense!;
    const values = { expenseId: "exp-9", reason: "Within policy" };
    expect(buildFinanceBody(decide, values).ok).toBe(false);
    const approved = buildFinanceBody(decide, values, { approve: true });
    const rejected = buildFinanceBody(decide, values, { approve: false });
    expect(approved).toEqual({ ok: true, body: { expenseId: "exp-9", reason: "Within policy", approve: true } });
    expect(rejected.ok && rejected.body["approve"]).toBe(false);
  });

  it("enforces a reason of at least three characters on decisions", () => {
    const result = buildFinanceBody(FINANCE_FORM_SPECS.decide_refund!, { refundId: "r1", reason: "no" }, { approve: true });
    expect(result.ok).toBe(false);
  });

  it("shows only the rate field that matches the chosen calculation type", () => {
    const rule = FINANCE_FORM_SPECS.create_commission_rule!;
    const base = {
      ruleCode: "R1",
      ruleName: "Referral",
      currencyCode: "ZAR",
      appliesTo: "orders",
      effectiveFrom: "2026-11-01",
    };
    const fixed = buildFinanceBody(rule, { ...base, calculationType: "fixed_cents", fixedAmountCents: "50", rateBasisPoints: "999" });
    expect(fixed).toEqual({
      ok: true,
      body: { ...base, calculationType: "fixed_cents", fixedAmountCents: 5000 },
    });
    const percent = buildFinanceBody(rule, { ...base, calculationType: "percentage_basis_points", fixedAmountCents: "", rateBasisPoints: "250" });
    expect(percent).toEqual({
      ok: true,
      body: { ...base, calculationType: "percentage_basis_points", rateBasisPoints: 250 },
    });
  });

  it("validates dates, currency codes, select options and integer ranges", () => {
    expect(buildFinanceBody(FINANCE_FORM_SPECS.get_trial_balance!, { fromDate: "01/11/2026", toDate: "2026-11-30" }).ok).toBe(false);
    expect(buildFinanceBody(FINANCE_FORM_SPECS.get_trial_balance!, { fromDate: "2026-11-01", toDate: "2026-11-30", currencyCode: "rand" }).ok).toBe(false);
    expect(buildFinanceBody(FINANCE_FORM_SPECS.get_order_intake!, { limit: "500" }).ok).toBe(false);
    const tax = buildFinanceBody(FINANCE_FORM_SPECS.create_tax_configuration!, {
      taxCode: "VAT",
      taxName: "VAT",
      jurisdictionCode: "ZA",
      taxType: "nonsense",
      effectiveFrom: "2026-01-01",
    });
    expect(tax.ok).toBe(false);
  });

  it("adds a submission key only for idempotent actions", () => {
    const plain = buildFinanceBody(FINANCE_FORM_SPECS.submit_expense!, { expenseId: "e1" });
    expect(plain).toEqual({ ok: true, body: { expenseId: "e1" } });
    const missingKey = buildFinanceBody(expense, validExpense);
    expect(missingKey.ok).toBe(false);
  });

  it("gives every spec initial values for its fields", () => {
    expect(initialValues(FINANCE_FORM_SPECS.get_trial_balance!)).toEqual({ fromDate: "", toDate: "", currencyCode: "ZAR" });
  });
});

describe("receipt workflow rules", () => {
  it("accepts only the approved file types and sizes", () => {
    expect(validateReceiptFile({ type: "application/pdf", size: 1000 })).toBeNull();
    expect(validateReceiptFile({ type: "image/png", size: 1000 })).toBeNull();
    expect(validateReceiptFile({ type: "text/html", size: 1000 })).toMatch(/PDF, JPEG, PNG or WebP/);
    expect(validateReceiptFile({ type: "image/jpeg", size: 0 })).toMatch(/empty/);
    expect(validateReceiptFile({ type: "image/jpeg", size: 11 * 1024 * 1024 })).toMatch(/10 MB/);
  });

  it("builds private storage paths that cannot escape the expense folder", () => {
    const path = receiptStoragePath("exp-1", "../../etc/passwd invoice.pdf", "uuid-1");
    expect(path).toBe("exp-1/uuid-1-etc_passwd_invoice.pdf");
    expect(path.startsWith("exp-1/")).toBe(true);
    expect(path).not.toContain("..");
    expect(safeFilename("")).toBe("receipt");
  });

  it("validates expense IDs before any upload", () => {
    expect(isValidExpenseId("exp_123-A")).toBe(true);
    expect(isValidExpenseId("../x")).toBe(false);
    expect(isValidExpenseId("")).toBe(false);
  });
});
