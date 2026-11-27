import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AccountPage, accountHead } from "@/components/AccountPage";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Check, Download, KeyRound, Loader2, Lock } from "lucide-react";
import { PlannedBadge } from "@/components/states";

export const Route = createFileRoute("/account/settings")({
  head: accountHead("Settings", "Manage account security and privacy."),
  component: AccountSettingsPage,
});

type NotificationPreferenceKey =
  | "push_orders"
  | "push_delivery"
  | "push_wallet"
  | "push_support"
  | "push_security"
  | "push_promotions";

type NotificationPreferences = Record<NotificationPreferenceKey, boolean>;

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  push_orders: true,
  push_delivery: true,
  push_wallet: true,
  push_support: true,
  push_security: true,
  push_promotions: false,
};

function AccountSettingsPage() {
  // Password change state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Data export state
  const [exporting, setExporting] = useState(false);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (passwordLoading) return;

    if (newPassword.length < 8) {
      setPasswordFeedback({
        type: "error",
        message: "New password must be at least 8 characters long.",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordFeedback({
        type: "error",
        message: "Passwords do not match.",
      });
      return;
    }

    setPasswordLoading(true);
    setPasswordFeedback(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setPasswordFeedback({
          type: "error",
          message: error.message || "Failed to update password.",
        });
        return;
      }

      setNewPassword("");
      setConfirmPassword("");
      setPasswordFeedback({
        type: "success",
        message: "Your password has been updated successfully.",
      });
    } catch {
      setPasswordFeedback({
        type: "error",
        message: "An unexpected error occurred while updating your password.",
      });
    } finally {
      setPasswordLoading(false);
    }
  }

  async function handleExportData() {
    if (exporting) return;
    setExporting(true);
    setExportFeedback(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setExportFeedback("Please sign in to export your account data.");
        setExporting(false);
        return;
      }

      const [{ data: profile }, { data: addresses }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("customer_addresses").select("*").eq("user_id", user.id),
      ]);

      const exportPayload = {
        exported_at: new Date().toISOString(),
        customer_id: user.id,
        email: user.email,
        profile: profile || null,
        delivery_addresses: addresses || [],
      };

      const dataStr =
        "data:text/json;charset=utf-8," +
        encodeURIComponent(JSON.stringify(exportPayload, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `nexa-customer-data-${user.id.slice(0, 8)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      setExportFeedback("Your customer profile and address records were downloaded.");
    } catch {
      setExportFeedback("Failed to compile customer records. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <AccountPage
      title="Security & Privacy"
      intro="Manage your password, data export and account preferences."
    >
      <div className="space-y-6">
        {/* Change Password Card */}
        <section className="surface rounded-2xl border p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-gold/40 bg-gold/10 text-gold">
              <KeyRound className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-bold">Change Password</h2>
              <p className="text-xs text-muted-foreground">
                Update your account password using verified authentication.
              </p>
            </div>
          </div>

          {passwordFeedback && (
            <div
              role="alert"
              className={`mt-4 rounded-xl border p-3 text-xs sm:text-sm ${
                passwordFeedback.type === "success"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400"
              }`}
            >
              {passwordFeedback.message}
            </div>
          )}

          <form onSubmit={handlePasswordChange} className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="new-pwd" className="text-xs font-semibold text-foreground">
                  New password <span className="text-red-500">*</span>
                </label>
                <div className="relative mt-1">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="new-pwd"
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="field pl-9"
                    disabled={passwordLoading}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="confirm-pwd" className="text-xs font-semibold text-foreground">
                  Confirm new password <span className="text-red-500">*</span>
                </label>
                <div className="relative mt-1">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="confirm-pwd"
                    type="password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="field pl-9"
                    disabled={passwordLoading}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={passwordLoading}
                className="btn btn-primary min-w-[140px]"
              >
                {passwordLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" /> Update password
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* Download Data */}
        <section className="surface rounded-2xl border p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-gold/40 bg-gold/10 text-gold">
                <Download className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base font-bold">Download Account Data</h2>
                <p className="text-xs text-muted-foreground">
                  Export your saved personal profile and delivery address records as JSON.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <p className="text-xs text-muted-foreground max-w-md">
              Exports profile fields and saved delivery addresses associated with your customer
              account.
            </p>

            <button
              type="button"
              onClick={handleExportData}
              disabled={exporting}
              className="btn border inline-flex items-center gap-2 text-xs font-semibold"
            >
              {exporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" /> Download data (JSON)
                </>
              )}
            </button>
          </div>

          {exportFeedback && (
            <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">{exportFeedback}</p>
          )}
        </section>
        
                 <FlejexaNotificationSoundSettings />
        <PushNotificationSettings />
      {/* Customer Notification Preferences */}
        <section className="surface rounded-2xl border p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold/40 bg-gold/10 text-gold">
              <Check className="h-5 w-5" />
            </span>

            <div>
              <h2 className="text-base font-bold">
                FleJexa Notification Preferences
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Choose the types of background notifications you want FleJexa
                to send to your device when push notifications are available.
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border p-3">
            <p className="text-xs font-semibold">In-app notifications</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Your FleJexa notification bell and inbox remain enabled for
              important account updates. These preferences do not switch them off.
            </p>
          </div>

          {preferencesLoading ? (
            <p className="mt-4 text-xs text-muted-foreground">
              Loading your preferences...
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {(
                [
                  ["push_orders", "Orders", "Order received and order status updates."],
                  ["push_delivery", "Delivery", "Delivery progress and delivery updates."],
                  ["push_wallet", "Wallet", "Wallet and rewards account updates."],
                  ["push_support", "Support", "Customer support replies and updates."],
                  ["push_security", "Security", "Important account security notifications."],
                  ["push_promotions", "Promotions", "Optional offers and promotional updates."],
                ] as const
              ).map(([key, title, description]) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center justify-between gap-4"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{title}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {description}
                    </span>
                  </span>

                  <input
                    type="checkbox"
                    checked={notificationPreferences[key]}
                    onChange={(event) =>
                      void handleNotificationPreferenceChange(
                        key,
                        event.target.checked
                      )
                    }
                    disabled={preferencesSaving}
                    className="h-5 w-5 shrink-0 cursor-pointer accent-gold"
                  />
                </label>
              ))}
            </div>
          )}

          {preferencesSaving && (
            <p className="mt-4 text-xs text-muted-foreground">
              Saving your preferences...
            </p>
          )}

          {preferencesFeedback && (
            <p role="status" className="mt-4 text-xs text-muted-foreground">
              {preferencesFeedback}
            </p>
          )}
        </section>

        {/* Preferences Notice */}
        <section className="space-y-3">
          <div className="surface flex items-center justify-between rounded-2xl border p-4">
            <div>
              <p className="text-sm font-semibold">Email & SMS Communications</p>
              <p className="text-xs text-muted-foreground">
                Marketing and promotional messaging preferences
              </p>
            </div>
            <PlannedBadge label="Planned" />
          </div>

          <div className="surface flex items-center justify-between rounded-2xl border p-4">
            <div>
              <p className="text-sm font-semibold">Language & Currency</p>
              <p className="text-xs text-muted-foreground">
                Currently defaulting to English and South African Rand (ZAR)
              </p>
            </div>
            <PlannedBadge label="Fixed (ZAR)" />
          </div>
        </section>

        {/* Account Deletion */}
        <section className="surface rounded-2xl border border-destructive/30 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-destructive/40 bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-destructive">Account Deletion</h2>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Account deletion is a permanent administrative operation. In accordance with data
                safety policies, deletion cannot be executed via client-side delete. To request
                deletion of your account and associated records, please submit a deletion request
                via our support channels with your Customer ID.
              </p>
            </div>
          </div>
        </section>
      </div>
    </AccountPage>
  );
}
