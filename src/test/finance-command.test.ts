import { describe, expect, it } from "vitest";
import {
  FINANCE_ACCESS_ROLES,
  FINANCE_GROUPS,
  FINANCE_MODULES,
  FINANCE_REAL_MONEY_DISABLED,
  canOpenFinanceCommandCentre,
  formatZarCents,
} from "@/lib/finance-command";

describe("Finance access", () => {
  it("opens for CEO and Finance accounts only", () => {
    expect(canOpenFinanceCommandCentre(["ceo"])).toBe(true);
    expect(canOpenFinanceCommandCentre(["finance"])).toBe(true);
    expect(canOpenFinanceCommandCentre(["customer", "ceo"])).toBe(true);
    expect(FINANCE_ACCESS_ROLES).toEqual(["ceo", "finance"]);
  });

  it("denies Admin, customers, partners, delivery and security users", () => {
    expect(canOpenFinanceCommandCentre(["admin"])).toBe(false);
    expect(canOpenFinanceCommandCentre(["customer"])).toBe(false);
    expect(canOpenFinanceCommandCentre(["partner", "delivery", "commission", "security"])).toBe(false);
    expect(canOpenFinanceCommandCentre([])).toBe(false);
  });
});

describe("Finance module shell", () => {
  it("lists exactly the 22 requested modules with unique ids", () => {
    expect(FINANCE_MODULES).toHaveLength(22);
    expect(new Set(FINANCE_MODULES.map((module) => module.id)).size).toBe(22);
    expect(FINANCE_MODULES.map((module) => module.label)).toEqual([
      "Overview",
      "Finance Work Queues",
      "Approval Centre",
      "Controls & Audit",
      "Orders & Payment Intake",
      "Refund Requests",
      "Payment Provider Events",
      "Settlement Reconciliation",
      "Wallet Reconciliation",
      "Accounting & Journals",
      "Trial Balance",
      "Management Reports",
      "Tax Configuration",
      "Expenses",
      "Expense Receipts",
      "Suppliers",
      "Product Cost Management",
      "Purchase Orders",
      "Inventory & Stock Reconciliation",
      "Commissions",
      "Payables",
      "Payroll",
    ]);
  });

  it("places every module in exactly one navigation group", () => {
    const grouped = FINANCE_GROUPS.flatMap((group) => FINANCE_MODULES.filter((module) => module.group === group));
    expect(grouped).toHaveLength(FINANCE_MODULES.length);
  });

  it("keeps every real-money operation in the disabled list", () => {
    expect(FINANCE_REAL_MONEY_DISABLED).toEqual(
      expect.arrayContaining([
        "Customer deposits",
        "Withdrawals",
        "Transfers",
        "Customer payouts",
        "Supplier payments",
        "Payroll payments",
        "Refund execution",
        "Any real payment-provider execution",
      ]),
    );
  });
});

describe("formatZarCents", () => {
  const normalise = (value: string) => value.replace(/\s/g, " ");

  it("formats integer cents as rand without floating-point arithmetic", () => {
    expect(normalise(formatZarCents(123456))).toBe("R 1 234,56");
    expect(normalise(formatZarCents(0))).toBe("R 0,00");
    expect(normalise(formatZarCents(5))).toBe("R 0,05");
    expect(normalise(formatZarCents(-250))).toBe("-R 2,50");
  });

  it("reports missing or unsafe amounts instead of inventing a figure", () => {
    expect(formatZarCents(null)).toBe("Not reported");
    expect(formatZarCents(undefined)).toBe("Not reported");
    expect(formatZarCents(10.5)).toBe("Not reported");
    expect(formatZarCents(Number.MAX_SAFE_INTEGER + 2)).toBe("Not reported");
  });
});
