import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  FileText,
  HelpCircle,
  Loader2,
  MessageCircle,
  PlusCircle,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { AccountPage, accountHead } from "@/components/AccountPage";
import { NEXA_QUICK_MESSAGE, openWhatsApp } from "@/lib/whatsapp";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { supabase } from "@/integrations/supabase/client";
import { fetchCanonicalCustomerCode } from "@/lib/customer-identity";
import { resolveCustomerCode } from "@/lib/customer-code";

export const Route = createFileRoute("/account/returns")({
  head: accountHead(
    "Help & Support",
    "Contact FleJexa Customer Support and manage your support cases.",
  ),
  component: HelpAndReturnsPage,
});

type ContactMethod =
  | "email"
  | "phone_call"
  | "whatsapp_call"
  | "whatsapp_chat";

type SupportCase = {
  id: string;
  case_reference: string;
  category: string;
  issue_description: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
};

const CATEGORIES = [
  "Order enquiry",
  "Delivery assistance",
  "Account assistance",
  "Payment enquiry",
  "Product enquiry",
  "Returns and exchanges",
  "Other",
];

const CONTACT_OPTIONS: { value: ContactMethod; label: string }[] = [
  { value: "email", label: "Email" },
  { value: "phone_call", label: "Phone call" },
  { value: "whatsapp_call", label: "WhatsApp call" },
  { value: "whatsapp_chat", label: "WhatsApp chat" },
];

function statusLabel(status: string) {
  switch (status) {
    case "open":
      return "Open";
    case "in_progress":
      return "In progress";
    case "waiting_for_customer":
      return "Waiting for you";
    case "resolved":
      return "Resolved";
    case "closed":
      return "Closed";
    default:
      return status.replaceAll("_", " ");
  }
}

function statusStyle(status: string) {
  switch (status) {
    case "resolved":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-600";
    case "closed":
      return "border-muted bg-muted text-muted-foreground";
    case "waiting_for_customer":
      return "border-amber-500/30 bg-amber-500/10 text-amber-600";
    case "in_progress":
      return "border-blue-500/30 bg-blue-500/10 text-blue-600";
    default:
      return "border-gold/40 bg-gold/10 text-gold";
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function HelpAndReturnsPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [userId, setUserId] = useState("");
  const [customerCode, setCustomerCode] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsappPhone, setWhatsappPhone] = useState("");

  const [cases, setCases] = useState<SupportCase[]>([]);
  const [casesLoading, setCasesLoading] = useState(true);

  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [contactMethod, setContactMethod] =
    useState<ContactMethod>("email");
  const [contactDetail, setContactDetail] = useState("");

  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    let active = true;

    async function loadSupportData() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) throw authError;
        if (!user) throw new Error("Please sign in to access Customer Support.");

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("customer_code,phone_e164,phone,whatsapp_phone_e164")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) throw profileError;

        const canonicalCode = await fetchCanonicalCustomerCode();
        if (!active) return;

        const resolvedCode = resolveCustomerCode(
          canonicalCode,
          profile?.customer_code,
        );

        const savedPhone =
          profile?.phone_e164 || profile?.phone || "";

        const savedWhatsapp = profile?.whatsapp_phone_e164 || "";

        setUserId(user.id);
        setCustomerCode(resolvedCode);
        setEmail(user.email || "");
        setPhone(savedPhone);
        setWhatsappPhone(savedWhatsapp);

        setContactDetail(user.email || "");

        const { data: caseData, error: caseError } = await (supabase as any)
          .from("support_cases")
          .select(
            "id,case_reference,category,issue_description,status,priority,created_at,updated_at",
          )
          .eq("customer_id", user.id)
          .order("created_at", { ascending: false });

        if (caseError) throw caseError;
        if (!active) return;

        setCases((caseData || []) as SupportCase[]);
      } catch (error) {
        if (active) {
          setFeedback({
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : "Unable to load Customer Support. Please refresh.",
          });
        }
      } finally {
        if (active) {
          setLoading(false);
          setCasesLoading(false);
        }
      }
    }

    void loadSupportData();

    return () => {
      active = false;
    };
  }, []);

  function handleContactMethodChange(value: ContactMethod) {
    setContactMethod(value);

    if (value === "email") {
      setContactDetail(email);
    } else if (value === "phone_call") {
      setContactDetail(phone);
    } else {
      setContactDetail(whatsappPhone || phone);
    }
  }

  async function handleCreateCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting) return;

    if (!userId) {
      setFeedback({
        type: "error",
        message: "Please sign in again before submitting a support request.",
      });
      return;
    }

    if (!customerCode) {
      setFeedback({
        type: "error",
        message:
          "Your Customer ID could not be verified. Please refresh your profile before submitting.",
      });
      return;
    }

    const cleanDescription = description.trim();
    const cleanContact = contactDetail.trim();

    if (cleanDescription.length < 5 || cleanDescription.length > 10000) {
      setFeedback({
        type: "error",
        message: "Please describe your issue using at least 5 characters.",
      });
      return;
    }

    if (cleanContact.length < 3 || cleanContact.length > 320) {
      setFeedback({
        type: "error",
        message: "Please enter valid contact details.",
      });
      return;
    }

    if (
      contactMethod === "email" &&
      !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(cleanContact)
    ) {
      setFeedback({
        type: "error",
        message: "Please enter a valid email address.",
      });
      return;
    }

    if (
      contactMethod !== "email" &&
      !/^\+?[0-9][0-9 ()-]{6,20}$/.test(cleanContact)
    ) {
      setFeedback({
        type: "error",
        message: "Please enter a valid phone number with its country code.",
      });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const { data, error } = await (supabase as any)
        .from("support_cases")
        .insert({
          customer_id: userId,
          customer_code: customerCode,
          category,
          issue_description: cleanDescription,
          contact_method: contactMethod,
          contact_detail: cleanContact,
        })
        .select(
          "id,case_reference,category,issue_description,status,priority,created_at,updated_at",
        )
        .single();

      if (error) throw error;

      setCases((current) => [data as SupportCase, ...current]);
      setDescription("");
      setCategory(CATEGORIES[0]);
      setShowForm(false);

      setFeedback({
        type: "success",
        message: `Your support request ${data.case_reference} has been submitted successfully.`,
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Your support request could not be submitted. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function handleContactWhatsApp() {
    openWhatsApp(NEXA_QUICK_MESSAGE);
  }

  if (loading) {
    return (
      <AccountPage title="Customer Support">
        <div className="surface flex items-center justify-center gap-2 rounded-2xl border p-10">
          <Loader2 className="h-5 w-5 animate-spin text-gold" />
          <span className="text-sm text-muted-foreground">
            Loading your support information...
          </span>
        </div>
      </AccountPage>
    );
  }

  return (
    <AccountPage
      title="Customer Support"
      intro="We're here to help with your FleJexa account, orders and services."
    >
      {feedback && (
        <div
          role="alert"
          className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${
            feedback.type === "success"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
              : "border-red-500/40 bg-red-500/10 text-red-600"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* CUSTOMER ID */}
      <section className="surface flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold/40 p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Your Customer ID
          </p>
          <p className="mt-1 font-mono text-lg font-bold">
            {customerCode || "ID unavailable"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Your ID helps our team identify your customer account.
          </p>
        </div>
        <ShieldCheck className="h-6 w-6 text-gold" />
      </section>

      {/* SUPPORT REQUESTS */}
      <section className="surface space-y-4 rounded-2xl border p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">My Support Cases</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Submit a request and keep track of its progress.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setFeedback(null);
              setShowForm((current) => !current);
            }}
            className="btn btn-primary inline-flex items-center gap-2"
          >
            {showForm ? (
              "Cancel"
            ) : (
              <>
                <PlusCircle className="h-4 w-4" />
                New request
              </>
            )}
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={handleCreateCase}
            className="space-y-4 rounded-xl border border-gold/30 bg-muted/20 p-4"
          >
            <div>
              <label
                htmlFor="support-category"
                className="mb-1.5 block text-sm font-semibold"
              >
                What do you need help with?
              </label>
              <select
                id="support-category"
                className="field w-full"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                disabled={submitting}
              >
                {CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="support-description"
                className="mb-1.5 block text-sm font-semibold"
              >
                Describe your issue
              </label>
              <textarea
                id="support-description"
                className="field min-h-32 w-full resize-y"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Tell us how we can help..."
                minLength={5}
                maxLength={10000}
                required
                disabled={submitting}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Please include relevant details so our team can assist you.
              </p>
            </div>

            <div>
              <label
                htmlFor="support-contact-method"
                className="mb-1.5 block text-sm font-semibold"
              >
                Preferred contact method
              </label>
              <select
                id="support-contact-method"
                className="field w-full"
                value={contactMethod}
                onChange={(event) =>
                  handleContactMethodChange(
                    event.target.value as ContactMethod,
                  )
                }
                disabled={submitting}
              >
                {CONTACT_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="support-contact-detail"
                className="mb-1.5 block text-sm font-semibold"
              >
                {contactMethod === "email"
                  ? "Email address"
                  : "Phone number"}
              </label>
              <input
                id="support-contact-detail"
                className="field w-full"
                type={contactMethod === "email" ? "email" : "tel"}
                value={contactDetail}
                onChange={(event) => setContactDetail(event.target.value)}
                placeholder={
                  contactMethod === "email"
                    ? "you@example.com"
                    : "+27..."
                }
                required
                disabled={submitting}
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !customerCode}
              className="btn btn-primary flex min-h-11 w-full items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting request...
                </>
              ) : (
                <>
                  <MessageCircle className="h-4 w-4" />
                  Submit support request
                </>
              )}
            </button>

            {!customerCode && (
              <p className="text-xs text-amber-600">
                Your Customer ID must be available before you can submit a request.
              </p>
            )}
          </form>
        )}

        {/* CASE LIST */}
        {casesLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading your cases...
          </div>
        ) : cases.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center">
            <HelpCircle className="mx-auto h-8 w-8 text-muted-foreground" />
            <h3 className="mt-3 font-semibold">No support cases yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              If you need assistance, create your first support request.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {cases.map((item) => (
              <article
                key={item.id}
                className="rounded-xl border p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-semibold text-gold">
                      {item.case_reference}
                    </p>
                    <h3 className="mt-1 font-semibold">{item.category}</h3>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyle(item.status)}`}
                  >
                    <Clock3 className="h-3 w-3" />
                    {statusLabel(item.status)}
                  </span>
                </div>

                <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">
                  {item.issue_description}
                </p>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
                  <span>Submitted {formatDate(item.created_at)}</span>
                  <span className="capitalize">
                    Priority: {item.priority}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* DIRECT CONTACT — PRESERVED */}
      <section className="surface rounded-2xl border border-gold/40 p-5">
        <h2 className="font-bold">Need immediate assistance?</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          You can still contact our support team directly through WhatsApp.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleContactWhatsApp}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#1DA851]"
          >
            <WhatsAppIcon className="h-5 w-5" />
            Chat on WhatsApp
          </button>

          <Link
            to="/support"
            className="btn border inline-flex items-center gap-2 text-sm"
          >
            <HelpCircle className="h-4 w-4" />
            Support Centre
          </Link>
        </div>
      </section>

      {/* RETURNS — EXISTING ENTRY PRESERVED */}
      <section className="surface rounded-2xl border p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-gold/40 bg-gold/10 text-gold">
            <RotateCcw className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-semibold">Returns & Exchanges</h3>
            <p className="text-xs text-muted-foreground">
              Help with returning or exchanging an item
            </p>
          </div>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          To report an item issue or request return assistance, create a
          support case above or contact our team through WhatsApp.
        </p>

        <Link
          to="/policies"
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-gold hover:underline"
        >
          <FileText className="h-3.5 w-3.5" />
          Read our Returns & Refund Policy
        </Link>
      </section>
    </AccountPage>
  );
}
