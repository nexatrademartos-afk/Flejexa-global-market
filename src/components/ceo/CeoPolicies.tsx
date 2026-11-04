import { useMemo, useState } from "react";
import { APPLICATION_TABS, ROLE_LABELS, policySummary, shortId, type DirectoryPerson, type ResourceView, type RoleApplication } from "@/lib/ceo-dashboard";
import { formatRecordDateTime, policyDeclarationStatus, readPolicyAcknowledgements } from "@/lib/admin-application";
import { Badge, Cell, DataTable, EmptyNotice, Notice, Panel, RefreshButton, ResourceNotice } from "./ceo-ui";

export function CeoPolicies({
  roleApplications,
  people,
}: {
  roleApplications: ResourceView<RoleApplication[]>;
  people: ResourceView<DirectoryPerson[]>;
}) {
  const [roleFilter, setRoleFilter] = useState("all");
  const applications = roleApplications.data ?? [];
  const reviewerNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const person of people.data ?? []) {
      map.set(person.user_id, person.full_name ?? person.nexa_id ?? person.email ?? "Staff account");
    }
    return map;
  }, [people.data]);

  const rows = applications.filter((app) => roleFilter === "all" || app.requested_role === roleFilter);

  return (
    <div className="space-y-6">
      <Panel
        id="ceo-policies"
        title="Policies & Compliance"
        description="What applicants accepted in their application form, and how each application was decided."
        actions={
          <>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Category</span>
              <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="field min-h-10">
                <option value="all">All categories</option>
                {APPLICATION_TABS.map((item) => (
                  <option key={item.key} value={item.key}>{item.label}</option>
                ))}
              </select>
            </label>
            <RefreshButton onClick={roleApplications.reload} busy={roleApplications.status === "loading"} />
          </>
        }
      >
        <Notice tone="muted">
          These are the policy records stored with each application. They record acceptance only and are not a compliance certification.
        </Notice>
        <ResourceNotice status={roleApplications.status} error={roleApplications.error} onRetry={roleApplications.reload} />
        {roleApplications.status === "ready" && rows.length === 0 && <EmptyNotice>No policy records in this category.</EmptyNotice>}
        {roleApplications.status === "ready" && rows.length > 0 && (
          <DataTable
            caption="Application policy records"
            headers={["Application", "Category", "Applicant", "Policy", "Signatory", "Accepted", "Acknowledgements", "Decision", "Reviewer"]}
          >
            {rows.map((app) => {
              const summary = policySummary(app.policy_acknowledgements);
              const declarations = policyDeclarationStatus(readPolicyAcknowledgements(app.policy_acknowledgements));
              return (
                <tr key={app.application_id}>
                  <Cell className="font-mono text-xs break-all">{shortId(app.application_id)}</Cell>
                  <Cell>{ROLE_LABELS[app.requested_role] ?? app.requested_role}</Cell>
                  <Cell>
                    <span className="block font-semibold">{app.nexa_id ?? "Not verified"}</span>
                    <span className="block text-xs text-muted-foreground">{app.profile_full_name ?? "Name not recorded"}</span>
                  </Cell>
                  <Cell>{app.policy_version ?? "Not recorded"}</Cell>
                  <Cell>{app.policy_signatory_name ?? "Not recorded"}</Cell>
                  <Cell>{formatRecordDateTime(app.policy_accepted_at)}</Cell>
                  <Cell>
                    <span className="font-semibold">{summary.accepted}/{summary.total}</span>
                    <details className="mt-1 text-xs">
                      <summary className="cursor-pointer text-muted-foreground">View</summary>
                      <ul className="mt-2 space-y-1">
                        {declarations.map((item) => (
                          <li key={item.text}>{item.accepted ? "✓" : "✗"} {item.text}</li>
                        ))}
                      </ul>
                    </details>
                  </Cell>
                  <Cell>
                    <Badge tone={app.application_status === "approved" ? "green" : app.application_status === "rejected" ? "red" : app.application_status === "pending" ? "gold" : "muted"}>
                      {app.application_status}
                    </Badge>
                  </Cell>
                  <Cell>
                    <span className="block">{app.reviewed_by ? reviewerNames.get(app.reviewed_by) ?? shortId(app.reviewed_by) : "Not reviewed"}</span>
                    <span className="block text-xs text-muted-foreground">{formatRecordDateTime(app.reviewed_at)}</span>
                  </Cell>
                </tr>
              );
            })}
          </DataTable>
        )}
      </Panel>
    </div>
  );
}
