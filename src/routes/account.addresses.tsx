import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AccountPage, accountHead } from "@/components/AccountPage";
import { supabase } from "@/integrations/supabase/client";
import { COUNTRY_OPTIONS, countryName, isValidCountryIso2 } from "@/lib/countries";
import { Check, Edit2, Loader2, MapPin, Plus, Star, Trash2, X } from "lucide-react";

type Address = {
  id: string;
  user_id: string;
  recipient: string;
  phone: string;
  street: string;
  city: string;
  province: string | null;
  postal_code: string | null;
  country_iso2: string | null;
  label: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export const Route = createFileRoute("/account/addresses")({
  head: accountHead("Addresses", "Saved delivery addresses."),
  component: DeliveryAddressesPage,
});

function DeliveryAddressesPage() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [recipient, setRecipient] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [countryIso2, setCountryIso2] = useState("");
  const [label, setLabel] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  // Deletion confirm state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadAddresses() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          if (active) {
            setFeedback({
              type: "error",
              message: "Please sign in to view your addresses.",
            });
            setLoading(false);
          }
          return;
        }

        if (!active) return;
        setUserId(user.id);

        const { data, error } = await supabase
          .from("customer_addresses")
          .select("*")
          .eq("user_id", user.id)
          .order("is_default", { ascending: false })
          .order("created_at", { ascending: false });

        if (error) throw error;

        if (active) {
          setAddresses((data as Address[]) || []);
        }
      } catch (err) {
        if (active) {
          setFeedback({
            type: "error",
            message:
              err instanceof Error ? err.message : "Failed to load addresses. Please try again.",
          });
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadAddresses();

    return () => {
      active = false;
    };
  }, []);

  function openCreateForm() {
    setEditingId(null);
    setRecipient("");
    setPhone("");
    setStreet("");
    setCity("");
    setProvince("");
    setPostalCode("");
    setLabel("");
    // Suggest the default address country, but never force it.
    setCountryIso2(addresses.find((a) => a.is_default)?.country_iso2 || "");
    setIsDefault(addresses.length === 0);
    setFormOpen(true);
    setFeedback(null);
  }

  function openEditForm(addr: Address) {
    setEditingId(addr.id);
    setRecipient(addr.recipient);
    setPhone(addr.phone);
    setStreet(addr.street);
    setCity(addr.city);
    setProvince(addr.province || "");
    setPostalCode(addr.postal_code || "");
    setCountryIso2(addr.country_iso2 || "");
    setLabel(addr.label || "");
    setIsDefault(addr.is_default);
    setFormOpen(true);
    setFeedback(null);
  }

  async function handleSaveAddress(e: React.FormEvent) {
    e.preventDefault();
    if (saving || !userId) return;

    if (!recipient.trim() || !phone.trim() || !street.trim() || !city.trim()) {
      setFeedback({
        type: "error",
        message: "Recipient, phone, street, and city are required fields.",
      });
      return;
    }

    if (!isValidCountryIso2(countryIso2)) {
      setFeedback({
        type: "error",
        message: "Please select a valid country for this address.",
      });
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      if (isDefault) {
        // Clear default on other addresses for this user
        await supabase
          .from("customer_addresses")
          .update({ is_default: false })
          .eq("user_id", userId);
      }

      const payload = {
        user_id: userId,
        recipient: recipient.trim(),
        phone: phone.trim(),
        street: street.trim(),
        city: city.trim(),
        province: province.trim() || null,
        postal_code: postalCode.trim() || null,
        country_iso2: countryIso2,
        label: label.trim() || null,
        is_default: isDefault,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error } = await supabase
          .from("customer_addresses")
          .update(payload)
          .eq("id", editingId)
          .eq("user_id", userId);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("customer_addresses").insert(payload);

        if (error) throw error;
      }

      // Refresh list
      const { data: updatedList, error: refreshError } = await supabase
        .from("customer_addresses")
        .select("*")
        .eq("user_id", userId)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });

      if (refreshError) throw refreshError;

      setAddresses((updatedList as Address[]) || []);
      setFormOpen(false);
      setEditingId(null);
      setFeedback({
        type: "success",
        message: editingId ? "Address updated successfully." : "New delivery address added.",
      });
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to save address.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleSetDefault(addr: Address) {
    if (!userId || addr.is_default) return;

    try {
      // Clear default on others
      await supabase.from("customer_addresses").update({ is_default: false }).eq("user_id", userId);

      // Set this one as default
      const { error } = await supabase
        .from("customer_addresses")
        .update({ is_default: true, updated_at: new Date().toISOString() })
        .eq("id", addr.id)
        .eq("user_id", userId);

      if (error) throw error;

      setAddresses((prev) =>
        prev.map((a) => ({
          ...a,
          is_default: a.id === addr.id,
        })),
      );

      setFeedback({
        type: "success",
        message: `Set "${addr.label || addr.street}" as default delivery address.`,
      });
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to update default address.",
      });
    }
  }

  async function handleDeleteConfirmed() {
    if (!userId || !deletingId || deleting) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from("customer_addresses")
        .delete()
        .eq("id", deletingId)
        .eq("user_id", userId);

      if (error) throw error;

      setAddresses((prev) => prev.filter((a) => a.id !== deletingId));
      setDeletingId(null);
      setFeedback({
        type: "success",
        message: "Address removed successfully.",
      });
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to delete address.",
      });
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <AccountPage title="Addresses" intro="Manage your delivery addresses.">
        <div className="surface flex items-center justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-gold" />
          <span className="ml-2 text-sm text-muted-foreground">Loading your addresses...</span>
        </div>
      </AccountPage>
    );
  }

  return (
    <AccountPage
      title="Addresses"
      intro="Saved shipping and delivery addresses for quick checkout and enquiries."
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

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="surface fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl">
            <h3 className="text-lg font-bold">Delete address?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Are you sure you want to delete this delivery address? This action cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                disabled={deleting}
                className="btn border"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirmed}
                disabled={deleting}
                className="btn bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? "Deleting..." : "Delete address"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Form Modal */}
      {formOpen && (
        <div className="surface fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm">
          <div className="my-8 w-full max-w-lg rounded-2xl border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-bold">
                {editingId ? "Edit address" : "Add new address"}
              </h3>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
                aria-label="Close form"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAddress} className="mt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="addr_recipient" className="text-xs font-semibold">
                    Recipient name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="addr_recipient"
                    required
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    className="field mt-1"
                    placeholder="Full name"
                  />
                </div>

                <div>
                  <label htmlFor="addr_phone" className="text-xs font-semibold">
                    Recipient phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="addr_phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="field mt-1"
                    placeholder="+27 ..."
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="addr_street" className="text-xs font-semibold">
                    Street address <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="addr_street"
                    required
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    className="field mt-1"
                    placeholder="Street name and number"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="addr_country" className="text-xs font-semibold">
                    Country <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="addr_country"
                    required
                    value={countryIso2}
                    onChange={(e) => setCountryIso2(e.target.value)}
                    className="field mt-1"
                  >
                    <option value="">Select a country</option>
                    {COUNTRY_OPTIONS.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="addr_city" className="text-xs font-semibold">
                    City <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="addr_city"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="field mt-1"
                    placeholder="City / Town"
                  />
                </div>

                <div>
                  <label htmlFor="addr_province" className="text-xs font-semibold">
                    Province / State
                  </label>
                  <input
                    id="addr_province"
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    className="field mt-1"
                    placeholder="e.g. Gauteng"
                  />
                </div>

                <div>
                  <label htmlFor="addr_postal" className="text-xs font-semibold">
                    Postal code
                  </label>
                  <input
                    id="addr_postal"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    className="field mt-1"
                    placeholder="e.g. 2000"
                  />
                </div>

                <div>
                  <label htmlFor="addr_label" className="text-xs font-semibold">
                    Address label (optional)
                  </label>
                  <input
                    id="addr_label"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    className="field mt-1"
                    placeholder="e.g. Home, Office"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  id="addr_default"
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-gold focus:ring-gold"
                />
                <label htmlFor="addr_default" className="text-sm font-medium cursor-pointer">
                  Set as default delivery address
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  disabled={saving}
                  className="btn border"
                >
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn btn-primary">
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" /> Save address
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {addresses.length} saved {addresses.length === 1 ? "address" : "addresses"}
        </p>
        <button
          type="button"
          onClick={openCreateForm}
          className="btn btn-primary inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> Add new address
        </button>
      </div>

      {addresses.length === 0 ? (
        <div className="surface rounded-2xl border p-8 text-center">
          <MapPin className="mx-auto h-10 w-10 text-muted-foreground/60" />
          <h3 className="mt-3 text-base font-bold">No saved addresses</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Add a delivery address for quicker order enquiries and shipping.
          </p>
          <button
            type="button"
            onClick={openCreateForm}
            className="btn btn-primary mt-4 inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> Add your first address
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {addresses.map((addr) => (
            <article
              key={addr.id}
              className={`surface relative flex flex-col justify-between rounded-2xl border p-5 transition-colors ${
                addr.is_default ? "border-gold/60 bg-gold/5" : "border-border"
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">
                      {addr.label || "Delivery Address"}
                    </span>
                    {addr.is_default && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-gold/40 bg-gold/15 px-2 py-0.5 text-[11px] font-semibold text-gold">
                        <Star className="h-3 w-3 fill-gold" /> Default
                      </span>
                    )}
                  </div>
                </div>

                <p className="mt-2 text-sm font-semibold">{addr.recipient}</p>
                <p className="text-xs text-muted-foreground">{addr.phone}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {addr.street}
                  <br />
                  {addr.city}
                  {addr.province ? `, ${addr.province}` : ""}
                  {addr.postal_code ? ` ${addr.postal_code}` : ""}
                </p>
                <p className="mt-1 text-xs font-medium text-muted-foreground">
                  {isValidCountryIso2(addr.country_iso2)
                    ? countryName(addr.country_iso2)
                    : "Country not set"}
                </p>
              </div>

              <div className="mt-5 flex items-center justify-between border-t pt-3 text-xs">
                <div>
                  {!addr.is_default && (
                    <button
                      type="button"
                      onClick={() => handleSetDefault(addr)}
                      className="font-semibold text-gold hover:underline"
                    >
                      Set as default
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEditForm(addr)}
                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                    aria-label={`Edit address for ${addr.recipient}`}
                  >
                    <Edit2 className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingId(addr.id)}
                    className="inline-flex items-center gap-1 text-destructive hover:underline"
                    aria-label={`Delete address for ${addr.recipient}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </AccountPage>
  );
}
