import { useState, type FormEvent } from "react";
import { Loader2, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  mapEmailChangeError,
  readPendingEmail,
  validateEmailChange,
} from "@/lib/profile";

interface ChangeEmailPanelProps {
  userId: string;
  currentEmail: string;
  pendingEmail: string | null;
  onStatusChange: (status: { email: string; pendingEmail: string | null }) => void;
}

/**
 * Separate email-change flow. The password is verified against the registered email, then
 * Supabase Auth sends a confirmation. The current email stays active until that confirmation.
 * The password is kept only in component state and cleared after each attempt.
 */
export function ChangeEmailPanel({
  userId,
  currentEmail,
  pendingEmail,
  onStatusChange,
}: ChangeEmailPanelProps) {
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );

  function closeForm() {
    setOpen(false);
    setCurrentPassword("");
    setNewEmail("");
  }

  async function refreshStatus() {
    if (busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) throw error ?? new Error("Sign in again to check your email status.");
      const pending = readPendingEmail(data.user);
      const email = data.user.email ?? currentEmail;
      onStatusChange({ email, pendingEmail: pending });
      setFeedback({
        type: "success",
        message: pending
          ? `The change to ${pending} is still awaiting confirmation.`
          : `Your sign-in email is ${email}.`,
      });
    } catch {
      setFeedback({ type: "error", message: "We couldn't check your email status. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const validationError = validateEmailChange({ currentEmail, newEmail, currentPassword });
    if (validationError) {
      setFeedback({ type: "error", message: validationError });
      return;
    }

    const normalizedEmail = newEmail.trim().toLowerCase();
    setBusy(true);
    setFeedback(null);

    try {
      // Step 1: verify the current password against the registered email.
      const { data: verified, error: verifyError } = await supabase.auth.signInWithPassword({
        email: currentEmail,
        password: currentPassword,
      });
      if (verifyError) throw verifyError;
      if (verified.user?.id !== userId) {
        throw new Error("Your session could not be verified. Sign in again and retry.");
      }

      // Step 2: start Supabase Auth's email change. It is not active until the link is confirmed.
      const { data: updated, error: updateError } = await supabase.auth.updateUser({
        email: normalizedEmail,
      });
      if (updateError) throw updateError;

      const pending = readPendingEmail(updated.user) ?? normalizedEmail;
      closeForm();
      onStatusChange({ email: currentEmail, pendingEmail: pending });
      setFeedback({
        type: "success",
        message: `We sent confirmation instructions to ${normalizedEmail}. Your current email stays active until you confirm the change.`,
      });
    } catch (err) {
      setCurrentPassword("");
      const raw = err && typeof err === "object" ? (err as { message?: unknown }).message : undefined;
      setFeedback({
        type: "error",
        message: mapEmailChangeError(typeof raw === "string" ? raw : null),
      });
    } finally {
      setBusy(false);
    }
  }

  const fieldClass = "field mt-1.5 w-full";

  return (
    <section
      aria-labelledby="change-email-heading"
      className="surface space-y-4 rounded-2xl border p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="change-email-heading" className="flex items-center gap-2 text-base font-bold">
            <Mail className="h-4 w-4 text-gold" aria-hidden="true" /> Sign-in email
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Current email: <span className="break-all font-mono text-foreground">{currentEmail || "Not available"}</span>
          </p>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            disabled={busy || !currentEmail}
            className="btn"
          >
            Change email
          </button>
        )}
      </div>

      {pendingEmail && (
        <div role="status" className="rounded-xl border border-gold/40 bg-gold/10 p-3 text-sm">
          <p>
            Confirmation pending for <strong className="break-all">{pendingEmail}</strong>. Open the link we
            sent to that address to finish. Until then, {currentEmail} remains your sign-in email.
          </p>
          <button
            type="button"
            onClick={() => void refreshStatus()}
            disabled={busy}
            className="mt-2 text-xs font-semibold text-gold underline disabled:opacity-50"
          >
            {busy ? "Checking…" : "Check status"}
          </button>
        </div>
      )}

      {feedback && (
        <div
          role={feedback.type === "error" ? "alert" : "status"}
          className={`rounded-xl border p-3 text-sm ${
            feedback.type === "success"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {open && (
        <form onSubmit={handleSubmit} className="space-y-4 border-t pt-4" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="change-email-password" className="text-sm font-semibold text-foreground">
              Current password
            </label>
            <input
              id="change-email-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className={fieldClass}
              disabled={busy}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="change-email-new" className="text-sm font-semibold text-foreground">
              New email address
            </label>
            <input
              id="change-email-new"
              type="email"
              autoComplete="email"
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              className={fieldClass}
              disabled={busy}
              required
            />
            <p className="text-[11px] text-muted-foreground">
              We will send a confirmation link to this address before it becomes your sign-in email.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button type="button" onClick={closeForm} disabled={busy} className="btn">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="btn btn-primary min-w-[180px]">
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…
                </>
              ) : (
                "Send confirmation"
              )}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
