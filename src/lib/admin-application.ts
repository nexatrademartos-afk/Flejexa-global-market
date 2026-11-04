// Administration employment application: shared field rules, validation, the database policy
// contract, identity verification helpers and the labelled summary stored in
// role_applications.application_message.
// Authorisation is enforced in Supabase (RLS, triggers and review_role_application). Nothing here grants access.

export const ADMIN_APPLICATION_VERSION = 1;

// Exact value the database expects in role_applications.policy_version.
export const ADMIN_POLICY_VERSION = "nexa-admin-application-v1";

export const DEPARTMENTS = [
  "General Operations",
  "Products and Catalogue",
  "Orders and Customer Operations",
  "Customer Support",
  "Marketing and Promotions",
  "Inventory and Warehouse Operations",
  "Supplier and Partner Operations",
  "Other",
] as const;

export const DECLARATIONS = [
  { key: "accurate", text: "The information I have submitted is accurate and complete." },
  { key: "notOffer", text: "I understand this is an application, not an offer of employment." },
  { key: "reviewSubject", text: "I understand approval is subject to executive review." },
  { key: "confidentiality", text: "I will keep NEXA business and customer information confidential." },
  { key: "credentials", text: "I will not share my credentials or access internal information without authorisation." },
  { key: "policies", text: "I will follow NEXA security, privacy, acceptable-use and workplace policies." },
  { key: "revocation", text: "I understand Administration access may be suspended or revoked if authorisation is withdrawn." },
] as const;

export type DeclarationKey = (typeof DECLARATIONS)[number]["key"];

// Maps each on-screen declaration to the exact acknowledgement key the backend requires.
export const POLICY_ACKNOWLEDGEMENT_KEYS: Record<DeclarationKey, string> = {
  accurate: "information_accurate",
  notOffer: "not_employment_offer",
  reviewSubject: "consent_to_review",
  confidentiality: "confidentiality",
  credentials: "no_credential_sharing",
  policies: "security_and_privacy",
  revocation: "access_revocable",
};

export const REQUIRED_POLICY_KEYS = Object.values(POLICY_ACKNOWLEDGEMENT_KEYS);

export interface AdminApplicationForm {
  firstName: string;
  surname: string;
  // Set from the authenticated account only. The applicant cannot edit it.
  email: string;
  phone: string;
  city: string;
  province: string;
  adminRole: string;
  department: string;
  departmentOther: string;
  experience: string;
  skills: string;
  reason: string;
  contribution: string;
  availability: string;
  signatory: string;
  declarations: Record<DeclarationKey, boolean>;
}

export type AdminApplicationErrors = Partial<Record<Exclude<keyof AdminApplicationForm, "declarations">, string | undefined>> & {
  declarations?: string | undefined;
};

export const FIELD_LIMITS = {
  name: 80,
  email: 254,
  phone: 20,
  place: 80,
  adminRole: 100,
  departmentOther: 100,
  experience: 1500,
  skills: 800,
  reason: 1000,
  contribution: 1000,
  availability: 500,
  signature: 120,
} as const;

export const IDENTITY_UNVERIFIED_MESSAGE =
  "We couldn't verify the NEXA ID for this account, so the application can't be submitted yet. Refresh this page or contact NEXA support.";

export function emptyAdminApplicationForm(): AdminApplicationForm {
  return {
    firstName: "",
    surname: "",
    email: "",
    phone: "",
    city: "",
    province: "",
    adminRole: "",
    department: "",
    departmentOther: "",
    experience: "",
    skills: "",
    reason: "",
    contribution: "",
    availability: "",
    signatory: "",
    declarations: Object.fromEntries(DECLARATIONS.map((d) => [d.key, false])) as Record<DeclarationKey, boolean>,
  };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Letters, spaces, apostrophes, hyphens and full stops. Must start with a letter.
const SIGNATURE_PATTERN = /^\p{L}[\p{L}\s.'-]*$/u;

export function isValidPhone(value: string): boolean {
  const trimmed = value.trim();
  if (!/^\+?[0-9 ()-]+$/.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

export function normaliseSignatory(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

// The typed signature must look like a full legal name: at least two words, letters only.
export function isValidSignatory(value: string): boolean {
  const name = normaliseSignatory(value);
  if (name.length < 2 || name.length > FIELD_LIMITS.signature) return false;
  if (!SIGNATURE_PATTERN.test(name)) return false;
  return name.split(" ").length >= 2;
}

export function validateAdminApplication(form: AdminApplicationForm): AdminApplicationErrors {
  const errors: AdminApplicationErrors = {};
  const required = (value: string) => value.trim().length > 0;

  if (!required(form.email)) errors.email = "Your account email couldn't be confirmed. Sign out and sign in again.";
  else if (form.email.trim().length > FIELD_LIMITS.email || !EMAIL_PATTERN.test(form.email.trim())) {
    errors.email = "Your account email isn't in a valid format. Sign out and sign in again.";
  }

  if (!required(form.firstName)) errors.firstName = "Enter your first name.";
  else if (form.firstName.trim().length > FIELD_LIMITS.name) errors.firstName = `Keep first name to ${FIELD_LIMITS.name} characters.`;

  if (!required(form.surname)) errors.surname = "Enter your surname.";
  else if (form.surname.trim().length > FIELD_LIMITS.name) errors.surname = `Keep surname to ${FIELD_LIMITS.name} characters.`;

  if (!required(form.phone)) errors.phone = "Enter a contact phone number.";
  else if (!isValidPhone(form.phone)) errors.phone = "Enter a valid phone number (7 to 15 digits, optional leading +).";

  if (!required(form.city)) errors.city = "Enter your city.";
  else if (form.city.trim().length > FIELD_LIMITS.place) errors.city = `Keep city to ${FIELD_LIMITS.place} characters.`;

  if (!required(form.province)) errors.province = "Enter your province.";
  else if (form.province.trim().length > FIELD_LIMITS.place) errors.province = `Keep province to ${FIELD_LIMITS.place} characters.`;

  if (!required(form.adminRole)) errors.adminRole = "Describe the Administration role you are applying for.";
  else if (form.adminRole.trim().length > FIELD_LIMITS.adminRole) errors.adminRole = `Keep the role to ${FIELD_LIMITS.adminRole} characters.`;

  if (!form.department) errors.department = "Choose a preferred department or area.";
  if (form.department === "Other") {
    if (!required(form.departmentOther)) errors.departmentOther = "Describe the area you prefer.";
    else if (form.departmentOther.trim().length > FIELD_LIMITS.departmentOther) errors.departmentOther = `Keep this to ${FIELD_LIMITS.departmentOther} characters.`;
  }

  const longText: [keyof typeof FIELD_LIMITS, keyof AdminApplicationForm, string][] = [
    ["experience", "experience", "Describe your previous or relevant experience."],
    ["skills", "skills", "List your relevant skills."],
    ["reason", "reason", "Tell us why you are applying."],
    ["contribution", "contribution", "Tell us what you believe you can contribute."],
    ["availability", "availability", "Tell us your availability and expected working schedule."],
  ];
  for (const [limitKey, field, missing] of longText) {
    const value = String(form[field]);
    if (!required(value)) errors[field as keyof AdminApplicationErrors] = missing;
    else if (value.trim().length > FIELD_LIMITS[limitKey]) errors[field as keyof AdminApplicationErrors] = `Keep this to ${FIELD_LIMITS[limitKey]} characters.`;
  }

  if (!required(form.signatory)) errors.signatory = "Type your full legal name to sign this application.";
  else if (normaliseSignatory(form.signatory).length > FIELD_LIMITS.signature) errors.signatory = `Keep your signature to ${FIELD_LIMITS.signature} characters.`;
  else if (!isValidSignatory(form.signatory)) errors.signatory = "Type your full legal name: your first name and surname, using letters only.";

  if (DECLARATIONS.some((d) => !form.declarations[d.key])) {
    errors.declarations = "Confirm every declaration before submitting.";
  }

  return errors;
}

export function hasErrors(errors: AdminApplicationErrors): boolean {
  return Object.values(errors).some(Boolean);
}

export interface AdminPolicyPayload {
  policy_version: typeof ADMIN_POLICY_VERSION;
  policy_signatory_name: string;
  policy_acknowledgements: Record<string, boolean>;
}

// Builds the exact backend policy contract. Returns null unless every declaration is accepted and the
// signature is valid. The database sets policy_accepted_at itself, so no timestamp is sent here.
export function buildPolicyPayload(form: AdminApplicationForm): AdminPolicyPayload | null {
  if (!isValidSignatory(form.signatory)) return null;
  if (DECLARATIONS.some((d) => !form.declarations[d.key])) return null;

  const acknowledgements = Object.fromEntries(
    DECLARATIONS.map((d) => [POLICY_ACKNOWLEDGEMENT_KEYS[d.key], true]),
  ) as Record<string, boolean>;

  return {
    policy_version: ADMIN_POLICY_VERSION,
    policy_signatory_name: normaliseSignatory(form.signatory),
    policy_acknowledgements: acknowledgements,
  };
}

// Reads the stored acknowledgements back as booleans. Anything that is not a boolean is ignored.
export function readPolicyAcknowledgements(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, v]) => typeof v === "boolean")) as Record<string, boolean>;
}

export function policyDeclarationStatus(acknowledgements: Record<string, boolean>): { text: string; accepted: boolean }[] {
  return DECLARATIONS.map((d) => ({
    text: d.text,
    accepted: acknowledgements[POLICY_ACKNOWLEDGEMENT_KEYS[d.key]] === true,
  }));
}

// Labelled summary stored in application_message. Labels are fixed so the CEO panel can read it back.
const SECTION_LABELS = {
  firstName: "First name",
  surname: "Surname",
  email: "Email",
  phone: "Phone",
  city: "City",
  province: "Province",
  adminRole: "Administration role",
  department: "Preferred department",
  departmentOther: "Other area",
  experience: "Experience",
  skills: "Relevant skills",
  reason: "Reason for applying",
  contribution: "Expected contribution",
  availability: "Availability and schedule",
} as const;

export function buildApplicationMessage(form: AdminApplicationForm, submittedAt: string): string {
  const lines: string[] = [
    "NEXA ADMINISTRATION EMPLOYMENT APPLICATION",
    `Form version: ${ADMIN_APPLICATION_VERSION}`,
    `Submitted: ${submittedAt}`,
    "",
    "[Applicant information]",
    `${SECTION_LABELS.firstName}: ${form.firstName.trim()}`,
    `${SECTION_LABELS.surname}: ${form.surname.trim()}`,
    `${SECTION_LABELS.email}: ${form.email.trim()}`,
    `${SECTION_LABELS.phone}: ${form.phone.trim()}`,
    `${SECTION_LABELS.city}: ${form.city.trim()}`,
    `${SECTION_LABELS.province}: ${form.province.trim()}`,
    "",
    "[Position]",
    `${SECTION_LABELS.adminRole}: ${form.adminRole.trim()}`,
    `${SECTION_LABELS.department}: ${form.department}`,
  ];
  if (form.department === "Other") lines.push(`${SECTION_LABELS.departmentOther}: ${form.departmentOther.trim()}`);
  lines.push(
    "",
    "[Experience and suitability]",
    `${SECTION_LABELS.experience}: ${form.experience.trim()}`,
    `${SECTION_LABELS.skills}: ${form.skills.trim()}`,
    `${SECTION_LABELS.reason}: ${form.reason.trim()}`,
    `${SECTION_LABELS.contribution}: ${form.contribution.trim()}`,
    `${SECTION_LABELS.availability}: ${form.availability.trim()}`,
    "",
    "[Declarations]",
    ...DECLARATIONS.map((d) => `${form.declarations[d.key] ? "[x]" : "[ ]"} ${d.text}`),
    "",
    "[Policy acceptance]",
    `Policy version: ${ADMIN_POLICY_VERSION}`,
    `Typed signature: ${normaliseSignatory(form.signatory)}`,
  );
  return lines.join("\n");
}

export interface ParsedApplication {
  fields: Partial<Record<keyof typeof SECTION_LABELS, string>>;
  declarations: { text: string; confirmed: boolean }[];
}

const KNOWN_LABELS = Object.values(SECTION_LABELS);

// Reads back a message written by buildApplicationMessage. Unknown text is ignored, never executed.
// Applicant-typed values are not identity evidence; the CEO panel uses verified account records instead.
export function parseApplicationMessage(message: string | null | undefined): ParsedApplication {
  const fields: ParsedApplication["fields"] = {};
  const declarations: ParsedApplication["declarations"] = [];
  if (!message) return { fields, declarations };

  const labelToKey = Object.fromEntries(
    (Object.keys(SECTION_LABELS) as (keyof typeof SECTION_LABELS)[]).map((k) => [SECTION_LABELS[k], k]),
  ) as Record<string, keyof typeof SECTION_LABELS>;

  let current: keyof typeof SECTION_LABELS | null = null;
  let inDeclarations = false;

  for (const rawLine of message.split("\n")) {
    const line = rawLine.trimEnd();
    if (line.startsWith("[Declarations]")) {
      inDeclarations = true;
      current = null;
      continue;
    }
    if (inDeclarations) {
      const match = line.match(/^\[( |x)\] (.*)$/);
      if (match) declarations.push({ text: match[2] ?? "", confirmed: match[1] === "x" });
      continue;
    }
    if (line.startsWith("[")) {
      current = null;
      continue;
    }
    const labelMatch = line.match(/^([^:]+): (.*)$/);
    const label = labelMatch?.[1] ?? "";
    const value = labelMatch?.[2] ?? "";
    const key = labelToKey[label];
    if (labelMatch && key && KNOWN_LABELS.includes(label as (typeof KNOWN_LABELS)[number])) {
      current = key;
      fields[key] = value;
    } else if (current && line.length > 0) {
      fields[current] = `${fields[current] ?? ""}\n${line}`;
    }
  }

  return { fields, declarations };
}

export function applicationReference(id: string): string {
  return `ADM-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export const APPLICATION_STATUS_COPY = {
  pending: "Awaiting review",
  approved: "Approved",
  rejected: "Not approved",
} as const;

export function formatRecordDateTime(value: string | null | undefined): string {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" });
}

// Maps a submission error to applicant-facing copy. Raw database messages are never shown.
export function describeSubmissionError(error: { code?: string | undefined } | null | undefined): string {
  switch (error?.code) {
    case "23505":
      return "You already have a pending Administration application. Refresh this page to see its status.";
    case "42501":
      return "Your account isn't allowed to submit this application. If you believe this is a mistake, contact NEXA support.";
    case "23514":
      return "Your declarations or typed signature couldn't be recorded. Check every declaration and your full legal name, then try again.";
    case "42703":
    case "42P01":
    case "PGRST204":
      return "Administration applications aren't available right now. Please try again later.";
    case undefined:
    case "":
      return "We couldn't reach NEXA. Check your connection and try again.";
    default:
      return "Your application could not be submitted. Please try again. If this continues, contact NEXA support.";
  }
}

// ---- CEO review: authoritative applicant identity -------------------------------------------------

// Name of the secure, CEO-only lookup that returns verified account records for pending Administration applications.
// Contract: docs/admin-application-contract.md. Until it is installed the panel shows identity as unverified.
export const CEO_APPLICATION_DOSSIER_RPC = "get_admin_application_dossiers";

export interface AdminApplicationDossier {
  application_id: string;
  applicant_id: string;
  nexa_id: string | null;
  account_email: string | null;
  account_created_at: string | null;
  account_confirmed_at: string | null;
  profile_full_name: string | null;
  profile_phone: string | null;
  assigned_roles: string[] | null;
}

export interface VerifiedApplicantIdentity {
  nexaId: string;
  applicantId: string;
  email: string;
  accountCreatedAt: string | null;
  accountConfirmedAt: string | null;
  fullName: string | null;
  phone: string | null;
  roles: string[];
}

// Returns verified identity only when the record belongs to this exact application and applicant account.
export function verifyApplicantIdentity(
  application: { id: string; applicant_id: string },
  dossiers: AdminApplicationDossier[],
): VerifiedApplicantIdentity | null {
  const row = dossiers.find((d) => d.application_id === application.id);
  if (!row || row.applicant_id !== application.applicant_id) return null;

  const nexaId = row.nexa_id?.trim() ?? "";
  const email = row.account_email?.trim() ?? "";
  if (!nexaId || !email) return null;

  return {
    nexaId,
    applicantId: row.applicant_id,
    email,
    accountCreatedAt: row.account_created_at,
    accountConfirmedAt: row.account_confirmed_at,
    fullName: row.profile_full_name?.trim() || null,
    phone: row.profile_phone?.trim() || null,
    roles: row.assigned_roles ?? [],
  };
}
