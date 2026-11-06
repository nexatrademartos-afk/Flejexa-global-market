import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FINANCE_ACTION_NAMES } from "@/lib/finance-core";

function finance_sources(): { path: string; text: string }[] {
  const roots = ["src/components/finance", "src/lib"];
  const files: string[] = [];
  for (const root of roots) {
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (entry.isFile() && /finance.*\.tsx?$|ExpenseReceipts|ApprovalCentre|FinanceCards/.test(entry.name)) {
        files.push(join(root, entry.name));
      }
    }
  }
  for (const entry of readdirSync("src/components/finance", { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".tsx")) files.push(join("src/components/finance", entry.name));
  }
  return [...new Set(files)].map((path) => ({ path, text: readFileSync(path, "utf8") }));
}

describe("Finance frontend safety", () => {
  const sources = finance_sources();

  it("scans the finance source files", () => {
    expect(sources.length).toBeGreaterThan(8);
  });

  it("never touches the private schema, service credentials or direct database tables", () => {
    for (const { path, text } of sources) {
      expect(text, path).not.toMatch(/app_private/);
      expect(text, path).not.toMatch(/service_role|SUPABASE_SERVICE/i);
      expect(text, path).not.toMatch(/supabase\.from\(/);
      expect(text, path).not.toMatch(/supabase\.rpc\(/);
    }
  });

  it("uses only the supplied action names in calls", () => {
    const allowed = new Set<string>(FINANCE_ACTION_NAMES);
    for (const { path, text } of sources) {
      for (const match of text.matchAll(/callFinanceCore\(\s*"([a-z_]+)"/g)) {
        expect(allowed.has(match[1]!), `${path}: ${match[1]}`).toBe(true);
      }
      for (const match of text.matchAll(/action:\s*"([a-z_]+)"/g)) {
        expect(allowed.has(match[1]!), `${path}: ${match[1]}`).toBe(true);
      }
    }
  });

  it("contains no hard-coded tokens or the retired wallet brand", () => {
    for (const { path, text } of sources) {
      expect(text, path).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/);
      expect(text, path).not.toMatch(/sk_(live|test)_/);
      expect(text, path).not.toMatch(/Nexa Wallet/);
    }
  });
});
