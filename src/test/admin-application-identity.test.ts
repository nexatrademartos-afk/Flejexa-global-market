import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ADMIN_POLICY_VERSION,
  DECLARATIONS,
  POLICY_ACKNOWLEDGEMENT_KEYS,
  REQUIRED_POLICY_KEYS,
  buildPolicyPayload,
  describeSubmissionError,
  emptyAdminApplicationForm,
  isValidSignatory,
  readPolicyAcknowledgements,
  validateAdminApplication,
  verifyApplicantIdentity,
  type AdminApplicationDossier,
  type AdminApplicationForm,
} from "@/lib/admin-application";

const read = (path: string) => readFileSync(resolve(__dirname, "../..", path), "utf8");

function completeForm(overrides: Partial<AdminApplicationForm> = {}): AdminApplicationForm {
  const declarations = Object.fromEntries(DECLARATIONS.map((d) => [d.key, true])) as AdminApplicationForm["declarations"];
  return {
    ...emptyAdminApplicationForm(),
    email: "thandi@example.com",
    firstName: "Thandi",
    surname: "Dlamini",
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
    signatory: "Thandi Dlamini",
    declarations,
    ...overrides,
  };
}

describe("Policy acceptance contract", () => {
  it("maps every declaration to a distinct backend key, and the keys are exactly the seven required", () => {
    expect(Object.keys(POLICY_ACKNOWLEDGEMENT_KEYS).sort()).toEqual(DECLARATIONS.map((d) => d.key).sort());
    expect([...REQUIRED_POLICY_KEYS].sort()).toEqual(
      ["access_revocable", "confidentiality", "consent_to_review", "information_accurate", "no_credential_sharing", "not_employment_offer", "security_and_privacy"],
    );
    expect(new Set(REQUIRED_POLICY_KEYS).size).toBe(7);
  });

  it("builds the exact backend payload with the policy version, normalised signatory and all seven keys true", () => {
    const payload = buildPolicyPayload(completeForm({ signatory: "  Thandi    Dlamini " }));
    expect(payload).not.toBeNull();
    expect(payload?.policy_version).toBe("nexa-admin-application-v1");
    expect(ADMIN_POLICY_VERSION).toBe("nexa-admin-application-v1");
    expect(payload?.policy_signatory_name).toBe("Thandi Dlamini");
    expect(Object.keys(payload?.policy_acknowledgements ?? {}).sort()).toEqual([...REQUIRED_POLICY_KEYS].sort());
    expect(Object.values(payload?.policy_acknowledgements ?? {}).every((v) => v === true)).toBe(true);
  });

  it("never includes a browser-generated acceptance timestamp", () => {
    const payload = buildPolicyPayload(completeForm()) as unknown as Record<string, unknown>;
    expect(payload).not.toHaveProperty("policy_accepted_at");
  });

  it("returns no payload when any declaration is not accepted or the signature is invalid", () => {
    const declarations = { ...completeForm().declarations, credentials: false };
    expect(buildPolicyPayload(completeForm({ declarations }))).toBeNull();
    expect(buildPolicyPayload(completeForm({ signatory: "" }))).toBeNull();
    expect(buildPolicyPayload(completeForm({ signatory: "Thandi2" }))).toBeNull();
  });

  it("requires every acknowledgement and the typed signature in validation", () => {
    const errors = validateAdminApplication(completeForm({ signatory: "" }));
    expect(errors.signatory).toBeTruthy();
    const declarations = { ...completeForm().declarations, revocation: false };
    expect(validateAdminApplication(completeForm({ declarations })).declarations).toBeTruthy();
  });

  it("requires a full legal name: two words, letters only", () => {
    expect(isValidSignatory("Thandi Dlamini")).toBe(true);
    expect(isValidSignatory("Anne-Marie O'Neill")).toBe(true);
    expect(isValidSignatory("Thandi")).toBe(false);
    expect(isValidSignatory("Thandi 123")).toBe(false);
    expect(isValidSignatory("x".repeat(121))).toBe(false);
  });

  it("reads stored acknowledgements back as booleans only", () => {
    expect(readPolicyAcknowledgements({ information_accurate: true, junk: "yes" })).toEqual({ information_accurate: true });
    expect(readPolicyAcknowledgements(null)).toEqual({});
    expect(readPolicyAcknowledgements(["true"])).toEqual({});
  });
});

describe("Submission error messages", () => {
  it("gives a permission message for 42501 without telling everyone to sign in", () => {
    const message = describeSubmissionError({ code: "42501" });
    expect(message).toContain("isn't allowed to submit");
    expect(message).not.toMatch(/sign in/i);
  });

  it("explains a policy mismatch separately from a permission problem", () => {
    expect(describeSubmissionError({ code: "23514" })).toContain("declarations or typed signature");
  });

  it("explains an existing pending application and a network failure", () => {
    expect(describeSubmissionError({ code: "23505" })).toContain("already have a pending");
    expect(describeSubmissionError({ code: undefined })).toContain("couldn't reach NEXA");
  });

  it("hides raw database detail from customers for any unknown code", () => {
    const message = describeSubmissionError({ code: "XX999" });
    expect(message).not.toContain("XX999");
    expect(message).toContain("could not be submitted");
  });
});

describe("Applicant identity verification for CEO review", () => {
  const application = { id: "app-1", applicant_id: "user-1" };
  const dossier = (overrides: Partial<AdminApplicationDossier> = {}): AdminApplicationDossier => ({
    application_id: "app-1",
    applicant_id: "user-1",
    nexa_id: "NEXA-0001",
    account_email: "owner@example.com",
    account_created_at: "2026-01-02T08:00:00Z",
    account_confirmed_at: "2026-01-02T08:05:00Z",
    profile_full_name: "Thandi Dlamini",
    profile_phone: "+27825550199",
    assigned_roles: ["customer"],
    ...overrides,
  });

  it("returns the authoritative identity when the record matches the application and applicant", () => {
    const identity = verifyApplicantIdentity(application, [dossier()]);
    expect(identity?.nexaId).toBe("NEXA-0001");
    expect(identity?.applicantId).toBe("user-1");
    expect(identity?.email).toBe("owner@example.com");
    expect(identity?.accountCreatedAt).toBe("2026-01-02T08:00:00Z");
    expect(identity?.roles).toEqual(["customer"]);
  });

  it("rejects a record whose applicant does not match the application's applicant_id", () => {
    expect(verifyApplicantIdentity(application, [dossier({ applicant_id: "someone-else" })])).toBeNull();
  });

  it("rejects a record for a different application", () => {
    expect(verifyApplicantIdentity(application, [dossier({ application_id: "app-2" })])).toBeNull();
  });

  it("does not verify when the NEXA ID or email is missing", () => {
    expect(verifyApplicantIdentity(application, [dossier({ nexa_id: null })])).toBeNull();
    expect(verifyApplicantIdentity(application, [dossier({ account_email: "  " })])).toBeNull();
    expect(verifyApplicantIdentity(application, [])).toBeNull();
  });
});

describe("Applicant form source contract", () => {
  const form = read("src/routes/account.admin-application.tsx");
  const identityHelper = read("src/lib/customer-identity.ts");

  it("shows the NEXA ID first and the account email second, both read-only, before other applicant fields", () => {
    const nexa = form.indexOf('ReadOnlyField id="nexaId"');
    const email = form.indexOf('ReadOnlyField id="accountEmail"');
    const firstName = form.indexOf('TextField id="firstName"');
    expect(nexa).toBeGreaterThan(0);
    expect(email).toBeGreaterThan(nexa);
    expect(firstName).toBeGreaterThan(email);
    expect(form).not.toMatch(/TextField id="(nexaId|accountEmail|email)"/);
  });

  it("resolves the NEXA ID from the authenticated user and blocks submission without it", () => {
    expect(form).toContain("fetchVerifiedNexaIdForUser(uid)");
    expect(form).toContain("fetchVerifiedNexaIdForUser(user.id)");
    expect(form).toContain("if (!nexaId) {");
    expect(form).toContain("disabled={submitting || !nexaId}");
  });

  it("takes the email from the signed-in account and checks it again before submitting", () => {
    expect(form).toContain("const accountEmail = user.email?.trim() ?? \"\";");
    expect(form).toContain("accountEmail !== form.email");
  });

  it("uses the authenticated user's id for the applicant, never a form or URL value", () => {
    expect(form).toContain("applicant_id: user.id");
    expect(form).not.toMatch(/applicant_id:\s*form\./);
    expect(form).not.toMatch(/useSearch|URLSearchParams/);
  });

  it("writes the exact policy contract and never a browser acceptance timestamp", () => {
    expect(form).toContain("policy_version: policy.policy_version");
    expect(form).toContain("policy_signatory_name: policy.policy_signatory_name");
    expect(form).toContain("policy_acknowledgements: policy.policy_acknowledgements");
    expect(form).not.toMatch(/policy_accepted_at\s*:/);
  });

  it("does not gate the form on the customer role or block accounts that hold other roles", () => {
    expect(form).not.toMatch(/role === "customer"/);
    expect(form).toMatch(/!hasAdminRole\s*&&\s*!justSubmitted/);
  });

  it("keeps the duplicate-pending protection and shows application history to Administration holders", () => {
    expect(form).toContain('describeSubmissionError(error)');
    expect(form).toContain('error.code === "23505"');
    expect(form).toContain("Your application history is kept below.");
  });

  it("never shows raw database errors to applicants", () => {
    expect(form).not.toMatch(/setSubmitError\(error\.message/);
    expect(form).not.toMatch(/setSubmitError\(.*rpcError\.message/);
  });

  it("looks up the NEXA ID by user_id, not by an unfiltered first row", () => {
    expect(identityHelper).toContain('.eq("user_id", userId)');
  });
});

describe("CEO review panel source contract", () => {
  const panel = read("src/components/CeoAdminApplications.tsx");

  it("loads authoritative identity through the CEO lookup and matches it to the application", () => {
    expect(panel).toContain("CEO_APPLICATION_DOSSIER_RPC");
    expect(panel).toContain("verifyApplicantIdentity(application, dossiers)");
  });

  it("shows NEXA ID, account UUID, email, profile name, contact and roles from verified records", () => {
    for (const label of ["NEXA ID", "Account UUID", "Authentication email", "Profile full name", "Contact number", "Assigned roles"]) {
      expect(panel).toContain(label);
    }
  });

  it("shows account registration, confirmation and submission dates from separate sources", () => {
    expect(panel).toContain("Account registered");
    expect(panel).toContain("Account email confirmed");
    expect(panel).toContain("Application submitted");
    expect(panel).toContain("identity.accountCreatedAt");
    expect(panel).not.toMatch(/Account registered[^<]*new Date\(\)/);
  });

  it("shows the full policy record: version, acceptance time, typed signature and seven declarations", () => {
    expect(panel).toContain("Policy version");
    expect(panel).toContain("Policy accepted");
    expect(panel).toContain("Typed electronic signature");
    expect(panel).toContain("policyDeclarationStatus(acknowledgements)");
  });

  it("disables approval until the identity is verified, and still decides only through review_role_application", () => {
    expect(panel).toMatch(/disabled=\{busyId !== null \|\| !identity\}/);
    expect(panel).toContain('supabase.rpc("review_role_application"');
    expect(panel).not.toMatch(/from\("role_applications"\)\s*\.update/);
  });

  it("does not treat the applicant's typed name as identity", () => {
    expect(panel).toContain("Name as typed by the applicant. It is not proof of identity.");
    expect(panel).not.toMatch(/identity\?\.fullName \?\? typedName\)\s*\}\s*\(NEXA ID/);
  });
});

describe("Proposed database contract for the workflow", () => {
  const sql = read("docs/sql/admin-application-proposed.sql");
  const customerIdentity = read("src/lib/customer-identity.ts");

  it("adds the policy record, a database-set acceptance time and the required-key trigger", () => {
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS policy_accepted_at timestamptz");
    expect(sql).toContain("NEW.policy_accepted_at := now();");
    expect(sql).toContain("BEFORE INSERT ON public.role_applications");
    for (const key of REQUIRED_POLICY_KEYS) expect(sql).toContain(`'${key}'`);
  });

  it("no longer blocks Admin or CEO accounts from submitting an application", () => {
    expect(sql).not.toContain("AND NOT public.nexa_current_user_has_role(requested_role)");
  });

  it("CEO identity lookup is CEO-only, rejects anonymous callers and is not granted to anon", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.get_admin_application_dossiers");
    expect(sql).toMatch(/IF auth\.uid\(\) IS NULL THEN[\s\S]*?IF NOT public\.nexa_current_user_has_role\('ceo'/);
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.get_admin_application_dossiers(uuid[]) FROM PUBLIC, anon;");
  });

  it("keeps CEO-only Administration approval and the existing review rules", () => {
    expect(sql).toMatch(/IF v_app\.requested_role = 'admin'::public\.app_role THEN\s+IF NOT public\.nexa_current_user_has_role\('ceo'/);
    expect(sql).toContain("You cannot review your own application");
    expect(sql).toContain("REVOKE UPDATE ON public.role_applications FROM anon, authenticated;");
  });

  it("identity lookup by NEXA ID is tied to the account user_id", () => {
    expect(sql).toContain("npi.user_id = ra.applicant_id");
    expect(customerIdentity).toContain('.eq("user_id", userId)');
  });
});
