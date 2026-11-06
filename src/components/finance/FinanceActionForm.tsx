import { useId, useRef, useState } from "react";
import { callFinanceCore, newIdempotencyKey } from "@/lib/finance-core";
import { buildFinanceBody, initialValues, isFieldVisible, type ActionFormSpec, type FieldSpec } from "@/lib/finance-forms";
import { ResultView } from "./FinanceResultView";

const INPUT =
  "w-full rounded-lg border border-[#C5CEDA] bg-white px-3 py-2 text-sm text-[#101C2D] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]";

const BUTTON_PRIMARY =
  "rounded-lg bg-[#1B2B40] px-4 py-2 text-sm font-semibold text-white hover:bg-[#101C2D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227] disabled:cursor-not-allowed disabled:opacity-60";

const BUTTON_SECONDARY =
  "rounded-lg border border-[#1B2B40] bg-white px-4 py-2 text-sm font-semibold text-[#1B2B40] hover:bg-[#F5F7FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227] disabled:cursor-not-allowed disabled:opacity-60";

function FieldInput({
  id,
  field,
  value,
  error,
  onChange,
}: {
  id: string;
  field: FieldSpec;
  value: string;
  error?: string | undefined;
  onChange: (value: string) => void;
}) {
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const describedBy = [error ? errorId : null, field.help ? helpId : null].filter(Boolean).join(" ") || undefined;
  const shared = {
    id,
    name: field.name,
    value,
    onChange: (event: { target: { value: string } }) => onChange(event.target.value),
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    className: INPUT,
  };

  let control;
  if (field.kind === "textarea") {
    control = <textarea {...shared} rows={3} />;
  } else if (field.kind === "select") {
    control = (
      <select {...shared}>
        <option value="">Choose…</option>
        {field.options?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  } else if (field.kind === "amount") {
    control = <input {...shared} type="text" inputMode="decimal" placeholder="0.00" autoComplete="off" />;
  } else if (field.kind === "integer") {
    control = <input {...shared} type="text" inputMode="numeric" autoComplete="off" />;
  } else if (field.kind === "date") {
    control = <input {...shared} type="date" />;
  } else {
    control = <input {...shared} type="text" autoComplete="off" />;
  }

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-[#1B2B40]">
        {field.label}
        {field.required ? <span aria-hidden="true"> *</span> : null}
        {field.kind === "amount" ? <span className="font-normal text-[#5B6B80]"> (rand)</span> : null}
      </label>
      {control}
      {field.help && (
        <p id={helpId} className="text-xs text-[#5B6B80]">
          {field.help}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium text-[#8A1F1F]">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Submits one verified Finance Core action. Shows success only after the backend confirms it,
 * blocks duplicate submissions while a request is in flight, and reuses the same idempotency key on retry.
 */
export function FinanceActionForm({ spec }: { spec: ActionFormSpec }) {
  const baseId = useId();
  const [values, setValues] = useState<Record<string, string>>(() => initialValues(spec));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const inFlight = useRef(false);
  const idempotencyKey = useRef(newIdempotencyKey());

  async function run(approve?: boolean) {
    if (inFlight.current) return;
    const built = buildFinanceBody(spec, values, { approve, idempotencyKey: idempotencyKey.current });
    if (!built.ok) {
      setErrors(built.errors);
      setStatus({ tone: "error", message: built.errors["__form"] ?? "Check the highlighted fields. Nothing was sent." });
      return;
    }
    setErrors({});
    setStatus(null);
    inFlight.current = true;
    setBusy(true);
    const response = await callFinanceCore(spec.action, built.body);
    inFlight.current = false;
    setBusy(false);
    if (response.ok) {
      setStatus({ tone: "success", message: spec.successMessage });
      setResult(response.data);
      idempotencyKey.current = newIdempotencyKey();
      if (spec.fields.length > 0 && spec.decision === undefined && !spec.action.startsWith("get_")) {
        setValues(initialValues(spec));
      }
    } else {
      setStatus({ tone: "error", message: response.message });
      setResult(null);
    }
  }

  const visibleFields = spec.fields.filter((field) => isFieldVisible(field, values));

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!spec.decision) void run();
      }}
      className="space-y-4"
    >
      {visibleFields.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {visibleFields.map((field) => (
            <FieldInput
              key={field.name}
              id={`${baseId}-${field.name}`}
              field={field}
              value={values[field.name] ?? ""}
              error={errors[field.name]}
              onChange={(value) => setValues((current) => ({ ...current, [field.name]: value }))}
            />
          ))}
        </div>
      )}
      {spec.warning && (
        <p className="rounded-lg border border-[#E0C766] bg-[#FFF9E6] p-3 text-sm text-[#5A4A10]">{spec.warning}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {spec.decision ? (
          <>
            <button type="button" disabled={busy} onClick={() => void run(true)} className={BUTTON_PRIMARY}>
              Approve
            </button>
            <button type="button" disabled={busy} onClick={() => void run(false)} className={BUTTON_SECONDARY}>
              Reject
            </button>
          </>
        ) : (
          <button type="submit" disabled={busy} className={BUTTON_PRIMARY}>
            {busy ? "Sending to Finance Core…" : spec.submitLabel}
          </button>
        )}
      </div>
      {status && (
        <p role={status.tone === "error" ? "alert" : "status"} className={status.tone === "error" ? "text-sm font-medium text-[#8A1F1F]" : "text-sm font-medium text-[#1E6B3A]"}>
          {status.message}
        </p>
      )}
      {result && <ResultView data={result} />}
    </form>
  );
}
