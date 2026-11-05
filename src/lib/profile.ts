/**
 * Customer profile helpers.
 *
 * Only full name, contact phone and primary address are editable through the ordinary
 * profile form. Email changes go through Supabase Auth (see ChangeEmailPanel). Identity
 * fields (NEXA ID, user id, referral fields, creation date) are never written from the client,
 * and updated_at is maintained by the database trigger, so it is never sent.
 */

export const PROFILE_LIMITS = {
  fullName: 100,
  phone: 30,
  address: 300,
} as const;

export interface ProfileFormInput {
  fullName: string;
  phone: string;
  address: string;
}

export interface ProfileUpdatePayload {
  full_name: string;
  phone: string | null;
  address: string | null;
}

export function validateProfileForm(input: ProfileFormInput): string | null {
  const name = input.fullName.trim();
  if (!name) return "Full name is required.";
  if (name.length > PROFILE_LIMITS.fullName) {
    return `Full name must be ${PROFILE_LIMITS.fullName} characters or fewer.`;
  }
  if (input.phone.trim().length > PROFILE_LIMITS.phone) return "Phone number is too long.";
  if (input.address.trim().length > PROFILE_LIMITS.address) {
    return `Address is too long (${PROFILE_LIMITS.address} characters max).`;
  }
  return null;
}

/** The only object the ordinary profile form may send to the profiles table. */
export function buildProfileUpdatePayload(input: ProfileFormInput): ProfileUpdatePayload {
  return {
    full_name: input.fullName.trim(),
    phone: input.phone.trim() || null,
    address: input.address.trim() || null,
  };
}

/** Human-readable message from a Supabase/Postgrest error or Error, with a safe fallback. */
export function describeSaveError(err: unknown, fallback: string): string {
  if (err && typeof err === "object") {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

export function readPendingEmail(user: unknown): string | null {
  if (!user || typeof user !== "object") return null;
  const value = (user as { new_email?: unknown }).new_email;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function isPlausibleEmail(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed);
}

export function validateEmailChange(input: {
  currentEmail: string;
  newEmail: string;
  currentPassword: string;
}): string | null {
  if (!input.currentEmail.trim()) return "Your account has no sign-in email to verify.";
  if (!input.currentPassword) return "Enter your current password to continue.";
  const next = input.newEmail.trim().toLowerCase();
  if (!isPlausibleEmail(next)) return "Enter a valid new email address.";
  if (next === input.currentEmail.trim().toLowerCase()) {
    return "Enter an email address that is different from your current one.";
  }
  return null;
}

export function mapEmailChangeError(message?: string | null): string {
  const text = (message ?? "").toLowerCase();
  if (text.includes("invalid login credentials") || text.includes("invalid_credentials")) {
    return "The current password is incorrect.";
  }
  if (
    text.includes("email_exists") ||
    text.includes("user_already_exists") ||
    (text.includes("already") && /registered|exists|in use/.test(text))
  ) {
    return "That email address is already linked to another account.";
  }
  if (
    text.includes("rate limit") ||
    text.includes("too many") ||
    text.includes("over_email_send_rate_limit") ||
    text.includes("security purposes")
  ) {
    return "Too many attempts. Please wait a few minutes and try again.";
  }
  return "We couldn't start the email change. Please check your details and try again.";
}
