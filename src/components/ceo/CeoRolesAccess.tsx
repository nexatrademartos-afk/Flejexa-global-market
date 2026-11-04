import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  OPERATIONAL_ROLES,
  ROLE_LABELS,
  REASON_MAX_LENGTH,
  describeAssignmentError,
  filterPeople,
  groupOf,
  shortId,
  validateRoleAssignment,
  type DirectoryPerson,
  type OperationalRole,
  type ResourceView,
} from "@/lib/ceo-dashboard";
import { Badge, Cell, DataTable, EmptyNotice, Notice, Panel, RefreshButton, ResourceNotice, SearchField } from "./ceo-ui";

export function CeoRolesAccess({ people, userId }: { people: ResourceView<DirectoryPerson[]>; userId: string }) {
  const [query, setQuery] = useState("");
  const [targetId, setTargetId] = useState("");
  const [role, setRole] = useState<OperationalRole>("partner");
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "gold" | "red"; text: string } | null>(null);

  const all = people.data ?? [];
  const candidates = filterPeople(all, query, "all").filter((person) => person.user_id !== userId);
  const target = all.find((person) => person.user_id === targetId) ?? null;
  const staff = all.filter((person) => groupOf(person.roles) === "staff");
  const validationError = target
    ? validateRoleAssignment({ targetUserId: target.user_id, currentUserId: userId, role, targetRoles: target.roles, reason })
    : "Choose a person from the directory.";

  function startReview() {
    setFeedback(null);
    if (validationError) {
      setFeedback({ tone: "red", text: validationError });
      return;
    }
    setConfirming(true);
  }

  async function assign() {
    if (!target || busy) return;
    setBusy(true);
    setFeedback(null);
    const { error } = await supabase.rpc("ceo_assign_operational_role", {
      p_user_id: target.user_id,
      p_role: role,
      p_reason: reason.trim(),
    });
    setBusy(false);
    if (error) {
      console.error("Operational role assignment failed:", error);
      setFeedback({ tone: "red", text: describeAssignmentError(error.code) });
      return;
    }
    setConfirming(false);
    setReason("");
    setTargetId("");
    setFeedback({ tone: "gold", text: `${ROLE_LABELS[role]} role assigned to ${target.full_name ?? target.nexa_id ?? "the selected account"}.` });
    people.reload();
  }

  return (
    <div className="space-y-6">
      <Panel
        id="ceo-access"
        title="Roles, Access & Security"
        description="Assign approved operational roles. The backend checks every request and is the final authority."
        actions={<RefreshButton onClick={people.reload} busy={people.status === "loading"} />}
      >
        <div className="grid gap-3 md:grid-cols-3">
          <Notice tone="muted"><strong className="font-semibold">Administration roles</strong> are granted only through an approved Administration application.</Notice>
          <Notice tone="muted"><strong className="font-semibold">CEO appointments</strong> go through an approved CEO application and aren't assigned here.</Notice>
          <Notice tone="muted"><strong className="font-semibold">Customer roles</strong> are not assigned from this page. You can't change your own roles.</Notice>
        </div>
        <ResourceNotice status={people.status} error={people.error} onRetry={people.reload} loadingLabel="Loading the account directory…" />
      </Panel>

      {people.status === "ready" && (
        <Panel id="ceo-assign" title="Assign an operational role" description="Pick a person, choose a role, and give a reason. You'll confirm before anything is changed.">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <SearchField label="Search accounts" value={query} onChange={setQuery} placeholder="Search name, email or NEXA ID" />
              <label className="block text-sm">
                <span className="text-muted-foreground">Account</span>
                <select value={targetId} onChange={(event) => setTargetId(event.target.value)} className="field mt-1 min-h-11 w-full" size={Math.min(8, Math.max(3, candidates.length))}>
                  <option value="">Choose an account…</option>
                  {candidates.map((person) => (
                    <option key={person.user_id} value={person.user_id}>
                      {(person.full_name ?? "Name not recorded")} · {person.nexa_id ?? "NEXA ID not recorded"} · {person.email ?? "no email"}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="text-muted-foreground">Operational role</span>
                <select value={role} onChange={(event) => setRole(event.target.value as OperationalRole)} className="field mt-1 min-h-11 w-full">
                  {OPERATIONAL_ROLES.map((item) => (
                    <option key={item} value={item}>{ROLE_LABELS[item]}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-muted-foreground">Reason (required)</span>
                <textarea value={reason} maxLength={REASON_MAX_LENGTH} onChange={(event) => setReason(event.target.value)} rows={4} className="field mt-1 w-full" placeholder="Why this role is needed, for the audit record" />
              </label>
              {!confirming && (
                <button type="button" className="btn btn-primary min-h-11 text-sm" onClick={startReview}>
                  Review assignment
                </button>
              )}
            </div>
          </div>

          {feedback && (
            <p role={feedback.tone === "red" ? "alert" : "status"} className={`text-sm ${feedback.tone === "red" ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>
              {feedback.text}
            </p>
          )}

          {confirming && target && (
            <div className="space-y-3 rounded-lg border border-gold/40 bg-gold-soft p-4">
              <p className="text-sm font-semibold text-foreground">
                Assign {ROLE_LABELS[role]} to {target.full_name ?? "this account"} ({target.nexa_id ?? "NEXA ID not recorded"})?
              </p>
              <p className="text-sm text-muted-foreground">Reason: {reason.trim()}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary min-h-10 text-sm" onClick={assign} disabled={busy}>
                  {busy ? "Assigning…" : "Confirm assignment"}
                </button>
                <button type="button" className="btn btn-outline min-h-10 text-sm" onClick={() => setConfirming(false)} disabled={busy}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </Panel>
      )}

      {people.status === "ready" && (
        <Panel id="ceo-staff-roles" title="Current operational staff" description="Accounts that currently hold an operational or administrative role.">
          {staff.length === 0 ? (
            <EmptyNotice>No operational staff roles are assigned yet.</EmptyNotice>
          ) : (
            <DataTable caption="Operational staff and roles" headers={["Name", "NEXA ID", "Roles"]}>
              {staff.map((person) => (
                <tr key={person.user_id}>
                  <Cell>{person.full_name ?? "Name not recorded"}</Cell>
                  <Cell>{person.nexa_id ?? shortId(person.user_id)}</Cell>
                  <Cell>
                    <div className="flex flex-wrap gap-1">
                      {person.roles.map((item) => <Badge key={item}>{ROLE_LABELS[item] ?? item}</Badge>)}
                    </div>
                  </Cell>
                </tr>
              ))}
            </DataTable>
          )}
        </Panel>
      )}
    </div>
  );
}
