// Administration employment application: shared field rules, validation and the
// labelled summary stored in role_applications.application_message.
// Authorisation is enforced in Supabase (RLS + review_role_application). Nothing here grants access.

export const ADMIN_APPLICATION_VERSION = 1;

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

export interface AdminApplicationForm {
  firstName: string;
  surname: string;
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
  declarations: Record<DeclarationKey, boolean>;
}

export type AdminApplicationErrors = Partial<Record<keyof Omit<AdminApplicationForm, "declarations">, string | undefined>> & {
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
} as const;

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
    declarations: Object.fromEntries(DECLARATIONS.map((d) => [d.key, false])) as Record<DeclarationKey, boolean>,
  };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidPhone(value: string): boolean {
  const trimmed = value.trim();
  if (!/^\+?[0-9 ()-]+$/.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

export function validateAdminApplication(form: AdminApplicationForm): AdminApplicationErrors {
  const errors: AdminApplicationErrors = {};
  const required = (value: string) => value.trim().length > 0;

  if (!required(form.firstName)) errors.firstName = "Enter your first name.";
  else if (form.firstName.trim().length > FIELD_LIMITS.name) errors.firstName = `Keep first name to ${FIELD_LIMITS.name} characters.`;

  if (!required(form.surname)) errors.surname = "Enter your surname.";
  else if (form.surname.trim().length > FIELD_LIMITS.name) errors.surname = `Keep surname to ${FIELD_LIMITS.name} characters.`;

  if (!required(form.email)) errors.email = "Enter your email address.";
  else if (form.email.trim().length > FIELD_LIMITS.email || !EMAIL_PATTERN.test(form.email.trim())) errors.email = "Enter a valid email address.";

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

  if (DECLARATIONS.some((d) => !form.declarations[d.key])) {
    errors.declarations = "Confirm every declaration before submitting.";
  }

  return errors;
}

export function hasErrors(errors: AdminApplicationErrors): boolean {
  return Object.values(errors).some(Boolean);
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
  );
  return lines.join("\n");
}

export interface ParsedApplication {
  fields: Partial<Record<keyof typeof SECTION_LABELS, string>>;
  declarations: { text: string; confirmed: boolean }[];
}

const KNOWN_LABELS = Object.values(SECTION_LABELS);

// Reads back a message written by buildApplicationMessage. Unknown text is ignored, never executed.
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
