import { useEffect, useRef, useState } from "react";
import { formatMoneyCents } from "@/lib/finance-command";
import { callFinanceCore, type FinanceActionName } from "@/lib/finance-core";

export function humanize(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function display(key: string, value: unknown, currency: string | null): string {
  if (value === null || value === undefined) return "Not reported";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number" && key.endsWith("Cents")) {
    return currency ? formatMoneyCents(value, currency) : `${value} cents (currency not reported)`;
  }
  return String(value);
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? "";
  } catch {
    return "Could not display this structure.";
  }
}

/** Renders a Finance Core response exactly as returned: scalar fields as a list, structures as expandable JSON. */
export function ResultView({ data, hide = [] }: { data: Record<string, unknown>; hide?: readonly string[] }) {
  const entries = Object.entries(data).filter(([key]) => key !== "success" && !hide.includes(key));
  const currency = typeof data["currencyCode"] === "string" ? (data["currencyCode"] as string) : null;
  const scalars = entries.filter(([, value]) => value === null || ["string", "number", "boolean"].includes(typeof value));
  const nested = entries.filter(([, value]) => typeof value === "object" && value !== null);

  if (entries.length === 0) {
    return <p className="text-sm text-[#5B6B80]">Finance Core confirmed the action and returned no fields.</p>;
  }

  return (
    <div className="space-y-3 rounded-xl border border-[#D5DCE6] bg-[#F5F7FA] p-4 text-sm text-[#101C2D]">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#5B6B80]">Finance Core response</p>
      {scalars.length > 0 && (
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {scalars.map(([key, value]) => (
            <div key={key} className="min-w-0">
              <dt className="text-xs text-[#5B6B80]">{humanize(key)}</dt>
              <dd className="break-words font-medium">{display(key, value, currency)}</dd>
            </div>
          ))}
        </dl>
      )}
      {nested.map(([key, value]) => (
        <details key={key} className="rounded-lg bg-white p-3">
          <summary className="cursor-pointer font-medium text-[#1B2B40]">
            {humanize(key)}
            {Array.isArray(value) ? ` (${value.length} item${value.length === 1 ? "" : "s"})` : ""}
          </summary>
          <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs text-[#101C2D]">{safeStringify(value)}</pre>
        </details>
      ))}
    </div>
  );
}

/** Loads one read action when mounted and shows loading, error and honest empty states. */
export function FinanceReadPanel({ action, emptyText }: { action: FinanceActionName; emptyText: string }) {
  const [state, setState] = useState<
    { status: "loading" } | { status: "ready"; data: Record<string, unknown> } | { status: "error"; message: string }
  >({ status: "loading" });
  const inFlight = useRef(false);
  const mounted = useRef(true);

  async function load() {
    if (inFlight.current) return;
    inFlight.current = true;
    setState({ status: "loading" });
    const result = await callFinanceCore(action);
    inFlight.current = false;
    if (!mounted.current) return;
    setState(result.ok ? { status: "ready", data: result.data } : { status: "error", message: result.message });
  }

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
    };
    // load is recreated per render but depends only on the action name.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action]);

  return (
    <div className="space-y-3">
      {state.status === "loading" && <p role="status" className="text-sm text-[#5B6B80]">Loading from Finance Core…</p>}
      {state.status === "error" && (
        <div role="alert" className="space-y-2 rounded-lg border border-[#E7B7B7] bg-[#FDF2F2] p-3 text-sm text-[#8A1F1F]">
          <p>{state.message}</p>
          <button type="button" onClick={() => void load()} className="font-semibold underline underline-offset-4">
            Try again
          </button>
        </div>
      )}
      {state.status === "ready" &&
        (Object.keys(state.data).filter((key) => key !== "success").length === 0 ? (
          <p className="text-sm text-[#5B6B80]">{emptyText}</p>
        ) : (
          <>
            <ResultView data={state.data} />
            <button type="button" onClick={() => void load()} className="text-sm font-semibold text-[#1B2B40] underline underline-offset-4">
              Refresh
            </button>
          </>
        ))}
    </div>
  );
}
