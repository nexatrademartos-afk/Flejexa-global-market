// CEO Executive Dashboard: shared data helpers, error mapping and the loading hook.
// Every number, list and status comes from a CEO-only Supabase RPC. Nothing here grants access:
// the backend verifies the caller's CEO role on every call.

import { useCallback, useEffect, useRef, useState } from "react";
import { readPolicyAcknowledgements, REQUIRED_POLICY_KEYS } from "@/lib/admin-application";

export type JsonRecord = Record<string, unknown>;

export const OPERATIONAL_ROLES = ["partner", "delivery", "commission", "finance", "security"] as const;
export type OperationalRole = (typeof OPERATIONAL_ROLES)[number];

export const ROLE_LABELS: Record<string, string> = {
  customer: "Customer",
  partner: "Business Partner",
  delivery: "Delivery",
  commission: "Commission Partner",
  admin: "Administration",
  ceo: "CEO",
  finance: "Finance",
  security: "Security",
};

const STAFF_ROLES = ["admin", "partner", "delivery", "commission", "finance", "security"];

export const APPLICATION_TABS = [
  { key: "admin", label: "Administration" },
  { key: "partner", label: "Partner" },
  { key: "delivery", label: "Delivery" },
  { key: "commission", label: "Commission" },
  { key: "ceo", label: "CEO" },
] as const;
export type ApplicationTabKey = (typeof APPLICATION_TABS)[number]["key"];

// ---- Errors -----------------------------------------------------------------------------------

export interface RpcErrorLike {
  code?: string | undefined;
  message?: string | undefined;
}

export type CeoErrorKind = "session" | "denied" | "unavailable" | "network" | "failed";
export interface CeoRpcError {
  kind: CeoErrorKind;
  message: string;
}
export type CeoResult<T> = { data: T; error: null } | { data: null; error: CeoRpcError };

export function describeCeoError(error: RpcErrorLike | null): CeoRpcError {
  if (!error) {
    return { kind: "network", message: "We couldn't reach NEXA's secure backend. Check your connection and try again." };
  }
  const message = error.message ?? "";
  if (error.code === "PGRST301" || /jwt|expired/i.test(message)) {
    return { kind: "session", message: "Your session has expired. Sign in again to continue." };
  }
  if (error.code === "42501") {
    return { kind: "denied", message: "Your CEO access couldn't be confirmed for this information." };
  }
  if (error.code === "PGRST202" || error.code === "42883") {
    return { kind: "unavailable", message: "This executive report isn't available yet." };
  }
  if (!error.code) {
    return { kind: "network", message: "We couldn't reach NEXA's secure backend. Check your connection and try again." };
  }
  return { kind: "failed", message: "This information couldn't be loaded. Refresh to try again." };
}

export function describeReviewError(code: string | undefined): string {
  switch (code) {
    case "42501":
      return "Your CEO access couldn't be confirmed for this decision, or this is your own application.";
    case "55000":
      return "This application has already been decided. Refresh the list to see its current status.";
    case "P0002":
      return "This application no longer exists. Refresh the list and try again.";
    case "22001":
      return "The review note is too long. Keep it to 500 characters.";
    default:
      return "The decision could not be recorded. Please try again. If this continues, contact NEXA support.";
  }
}

export function describeAssignmentError(code: string | undefined): string {
  switch (code) {
    case "42501":
      return "This assignment isn't permitted for your account, or it isn't allowed under the current rules.";
    case "23505":
      return "This person already holds that role.";
    case "22023":
    case "22001":
      return "The role or reason wasn't accepted. Check the details and try again.";
    default:
      return "The role could not be assigned. Refresh the directory and try again. If this continues, contact NEXA support.";
  }
}

// Runs one RPC and maps any failure to a safe message. Raw database messages are never returned to the UI.
export async function callCeoRpc<T>(
  call: () => PromiseLike<{ data: unknown; error: RpcErrorLike | null }>,
  parse: (raw: unknown) => T,
): Promise<CeoResult<T>> {
  try {
    const { data, error } = await call();
    if (error) {
      console.error("CEO dashboard request failed:", error);
      return { data: null, error: describeCeoError(error) };
    }
    return { data: parse(data), error: null };
  } catch (caught) {
    console.error("CEO dashboard request could not run:", caught);
    return { data: null, error: describeCeoError(null) };
  }
}

// ---- Loading hook -----------------------------------------------------------------------------

export interface ResourceState<T> {
  status: "idle" | "loading" | "ready" | "error";
  data: T | null;
  error: CeoRpcError | null;
  loadedAt: string | null;
}

export interface ResourceView<T> extends ResourceState<T> {
  reload: () => void;
}

// Loads once, the first time `enabled` becomes true. Stale responses are ignored.
export function useCeoResource<T>(load: () => Promise<CeoResult<T>>, enabled: boolean): ResourceView<T> {
  const [state, setState] = useState<ResourceState<T>>({ status: "idle", data: null, error: null, loadedAt: null });
  const loaderRef = useRef(load);
  const requestRef = useRef(0);
  const startedRef = useRef(false);

  useEffect(() => {
    loaderRef.current = load;
  }, [load]);

  const run = useCallback(async () => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setState((previous) => ({ ...previous, status: "loading", error: null }));
    const result = await loaderRef.current();
    if (requestRef.current !== requestId) return;
    if (result.error) {
      setState((previous) => ({ status: "error", data: previous.data, error: result.error, loadedAt: previous.loadedAt }));
    } else {
      setState({ status: "ready", data: result.data, error: null, loadedAt: new Date().toISOString() });
    }
  }, []);

  useEffect(() => {
    if (enabled && !startedRef.current) {
      startedRef.current = true;
      void run();
    }
  }, [enabled, run]);

  return { ...state, reload: () => void run() };
}

// ---- Tolerant readers -------------------------------------------------------------------------
// Fields the backend returns are read defensively. A missing or malformed value becomes null, never zero.

export function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

export function asRows(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.flatMap((item) => (asRecord(item) ? [item as JsonRecord] : [])) : [];
}

// Rows under `key` of an object response, or the array itself.
export function rowsAt(raw: unknown, key: string): JsonRecord[] {
  return Array.isArray(raw) ? asRows(raw) : asRows(asRecord(raw)?.[key]);
}

export function asText(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

export function asNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

export function asBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

export function firstText(row: JsonRecord, keys: readonly string[]): string | null {
  for (const key of keys) {
    const text = asText(row[key]);
    if (text) return text;
  }
  return null;
}

export function firstNumber(row: JsonRecord, keys: readonly string[]): number | null {
  for (const key of keys) {
    const number = asNumber(row[key]);
    if (number !== null) return number;
  }
  return null;
}

export function valueAt(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => asRecord(current)?.[key], source);
}

export function numberAt(source: unknown, path: string): number | null {
  return asNumber(valueAt(source, path));
}

export function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const text = typeof item === "string" ? item.trim() : asText(asRecord(item)?.["role"]);
    return text ? [text] : [];
  });
}

export function humanise(label: string): string {
  return label.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export interface CountRow {
  label: string;
  count: number;
}

const LABEL_KEYS = ["status", "payment_status", "payment_method", "role", "category", "category_name", "name", "label", "key", "source", "bucket", "day", "date"];
const COUNT_KEYS = ["count", "total", "orders", "registrations", "value", "n", "quantity"];

// Accepts an object map ({ pending: 3 }) or an array of rows ([{ status: "pending", count: 3 }]).
export function countRows(value: unknown): CountRow[] {
  if (Array.isArray(value)) {
    return asRows(value).flatMap((row) => {
      const label = firstText(row, LABEL_KEYS);
      const count = firstNumber(row, COUNT_KEYS);
      return label && count !== null ? [{ label: humanise(label), count }] : [];
    });
  }
  const map = asRecord(value);
  if (!map) return [];
  return Object.entries(map).flatMap(([label, count]) => {
    const number = asNumber(count);
    return number === null ? [] : [{ label: humanise(label), count: number }];
  });
}

export function formatCount(value: number | null): string {
  return value === null ? "Not reported" : value.toLocaleString("en-ZA");
}

// Order values are shown as individual amounts only. They are never summed into revenue.
export function formatAmount(value: number | null, currency: string | null): string {
  if (value === null) return "Not reported";
  if (currency && /^[A-Z]{3}$/.test(currency)) {
    try {
      return new Intl.NumberFormat("en-ZA", { style: "currency", currency }).format(value);
    } catch {
      // Fall through to the plain format below.
    }
  }
  return `${value.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (currency not reported)`;
}

export function shortId(id: string | null): string {
  return id ? `${id.slice(0, 8)}…` : "Not recorded";
}

// ---- Analytics range --------------------------------------------------------------------------

export const ANALYTICS_MAX_DAYS = 365;

export function isoDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

// Inclusive range ending today, capped below the backend's 366-day limit.
export function rangeForDays(days: number, today: Date = new Date()): { start: string; end: string } {
  const span = Math.min(Math.max(1, Math.floor(days)), ANALYTICS_MAX_DAYS);
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const start = new Date(end);
  start.setDate(end.getDate() - (span - 1));
  return { start: isoDay(start), end: isoDay(end) };
}

// ---- Applications -----------------------------------------------------------------------------

export interface RoleApplication {
  application_id: string;
  applicant_id: string;
  requested_role: string;
  application_message: string | null;
  application_status: string;
  application_created_at: string | null;
  application_updated_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  policy_version: string | null;
  policy_accepted_at: string | null;
  policy_signatory_name: string | null;
  policy_acknowledgements: unknown;
  nexa_id: string | null;
  applicant_email: string | null;
  profile_full_name: string | null;
  profile_phone: string | null;
  profile_address: string | null;
  legacy_customer_code: string | null;
  account_created_at: string | null;
  account_confirmed_at: string | null;
  existing_roles: string[];
}

export function parseRoleApplications(raw: unknown): RoleApplication[] {
  return rowsAt(raw, "applications").flatMap((row) => {
    const applicationId = firstText(row, ["application_id", "id"]);
    const applicantId = firstText(row, ["applicant_id"]);
    const requestedRole = firstText(row, ["requested_role"]);
    if (!applicationId || !applicantId || !requestedRole) return [];
    return [{
      application_id: applicationId,
      applicant_id: applicantId,
      requested_role: requestedRole,
      application_message: asText(row["application_message"]),
      application_status: firstText(row, ["application_status", "status"]) ?? "unknown",
      application_created_at: asText(row["application_created_at"]),
      application_updated_at: asText(row["application_updated_at"]),
      reviewed_by: asText(row["reviewed_by"]),
      reviewed_at: asText(row["reviewed_at"]),
      review_notes: asText(row["review_notes"]),
      policy_version: asText(row["policy_version"]),
      policy_accepted_at: asText(row["policy_accepted_at"]),
      policy_signatory_name: asText(row["policy_signatory_name"]),
      policy_acknowledgements: row["policy_acknowledgements"] ?? null,
      nexa_id: asText(row["nexa_id"]),
      applicant_email: asText(row["applicant_email"]),
      profile_full_name: asText(row["profile_full_name"]),
      profile_phone: asText(row["profile_phone"]),
      profile_address: asText(row["profile_address"]),
      legacy_customer_code: asText(row["legacy_customer_code"]),
      account_created_at: asText(row["account_created_at"]),
      account_confirmed_at: asText(row["account_confirmed_at"]),
      existing_roles: stringList(row["existing_roles"]),
    }];
  });
}

export function policySummary(value: unknown): { accepted: number; total: number } {
  const acknowledgements = readPolicyAcknowledgements(value);
  return {
    accepted: REQUIRED_POLICY_KEYS.filter((key) => acknowledgements[key] === true).length,
    total: REQUIRED_POLICY_KEYS.length,
  };
}

// The identity used before approving: both values must come from the backend record, never from typed text.
export function hasTrustedIdentity(application: Pick<RoleApplication, "nexa_id" | "applicant_email">): boolean {
  return Boolean(application.nexa_id && application.applicant_email);
}

// ---- People -----------------------------------------------------------------------------------

export interface DirectoryPerson {
  user_id: string;
  email: string | null;
  email_confirmed: boolean | null;
  account_created_at: string | null;
  full_name: string | null;
  phone: string | null;
  nexa_id: string | null;
  roles: string[];
}

export type PersonGroup = "customers" | "staff" | "executive";

export function groupOf(roles: string[]): PersonGroup {
  if (roles.includes("ceo")) return "executive";
  if (roles.some((role) => STAFF_ROLES.includes(role))) return "staff";
  return "customers";
}

export const GROUP_LABELS: Record<PersonGroup, string> = {
  customers: "Customer",
  staff: "Operational staff",
  executive: "Executive",
};

export function parsePeople(raw: unknown): DirectoryPerson[] {
  return rowsAt(raw, "people").flatMap((row) => {
    const userId = firstText(row, ["user_id"]);
    if (!userId) return [];
    return [{
      user_id: userId,
      email: asText(row["email"]),
      email_confirmed: asBoolean(row["email_confirmed"]),
      account_created_at: asText(row["account_created_at"]),
      full_name: asText(row["full_name"]),
      phone: asText(row["phone"]),
      nexa_id: asText(row["nexa_id"]),
      roles: stringList(row["roles"]),
    }];
  });
}

export function filterPeople(people: DirectoryPerson[], query: string, group: PersonGroup | "all"): DirectoryPerson[] {
  const needle = query.trim().toLowerCase();
  return people.filter((person) => {
    if (group !== "all" && groupOf(person.roles) !== group) return false;
    if (!needle) return true;
    return [person.full_name, person.email, person.nexa_id, ...person.roles]
      .some((value) => (value ?? "").toLowerCase().includes(needle));
  });
}

export const REASON_MIN_LENGTH = 10;
export const REASON_MAX_LENGTH = 500;

// Client-side checks for clarity only. ceo_assign_operational_role enforces the same rules on the server.
export function validateRoleAssignment(input: {
  targetUserId: string | null;
  currentUserId: string;
  role: string;
  targetRoles: string[];
  reason: string;
}): string | null {
  if (!input.targetUserId) return "Choose a person from the directory.";
  if (input.targetUserId === input.currentUserId) return "You can't assign a role to your own account.";
  if (!(OPERATIONAL_ROLES as readonly string[]).includes(input.role)) {
    return "Choose an operational role. Administration and CEO roles aren't assigned here, and customer roles aren't assigned by this tool.";
  }
  if (input.targetRoles.includes(input.role)) return "This person already holds that role.";
  const reason = input.reason.trim();
  if (reason.length < REASON_MIN_LENGTH) return `Give a clear reason (at least ${REASON_MIN_LENGTH} characters).`;
  if (reason.length > REASON_MAX_LENGTH) return `Keep the reason to ${REASON_MAX_LENGTH} characters.`;
  return null;
}

// ---- Audit ------------------------------------------------------------------------------------

export interface AuditEntry {
  audit_id: string;
  actor_user_id: string | null;
  target_user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: unknown;
  created_at: string | null;
}

export function parseAudit(raw: unknown): AuditEntry[] {
  const rows = Array.isArray(raw) ? asRows(raw) : asRows(asRecord(raw)?.["entries"] ?? asRecord(raw)?.["audit"] ?? asRecord(raw)?.["records"]);
  return rows.flatMap((row) => {
    const auditId = firstText(row, ["audit_id", "id"]);
    const action = firstText(row, ["action"]);
    if (!auditId || !action) return [];
    return [{
      audit_id: auditId,
      actor_user_id: asText(row["actor_user_id"]),
      target_user_id: asText(row["target_user_id"]),
      action,
      entity_type: asText(row["entity_type"]),
      entity_id: asText(row["entity_id"]),
      details: row["details"] ?? null,
      created_at: asText(row["created_at"]),
    }];
  });
}
