import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { callCeoRpc, parseAudit, shortId, useCeoResource, type AuditEntry, type CeoResult } from "@/lib/ceo-dashboard";
import { formatRecordDateTime } from "@/lib/admin-application";
import { Cell, DataTable, EmptyNotice, Notice, Panel, RefreshButton, ResourceNotice, SearchField } from "./ceo-ui";

async function loadAudit(): Promise<CeoResult<AuditEntry[]>> {
  return callCeoRpc(() => supabase.rpc("get_ceo_executive_audit", { p_limit: 50 }), parseAudit);
}

function summariseDetails(details: unknown): string {
  if (details === null || details === undefined) return "No details recorded";
  try {
    const text = JSON.stringify(details, null, 2);
    return text.length > 2000 ? `${text.slice(0, 2000)}…` : text;
  } catch {
    return "Details unavailable";
  }
}

export function CeoAudit() {
  const audit = useCeoResource(loadAudit, true);
  const [query, setQuery] = useState("");
  const [action, setAction] = useState("all");
  const entries = audit.data ?? [];
  const actions = useMemo(() => Array.from(new Set(entries.map((entry) => entry.action))).sort(), [entries]);
  const needle = query.trim().toLowerCase();
  const visible = entries.filter((entry) => {
    if (action !== "all" && entry.action !== action) return false;
    if (!needle) return true;
    return [entry.action, entry.actor_user_id, entry.target_user_id, entry.entity_type, entry.entity_id]
      .some((value) => (value ?? "").toLowerCase().includes(needle));
  });

  return (
    <Panel
      id="ceo-audit"
      title="Executive Activity & Audit"
      description="Read-only record of executive actions. Audit entries can't be edited or deleted from this dashboard."
      actions={<RefreshButton onClick={audit.reload} busy={audit.status === "loading"} />}
    >
      <Notice tone="muted">Showing the latest 50 entries. Actor and target IDs are shown in shortened form.</Notice>
      <div className="flex flex-wrap items-center gap-3">
        <SearchField label="Search actor, target, action or entity" value={query} onChange={setQuery} />
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Action</span>
          <select value={action} onChange={(event) => setAction(event.target.value)} className="field min-h-10">
            <option value="all">All actions</option>
            {actions.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
      </div>
      <ResourceNotice status={audit.status} error={audit.error} onRetry={audit.reload} loadingLabel="Loading the audit trail…" />
      {audit.status === "ready" && visible.length === 0 && <EmptyNotice>No audit entries match this view.</EmptyNotice>}
      {audit.status === "ready" && visible.length > 0 && (
        <DataTable caption="Executive audit entries" headers={["Time", "Action", "Actor", "Target", "Entity", "Details"]}>
          {visible.map((entry) => (
            <tr key={entry.audit_id}>
              <Cell>{formatRecordDateTime(entry.created_at)}</Cell>
              <Cell className="font-semibold">{entry.action}</Cell>
              <Cell className="font-mono text-xs">{shortId(entry.actor_user_id)}</Cell>
              <Cell className="font-mono text-xs">{shortId(entry.target_user_id)}</Cell>
              <Cell>
                <span className="block">{entry.entity_type ?? "Not recorded"}</span>
                <span className="block font-mono text-xs text-muted-foreground">{shortId(entry.entity_id)}</span>
              </Cell>
              <Cell>
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">View</summary>
                  <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-muted p-2">{summariseDetails(entry.details)}</pre>
                </details>
              </Cell>
            </tr>
          ))}
        </DataTable>
      )}
    </Panel>
  );
}
