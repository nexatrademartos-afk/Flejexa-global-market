import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ADMIN_POLICY_VERSION,
  CEO_APPLICATION_DOSSIER_RPC,
  applicationReference,
  formatRecordDateTime,
  parseApplicationMessage,
  policyDeclarationStatus,
  readPolicyAcknowledgements,
  verifyApplicantIdentity,
  type AdminApplicationDossier,
  type VerifiedApplicantIdentity,
} from "@/lib/admin-application";

// CEO-only review panel. Visibility, identity lookup and decisions are enforced by Supabase
// (RLS, the secure CEO lookup and review_role_application). Rendering this component grants nothing by itself.

type PendingApplication = {
  id: string;
  applicant_id: string;
  application_message: string | null;
  status: string;
  review_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  policy_version: string | null;
  policy_signatory_name: string | null;
  policy_acknowledgements: unknown;
  policy_accepted_at: string | null;
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

function identityLookupMessage(code: string | undefined): string {
  switch (code) {
    case "42501":
      return "Your CEO access couldn't be confirmed, so applicant identity details are hidden. Refresh to try again.";
    case "42883":
    case "PGRST202":
      return "The secure applicant identity lookup isn't available yet, so NEXA IDs and account dates can't be verified. Approval stays disabled until it is installed.";
    default:
      return "Applicant identity details couldn't be loaded. Refresh to try again. Approval stays disabled until the identity is verified.";
  }
}

export function CeoAdminApplications() {
  const [items, setItems] = useState<PendingApplication[]>([]);
  const [dossiers, setDossiers] = useState<AdminApplicationDossier[]>([]);
  const [identityNotice, setIdentityNotice] = useState("");
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
      .select("id, applicant_id, application_message, status, review_notes, created_at, reviewed_at, policy_version, policy_signatory_name, policy_acknowledgements, policy_accepted_at")
      .eq("requested_role", "admin")
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (loadError) {
      console.error("Administration applications could not be loaded:", loadError);
      setError("Administration applications couldn't be loaded. Please refresh. If this continues, contact NEXA support.");
      setItems([]);
      setDossiers([]);
      setLoading(false);
      return;
    }

    const applications = (data ?? []) as unknown as PendingApplication[];
    setItems(applications);

    if (applications.length === 0) {
      setDossiers([]);
      setIdentityNotice("");
      setLoading(false);
      return;
    }

    // Authoritative account records come only from the secure CEO lookup, never from the applicant's typed text.
    const { data: dossierData, error: dossierError } = await supabase.rpc(CEO_APPLICATION_DOSSIER_RPC, {
      p_application_ids: applications.map((application) => application.id),
    });

    if (dossierError) {
      console.error("Administration applicant identity lookup failed:", dossierError);
      setDossiers([]);
      setIdentityNotice(identityLookupMessage(dossierError.code));
    } else {
      setDossiers((dossierData ?? []) as AdminApplicationDossier[]);
      setIdentityNotice("");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(application: PendingApplication, decision: Decision) {
    if (busyId) return;
    // Approval needs a verified account identity. Rejection does not.
    if (decision === "approved" && !verifyApplicantIdentity(application, dossiers)) {
      setError("This applicant's NEXA identity isn't verified, so approval is disabled. Refresh to try again.");
      return;
    }
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
      {!loading && identityNotice && (
        <div role="alert" className="rounded-lg border border-red-500/40 p-3 text-sm">{identityNotice}</div>
      )}
      {loading && <p role="status" className="text-sm text-muted-foreground">Loading pending Administration applications...</p>}

      {!loading && !error && items.length === 0 && (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          No Administration applications are awaiting review.
        </p>
      )}

      {!loading && items.map((application) => {
        const identity = verifyApplicantIdentity(application, dossiers);
        const parsed = parseApplicationMessage(application.application_message);
        const fields = parsed.fields;
        const typedName = [fields.firstName, fields.surname].filter(Boolean).join(" ") || "Name not provided";
        const isOwn = currentUserId !== null && application.applicant_id === currentUserId;
        const isOpen = Boolean(openDetails[application.id]);
        const isConfirming = confirming?.id === application.id;

        const acknowledgements = readPolicyAcknowledgements(application.policy_acknowledgements);
        const policyStatus = policyDeclarationStatus(acknowledgements);
        const allAccepted = policyStatus.every((d) => d.accepted);
        const policyVersionMatches = application.policy_version === ADMIN_POLICY_VERSION;

        return (
          <article key={application.id} className="rounded-xl border border-border p-4 md:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-semibold">{typedName}</h3>
                <p className="text-xs text-muted-foreground">
                  Reference {applicationReference(application.id)} · Submitted {formatRecordDateTime(application.created_at)} · Awaiting review
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Name as typed by the applicant. It is not proof of identity.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-gold/40 px-3 py-1 text-xs">Pending</span>
                <span className={`rounded-full border px-3 py-1 text-xs ${identity ? "border-emerald-500/50" : "border-red-500/50"}`}>
                  {identity ? "Identity verified" : "Identity not verified"}
                </span>
              </div>
            </div>

            <section aria-label="Verified account identity" className="mt-4 rounded-lg border border-border p-3">
              <h4 className="text-sm font-semibold">Verified account identity</h4>
              {identity ? (
                <IdentityDetails identity={identity} applicantId={application.applicant_id} declaredPhone={fields.phone} />
              ) : (
                <>
                  <p className="mt-2 text-sm text-red-300">
                    NEXA ID and account email could not be verified for this application. Do not rely on the typed name or details below.
                  </p>
                  <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                    <div><dt className="text-muted-foreground">Account UUID (from application)</dt><dd className="break-all">{application.applicant_id}</dd></div>
                  </dl>
                </>
              )}
            </section>

            <section aria-label="Account history" className="mt-4 rounded-lg border border-border p-3">
              <h4 className="text-sm font-semibold">Account history</h4>
              <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Account registered</dt>
                  <dd>{identity ? formatRecordDateTime(identity.accountCreatedAt) : "Unavailable until identity is verified"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Account email confirmed</dt>
                  <dd>{identity ? (identity.accountConfirmedAt ? formatRecordDateTime(identity.accountConfirmedAt) : "Not confirmed") : "Unavailable until identity is verified"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Application submitted</dt>
                  <dd>{formatRecordDateTime(application.created_at)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Application reference</dt>
                  <dd className="font-semibold">{applicationReference(application.id)}</dd>
                </div>
              </dl>
            </section>

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
                <p className="text-xs text-muted-foreground">Answers below were typed by the applicant.</p>
                <dl className="grid gap-2 sm:grid-cols-2">
                  <div><dt className="text-muted-foreground">Typed email</dt><dd className="break-all">{fields.email || "Not provided"}</dd></div>
                  <div><dt className="text-muted-foreground">Typed phone</dt><dd>{fields.phone || "Not provided"}</dd></div>
                  <div><dt className="text-muted-foreground">Requested role</dt><dd>{fields.adminRole || "Not provided"}</dd></div>
                  <div>
                    <dt className="text-muted-foreground">Preferred department</dt>
                    <dd>{fields.department || "Not provided"}{fields.department === "Other" && fields.departmentOther ? ` (${fields.departmentOther})` : ""}</dd>
                  </div>
                </dl>
                <DetailBlock label="City and province" value={[fields.city, fields.province].filter(Boolean).join(", ")} />
                <DetailBlock label="Experience" value={fields.experience} />
                <DetailBlock label="Relevant skills" value={fields.skills} />
                <DetailBlock label="Reason for applying" value={fields.reason} />
                <DetailBlock label="Expected contribution" value={fields.contribution} />
                <DetailBlock label="Availability and schedule" value={fields.availability} />

                <section aria-label="Policy record" className="rounded-lg border border-border p-3">
                  <h4 className="font-semibold">Policy record</h4>
                  <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div>
                      <dt className="text-muted-foreground">Policy version</dt>
                      <dd>{application.policy_version ?? "Not recorded"}{application.policy_version && !policyVersionMatches ? " (unexpected version)" : ""}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Policy accepted</dt>
                      <dd>{formatRecordDateTime(application.policy_accepted_at)}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-muted-foreground">Typed electronic signature</dt>
                      <dd className="font-semibold">{application.policy_signatory_name ?? "Not recorded"}</dd>
                    </div>
                  </dl>
                  <p className="mt-3 font-semibold">
                    {allAccepted ? "All seven declarations accepted" : "Declarations incomplete. Review before deciding."}
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                    {policyStatus.map((d) => (
                      <li key={d.text}>{d.accepted ? "Accepted" : "Not recorded as accepted"}: {d.text}</li>
                    ))}
                  </ul>
                </section>
              </div>
            )}

            {isOwn && (
              <p className="mt-4 text-sm text-gold">This is your own application. You cannot review it.</p>
            )}

            {!isOwn && !identity && !isConfirming && (
              <p className="mt-4 text-sm text-red-300">Approval is disabled until this applicant's NEXA identity is verified. You can still reject the application.</p>
            )}

            {!isOwn && !isConfirming && (
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busyId !== null || !identity}
                  onClick={() => { setConfirming({ id: application.id, decision: "approved" }); setReviewNote(""); }}
                >
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
                    ? `Approve the Administration application from ${identity?.fullName ?? typedName} (NEXA ID ${identity?.nexaId ?? "not verified"}, ${identity?.email ?? "email not verified"})? This assigns the Administration role to that account.`
                    : `Reject the Administration application from ${typedName}? No Administration role will be assigned.`}
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

function IdentityDetails({
  identity,
  applicantId,
  declaredPhone,
}: {
  identity: VerifiedApplicantIdentity;
  applicantId: string;
  declaredPhone: string | undefined;
}) {
  return (
    <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
      <div><dt className="text-muted-foreground">NEXA ID</dt><dd className="font-semibold">{identity.nexaId}</dd></div>
      <div><dt className="text-muted-foreground">Account UUID</dt><dd className="break-all">{applicantId}</dd></div>
      <div><dt className="text-muted-foreground">Authentication email</dt><dd className="break-all">{identity.email}</dd></div>
      <div><dt className="text-muted-foreground">Profile full name</dt><dd>{identity.fullName ?? "Not recorded"}</dd></div>
      <div>
        <dt className="text-muted-foreground">Contact number</dt>
        <dd>{identity.phone ?? (declaredPhone ? `${declaredPhone} (typed by applicant)` : "Not recorded")}</dd>
      </div>
      <div><dt className="text-muted-foreground">Assigned roles</dt><dd>{identity.roles.length ? identity.roles.join(", ") : "None recorded"}</dd></div>
    </dl>
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

