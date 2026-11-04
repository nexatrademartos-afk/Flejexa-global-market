import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DECLARATIONS,
  applicationReference,
  buildApplicationMessage,
  emptyAdminApplicationForm,
  hasErrors,
  isValidPhone,
  parseApplicationMessage,
  validateAdminApplication,
  type AdminApplicationForm,
} from "@/lib/admin-application";

const read = (path: string) => readFileSync(resolve(__dirname, "../..", path), "utf8");

function completeForm(overrides: Partial<AdminApplicationForm> = {}): AdminApplicationForm {
  const declarations = Object.fromEntries(DECLARATIONS.map((d) => [d.key, true])) as AdminApplicationForm["declarations"];
  return {
    ...emptyAdminApplicationForm(),
    firstName: "Thandi",
    surname: "Dlamini",
    email: "thandi@example.com",
    phone: "+27 82 555 0199",
    city: "Johannesburg",
    province: "Gauteng",
    adminRole: "Operations coordinator",
    department: "Orders and Customer Operations",
    experience: "Two years in order handling.",
    skills: "Excel, customer communication",
    reason: "I want to help NEXA run smoothly.",
    contribution: "Careful order checks and clear follow-up.",
    availability: "Weekdays, 08:00 to 16:00",
    declarations,
    ...overrides,
  };
}

describe("Administration application validation", () => {
  it("accepts a complete application with every declaration confirmed", () => {
    expect(hasErrors(validateAdminApplication(completeForm()))).toBe(false);
  });

  it("requires every essential field on an empty form", () => {
    const errors = validateAdminApplication(emptyAdminApplicationForm());
    for (const field of ["firstName", "surname", "email", "phone", "city", "province", "adminRole", "department", "experience", "skills", "reason", "contribution", "availability", "declarations"] as const) {
      expect(errors[field], field).toBeTruthy();
    }
  });

  it("rejects an invalid email address", () => {
    expect(validateAdminApplication(completeForm({ email: "not-an-email" })).email).toBeTruthy();
  });

  it("requires every declaration to be confirmed", () => {
    const declarations = { ...completeForm().declarations, revocation: false };
    expect(validateAdminApplication(completeForm({ declarations })).declarations).toBeTruthy();
  });

  it("requires a description when Other is chosen as the department", () => {
    expect(validateAdminApplication(completeForm({ department: "Other", departmentOther: "" })).departmentOther).toBeTruthy();
    expect(hasErrors(validateAdminApplication(completeForm({ department: "Other", departmentOther: "Special projects" })))).toBe(false);
  });

  it("enforces field length limits", () => {
    expect(validateAdminApplication(completeForm({ reason: "x".repeat(1001) })).reason).toBeTruthy();
  });

  it("accepts realistic phone numbers and rejects letters or too few digits", () => {
    expect(isValidPhone("+27 82 555 0199")).toBe(true);
    expect(isValidPhone("082-555-0199")).toBe(true);
    expect(isValidPhone("call me")).toBe(false);
    expect(isValidPhone("12345")).toBe(false);
  });
});

describe("Application summary storage", () => {
  it("round-trips every field and declaration through the labelled message", () => {
    const form = completeForm({ department: "Other", departmentOther: "Special projects", experience: "Line one.\nLine two." });
    const parsed = parseApplicationMessage(buildApplicationMessage(form, "2026-11-04T10:00:00.000Z"));
    expect(parsed.fields.firstName).toBe("Thandi");
    expect(parsed.fields.surname).toBe("Dlamini");
    expect(parsed.fields.email).toBe("thandi@example.com");
    expect(parsed.fields.departmentOther).toBe("Special projects");
    expect(parsed.fields.experience).toBe("Line one.\nLine two.");
    expect(parsed.declarations).toHaveLength(DECLARATIONS.length);
    expect(parsed.declarations.every((d) => d.confirmed)).toBe(true);
  });

  it("returns empty results for a missing message", () => {
    expect(parseApplicationMessage(null)).toEqual({ fields: {}, declarations: [] });
  });

  it("builds a short, stable reference from the application id", () => {
    expect(applicationReference("3f2a9c1e-1234-4abc-9def-000000000000")).toBe("ADM-3F2A9C1E");
  });
});

describe("Administration application entry point and review wiring", () => {
  const workspace = read("src/routes/workspace.$role.tsx");
  const admin = read("src/routes/admin.tsx");
  const form = read("src/routes/account.admin-application.tsx");
  const panel = read("src/components/CeoAdminApplications.tsx");
  const sql = read("docs/sql/admin-application-proposed.sql");

  it("replaces the Coming Soon notice with a link to the formal application page", () => {
    expect(workspace).not.toContain("Coming Soon");
    expect(workspace).not.toContain("showAdminApplicationNotice");
    expect(workspace).toMatch(/<Link to="\/account\/admin-application"[^>]*>\s*Apply for Admin Access/);
  });

  it("keeps the protected Admin access check unchanged", () => {
    expect(workspace).toContain("access.status === \"allowed\"");
    expect(workspace).toContain("Your account is not authorised to access this workspace");
  });

  it("renders the CEO review panel only in the CEO workspace", () => {
    expect(workspace).toMatch(/workspace\.key === "ceo" && \(\s*<div[^>]*>\s*<CeoAdminApplications \/>/);
  });

  it("applicant form submits as the authenticated user, pending, with no review fields", () => {
    expect(form).toContain("applicant_id: authData.user.id");
    expect(form).toContain('requested_role: "admin"');
    expect(form).toContain('status: "pending"');
    expect(form).toContain("reviewed_by: null");
    expect(form).toContain("reviewed_at: null");
    expect(form).toContain("submittingRef");
  });

  it("does not let the applicant pick a status or reviewer", () => {
    expect(form).not.toMatch(/status:\s*"approved"/);
  });

  it("CEO panel decides only through the secure review RPC", () => {
    expect(panel).toContain('supabase.rpc("review_role_application"');
    expect(panel).not.toMatch(/from\("role_applications"\)\s*\.update/);
    expect(panel).toContain('.eq("requested_role", "admin")');
  });

  it("Admin dashboard no longer writes application status directly and hides Administration applications", () => {
    expect(admin).toContain('supabase.rpc("review_role_application"');
    expect(admin).not.toMatch(/from\("role_applications"\)\.update/);
    expect(admin).toContain('.neq("requested_role", "admin")');
    expect(admin).toContain("Administration applications can only be decided by the CEO.");
  });

  it("proposed SQL keeps CEO-only Administration approval and no client UPDATE path", () => {
    expect(sql).toContain("requested_role::text IN ('partner', 'delivery', 'commission', 'admin')");
    expect(sql).toContain("REVOKE UPDATE ON public.role_applications FROM anon, authenticated;");
    expect(sql).toMatch(/IF v_app\.requested_role = 'admin'::public\.app_role THEN\s+IF NOT public\.nexa_current_user_has_role\('ceo'/);
    expect(sql).toContain("You cannot review your own application");
    expect(sql).toContain("Only pending applications can be reviewed");
    expect(sql).toContain("WHERE NOT EXISTS");
  });
});
