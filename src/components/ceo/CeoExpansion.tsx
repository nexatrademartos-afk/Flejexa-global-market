import { PlannedBadge } from "@/components/states";
import { groupOf, type DirectoryPerson, type ResourceView, type RoleApplication } from "@/lib/ceo-dashboard";
import { Metric, Notice, Panel, ResourceNotice } from "./ceo-ui";

const PLANNED = [
  "Multi-vendor marketplace with partner-managed catalogues",
  "Business (B2B) accounts and wholesale pricing",
  "Supplier and partner payout records",
];

export function CeoExpansion({
  roleApplications,
  people,
}: {
  roleApplications: ResourceView<RoleApplication[]>;
  people: ResourceView<DirectoryPerson[]>;
}) {
  const partnerApps = (roleApplications.data ?? []).filter((app) => app.requested_role === "partner");
  const count = (status: string) => partnerApps.filter((app) => app.application_status === status).length;
  const partnerHolders = (people.data ?? []).filter((person) => person.roles.includes("partner")).length;
  const deliveryHolders = (people.data ?? []).filter((person) => person.roles.includes("delivery")).length;
  const commissionHolders = (people.data ?? []).filter((person) => person.roles.includes("commission")).length;
  const notLoaded = roleApplications.status !== "ready" || people.status !== "ready";

  return (
    <div className="space-y-6">
      <Panel id="ceo-partners" title="Partners & Expansion" description="Partner progress from real applications and assigned roles. Nothing here is estimated.">
        <ResourceNotice status={roleApplications.status} error={roleApplications.error} onRetry={roleApplications.reload} loadingLabel="Loading partner applications…" />
        <ResourceNotice status={people.status} error={people.error} onRetry={people.reload} loadingLabel="Loading partner role holders…" />
        {!notLoaded && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Partner applications" value={partnerApps.length.toLocaleString("en-ZA")} note="All partner applications" />
            <Metric label="Pending partner" value={count("pending").toLocaleString("en-ZA")} note="Awaiting a decision" />
            <Metric label="Approved partner" value={count("approved").toLocaleString("en-ZA")} note="Decisions recorded as approved" />
            <Metric label="Partner role holders" value={partnerHolders.toLocaleString("en-ZA")} note="Accounts with the partner role" />
          </div>
        )}
        {!notLoaded && (
          <p className="text-sm text-muted-foreground">
            Also holding roles: {deliveryHolders} delivery and {commissionHolders} commission. Staff in directory groups: {(people.data ?? []).filter((person) => groupOf(person.roles) === "staff").length}.
          </p>
        )}
      </Panel>
      <Panel id="ceo-planned" title="Planned capabilities" description="Not yet built. These are listed for planning and are not active.">
        <ul className="space-y-2 text-sm text-muted-foreground">
          {PLANNED.map((item) => (
            <li key={item} className="flex items-start justify-between gap-3 rounded-lg border border-border px-4 py-3">
              <span>{item}</span>
              <PlannedBadge />
            </li>
          ))}
        </ul>
        <Notice tone="muted">No partner businesses, suppliers or marketplace revenue are shown, because none are recorded yet.</Notice>
      </Panel>
    </div>
  );
}
