import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import type { CeoRpcError, CountRow } from "@/lib/ceo-dashboard";

export function Panel({
  id,
  title,
  description,
  actions,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-title`} className="surface space-y-4 rounded-2xl border border-border p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="text-lg font-bold text-foreground">{title}</h2>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 break-words text-2xl font-bold text-foreground">{value}</p>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

export function Notice({ tone = "gold", children }: { tone?: "gold" | "red" | "muted"; children: ReactNode }) {
  const toneClass =
    tone === "red"
      ? "border-red-500/40 bg-red-500/5"
      : tone === "muted"
        ? "border-border bg-muted/40"
        : "border-gold/40 bg-gold-soft";
  return <div role={tone === "red" ? "alert" : "note"} className={`rounded-lg border px-4 py-3 text-sm text-foreground ${toneClass}`}>{children}</div>;
}

export function Badge({ tone = "muted", children }: { tone?: "gold" | "green" | "red" | "muted"; children: ReactNode }) {
  const toneClass =
    tone === "gold"
      ? "border-gold/50 bg-gold-soft text-accent-foreground"
      : tone === "green"
        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        : tone === "red"
          ? "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300"
          : "border-border bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${toneClass}`}>
      {children}
    </span>
  );
}

export function RefreshButton({ onClick, busy }: { onClick: () => void; busy: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={busy} className="btn btn-outline min-h-10 gap-2 text-sm">
      <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} aria-hidden="true" />
      {busy ? "Refreshing…" : "Refresh"}
    </button>
  );
}

// Shows the honest loading or error state for a resource. Renders nothing once data is ready.
export function ResourceNotice({
  status,
  error,
  onRetry,
  loadingLabel = "Loading from NEXA's secure backend…",
}: {
  status: "idle" | "loading" | "ready" | "error";
  error: CeoRpcError | null;
  onRetry?: () => void;
  loadingLabel?: string;
}) {
  if (status === "idle" || status === "loading") {
    return <p role="status" className="text-sm text-muted-foreground">{loadingLabel}</p>;
  }
  if (status === "error" && error) {
    return (
      <div role="alert" className="rounded-lg border border-red-500/40 bg-red-500/5 p-4">
        <p className="text-sm text-foreground">{error.message}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {error.kind === "session" ? (
            <Link to="/sign-in" className="btn btn-primary text-sm">Sign in again</Link>
          ) : (
            onRetry && <button type="button" onClick={onRetry} className="btn btn-outline text-sm">Try again</button>
          )}
        </div>
      </div>
    );
  }
  return null;
}

export function EmptyNotice({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

export function CountTable({ title, rows, labelHeading }: { title: string; rows: CountRow[]; labelHeading: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-left text-sm">
        <caption className="px-4 py-3 text-left font-semibold text-foreground">{title}</caption>
        <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-2 font-semibold">{labelHeading}</th>
            <th scope="col" className="px-4 py-2 text-right font-semibold">Count</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={2} className="px-4 py-4 text-muted-foreground">No values reported.</td></tr>
          ) : (
            rows.map((row) => (
              <tr key={row.label} className="border-t border-border">
                <td className="px-4 py-2">{row.label}</td>
                <td className="px-4 py-2 text-right font-semibold tabular-nums">{row.count.toLocaleString("en-ZA")}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function SearchField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="block min-w-0 flex-1">
      <span className="sr-only">{label}</span>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder ?? label}
        className="field min-h-10 w-full"
      />
    </label>
  );
}

export function DataTable({ caption, headers, children }: { caption: string; headers: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[640px] text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            {headers.map((header) => (
              <th key={header} scope="col" className="px-3 py-2 font-semibold">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Cell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`border-t border-border px-3 py-2 align-top ${className}`}>{children}</td>;
}
