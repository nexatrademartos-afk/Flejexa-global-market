import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BRAND, brandPageTitle } from "@/lib/brand";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Check, Loader2, Mail } from "lucide-react";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: brandPageTitle("Reset Password") },
      {
        name: "description",
        content: `Reset your ${BRAND.shortName} account password.`,
      },
      {
  name: "robots",
  content: "noindex, nofollow",
},
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const redirectTo =
        typeof window !== "undefined" ? `${window.location.origin}/account/settings` : undefined;

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo,
      });

      if (resetError) {
        setError(resetError.message || "Failed to send reset email.");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <div className="surface rounded-2xl border p-6 sm:p-8">
        <Link
          to="/sign-in"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
        </Link>

        <h1 className="mt-4 font-display text-2xl font-bold">Reset your password</h1>
        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
          Enter the email associated with your {BRAND.shortName} account to receive a password
          recovery link.
        </p>

        {submitted ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-600 dark:text-emerald-400">
              <div className="flex items-center gap-2 font-semibold">
                <Check className="h-4 w-4" /> Reset link sent
              </div>
              <p className="mt-1 text-xs">
                If an account exists for {email}, you will receive an email with instructions to set
                a new password.
              </p>
            </div>

            <Link
              to="/sign-in"
              className="btn btn-primary inline-flex w-full items-center justify-center"
            >
              Return to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-500"
              >
                {error}
              </div>
            )}

            <div>
              <label htmlFor="reset-email" className="text-xs font-semibold">
                Email address
              </label>
              <div className="relative mt-1">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="reset-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="field pl-9"
                  disabled={loading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary inline-flex min-h-11 w-full items-center justify-center"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending link...
                </>
              ) : (
                "Send reset instructions"
              )}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
