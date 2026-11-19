import { useCallback, useEffect, useState } from "react";
import { CreditCard, RefreshCw, Save, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type RpcError = { code?: string; message?: string } | null;
type RpcResult = { data: unknown; error: RpcError };

interface PaymentSettings {
  cod_enabled: boolean;
  eft_enabled: boolean;
  eft_configured: boolean;
  bank_name: string;
  account_holder: string;
  account_number: string;
  account_type: string;
  branch_code: string;
  payment_reference_instructions: string;
  updated_at: string | null;
}

const EMPTY_SETTINGS: PaymentSettings = {
  cod_enabled: true,
  eft_enabled: false,
  eft_configured: false,
  bank_name: "",
  account_holder: "",
  account_number: "",
  account_type: "",
  branch_code: "",
  payment_reference_instructions: "",
  updated_at: null,
};

// The RPCs were added after the currently generated Supabase Database type.
// Keep the cast local until the project's database types are regenerated.
const callPaymentRpc = supabase.rpc as unknown as (
  functionName: string,
  args?: Record<string, unknown>,
) => Promise<RpcResult>;

function asSettings(value: unknown): PaymentSettings | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.cod_enabled !== "boolean" || typeof row.eft_enabled !== "boolean") return null;

  return {
    cod_enabled: row.cod_enabled,
    eft_enabled: row.eft_enabled,
    eft_configured: row.eft_configured === true,
    bank_name: typeof row.bank_name === "string" ? row.bank_name : "",
    account_holder: typeof row.account_holder === "string" ? row.account_holder : "",
    account_number: typeof row.account_number === "string" ? row.account_number : "",
    account_type: typeof row.account_type === "string" ? row.account_type : "",
    branch_code: typeof row.branch_code === "string" ? row.branch_code : "",
    payment_reference_instructions:
      typeof row.payment_reference_instructions === "string" ? row.payment_reference_instructions : "",
    updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
  };
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  required = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength: number;
  required?: boolean;
}) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="font-medium text-foreground">
        {label}{required && <span className="text-destructive"> *</span>}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        required={required}
        className="min-h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20"
      />
    </label>
  );
}

export function CeoPaymentMethods() {
  const [settings, setSettings] = useState<PaymentSettings>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotice(null);

    const { data, error: rpcError } = await callPaymentRpc("get_ceo_checkout_payment_settings");
    if (rpcError) {
      setError(
        rpcError.code === "42501"
          ? "Your CEO access could not be confirmed. Sign in with the authorized CEO account."
          : "Payment settings could not be loaded. Please refresh and try again.",
      );
      setLoading(false);
      return;
    }

    const parsed = asSettings(data);
    if (!parsed) {
      setError("The payment settings response was incomplete. Please contact technical support.");
      setLoading(false);
      return;
    }

    setSettings(parsed);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  function update<K extends keyof PaymentSettings>(key: K, value: PaymentSettings[K]) {
    setSettings((previous) => ({ ...previous, [key]: value }));
  }

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);

    const { data, error: rpcError } = await callPaymentRpc("update_ceo_checkout_payment_settings", {
      p_cod_enabled: settings.cod_enabled,
      p_eft_enabled: settings.eft_enabled,
      p_bank_name: settings.bank_name,
      p_account_holder: settings.account_holder,
      p_account_number: settings.account_number,
      p_account_type: settings.account_type,
      p_branch_code: settings.branch_code,
      p_payment_reference_instructions: settings.payment_reference_instructions,
    });

    if (rpcError) {
      setError(
        rpcError.code === "42501"
          ? "Your CEO access could not be confirmed. No changes were saved."
          : rpcError.code === "22023"
            ? rpcError.message ?? "Check the EFT details. All required fields must be completed before EFT can be enabled."
            : "The payment settings could not be saved. Please try again.",
      );
      setSaving(false);
      return;
    }

    const result = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
    setSettings((previous) => ({
      ...previous,
      cod_enabled: result.cod_enabled === true,
      eft_enabled: result.eft_enabled === true,
      eft_configured: result.eft_configured === true,
    }));
    setNotice("Payment settings saved successfully.");
    setSaving(false);
    await loadSettings();
  }

  const eftFieldsComplete = [
    settings.bank_name,
    settings.account_holder,
    settings.account_number,
    settings.account_type,
    settings.branch_code,
    settings.payment_reference_instructions,
  ].every((value) => value.trim().length > 0);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-border bg-background">
        <div className="flex items-start gap-3 border-b border-border p-5">
          <span className="rounded-xl bg-gold/10 p-2 text-gold">
            <CreditCard className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Payment Methods</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage the payment options customers can select at checkout. Changes are stored securely in the database.
            </p>
          </div>
        </div>

        <div className="p-5">
          {loading && <p role="status" className="text-sm text-muted-foreground">Loading payment settings…</p>}

          {!loading && error && (
            <div role="alert" className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
              <button type="button" onClick={() => void loadSettings()} className="ml-2 inline-flex items-center gap-1 font-semibold underline">
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Retry
              </button>
            </div>
          )}

          {!loading && !error && (
            <form onSubmit={saveSettings} className="space-y-6">
              {notice && (
                <p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-300">
                  {notice}
                </p>
              )}

              <div className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-foreground">Cash on Delivery (COD)</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Customers pay when their order is delivered.</p>
                  </div>
                  <label className="inline-flex min-h-10 items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={settings.cod_enabled}
                      onChange={(event) => update("cod_enabled", event.target.checked)}
                      className="h-4 w-4 accent-current"
                    />
                    {settings.cod_enabled ? "Enabled" : "Disabled"}
                  </label>
                </div>
              </div>

              <div className="space-y-4 rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-foreground">Electronic Funds Transfer (EFT)</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Customers receive the bank details below to make a manual transfer.
                    </p>
                  </div>
                  <label className="inline-flex min-h-10 items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={settings.eft_enabled}
                      onChange={(event) => update("eft_enabled", event.target.checked)}
                      className="h-4 w-4 accent-current"
                    />
                    {settings.eft_enabled ? "Enabled" : "Disabled"}
                  </label>
                </div>

                <div className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
                  <ShieldCheck className="mr-1 inline h-4 w-4" aria-hidden="true" />
                  EFT can only be enabled after all required bank details and reference instructions are provided.
                  EFT instructions do not automatically verify or confirm a customer's transfer.
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Bank name" value={settings.bank_name} onChange={(value) => update("bank_name", value)} placeholder="e.g. Your bank" maxLength={120} />
                  <Field label="Account holder" value={settings.account_holder} onChange={(value) => update("account_holder", value)} placeholder="Registered account holder" maxLength={160} />
                  <Field label="Account number" value={settings.account_number} onChange={(value) => update("account_number", value)} placeholder="Bank account number" maxLength={40} />
                  <Field label="Account type" value={settings.account_type} onChange={(value) => update("account_type", value)} placeholder="e.g. Cheque / Current" maxLength={60} />
                  <Field label="Branch code" value={settings.branch_code} onChange={(value) => update("branch_code", value)} placeholder="Bank branch code" maxLength={30} />
                </div>

                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium text-foreground">Payment reference instructions <span className="text-destructive">*</span></span>
                  <textarea
                    value={settings.payment_reference_instructions}
                    onChange={(event) => update("payment_reference_instructions", event.target.value)}
                    placeholder="Tell customers what reference to use when making payment."
                    maxLength={500}
                    required
                    rows={3}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20"
                  />
                  <span className="text-xs text-muted-foreground">{settings.payment_reference_instructions.length}/500 characters</span>
                </label>

                {settings.eft_enabled && !eftFieldsComplete && (
                  <p className="text-sm text-destructive">Complete every EFT field before saving with EFT enabled.</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Current backend status: {settings.eft_configured ? "EFT details configured" : "EFT details not yet configured"}.
                </p>
              </div>

              {settings.updated_at && (
                <p className="text-xs text-muted-foreground">
                  Last updated: {new Date(settings.updated_at).toLocaleString("en-ZA")}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={saving || (settings.eft_enabled && !eftFieldsComplete)}
                  className="btn btn-primary inline-flex min-h-11 items-center gap-2"
                >
                  <Save className="h-4 w-4" aria-hidden="true" />
                  {saving ? "Saving…" : "Save payment settings"}
                </button>
                <button
                  type="button"
                  onClick={() => void loadSettings()}
                  disabled={saving}
                  className="btn btn-outline inline-flex min-h-11 items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" /> Reload
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
