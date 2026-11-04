import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CeoAdminApplications } from "@/components/CeoAdminApplications";
import {
  APPLICATION_TABS,
  ROLE_LABELS,
  describeReviewError,
  hasTrustedIdentity,
  policySummary,
  shortId,
  type ApplicationTabKey,
  type ResourceView,
  type RoleApplication,
} from "@/lib/ceo-dashboard";
import { formatRecordDateTime, policyDeclarationStatus, readPolicyAcknowledgements } from "@/lib/admin-application";
import { Badge, Cell, DataTable, EmptyNotice, Notice, Panel, RefreshButton, ResourceNotice, SearchField } from "./ceo-ui";

const REVIEW_NOTE_MAX = 500;

function statusTone(status: string): "gold" | "green" | "red" | "muted" {
  if (status === "approved") return "green";
  if (status === "rejected") return "red";
  if (status === "pending") return "gold";
  return "muted";
}

export function CeoApplications({ roleApplications, userId }: { roleApplications: ResourceView<RoleApplication[]>; userId: string }) {
  const [tab, setTab] = useState<ApplicationTabKey>("admin");
  const [pendingOnly, setPendingOnly] = useState(true);
  const [query, setQuery] = useState("");

  const applications = roleApplications.data ?? [];
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return applications.filter((app) => {
      if (app.requested_role !== tab) return false;
      if (pendingOnly && app.application_status !== "pending") return false;
      if (!needle) return true;
      return [app.nexa_id, app.applicant_email, app.profile_full_name, app.application_id]
        .some((value) => (value ?? "").toLowerCase().includes(needle));
    });
  }, [applications, tab, pendingOnly, query]);

  const tabCount = (key: ApplicationTabKey) => applications.filter((app) => app.requested_role === key && app.application_status === "pending").length;

  return (
    <div className="space-y-6">
      <Panel
        id="ceo-applications"
        title="Applications & Approvals"
        description="Review applications by category. Administration applications keep their verified identity review."
        actions={<RefreshButton onClick={roleApplications.reload} busy={roleApplications.status === "loading"} />}
      >
        <div role="tablist" aria-label="Application categories" className="flex flex-wrap gap-2">
          {APPLICATION_TABS.map((item) => {
            const selected = item.key === tab;
            return (
              <button
                key={item.key}
                id={`ceo-tab-${item.key}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="ceo-application-panel"
                onClick={() => setTab(item.key)}
                className={`min-h-10 rounded-full border px-4 text-sm font-semibold transition ${
                  selected ? "border-gold bg-ink text-gold" : "border-border text-foreground hover:bg-muted"
                }`}
              >
                {item.label}
                {item.key !== "admin" && roleApplications.status === "ready" && (
                  <span className="ml-2 text-xs text-muted-foreground">{tabCount(item.key)} pending</span>
                )}
              </button>
            );
          })}
        </div>
      </Panel>

      <div id="ceo-application-panel" role="tabpanel" aria-labelledby={`ceo-tab-${tab}`} className="space-y-6">
        {tab === "admin" ? (
          <>
            <Notice>
              Administration applications are reviewed in the verified review panel below. Approval requires the applicant's NEXA ID and
              account email from the backend, and the decision is recorded by the CEO-only review function.
            </Notice>
            <CeoAdminApplications />
          </>
        ) : (
          <Panel
            id={`ceo-${tab}-applications`}
            title={`${ROLE_LABELS[tab] ?? tab} applications`}
            description={
              tab === "ceo"
                ? "CEO applications are shown for oversight. Decisions aren't made from this list."
                : "Approving records the decision. To give an operational role, assign it in Roles, Access & Security after approval."
            }
          >
            <div className="flex flex-wrap items-center gap-3">
              <SearchField label="Search by NEXA ID, email or name" value={query} onChange={setQuery} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={pendingOnly} onChange={(event) => setPendingOnly(event.target.checked)} className="h-4 w-4 accent-[var(--gold)]" />
                Pending only
              </label>
            </div>
            <ResourceNotice status={roleApplications.status} error={roleApplications.error} onRetry={roleApplications.reload} />
            {roleApplications.status === "ready" && rows.length === 0 && (
              <EmptyNotice>{pendingOnly ? "No pending applications in this category." : "No applications in this category yet."}</EmptyNotice>
            )}
            {roleApplications.status === "ready" && rows.length > 0 && (
              <ul className="space-y-4">
                {rows.map((app) => (
                  <li key={app.application_id}>
                    <ApplicationCard app={app} userId={userId} readOnly={tab === "ceo"} onDecided={roleApplications.reload} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}
      </div>
    </div>
  );
}

function ApplicationCard({ app, userId, readOnly, onDecided }: { app: RoleApplication; userId: string; readOnly: boolean; onDecided: () => void }) {
  const [decision, setDecision] = useState<"approved" | "rejected" | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "gold" | "red"; text: string } | null>(null);

  const isPending = app.application_status === "pending";
  const isSelf = app.applicant_id === userId;
  const identityVerified = hasTrustedIdentity(app);
  const policy = policySummary(app.policy_acknowledgements);
  const declarations = policyDeclarationStatus(readPolicyAcknowledgements(app.policy_acknowledgements));
  const canDecide = !readOnly && isPending && !isSelf;
  const approvalBlocked = decision === "approved" && !identityVerified;

  async function submitDecision() {
    if (!decision || busy) return;
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.rpc("review_role_application", {
      p_application_id: app.application_id,
      p_decision: decision,
      ...(note.trim() ? { p_review_notes: note.trim() } : {}),
    });
    setBusy(false);
    if (error) {
      setMessage({ tone: "red", text: describeReviewError(error.code) });
      return;
    }
    setDecision(null);
    setNote("");
    setMessage({ tone: "gold", text: decision === "approved" ? "Application approved and recorded." : "Application rejected and recorded." });
    onDecided();
  }

  return (
    <article className="rounded-xl border border-border bg-background p-4" aria-labelledby={`app-${app.application_id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={`app-${app.application_id}`} className="font-semibold text-foreground">
            {app.profile_full_name ?? "Name not recorded"}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Reference <span className="break-all font-mono">{app.application_id}</span> · Submitted {formatRecordDateTime(app.application_created_at)}
          </p>
        </div>
        <Badge tone={statusTone(app.application_status)}>{app.application_status}</Badge>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
        <div><dt className="text-xs text-muted-foreground">NEXA ID</dt><dd className="font-semibold">{app.nexa_id ?? "Not verified"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Account email</dt><dd className="break-all">{app.applicant_email ?? "Not verified"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Existing roles</dt><dd>{app.existing_roles.length ? app.existing_roles.map((role) => ROLE_LABELS[role] ?? role).join(", ") : "None recorded"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Policy accepted</dt><dd>{app.policy_accepted_at ? `${formatRecordDateTime(app.policy_accepted_at)} · ${policy.accepted}/${policy.total}` : "Not recorded"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Decision</dt><dd>{app.reviewed_at ? `${app.application_status} on ${formatRecordDateTime(app.reviewed_at)}` : "Awaiting review"}</dd></div>
      </dl>

      <details className="mt-4 text-sm">
        <summary className="cursor-pointer font-semibold text-foreground">Application details</summary>
        <div className="mt-3 space-y-3 text-muted-foreground">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide">Applicant message</p>
            <p className="mt-1 whitespace-pre-wrap break-words text-foreground">{app.application_message ?? "No message submitted."}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <p><span className="text-xs uppercase tracking-wide">Phone</span><br />{app.profile_phone ?? "Not recorded"}</p>
            <p><span className="text-xs uppercase tracking-wide">Address</span><br />{app.profile_address ?? "Not recorded"}</p>
            <p><span className="text-xs uppercase tracking-wide">Account created</span><br />{formatRecordDateTime(app.account_created_at)}</p>
            <p><span className="text-xs uppercase tracking-wide">Account confirmed</span><br />{formatRecordDateTime(app.account_confirmed_at)}</p>
            <p><span className="text-xs uppercase tracking-wide">Applicant ID</span><br />{shortId(app.applicant_id)}</p>
            <p><span className="text-xs uppercase tracking-wide">Reviewer ID</span><br />{shortId(app.reviewed_by)}</p>
          </div>
          {app.review_notes && <p><span className="text-xs uppercase tracking-wide">Review notes</span><br /><span className="text-foreground">{app.review_notes}</span></p>}
          {app.policy_version && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide">Policy {app.policy_version} · signed as {app.policy_signatory_name ?? "not recorded"}</p>
              <ul className="mt-2 space-y-1">
                {declarations.map((item) => (
                  <li key={item.text}>{item.accepted ? "✓" : "✗"} {item.text}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </details>

      {message && <p role={message.tone === "red" ? "alert" : "status"} className={`mt-4 text-sm ${message.tone === "red" ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>{message.text}</p>}

      {canDecide && decision === null && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary min-h-10 text-sm" onClick={() => setDecision("approved")} disabled={!identityVerified}>
            Approve…
          </button>
          <button type="button" className="btn btn-outline min-h-10 text-sm" onClick={() => setDecision("rejected")}>
            Reject…
          </button>
          {!identityVerified && <p className="w-full text-xs text-muted-foreground">Approval needs a verified NEXA ID and account email for this applicant.</p>}
        </div>
      )}

      {canDecide && decision !== null && (
        <div className="mt-4 space-y-3 rounded-lg border border-gold/40 bg-gold-soft p-4">
          <p className="text-sm font-semibold text-foreground">
            Confirm {decision === "approved" ? "approval" : "rejection"} for {app.profile_full_name ?? "this applicant"} ({app.nexa_id ?? "NEXA ID not verified"})?
          </p>
          <label className="block text-sm">
            <span className="text-muted-foreground">Review note (optional, up to {REVIEW_NOTE_MAX} characters)</span>
            <textarea
              value={note}
              maxLength={REVIEW_NOTE_MAX}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              className="field mt-1 w-full"
            />
          </label>
          {approvalBlocked && <p role="alert" className="text-sm text-red-600 dark:text-red-400">This approval can't proceed without a verified identity.</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary min-h-10 text-sm" onClick={submitDecision} disabled={busy || approvalBlocked}>
              {busy ? "Recording…" : `Confirm ${decision}`}
            </button>
            <button type="button" className="btn btn-outline min-h-10 text-sm" onClick={() => setDecision(null)} disabled={busy}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {!readOnly && isPending && isSelf && (
        <p className="mt-4 text-xs text-muted-foreground">This is your own application, so you can't review it.</p>
      )}
      {!isPending && <p className="mt-4 text-xs text-muted-foreground">This application has already been decided.</p>}
      {readOnly && <p className="mt-4 text-xs text-muted-foreground">CEO applications are shown for oversight only.</p>}
    </article>
  );
}
