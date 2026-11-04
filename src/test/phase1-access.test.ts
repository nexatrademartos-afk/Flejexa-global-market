import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(__dirname, "../..", path), "utf8");

describe("customer service search gateway", () => {
  const index = read("src/routes/account.index.tsx");

  it("makes the No matching services heading a quiet link to secure-access, with no visible nominate button", () => {
    const emptyState = index.slice(index.indexOf("filteredServices.length === 0"));
    expect(emptyState).toContain("No matching services");
    expect(emptyState).toMatch(/<Link\s+to="\/account\/secure-access"[\s\S]*?No matching services/);
    expect(emptyState).not.toContain("Nominate Service");
    expect(emptyState).toContain("Clear search");
    expect(emptyState).toContain("setSearch(\"\")");
  });

  it("secure-access stays noindex and links to the Admin and CEO workspaces", () => {
    const secure = read("src/routes/account.secure-access.tsx");
    expect(secure).toContain('"noindex, nofollow"');
    expect(secure).toContain('href="/workspace/admin"');
    expect(secure).toContain('href="/workspace/ceo"');
  });
});

describe("customer mobile quick navigation", () => {
  const account = read("src/routes/account.tsx");
  const quickNav = account.slice(
    account.indexOf('aria-label="Customer quick navigation"'),
    account.indexOf("</nav>", account.indexOf('aria-label="Customer quick navigation"')),
  );

  it("lists the six milestone items in order", () => {
    const targets = [...quickNav.matchAll(/to="([^"]+)"/g)].map((m) => m[1]);
    expect(targets).toEqual([
      "/shop",
      "/account/orders",
      "/account",
      "/account/wallet",
      "/account/orders",
      "/account/profile",
    ]);
  });

  it("keeps Security & Privacy out of the quick bar but in the full account menu", () => {
    expect(quickNav).not.toContain("/account/settings");
    expect(account).toContain("Security & Privacy");
  });
});

describe("workspace access gate", () => {
  const workspace = read("src/routes/workspace.$role.tsx");

  it("checks the signed-in user and their actual user_roles rows before showing content", () => {
    expect(workspace).toContain("supabase.auth.getUser()");
    expect(workspace.indexOf("supabase.auth.getUser()")).toBeLessThan(
      workspace.indexOf('.from("user_roles")'),
    );
  });

  it("is marked noindex", () => {
    expect(workspace).toContain('{ name: "robots", content: "noindex" }');
  });
});
