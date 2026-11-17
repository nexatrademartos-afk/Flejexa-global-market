
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";
import { Check, ChevronDown, Loader2, Search, ShieldCheck } from "lucide-react";
import { AccountPage, accountHead } from "@/components/AccountPage";
import { ChangeEmailPanel } from "@/components/account/ChangeEmailPanel";
import { supabase } from "@/integrations/supabase/client";
import { fetchCanonicalCustomerCode } from "@/lib/customer-identity";
import { resolveCustomerCode } from "@/lib/customer-code";
import { COUNTRY_OPTIONS, countryName, isValidCountryIso2 } from "@/lib/countries";
import { describeSaveError, readPendingEmail } from "@/lib/profile";

export const Route = createFileRoute("/account/profile")({
  head: accountHead("Profile", "Manage your FleJexa customer profile."),
  component: CustomerProfilePage,
});

type PhoneCountry = {
  code: CountryCode;
  name: string;
  callingCode: string;
};

type PanelName = "personal" | "contact" | "address";

type PanelStatus = "saved" | "unsaved" | "empty";

function flagEmoji(code: string) {
  return String.fromCodePoint(
    ...code.toUpperCase().split("").map((letter) => 127397 + letter.charCodeAt(0)),
  );
}

const PHONE_COUNTRIES: PhoneCountry[] = getCountries()
  .map((code) => ({
    code,
    name: countryName(code),
    callingCode: `+${getCountryCallingCode(code)}`,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

function SearchablePhoneCountry({
  value,
  onChange,
  disabled,
  id,
}: {
  value: CountryCode;
  onChange: (code: CountryCode) => void;
  disabled?: boolean;
  id: string;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const selected =
    PHONE_COUNTRIES.find((item) => item.code === value) ??
    PHONE_COUNTRIES.find((item) => item.code === "ZA")!;

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return PHONE_COUNTRIES;

    return PHONE_COUNTRIES.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.code.toLowerCase().includes(query) ||
        item.callingCode.includes(query),
    );
  }, [search]);

  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        Search phone country
      </label>

      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => {
          setOpen((current) => !current);
          setSearch("");
        }}
        className="field flex w-full items-center justify-between gap-2 text-left"
        aria-expanded={open}
      >
        <span className="truncate">
          {flagEmoji(selected.code)} {selected.callingCode} · {selected.name}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 mt-2 max-h-64 w-72 max-w-[85vw] overflow-hidden rounded-xl border bg-background shadow-xl">
          <div className="border-b p-2">
            <div className="flex items-center gap-2 rounded-lg border px-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search country or code..."
                className="w-full bg-transparent py-2 text-sm outline-none"
              />
            </div>
          </div>

          <div className="max-h-48 overflow-y-auto p-1">
            {filtered.length ? (
              filtered.map((item) => (
                <button
                  type="button"
                  key={item.code}
                  onClick={() => {
                    onChange(item.code);
                    setOpen(false);
                    setSearch("");
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  <span>
                    {flagEmoji(item.code)} {item.name}
                  </span>
                  <span className="text-muted-foreground">
                    {item.callingCode}
                  </span>
                </button>
              ))
            ) : (
              <p className="p-3 text-sm text-muted-foreground">
                No countries found.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function normalizePhone(
  value: string,
  country: CountryCode,
): string | null {
  const trimmed = value.trim();

  if (!trimmed) return null;

  const parsed = parsePhoneNumberFromString(trimmed, country);

  if (!parsed || !parsed.isValid()) {
    throw new Error("Enter a valid phone number for the selected country.");
  }

  return parsed.number;
}

function CustomerProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openPanel, setOpenPanel] = useState<PanelName | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [customerCode, setCustomerCode] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [country, setCountry] = useState("ZA");

  const [phone, setPhone] = useState("");
  const [phoneCountry, setPhoneCountry] = useState<CountryCode>("ZA");

  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [suburb, setSuburb] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [addressCountry, setAddressCountry] = useState("ZA");

  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [whatsappCountry, setWhatsappCountry] = useState<CountryCode>("ZA");
  const [whatsappConsent, setWhatsappConsent] = useState(false);
  const [whatsappVerified, setWhatsappVerified] = useState(false);

  const [panelStatus, setPanelStatus] = useState<
    Record<PanelName, PanelStatus>
  >({
    personal: "empty",
    contact: "empty",
    address: "empty",
  });

  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          throw new Error("Please sign in to view and edit your profile.");
        }

        if (!active) return;

        setUserId(user.id);
        setAuthEmail(user.email || "");
        setPendingEmail(readPendingEmail(user));

        const { data: profile, error } = await supabase
          .from("profiles")
          .select(
            "first_name,last_name,country_iso2,phone_e164,phone_country_iso2,address_line1,address_line2,suburb,city,province,postal_code,address_country_iso2,whatsapp_phone_e164,whatsapp_country_iso2,whatsapp_contact_consent_at,whatsapp_verified_at,full_name,phone,address,customer_code",
          )
          .eq("id", user.id)
          .maybeSingle();

        if (error) throw error;

        const canonicalCode = await fetchCanonicalCustomerCode();

        if (!active) return;

        if (profile) {
          const legacyName = profile.full_name || "";
          const nameParts = legacyName.trim().split(/\s+/).filter(Boolean);

          const loadedFirstName =
            profile.first_name || nameParts[0] || "";
          const loadedLastName =
            profile.last_name || nameParts.slice(1).join(" ");

          const loadedPhone = profile.phone_e164 || profile.phone || "";
          const loadedWhatsapp = profile.whatsapp_phone_e164 || "";

          const loadedAddressLine1 =
            profile.address_line1 || profile.address || "";

          setFirstName(loadedFirstName);
          setLastName(loadedLastName);

          setCountry(
            isValidCountryIso2(profile.country_iso2)
              ? profile.country_iso2
              : "ZA",
          );

          setPhone(loadedPhone);

          if (isValidCountryIso2(profile.phone_country_iso2)) {
            setPhoneCountry(profile.phone_country_iso2 as CountryCode);
          }

          setAddressLine1(loadedAddressLine1);
          setAddressLine2(profile.address_line2 || "");
          setSuburb(profile.suburb || "");
          setCity(profile.city || "");
          setProvince(profile.province || "");
          setPostalCode(profile.postal_code || "");

          setAddressCountry(
            isValidCountryIso2(profile.address_country_iso2)
              ? profile.address_country_iso2
              : "ZA",
          );

          setWhatsappPhone(loadedWhatsapp);

          if (isValidCountryIso2(profile.whatsapp_country_iso2)) {
            setWhatsappCountry(
              profile.whatsapp_country_iso2 as CountryCode,
            );
          }

          setWhatsappConsent(
            Boolean(profile.whatsapp_contact_consent_at),
          );
          setWhatsappVerified(Boolean(profile.whatsapp_verified_at));

          setPanelStatus({
            personal:
              loadedFirstName || loadedLastName ? "saved" : "empty",
            contact:
              loadedPhone || loadedWhatsapp ? "saved" : "empty",
            address:
              loadedAddressLine1 ||
              profile.address_line2 ||
              profile.suburb ||
              profile.city ||
              profile.province ||
              profile.postal_code
                ? "saved"
                : "empty",
          });

          setCustomerCode(
            resolveCustomerCode(canonicalCode, profile.customer_code),
          );
        } else {
          const metadataName =
            typeof user.user_metadata?.full_name === "string"
              ? user.user_metadata.full_name
              : "";

          const parts = metadataName.trim().split(/\s+/).filter(Boolean);

          setFirstName(parts[0] || "");
          setLastName(parts.slice(1).join(""));

          setCustomerCode(resolveCustomerCode(canonicalCode, null));
        }
      } catch (error) {
        if (active) {
          setFeedback({
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : "Unable to load your profile. Please refresh and try again.",
          });
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, []);

  function markPanelUnsaved(panel: PanelName) {
    setPanelStatus((current) => ({
      ...current,
      [panel]: "unsaved",
    }));
  }

  async function savePanel(
    panel: PanelName,
    payload: {
      first_name?: string | null;
      last_name?: string | null;
      country_iso2?: string | null;
      phone_e164?: string | null;
      phone_country_iso2?: string | null;
      whatsapp_phone_e164?: string | null;
      whatsapp_country_iso2?: string | null;
      whatsapp_contact_consent_at?: string | null;
      address_line1?: string | null;
      address_line2?: string | null;
      suburb?: string | null;
      city?: string | null;
      province?: string | null;
      postal_code?: string | null;
      address_country_iso2?: string | null;
    },
    hasValues: boolean,
    successMessage: string,
  ) {
    if (saving || !userId) return false;

    setSaving(true);
    setFeedback(null);

    try {
      const { data, error } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", userId)
        .select("id");

      if (error) throw error;

      if (!Array.isArray(data) || data.length === 0) {
        throw new Error(
          "No profile record was updated. Refresh the page and try again.",
        );
      }

      setPanelStatus((current) => ({
        ...current,
        [panel]: hasValues ? "saved" : "empty",
      }));

      setFeedback({
        type: "success",
        message: successMessage,
      });

      setOpenPanel(null);

      return true;
    } catch (error) {
      setFeedback({
        type: "error",
        message: describeSaveError(
          error,
          "Unable to save these details. Please check your information and try again.",
        ),
      });

      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleSavePersonal(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const first = firstName.trim();
    const last = lastName.trim();

    if (!first || !last) {
      setFeedback({
        type: "error",
        message: "Enter both your first name and last name.",
      });
      return;
    }

    if (first.length > 100 || last.length > 100) {
      setFeedback({
        type: "error",
        message: "Your first and last names must each be 100 characters or fewer.",
      });
      return;
    }

    if (!isValidCountryIso2(country)) {
      setFeedback({
        type: "error",
        message: "Choose your country of residence.",
      });
      return;
    }

    await savePanel(
      "personal",
      {
        first_name: first,
        last_name: last,
        country_iso2: country,
      },
      Boolean(first || last),
      "Personal details saved successfully.",
    );
  }

  async function handleSaveContact(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (whatsappConsent && !whatsappPhone.trim()) {
      setFeedback({
        type: "error",
        message: "Enter a WhatsApp number before giving contact consent.",
      });
      return;
    }

    try {
      const normalizedPhone = normalizePhone(phone, phoneCountry);
      const normalizedWhatsapp = normalizePhone(
        whatsappPhone,
        whatsappCountry,
      );

      const hasValues = Boolean(normalizedPhone || normalizedWhatsapp);

      const saved = await savePanel(
        "contact",
        {
          phone_e164: normalizedPhone,
          phone_country_iso2: normalizedPhone ? phoneCountry : null,
          whatsapp_phone_e164: normalizedWhatsapp,
          whatsapp_country_iso2: normalizedWhatsapp
            ? whatsappCountry
            : null,
          whatsapp_contact_consent_at:
            normalizedWhatsapp && whatsappConsent
              ? new Date().toISOString()
              : null,
        },
        hasValues,
        "Contact details saved successfully.",
      );

      if (saved) {
        setPhone(normalizedPhone || "");
        setWhatsappPhone(normalizedWhatsapp || "");
      }
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Enter valid phone numbers.",
      });
    }
  }

  async function handleSaveAddress(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!isValidCountryIso2(addressCountry)) {
      setFeedback({
        type: "error",
        message: "Choose the country for your residential address.",
      });
      return;
    }

    const line1 = addressLine1.trim();
    const line2 = addressLine2.trim();
    const suburbValue = suburb.trim();
    const cityValue = city.trim();
    const provinceValue = province.trim();
    const postalValue = postalCode.trim();

    await savePanel(
      "address",
      {
        address_line1: line1 || null,
        address_line2: line2 || null,
        suburb: suburbValue || null,
        city: cityValue || null,
        province: provinceValue || null,
        postal_code: postalValue || null,
        address_country_iso2: addressCountry,
      },
      Boolean(
        line1 ||
        line2 ||
        suburbValue ||
        cityValue ||
        provinceValue ||
        postalValue
      ),
      "Residential address saved successfully.",
    );
  }

  const fieldClass = "field w-full";
  const labelClass =
    "mb-1.5 block text-sm font-semibold text-foreground";

  function statusLabel(status: PanelStatus) {
    if (status === "saved") return "Saved";
    if (status === "unsaved") return "Unsaved changes";
    return "Not set";
  }

  function statusClass(status: PanelStatus) {
    if (status === "saved") return "text-emerald-600";
    if (status === "unsaved") return "text-amber-600";
    return "text-muted-foreground";
  }

  if (loading) {
    return (
      <AccountPage title="Profile">
        <div className="surface flex items-center justify-center rounded-2xl border p-12">
          <Loader2 className="h-6 w-6 animate-spin text-gold" />
          <span className="ml-2 text-sm text-muted-foreground">
            Loading your profile...
          </span>
        </div>
      </AccountPage>
    );
  }

  return (
    <AccountPage title="Profile">
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

      <div className="space-y-3">
        {/* PERSONAL DETAILS */}
        <section className="surface overflow-hidden rounded-2xl border">
          <button
            type="button"
            onClick={() =>
              setOpenPanel(
                openPanel === "personal" ? null : "personal",
              )
            }
            className="flex w-full items-center justify-between gap-4 p-4 text-left sm:p-5"
            aria-expanded={openPanel === "personal"}
          >
            <span>
              <span className="block font-bold">Personal Details</span>
              <span className="mt-1 block text-sm text-muted-foreground">
                {[firstName, lastName].filter(Boolean).join(" ") ||
                  "Your name and country of residence"}
              </span>
            </span>

            <span className="flex shrink-0 items-center gap-3 text-sm">
              <span className={statusClass(panelStatus.personal)}>
                {statusLabel(panelStatus.personal)}
              </span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${
                  openPanel === "personal" ? "rotate-180" : ""
                }`}
              />
            </span>
          </button>

          {openPanel === "personal" && (
            <form
              onSubmit={handleSavePersonal}
              className="space-y-4 border-t p-4 sm:p-5"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor="first_name">
                    First name *
                  </label>
                  <input
                    id="first_name"
                    className={fieldClass}
                    value={firstName}
                    onChange={(event) => {
                      setFirstName(event.target.value);
                      markPanelUnsaved("personal");
                    }}
                    disabled={saving}
                    required
                    maxLength={100}
                  />
                </div>

                <div>
                  <label className={labelClass} htmlFor="last_name">
                    Last name *
                  </label>
                  <input
                    id="last_name"
                    className={fieldClass}
                    value={lastName}
                    onChange={(event) => {
                      setLastName(event.target.value);
                      markPanelUnsaved("personal");
                    }}
                    disabled={saving}
                    required
                    maxLength={100}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label
                    className={labelClass}
                    htmlFor="residence_country"
                  >
                    Country of residence *
                  </label>
                  <select
                    id="residence_country"
                    className={fieldClass}
                    value={country}
                    onChange={(event) => {
                      setCountry(event.target.value);
                      markPanelUnsaved("personal");
                    }}
                    disabled={saving}
                  >
                    {COUNTRY_OPTIONS.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    This is separate from your residential and delivery addresses.
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary min-w-[150px]"
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Save details
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </section>

        {/* CONTACT DETAILS */}
        <section className="surface overflow-hidden rounded-2xl border">
          <button
            type="button"
            onClick={() =>
              setOpenPanel(
                openPanel === "contact" ? null : "contact",
              )
            }
            className="flex w-full items-center justify-between gap-4 p-4 text-left sm:p-5"
            aria-expanded={openPanel === "contact"}
          >
            <span>
              <span className="block font-bold">Contact Details</span>
              <span className="mt-1 block text-sm text-muted-foreground">
                {phone || whatsappPhone
                  ? "Your contact phone and WhatsApp details"
                  : "Phone and WhatsApp contact information"}
              </span>
            </span>

            <span className="flex shrink-0 items-center gap-3 text-sm">
              <span className={statusClass(panelStatus.contact)}>
                {statusLabel(panelStatus.contact)}
              </span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${
                  openPanel === "contact" ? "rotate-180" : ""
                }`}
              />
            </span>
          </button>

          {openPanel === "contact" && (
            <form
              onSubmit={handleSaveContact}
              className="space-y-5 border-t p-4 sm:p-5"
            >
              <div>
                <label className={labelClass} htmlFor="phone_number">
                  Contact phone number
                </label>
                <div className="grid gap-2 sm:grid-cols-[minmax(190px,0.8fr)_1.2fr]">
                  <SearchablePhoneCountry
                    id="phone_country"
                    value={phoneCountry}
                    onChange={(value) => {
                      setPhoneCountry(value);
                      markPanelUnsaved("contact");
                    }}
                    disabled={saving}
                  />
                  <input
                    id="phone_number"
                    type="tel"
                    autoComplete="tel-national"
                    className={fieldClass}
                    value={phone}
                    onChange={(event) => {
                      setPhone(event.target.value);
                      markPanelUnsaved("contact");
                    }}
                    disabled={saving}
                    placeholder="Enter your number"
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Select your country code. Your number will be saved in international format.
                </p>
              </div>

              <div>
                <label className={labelClass} htmlFor="whatsapp_number">
                  WhatsApp number (optional)
                </label>
                <div className="grid gap-2 sm:grid-cols-[minmax(190px,0.8fr)_1.2fr]">
                  <SearchablePhoneCountry
                    id="whatsapp_country"
                    value={whatsappCountry}
                    onChange={(value) => {
                      setWhatsappCountry(value);
                      markPanelUnsaved("contact");
                    }}
                    disabled={saving}
                  />
                  <input
                    id="whatsapp_number"
                    type="tel"
                    className={fieldClass}
                    value={whatsappPhone}
                    onChange={(event) => {
                      setWhatsappPhone(event.target.value);
                      markPanelUnsaved("contact");
                    }}
                    disabled={saving}
                    placeholder="Enter WhatsApp number"
                  />
                </div>
              </div>

              <div className="rounded-xl border p-3">
                <label className="flex cursor-pointer items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-current"
                    checked={whatsappConsent}
                    onChange={(event) => {
                      setWhatsappConsent(event.target.checked);
                      markPanelUnsaved("contact");
                    }}
                    disabled={saving}
                  />
                  <span>
                    I agree that authorised FleJexa support personnel may contact me on the WhatsApp number I provided.
                  </span>
                </label>
              </div>

              <p className="text-xs text-muted-foreground" role="status">
                WhatsApp verification:{" "}
                <strong>
                  {whatsappVerified ? "Verified" : "Not yet verified"}
                </strong>
                . Saving your number and consent does not verify the number.
              </p>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary min-w-[150px]"
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Save contact details
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </section>

        {/* ACCOUNT SUPPORT */}
        <section className="surface overflow-hidden rounded-2xl border">
          <button
            type="button"
            onClick={() =>
              setOpenPanel(
                openPanel === "support" ? null : "support",
              )
            }
            className="flex w-full items-center justify-between gap-4 p-4 text-left sm:p-5"
            aria-expanded={openPanel === "support"}
          >
            <span>
              <span className="block font-bold">Account Support</span>
              <span className="mt-1 block text-sm text-muted-foreground">
                Protected sign-in email and account security
              </span>
            </span>

            <span className="flex shrink-0 items-center gap-3 text-sm">
              <span className="text-emerald-600">Protected</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${
                  openPanel === "support" ? "rotate-180" : ""
                }`}
              />
            </span>
          </button>

          {openPanel === "support" && (
            <div className="space-y-4 border-t p-4 sm:p-5">
              <div>
                <label className={labelClass} htmlFor="profile_email">
                  Sign-in email address
                </label>
                <input
                  id="profile_email"
                  type="email"
                  className={`${fieldClass} cursor-not-allowed opacity-70`}
                  value={authEmail}
                  disabled
                  readOnly
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Your sign-in email is protected. It cannot be edited directly here.
                </p>
              </div>

              {userId && (
                <ChangeEmailPanel
                  userId={userId}
                  currentEmail={authEmail}
                  pendingEmail={pendingEmail}
                  onStatusChange={({ email, pendingEmail: pending }) => {
                    setAuthEmail(email);
                    setPendingEmail(pending);
                  }}
                />
              )}
            </div>
          )}
        </section>

        {/* ADDRESS DETAILS */}
        <section className="surface overflow-hidden rounded-2xl border">
          <button
            type="button"
            onClick={() =>
              setOpenPanel(
                openPanel === "address" ? null : "address",
              )
            }
            className="flex w-full items-center justify-between gap-4 p-4 text-left sm:p-5"
            aria-expanded={openPanel === "address"}
          >
            <span>
              <span className="block font-bold">Address Details</span>
              <span className="mt-1 block text-sm text-muted-foreground">
                {[addressLine1, suburb, city].filter(Boolean).join(", ") ||
                  "Your residential address"}
              </span>
            </span>

            <span className="flex shrink-0 items-center gap-3 text-sm">
              <span className={statusClass(panelStatus.address)}>
                {statusLabel(panelStatus.address)}
              </span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${
                  openPanel === "address" ? "rotate-180" : ""
                }`}
              />
            </span>
          </button>

          {openPanel === "address" && (
            <form
              onSubmit={handleSaveAddress}
              className="space-y-4 border-t p-4 sm:p-5"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={labelClass} htmlFor="address_line1">
                    Street address
                  </label>
                  <input
                    id="address_line1"
                    className={fieldClass}
                    value={addressLine1}
                    onChange={(event) => {
                      setAddressLine1(event.target.value);
                      markPanelUnsaved("address");
                    }}
                    disabled={saving}
                    placeholder="House number and street name"
                    maxLength={200}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className={labelClass} htmlFor="address_line2">
                    Apartment, unit or building (optional)
                  </label>
                  <input
                    id="address_line2"
                    className={fieldClass}
                    value={addressLine2}
                    onChange={(event) => {
                      setAddressLine2(event.target.value);
                      markPanelUnsaved("address");
                    }}
                    disabled={saving}
                    maxLength={200}
                  />
                </div>

                <div>
                  <label className={labelClass} htmlFor="suburb">
                    Suburb
                  </label>
                  <input
                    id="suburb"
                    className={fieldClass}
                    value={suburb}
                    onChange={(event) => {
                      setSuburb(event.target.value);
                      markPanelUnsaved("address");
                    }}
                    disabled={saving}
                    maxLength={120}
                  />
                </div>

                <div>
                  <label className={labelClass} htmlFor="city">
                    City / town
                  </label>
                  <input
                    id="city"
                    className={fieldClass}
                    value={city}
                    onChange={(event) => {
                      setCity(event.target.value);
                      markPanelUnsaved("address");
                    }}
                    disabled={saving}
                    maxLength={120}
                  />
                </div>

                <div>
                  <label className={labelClass} htmlFor="province">
                    Province / state
                  </label>
                  <input
                    id="province"
                    className={fieldClass}
                    value={province}
                    onChange={(event) => {
                      setProvince(event.target.value);
                      markPanelUnsaved("address");
                    }}
                    disabled={saving}
                    maxLength={120}
                  />
                </div>

                <div>
                  <label className={labelClass} htmlFor="postal_code">
                    Postal code
                  </label>
                  <input
                    id="postal_code"
                    className={fieldClass}
                    value={postalCode}
                    onChange={(event) => {
                      setPostalCode(event.target.value);
                      markPanelUnsaved("address");
                    }}
                    disabled={saving}
                    maxLength={30}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className={labelClass} htmlFor="address_country">
                    Address country
                  </label>
                  <select
                    id="address_country"
                    className={fieldClass}
                    value={addressCountry}
                    onChange={(event) => {
                      setAddressCountry(event.target.value);
                      markPanelUnsaved("address");
                    }}
                    disabled={saving}
                  >
                    {COUNTRY_OPTIONS.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.name}
                      </option>
                    ))}
                  </select>

                  <p className="mt-1 text-xs text-muted-foreground">
                    This address is separate from your saved delivery addresses.{" "}
                    <Link
                      to="/account/addresses"
                      className="font-semibold text-gold hover:underline"
                    >
                      Manage delivery addresses
                    </Link>
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary min-w-[150px]"
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Save address
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>

      {/* PERMANENT CUSTOMER IDENTIFIER */}
      {customerCode && (
        <section className="surface flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold/40 p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Customer ID
            </p>
            <p className="mt-1 font-mono text-lg font-bold text-foreground">
              {customerCode}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Permanent account identifier · Cannot be edited
            </p>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-semibold text-gold">
            <ShieldCheck className="h-4 w-4" />
            Verified Customer
          </span>
        </section>
      )}
    </AccountPage>
  );
}
