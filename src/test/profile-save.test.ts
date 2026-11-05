import { describe, expect, it } from "vitest";
import {
  buildProfileUpdatePayload,
  describeSaveError,
  mapEmailChangeError,
  readPendingEmail,
  validateEmailChange,
  validateProfileForm,
} from "@/lib/profile";

describe("profile save payload", () => {
  it("sends only the three editable columns and never updated_at", () => {
    const payload = buildProfileUpdatePayload({
      fullName: "  Thulani Joseph  ",
      phone: " +27 82 123 4567 ",
      address: " 1 Main Road, Johannesburg ",
    });

    expect(Object.keys(payload).sort()).toEqual(["address", "full_name", "phone"]);
    expect(payload).not.toHaveProperty("updated_at");
    expect(payload).not.toHaveProperty("email");
    expect(payload).not.toHaveProperty("customer_code");
    expect(payload).toEqual({
      full_name: "Thulani Joseph",
      phone: "+27 82 123 4567",
      address: "1 Main Road, Johannesburg",
    });
  });

  it("stores empty optional fields as null rather than blank strings", () => {
    expect(buildProfileUpdatePayload({ fullName: "A", phone: "  ", address: "" })).toEqual({
      full_name: "A",
      phone: null,
      address: null,
    });
  });

  it("keeps the existing validation rules", () => {
    expect(validateProfileForm({ fullName: "  ", phone: "", address: "" })).toBe("Full name is required.");
    expect(validateProfileForm({ fullName: "a".repeat(101), phone: "", address: "" })).toContain("100 characters");
    expect(validateProfileForm({ fullName: "A", phone: "1".repeat(31), address: "" })).toBe("Phone number is too long.");
    expect(validateProfileForm({ fullName: "A", phone: "", address: "x".repeat(301) })).toContain("300 characters");
    expect(validateProfileForm({ fullName: "A", phone: "", address: "" })).toBeNull();
  });

  it("reports a useful message from a Supabase error object", () => {
    expect(describeSaveError({ message: "new row violates row-level security" }, "fallback")).toBe(
      "new row violates row-level security",
    );
    expect(describeSaveError(new Error("boom"), "fallback")).toBe("boom");
    expect(describeSaveError({}, "fallback")).toBe("fallback");
  });
});

describe("secure email change", () => {
  const base = { currentEmail: "thulani@example.com", newEmail: "new@example.com", currentPassword: "secret-pass" };

  it("requires the current password before any email change is attempted", () => {
    expect(validateEmailChange({ ...base, currentPassword: "" })).toBe("Enter your current password to continue.");
  });

  it("requires a valid, different new email address", () => {
    expect(validateEmailChange({ ...base, newEmail: "not-an-email" })).toBe("Enter a valid new email address.");
    expect(validateEmailChange({ ...base, newEmail: "THULANI@example.com " })).toMatch(/different/);
    expect(validateEmailChange(base)).toBeNull();
  });

  it("maps wrong passwords and duplicate or rate-limited addresses to clear messages", () => {
    expect(mapEmailChangeError("Invalid login credentials")).toBe("The current password is incorrect.");
    expect(mapEmailChangeError("A user with this email address has already been registered")).toBe(
      "That email address is already linked to another account.",
    );
    expect(mapEmailChangeError("email rate limit exceeded")).toBe(
      "Too many attempts. Please wait a few minutes and try again.",
    );
    expect(mapEmailChangeError("something unexpected")).toBe(
      "We couldn't start the email change. Please check your details and try again.",
    );
  });

  it("reads a pending Auth email change and ignores empty values", () => {
    expect(readPendingEmail({ new_email: "pending@example.com" })).toBe("pending@example.com");
    expect(readPendingEmail({ new_email: "   " })).toBeNull();
    expect(readPendingEmail({})).toBeNull();
    expect(readPendingEmail(null)).toBeNull();
  });
});
