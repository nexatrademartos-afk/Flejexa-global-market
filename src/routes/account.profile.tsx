import { useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { AccountPage, accountHead } from "@/components/AccountPage";
import { supabase } from "@/integrations/supabase/client";
import { fetchCanonicalCustomerCode } from "@/lib/customer-identity";
import { resolveCustomerCode } from "@/lib/customer-code";
import { countryName, isValidCountryIso2 } from "@/lib/countries";
import { Check, Loader2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/account/profile")({
  head: accountHead("Profile", "Manage your NEXA profile."),
  component: CustomerProfilePage,
});

function CustomerProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [customerCode, setCustomerCode] = useState("");
  const [country, setCountry] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          if (active) {
            setFeedback({
              type: "error",
              message: "Please sign in to view and edit your profile.",
            });
            setLoading(false);
          }
          return;
        }

        if (!active) return;
        setUserId(user.id);
        setAuthEmail(user.email || "");

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("full_name, phone, address, customer_code")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) throw profileError;

        // Canonical identity code comes from nexa_person_identities; profiles.customer_code is only a fallback.
        const canonicalCode = await fetchCanonicalCustomerCode();

        // Country is read from the default delivery address (the existing trigger keeps it in sync with identity).
        const { data: defaultAddress, error: addressError } = await supabase
          .from("customer_addresses")
          .select("country_iso2")
          .eq("user_id", user.id)
          .eq("is_default", true)
          .limit(1)
          .maybeSingle();

        if (addressError) throw addressError;

        if (active) {
          if (profile) {
            setFullName(profile.full_name || "");
            setPhone(profile.phone || "");
            setAddress(profile.address || "");
          } else {
            const metaName =
              typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "";
            setFullName(metaName);
          }

          setCustomerCode(resolveCustomerCode(canonicalCode, profile?.customer_code));
          setCountry(defaultAddress?.country_iso2 || null);
        }
      } catch (err) {
        if (active) {
          setFeedback({
            type: "error",
            message:
              err instanceof Error
                ? err.message
                : "Unable to load profile records. Please refresh and try again.",
          });
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadData();

    return () => {
      active = false;
    };
  }, []);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (saving || !userId) return;

    const trimmedName = fullName.trim();
    if (!trimmedName) {
      setFeedback({
        type: "error",
        message: "Full name is required.",
      });
      return;
    }

    if (trimmedName.length > 100) {
      setFeedback({
        type: "error",
        message: "Full name must be 100 characters or fewer.",
      });
      return;
    }

    if (phone.trim().length > 30) {
      setFeedback({
        type: "error",
        message: "Phone number is too long.",
      });
      return;
    }

    if (address.trim().length > 300) {
      setFeedback({
        type: "error",
        message: "Address is too long (300 characters max).",
      });
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      const updatePayload = {
        full_name: trimmedName,
        phone: phone.trim() || null,
        address: address.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from("profiles")
        .update(updatePayload)
        .eq("id", userId);

      if (updateError) throw updateError;

      setFeedback({
        type: "success",
        message: "Your profile details have been saved successfully.",
      });
    } catch (err) {
      setFeedback({
        type: "error",
        message:
          err instanceof Error ? err.message : "Failed to save profile changes. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AccountPage title="Profile" intro="Manage your personal customer details.">
        <div className="surface flex items-center justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-gold" />
          <span className="ml-2 text-sm text-muted-foreground">Loading your profile...</span>
        </div>
      </AccountPage>
    );
  }

  return (
    <AccountPage
      title="Profile"
      intro="Manage your personal details and primary contact information."
    >
      {feedback && (
        <div
          role="alert"
          className={`rounded-xl border p-4 text-sm ${
            feedback.type === "success"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {customerCode && (
        <div className="surface flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold/40 p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Customer Code
            </p>
            <p className="mt-1 font-mono text-lg font-bold text-foreground">{customerCode}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-semibold text-gold">
            <ShieldCheck className="h-4 w-4" /> Verified Customer
          </span>
        </div>
      )}

      <form onSubmit={handleSave} className="surface space-y-5 rounded-2xl border p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="full_name" className="text-sm font-semibold text-foreground">
              Full name <span className="text-red-500">*</span>
            </label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="field"
              placeholder="e.g. John Doe"
              disabled={saving}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-semibold text-foreground">
              Email address
            </label>
            <input
              id="email"
              type="email"
              disabled
              value={authEmail}
              className="field cursor-not-allowed opacity-70"
            />
            <p className="text-[11px] text-muted-foreground">Linked to your sign-in credentials.</p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="phone" className="text-sm font-semibold text-foreground">
              Contact phone
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="field"
              placeholder="e.g. +27 82 123 4567"
              disabled={saving}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="country_notice" className="text-sm font-semibold text-foreground">
              Country
            </label>
            <input
              id="country_notice"
              type="text"
              disabled
              value={isValidCountryIso2(country) ? countryName(country) : "Not set"}
              className="field cursor-not-allowed opacity-70"
            />
            <p className="text-[11px] text-muted-foreground">
              Taken from your default delivery address.{" "}
              <Link to="/account/addresses" className="font-semibold text-gold hover:underline">
                Manage addresses
              </Link>
            </p>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="address" className="text-sm font-semibold text-foreground">
              Primary residential / street address
            </label>
            <textarea
              id="address"
              name="address"
              rows={3}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="field resize-none"
              placeholder="Enter your street address, suburb, and city"
              disabled={saving}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button type="submit" disabled={saving} className="btn btn-primary min-w-[140px]">
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" /> Save changes
              </>
            )}
          </button>
        </div>
      </form>
    </AccountPage>
  );
}
