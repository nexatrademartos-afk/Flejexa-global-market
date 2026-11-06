import { describe, expect, it } from "vitest";
import {
  FINANCE_ACCESS_ROLES,
  FINANCE_GROUPS,
  FINANCE_MODULES,
  FINANCE_REAL_MONEY_DISABLED,
  canOpenFinanceCommandCentre,
  formatMoneyCents,
  formatZarCents,
} from "@/lib/finance-command";

describe("Finance access", () => {
  it("opens for CEO and Finance accounts only", () => {
    expect(FINANCE_ACCESS_ROLES).toEqual(["ceo", "finance"]);
    expect(canOpenFinanceCommandCentre(["ceo"])).toBe(true);
    expect(canOpenFinanceCommandCentre(["finance"])).toBe(true);
    expect(canOpenFinanceCommandCentre(["customer", "ceo"])).toBe(true);
  });

  it("denies Admin, customer, partner, delivery, commission and security roles", () => {
    expect(canOpenFinanceCommandCentre(["admin"])).toBe(false);
    expect(canOpenFinanceCommandCentre(["customer"])).toBe(false);
    expect(canOpenFinanceCommandCentre(["partner", "delivery", "commission", "security"])).toBe(false);
    expect(canOpenFinanceCommandCentre([])).toBe(false);
  });
});

describe("Finance module map", () => {
  it("lists 21 sidebar pages, each in a known group with a unique id", () => {
    expect(FINANCE_MODULES).toHaveLength(21);
    expect(new Set(FINANCE_MODULES.map((module) => module.id)).size).toBe(21);
    for (const module of FINANCE_MODULES) {
      expect(FINANCE_GROUPS).toContain(module.group);
      expect(module.description.length).toBeGreaterThan(10);
    }
  });

  it("includes Provider Events and Stock Reconciliation as distinct pages", () => {
    const labels = FINANCE_MODULES.map((module) => module.label);
    expect(labels).toContain("Provider Events");
    expect(labels).toContain("Stock Reconciliation");
    expect(labels).toContain("Approval Centre");
  });

  it("keeps the real-money operations disabled list complete", () => {
    expect(FINANCE_REAL_MONEY_DISABLED).toEqual(
      expect.arrayContaining(["Withdrawals", "Transfers", "Supplier payments", "Payroll payments", "Refund execution"]),
    );
  });
});

describe("money formatting", () => {
  it("formats integer cents as rand without floating point", () => {
    expect(formatZarCents(125050)).toMatch(/^R 1\s250,50$/);
    expect(formatZarCents(5)).toMatch(/^R 0,05$/);
    expect(formatZarCents(-1999)).toMatch(/^-R 19,99$/);
  });

  it("uses the record's own currency and shows placeholders when data is missing", () => {
    expect(formatMoneyCents(12345, "USD")).toMatch(/^USD 123,45$/);
    expect(formatMoneyCents(null, "ZAR")).toBe("Not reported");
    expect(formatMoneyCents(100, null)).toBe("Currency not reported");
    expect(formatMoneyCents(1.5, "ZAR")).toBe("Not reported");
  });
});
