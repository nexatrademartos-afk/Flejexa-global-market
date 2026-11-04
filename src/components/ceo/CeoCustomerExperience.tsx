import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { asBoolean, callCeoRpc, firstText, rowsAt, useCeoResource, type CeoResult, type JsonRecord } from "@/lib/ceo-dashboard";
import { formatRecordDateTime } from "@/lib/admin-application";
import { Badge, Cell, DataTable, EmptyNotice, Notice, Panel, RefreshButton, ResourceNotice, SearchField } from "./ceo-ui";

interface ExperienceData {
  messages: JsonRecord[];
  cases: JsonRecord[];
}

async function loadExperience(): Promise<CeoResult<ExperienceData>> {
  return callCeoRpc(
    () => supabase.rpc("get_ceo_customer_experience", { p_limit: 50 }),
    (raw) => ({ messages: rowsAt(raw, "contact_messages"), cases: rowsAt(raw, "support_cases") }),
  );
}

const NOT_REPORTED = "Not reported";

function isRead(row: JsonRecord): boolean | null {
  const flag = asBoolean(row["is_read"]) ?? asBoolean(row["read"]);
  if (flag !== null) return flag;
  if (firstText(row, ["read_at"])) return true;
  return null;
}

export function CeoCustomerExperience() {
  const experience = useCeoResource(loadExperience, true);
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const matches = (row: JsonRecord) => !needle || JSON.stringify(row).toLowerCase().includes(needle);
  const data = experience.data;

  return (
    <div className="space-y-6">
      <Panel
        id="ceo-customer-experience"
        title="Customer Experience"
        description="Recent enquiries and support cases. This view is read-only: messages can't be deleted or edited here."
        actions={<RefreshButton onClick={experience.reload} busy={experience.status === "loading"} />}
      >
        <SearchField label="Filter enquiries and cases" value={query} onChange={setQuery} />
        <ResourceNotice status={experience.status} error={experience.error} onRetry={experience.reload} loadingLabel="Loading customer enquiries…" />
      </Panel>

      {data && experience.status === "ready" && (
        <>
          <Panel id="ceo-contact-messages" title="Contact messages" description="Newest first, up to 50.">
            {data.messages.filter(matches).length === 0 ? (
              <EmptyNotice>No contact messages match this view.</EmptyNotice>
            ) : (
              <DataTable caption="Contact messages" headers={["Received", "Contact", "Subject", "Message", "Read state"]}>
                {data.messages.filter(matches).map((row, index) => {
                  const read = isRead(row);
                  return (
                    <tr key={firstText(row, ["id"]) ?? index}>
                      <Cell>{formatRecordDateTime(firstText(row, ["created_at", "submitted_at"]))}</Cell>
                      <Cell>
                        <span className="block font-semibold">{firstText(row, ["contact_name", "name", "full_name"]) ?? NOT_REPORTED}</span>
                        <span className="block break-all text-xs text-muted-foreground">{firstText(row, ["email", "contact_email"]) ?? "No email"}</span>
                        <span className="block text-xs text-muted-foreground">{firstText(row, ["phone", "contact_phone"]) ?? "No phone"}</span>
                      </Cell>
                      <Cell>{firstText(row, ["subject"]) ?? NOT_REPORTED}</Cell>
                      <Cell className="max-w-md whitespace-pre-wrap break-words">{firstText(row, ["message", "body"]) ?? NOT_REPORTED}</Cell>
                      <Cell>
                        <Badge tone={read === false ? "gold" : read === true ? "muted" : "muted"}>
                          {read === false ? "Unread" : read === true ? "Read" : "Not reported"}
                        </Badge>
                      </Cell>
                    </tr>
                  );
                })}
              </DataTable>
            )}
          </Panel>

          <Panel id="ceo-support-cases" title="Support cases" description="Open and recent cases, newest first.">
            {data.cases.filter(matches).length === 0 ? (
              <EmptyNotice>No support cases match this view.</EmptyNotice>
            ) : (
              <DataTable caption="Support cases" headers={["Opened", "Case", "Subject", "Status", "Priority"]}>
                {data.cases.filter(matches).map((row, index) => (
                  <tr key={firstText(row, ["id"]) ?? index}>
                    <Cell>{formatRecordDateTime(firstText(row, ["created_at", "opened_at"]))}</Cell>
                    <Cell className="font-mono text-xs">{firstText(row, ["case_number", "reference", "id"]) ?? NOT_REPORTED}</Cell>
                    <Cell>{firstText(row, ["subject", "title"]) ?? NOT_REPORTED}</Cell>
                    <Cell>{firstText(row, ["status"]) ?? NOT_REPORTED}</Cell>
                    <Cell>{firstText(row, ["priority"]) ?? NOT_REPORTED}</Cell>
                  </tr>
                ))}
              </DataTable>
            )}
          </Panel>
          <Notice tone="muted">Contact details are shown only so you can follow up. Customer records aren't changed from this view.</Notice>
        </>
      )}
    </div>
  );
}
