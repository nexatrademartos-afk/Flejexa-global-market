import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  GROUP_LABELS,
  ROLE_LABELS,
  callCeoRpc,
  filterPeople,
  groupOf,
  parsePeople,
  shortId,
  useCeoResource,
  type CeoResult,
  type DirectoryPerson,
  type PersonGroup,
} from "@/lib/ceo-dashboard";
import { formatRecordDateTime } from "@/lib/admin-application";
import { Badge, Cell, DataTable, EmptyNotice, Notice, Panel, RefreshButton, ResourceNotice, SearchField } from "./ceo-ui";

const LIMIT_OPTIONS = [100, 200] as const;

export function CeoPeople() {
  const [limit, setLimit] = useState<(typeof LIMIT_OPTIONS)[number]>(100);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Accounts to load</span>
          <select value={limit} onChange={(event) => setLimit(Number(event.target.value) as (typeof LIMIT_OPTIONS)[number])} className="field min-h-10">
            {LIMIT_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
      </div>
      <PeopleList key={limit} limit={limit} />
    </div>
  );
}

function PeopleList({ limit }: { limit: number }) {
  const people = useCeoResource(
    async (): Promise<CeoResult<DirectoryPerson[]>> =>
      callCeoRpc(() => supabase.rpc("get_ceo_people_directory", { p_limit: limit }), parsePeople),
    true,
  );
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<PersonGroup | "all">("all");
  const all = people.data ?? [];
  const visible = filterPeople(all, query, group);

  return (
    <Panel
      id="ceo-people"
      title="People & Workforce"
      description="Customer and staff accounts from the NEXA directory. Groups are based only on the roles assigned to each account."
      actions={<RefreshButton onClick={people.reload} busy={people.status === "loading"} />}
    >
      <Notice tone="muted">
        Employment departments and employment status aren't recorded in this directory, so they aren't shown.
      </Notice>
      <div className="flex flex-wrap items-center gap-3">
        <SearchField label="Search by name, email, NEXA ID or role" value={query} onChange={setQuery} />
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Group</span>
          <select value={group} onChange={(event) => setGroup(event.target.value as PersonGroup | "all")} className="field min-h-10">
            <option value="all">Everyone</option>
            {(Object.keys(GROUP_LABELS) as PersonGroup[]).map((item) => (
              <option key={item} value={item}>{GROUP_LABELS[item]}</option>
            ))}
          </select>
        </label>
      </div>
      <ResourceNotice status={people.status} error={people.error} onRetry={people.reload} loadingLabel="Loading the account directory…" />
      {people.status === "ready" && (
        <>
          <p className="text-xs text-muted-foreground">
            Showing {visible.length} of {all.length} loaded accounts (limit {limit}).
            {all.length >= limit && " More accounts may exist. Raise the limit to see more."}
          </p>
          {visible.length === 0 ? (
            <EmptyNotice>No accounts match this view.</EmptyNotice>
          ) : (
            <DataTable caption="Account directory" headers={["Name", "NEXA ID", "Account email", "Roles", "Group", "Registered"]}>
              {visible.map((person) => {
                const personGroup = groupOf(person.roles);
                return (
                  <tr key={person.user_id}>
                    <Cell>
                      <span className="block font-semibold">{person.full_name ?? "Name not recorded"}</span>
                      <span className="block font-mono text-xs text-muted-foreground">{shortId(person.user_id)}</span>
                    </Cell>
                    <Cell className="font-semibold">{person.nexa_id ?? "Not recorded"}</Cell>
                    <Cell>
                      <span className="block break-all">{person.email ?? "Not recorded"}</span>
                      <Badge tone={person.email_confirmed === true ? "green" : person.email_confirmed === false ? "gold" : "muted"}>
                        {person.email_confirmed === true ? "Confirmed" : person.email_confirmed === false ? "Not confirmed" : "Status not reported"}
                      </Badge>
                    </Cell>
                    <Cell>
                      <div className="flex flex-wrap gap-1">
                        {person.roles.length ? person.roles.map((role) => <Badge key={role}>{ROLE_LABELS[role] ?? role}</Badge>) : <span className="text-muted-foreground">None</span>}
                      </div>
                    </Cell>
                    <Cell>
                      <Badge tone={personGroup === "executive" ? "gold" : personGroup === "staff" ? "green" : "muted"}>{GROUP_LABELS[personGroup]}</Badge>
                    </Cell>
                    <Cell>{formatRecordDateTime(person.account_created_at)}</Cell>
                  </tr>
                );
              })}
            </DataTable>
          )}
        </>
      )}
    </Panel>
  );
}
