import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FINANCE_ACCESS_ROLES, canOpenFinanceCommandCentre } from "@/lib/finance-command";

const dashboard = readFileSync("src/components/ceo/CeoDashboard.tsx", "utf8");

describe("CEO dashboard Finance Command Centre entry", () => {
  it("links to the finance workspace from the header and the section navigation", () => {
    const links = dashboard.match(/to="\/workspace\/\$role"\s+params=\{\{ role: "finance" \}\}/g) ?? [];
    expect(links.length).toBeGreaterThanOrEqual(2);
    expect(dashboard).toContain("Finance Command Centre");
  });

  it("keeps the navigation link outside the mobile-hidden section buttons", () => {
    expect(dashboard.lastIndexOf("Finance Command Centre")).toBeGreaterThan(dashboard.indexOf('aria-label="CEO sections"'));
  });

  it("grants Finance access to CEO accounts and not to Admin or customers", () => {
    expect(FINANCE_ACCESS_ROLES).toContain("ceo");
    expect(canOpenFinanceCommandCentre(["ceo"])).toBe(true);
    expect(canOpenFinanceCommandCentre(["admin"])).toBe(false);
    expect(canOpenFinanceCommandCentre(["customer"])).toBe(false);
  });
});
