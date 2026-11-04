import { PlannedBadge } from "@/components/states";
import { Notice, Panel } from "./ceo-ui";

const PLANNED = [
  "Summaries of daily trading, drawn from verified backend records",
  "Risk and anomaly alerts for orders, applications and access changes",
  "Recommended actions, each linked to the records it's based on",
];

export function CeoIntelligence() {
  return (
    <Panel
      id="ceo-intelligence"
      title="AI Executive Intelligence"
      description="This section is ready for a CEO-authorised AI endpoint. None is connected yet."
      actions={<PlannedBadge label="Awaiting integration" />}
    >
      <Notice tone="muted">
        No AI insights, forecasts or recommendations are generated or shown. Nothing here is a sample response.
      </Notice>
      <ul className="space-y-2 text-sm text-muted-foreground">
        {PLANNED.map((item) => (
          <li key={item} className="flex items-start justify-between gap-3 rounded-lg border border-border px-4 py-3">
            <span>{item}</span>
            <PlannedBadge />
          </li>
        ))}
      </ul>
    </Panel>
  );
}
