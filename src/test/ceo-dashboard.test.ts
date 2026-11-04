import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ANALYTICS_MAX_DAYS,
  countRows,
  describeCeoError,
  filterPeople,
  formatAmount,
  groupOf,
  hasTrustedIdentity,
  numberAt,
  parseAudit,
  parsePeople,
  parseRoleApplications,
  policySummary,
  rangeForDays,
  validateRoleAssignment,
  type DirectoryPerson,
} from "@/lib/ceo-dashboard";

const read = (path: string) => readFileSync(resolve(__dirname, "../..", path), "utf8");
const ceoDir = resolve(__dirname, "../components/ceo");
const ceoSource = readdirSync(ceoDir)
  .filter((file) => file.endsWith(".tsx"))
  .map((file) => read(`src/components/ceo/${file}`))
  .join("\n");

const person = (overrides: Partial<DirectoryPerson> = {}): DirectoryPerson => ({
  user_id: "11111111-1111-1111-1111-111111111111",
  email: "staff@example.com",
  email_confirmed: true,
  account_created_at: "2026-01-01T00:00:00Z",
  full_name: "Staff Member",
  phone: null,
  nexa_id: "NEXA-TEST-1",
  roles: ["customer"],
  ...overrides,
});

describe("CEO date ranges", () => {
  it("returns an inclusive ISO range ending today", () => {
    const today = new Date(2026, 5, 30);
    expect(rangeForDays(7, today)).toEqual({ start: "2026-06-24", end: "2026-06-30" });
  });

  it("never exceeds the backend's range limit", () => {
    expect(ANALYTICS_MAX_DAYS).toBeLessThanOrEqual(365);
    const range = rangeForDays(9999, new Date(2026, 5, 30));
    const span = (Date.parse(range.end) - Date.parse(range.start)) / 86_400_000;
    expect(span).toBeLessThan(366);
  });
});

describe("CEO error mapping", () => {
  it("maps permission denials without exposing the database message", () => {
    const mapped = describeCeoError({ code: "42501", message: "secret internal detail" });
    expect(mapped.kind).toBe("denied");
    expect(mapped.message).not.toContain("secret");
  });

  it("asks for sign-in when the session has expired", () => {
    expect(describeCeoError({ code: "PGRST301", message: "JWT expired" }).kind).toBe("session");
  });

  it("reports missing functions as not yet available", () => {
    expect(describeCeoError({ code: "PGRST202", message: "not found" }).kind).toBe("unavailable");
  });

  it("treats a missing response as a connection problem", () => {
    expect(describeCeoError(null).kind).toBe("network");
  });
});

describe("Backend values are never invented", () => {
  it("returns null, not zero, for missing numbers", () => {
    expect(numberAt({ products: {} }, "products.total")).toBeNull();
    expect(numberAt({ products: { total: 4 } }, "products.total")).toBe(4);
  });

  it("formats an absent amount as not reported and labels amounts without a currency", () => {
    expect(formatAmount(null, "ZAR")).toBe("Not reported");
    expect(formatAmount(120, null)).toContain("currency not reported");
  });

  it("reads count maps and count rows", () => {
    expect(countRows({ pending_review: 2, approved: 0 })).toEqual([
      { label: "Pending review", count: 2 },
      { label: "Approved", count: 0 },
    ]);
    expect(countRows([{ status: "paid", count: 3 }])).toEqual([{ label: "Paid", count: 3 }]);
  });
});

describe("Application and people parsing", () => {
  it("drops application rows that lack an ID, applicant or role", () => {
    const parsed = parseRoleApplications([
      { application_id: "a1", applicant_id: "u1", requested_role: "partner", application_status: "pending", existing_roles: ["customer"] },
      { application_id: "a2" },
    ]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.existing_roles).toEqual(["customer"]);
  });

  it("groups accounts only by the roles assigned to them", () => {
    expect(groupOf(["ceo", "customer"])).toBe("executive");
    expect(groupOf(["finance"])).toBe("staff");
    expect(groupOf(["customer"])).toBe("customers");
  });

  it("filters the directory by text and group", () => {
    const people = [person(), person({ user_id: "2", full_name: "Ada", roles: ["partner"], nexa_id: "NEXA-2" })];
    expect(filterPeople(people, "ada", "all").map((p) => p.user_id)).toEqual(["2"]);
    expect(filterPeople(people, "", "customers").map((p) => p.user_id)).toEqual(["11111111-1111-1111-1111-111111111111"]);
  });

  it("reads the directory response object", () => {
    expect(parsePeople({ people: [person()], returned: 1 })).toHaveLength(1);
    expect(parsePeople({ returned: 0 })).toEqual([]);
  });

  it("reads audit entries without an ID or action as invalid", () => {
    expect(parseAudit({ entries: [{ audit_id: "x", action: "role.assign" }, { audit_id: "y" }] })).toHaveLength(1);
  });
});

describe("Identity and policy checks", () => {
  it("requires both a NEXA ID and an account email before approval", () => {
    expect(hasTrustedIdentity({ nexa_id: "NEXA-1", applicant_email: "a@example.com" })).toBe(true);
    expect(hasTrustedIdentity({ nexa_id: null, applicant_email: "a@example.com" })).toBe(false);
    expect(hasTrustedIdentity({ nexa_id: "NEXA-1", applicant_email: null })).toBe(false);
  });

  it("counts accepted policy acknowledgements out of the seven required keys", () => {
    const acknowledgements = Object.fromEntries(
      ["information_accurate", "not_employment_offer", "confidentiality"].map((key) => [key, true]),
    );
    expect(policySummary(acknowledgements)).toEqual({ accepted: 3, total: 7 });
  });
});

describe("Operational role assignment rules", () => {
  const base = { targetUserId: "target", currentUserId: "me", role: "partner", targetRoles: ["customer"], reason: "Runs partner onboarding" };

  it("accepts a valid operational assignment", () => {
    expect(validateRoleAssignment(base)).toBeNull();
  });

  it("blocks self-assignment", () => {
    expect(validateRoleAssignment({ ...base, targetUserId: "me" })).toMatch(/own account/);
  });

  it("blocks admin, CEO and customer roles from this tool", () => {
    for (const role of ["admin", "ceo", "customer"]) {
      expect(validateRoleAssignment({ ...base, role })).toMatch(/aren't assigned here/);
    }
  });

  it("requires a meaningful reason", () => {
    expect(validateRoleAssignment({ ...base, reason: "ok" })).toMatch(/at least 10/);
  });

  it("does not reassign a role the person already holds", () => {
    expect(validateRoleAssignment({ ...base, targetRoles: ["partner"] })).toMatch(/already holds/);
  });
});

describe("CEO dashboard source safety", () => {
  it("routes the CEO workspace to the dedicated dashboard and keeps the other branches", () => {
    const route = read("src/routes/workspace.$role.tsx");
    expect(route).toContain("workspace.key === \"ceo\" ? (");
    expect(route).toContain("<CeoDashboard");
    expect(route).toContain("<AdminDashboard");
    expect(route).toContain("<StandardWorkspace");
    expect(route).toContain("assignedRoles.includes(workspace.key)");
    expect(route).toContain('.from("user_roles")');
  });

  it("never writes to user_roles or role applications directly", () => {
    expect(ceoSource).not.toMatch(/from\("user_roles"\)\s*\.(insert|update|upsert|delete)/);
    expect(ceoSource).not.toMatch(/from\("role_applications"\)\s*\.(insert|update|upsert|delete)/);
  });

  it("calls only installed CEO RPCs that exist in the generated types", () => {
    const types = read("src/integrations/supabase/types.ts");
    const names = [...ceoSource.matchAll(/rpc\("([a-z_]+)"/g)].map((match) => match[1]);
    expect(names.length).toBeGreaterThan(0);
    for (const name of new Set(names)) {
      expect(types).toContain(`${name}: {`);
    }
  });

  it("uses the review RPC and the role-assignment RPC with their documented arguments", () => {
    expect(ceoSource).toContain('rpc("review_role_application"');
    expect(ceoSource).toContain('rpc("ceo_assign_operational_role"');
    expect(ceoSource).toContain("p_reason: reason.trim()");
  });

  it("does not sum order totals into revenue", () => {
    expect(read("src/components/ceo/CeoOperations.tsx")).not.toMatch(/\.reduce\(/);
    expect(read("src/components/ceo/CeoFinance.tsx")).not.toMatch(/\.reduce\(/);
  });

  it("keeps the AI section free of generated or sample output", () => {
    const intelligence = read("src/components/ceo/CeoIntelligence.tsx");
    expect(intelligence).toContain("Awaiting integration");
    expect(intelligence).not.toMatch(/fetch\(|functions\.invoke|supabase\.rpc/);
  });

  it("keeps the audit trail read-only and customer messages non-deletable", () => {
    const audit = read("src/components/ceo/CeoAudit.tsx");
    const experience = read("src/components/ceo/CeoCustomerExperience.tsx");
    expect(audit).not.toMatch(/\.(delete|update|insert)\(/);
    expect(experience).not.toMatch(/\.(delete|update|insert)\(/);
  });

  it("keeps the existing Administration review component in place", () => {
    expect(read("src/components/CeoAdminApplications.tsx")).toContain("CEO_APPLICATION_DOSSIER_RPC");
    expect(read("src/lib/admin-application.ts")).toContain('"get_admin_application_dossiers"');
  });
});
