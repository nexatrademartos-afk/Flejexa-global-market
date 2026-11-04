import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DECLARATIONS,
  applicationReference,
  parseApplicationMessage,
} from "@/lib/admin-application";

// CEO-only review panel. Visibility and decisions are enforced by Supabase (RLS and
// review_role_application). Rendering this component grants nothing by itself.

type PendingApplication = {
  id: string;
  applicant_id: string;
  application_message: string | null;
  status: string;
  review_notes: string | null;
  created_at: string;
};

type Decision = "approved" | "rejected";

function reviewErrorMessage(code: string | undefined): string {
  switch (code) {
    case "42501":
      return "Your CEO access couldn't be confirmed for this decision, or this is your own application. Refresh and try again.";
    case "55000":
      return "This application has already been decided. The list has been refreshed.";
    case "P0002":
      return "This application no longer exists. Refresh the list and try again.";
    case "22001":
      return "The review note is too long. Keep it to 500 characters.";
    case "22023":
      return "The decision could not be recorded. Choose approve or reject again.";
    default:
      return "The decision could not be recorded. Please try again. If this continues, contact NEXA support.";
  }
}

export function CeoAdminApplications() {
  const [items, setItems] = useState<PendingApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [openDetails, setOpenDetails] = useState<Record<string, boolean>>({});
  const [confirming, setConfirming] = useState<{ id: string; decision: Decision } | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data: authData } = await supabase.auth.getUser();
    setCurrentUserId(authData.user?.id ?? null);

    const { data, error: loadError } = await supabase
      .from("role_applications")
      .select("id, applicant_id, application_message, status, review_notes, created_at")
      .eq("requested_role", "admin")
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (loadError) {
      console.error("Administration applications could not be loaded:", loadError);
      setError("Administration applications couldn't be loaded. Please refresh. If this continues, contact NEXA support.");
      setItems([]);
    } else {
      setItems((data ?? []) as PendingApplication[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(application: PendingApplication, decision: Decision) {
    if (busyId) return;
    setBusyId(application.id);
    setError("");
    setNotice("");

    const trimmedNote = reviewNote.trim();
    const args: { p_application_id: string; p_decision: string; p_review_notes?: string } = {
      p_application_id: application.id,
      p_decision: decision,
    };
    if (trimmedNote) args.p_review_notes = trimmedNote;
    const { error: rpcError } = await supabase.rpc("review_role_application", args);

    if (rpcError) {
      console.error("Administration application review failed:", rpcError);
      setError(reviewErrorMessage(rpcError.code));
      if (rpcError.code === "55000" || rpcError.code === "P0002") await load();
      setBusyId(null);
      return;
    }

    const reference = applicationReference(application.id);
    setItems((current) => current.filter((item) => item.id !== application.id));
    setConfirming(null);
    setReviewNote("");
    setNotice(
      decision === "approved"
        ? `Application ${reference} approved. The Administration role has been assigned to the applicant's account.`
        : `Application ${reference} rejected. No Administration role was assigned.`,
    );
    setBusyId(null);
  }

  return (
    <section aria-labelledby="ceo-admin-applications" className="surface space-y-5 rounded-2xl border border-gold/30 p-5 md:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">CEO only</p>
          <h2 id="ceo-admin-applications" className="mt-1 text-xl font-bold">Administration applications</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pending Administration employment applications. Only CEO accounts can approve or reject them.
          </p>
        </div>
        <button type="button" className="btn btn-outline" onClick={() => void load()} disabled={loading || busyId !== null}>
          Refresh list
        </button>
      </div>

      {notice && <div role="status" className="rounded-lg border border-gold/40 p-3 text-sm">{notice}</div>}
      {error && <div role="alert" className="rounded-lg border border-red-500/40 p-3 text-sm">{error}</div>}
      {loading && <p role="status" className="text-sm text-muted-foreground">Loading pending Administration applications...</p>}

      {!loading && !error && items.length === 0 && (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          No Administration applications are awaiting review.
        </p>
      )}

      {!loading && items.map((application) => {
        const parsed = parseApplicationMessage(application.application_message);
        const fields = parsed.fields;
        const name = [fields.firstName, fields.surname].filter(Boolean).join(" ") || "Name not provided";
        const isOwn = currentUserId !== null && application.applicant_id === currentUserId;
        const isOpen = Boolean(openDetails[application.id]);
        const isConfirming = confirming?.id === application.id;
        const declarationsConfirmed =
          parsed.declarations.length === DECLARATIONS.length && parsed.declarations.every((d) => d.confirmed);

        return (
          <article key={application.id} className="rounded-xl border border-border p-4 md:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-semibold">{name}</h3>
                <p className="text-xs text-muted-foreground">
                  Reference {applicationReference(application.id)} · Submitted {new Date(application.created_at).toLocaleDateString()} · Awaiting review
                </p>
              </div>
              <span className="rounded-full border border-gold/40 px-3 py-1 text-xs">Pending</span>
            </div>

            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <div><dt className="text-muted-foreground">Email</dt><dd className="break-all">{fields.email || "Not provided"}</dd></div>
              <div><dt className="text-muted-foreground">Phone</dt><dd>{fields.phone || "Not provided"}</dd></div>
              <div><dt className="text-muted-foreground">Requested role</dt><dd>{fields.adminRole || "Not provided"}</dd></div>
              <div>
                <dt className="text-muted-foreground">Preferred department</dt>
                <dd>{fields.department || "Not provided"}{fields.department === "Other" && fields.departmentOther ? ` (${fields.departmentOther})` : ""}</dd>
              </div>
            </dl>

            <button
              type="button"
              className="mt-4 text-sm font-semibold text-gold underline"
              aria-expanded={isOpen}
              onClick={() => setOpenDetails((current) => ({ ...current, [application.id]: !isOpen }))}
            >
              {isOpen ? "Hide application details" : "View application details"}
            </button>

            {isOpen && (
              <div className="mt-4 space-y-4 text-sm">
                <DetailBlock label="City and province" value={[fields.city, fields.province].filter(Boolean).join(", ")} />
                <DetailBlock label="Experience" value={fields.experience} />
                <DetailBlock label="Relevant skills" value={fields.skills} />
                <DetailBlock label="Motivation" value={fields.reason} />
                <DetailBlock label="Expected contribution" value={fields.contribution} />
                <DetailBlock label="Availability and schedule" value={fields.availability} />
                <div>
                  <p className="text-muted-foreground">Declarations</p>
                  <p className="font-semibold">
                    {declarationsConfirmed ? "All declarations confirmed" : "Declarations incomplete. Review before deciding."}
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                    {parsed.declarations.map((d) => (
                      <li key={d.text}>{d.confirmed ? "Confirmed" : "Not confirmed"}: {d.text}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {isOwn && (
              <p className="mt-4 text-sm text-gold">This is your own application. You cannot review it.</p>
            )}

            {!isOwn && !isConfirming && (
              <div className="mt-5 flex flex-wrap gap-3">
                <button type="button" className="btn btn-primary" disabled={busyId !== null} onClick={() => { setConfirming({ id: application.id, decision: "approved" }); setReviewNote(""); }}>
                  Approve…
                </button>
                <button type="button" className="btn btn-outline" disabled={busyId !== null} onClick={() => { setConfirming({ id: application.id, decision: "rejected" }); setReviewNote(""); }}>
                  Reject…
                </button>
              </div>
            )}

            {!isOwn && isConfirming && confirming && (
              <div className="mt-5 space-y-3 rounded-lg border border-gold/40 p-4">
                <p className="text-sm font-semibold">
                  {confirming.decision === "approved"
                    ? `Approve ${name}'s Administration application? This assigns the Administration role to their account.`
                    : `Reject ${name}'s Administration application? No Administration role will be assigned.`}
                </p>
                <label htmlFor={`review-note-${application.id}`} className="block text-sm">
                  Review note (optional, shown to the applicant)
                </label>
                <textarea
                  id={`review-note-${application.id}`}
                  className="field min-h-20 w-full"
                  maxLength={500}
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                />
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busyId !== null}
                    onClick={() => void decide(application, confirming.decision)}
                  >
                    {busyId === application.id
                      ? "Recording decision..."
                      : confirming.decision === "approved"
                        ? "Confirm approval"
                        : "Confirm rejection"}
                  </button>
                  <button type="button" className="btn btn-outline" disabled={busyId !== null} onClick={() => setConfirming(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}

function DetailBlock({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="whitespace-pre-line">{value || "Not provided"}</p>
    </div>
  );
}
