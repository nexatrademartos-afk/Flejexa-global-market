import { useEffect, useId, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { callFinanceCore } from "@/lib/finance-core";
import { humanize } from "./FinanceResultView";

export const RECEIPT_BUCKET = "finance-receipts";
export const RECEIPT_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
export const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;

export function validateReceiptFile(file: { type: string; size: number }): string | null {
  if (!(RECEIPT_TYPES as readonly string[]).includes(file.type)) return "Upload a PDF, JPEG, PNG or WebP file.";
  if (file.size <= 0) return "This file is empty.";
  if (file.size > RECEIPT_MAX_BYTES) return "This file is larger than 10 MB.";
  return null;
}

export function safeFilename(name: string): string {
  return (
    name
      .replace(/[^A-Za-z0-9._-]/g, "_")
      .replace(/\.{2,}/g, ".")
      .replace(/_+/g, "_")
      .replace(/^[._]+/, "")
      .slice(0, 100) || "receipt"
  );
}

export function receiptStoragePath(expenseId: string, filename: string, uniqueId: string): string {
  return `${expenseId}/${uniqueId}-${safeFilename(filename)}`;
}

export function isValidExpenseId(value: string): boolean {
  return /^[A-Za-z0-9_-]{1,100}$/.test(value.trim());
}

type Receipt = Record<string, unknown>;

const SIGNED_KEYS = ["signedUrl", "url", "downloadUrl"] as const;

function safeLink(receipt: Receipt): string | null {
  for (const key of SIGNED_KEYS) {
    const value = receipt[key];
    if (typeof value === "string" && value.startsWith("https://")) return value;
  }
  return null;
}

/** Private receipt workflow: stores the file in the private bucket, then registers it through Finance Core. */
export function ExpenseReceipts() {
  const baseId = useId();
  const [expenseId, setExpenseId] = useState("");
  const [receipts, setReceipts] = useState<Receipt[] | null>(null);
  const [listStatus, setListStatus] = useState<{ tone: "error" | "info"; message: string } | null>(null);
  const [uploadStatus, setUploadStatus] = useState<{ tone: "error" | "success"; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function loadReceipts(id = expenseId) {
    if (inFlight.current) return;
    if (!isValidExpenseId(id)) {
      setListStatus({ tone: "error", message: "Enter a valid expense ID first." });
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setListStatus({ tone: "info", message: "Loading receipts…" });
    const result = await callFinanceCore("get_expense_receipts", { expenseId: id.trim() });
    inFlight.current = false;
    setBusy(false);
    if (!result.ok) {
      setReceipts(null);
      setListStatus({ tone: "error", message: result.message });
      return;
    }
    const list = Array.isArray(result.data["receipts"]) ? (result.data["receipts"] as Receipt[]) : [];
    setReceipts(list);
    setListStatus(null);
  }

  useEffect(() => {
    setReceipts(null);
  }, [expenseId]);

  async function upload(file: File) {
    if (inFlight.current) return;
    if (!isValidExpenseId(expenseId)) {
      setUploadStatus({ tone: "error", message: "Enter a valid expense ID before uploading." });
      return;
    }
    const problem = validateReceiptFile(file);
    if (problem) {
      setUploadStatus({ tone: "error", message: problem });
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setUploadStatus({ tone: "success", message: "Storing the file privately…" });
    const id = expenseId.trim();
    const path = receiptStoragePath(id, file.name, crypto.randomUUID());
    try {
      const { error } = await supabase.storage.from(RECEIPT_BUCKET).upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (error) {
        setUploadStatus({ tone: "error", message: "The file was not stored. Nothing was registered. Try again." });
        return;
      }
      const registered = await callFinanceCore("register_expense_receipt", {
        expenseId: id,
        storagePath: path,
        filename: file.name,
        mimeType: file.type,
        fileSizeBytes: file.size,
      });
      if (!registered.ok) {
        setUploadStatus({
          tone: "error",
          message: `The file is stored privately, but Finance Core did not register it: ${registered.message} Ask Finance to review this upload.`,
        });
        return;
      }
      setUploadStatus({ tone: "success", message: "Receipt registered by Finance Core." });
      if (fileInput.current) fileInput.current.value = "";
      await loadReceipts(id);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label htmlFor={`${baseId}-expense`} className="block text-sm font-medium text-[#1B2B40]">
          Expense ID
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id={`${baseId}-expense`}
            value={expenseId}
            onChange={(event) => setExpenseId(event.target.value)}
            autoComplete="off"
            className="min-w-0 flex-1 rounded-lg border border-[#C5CEDA] bg-white px-3 py-2 text-sm text-[#101C2D] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void loadReceipts()}
            className="rounded-lg border border-[#1B2B40] bg-white px-4 py-2 text-sm font-semibold text-[#1B2B40] hover:bg-[#F5F7FA] disabled:opacity-60"
          >
            Load receipts
          </button>
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-dashed border-[#C5CEDA] p-4">
        <label htmlFor={`${baseId}-file`} className="block text-sm font-medium text-[#1B2B40]">
          Upload receipt
        </label>
        <p className="text-xs text-[#5B6B80]">PDF, JPEG, PNG or WebP, up to 10 MB. Files are stored privately and are not public links.</p>
        <input
          id={`${baseId}-file`}
          ref={fileInput}
          type="file"
          accept={RECEIPT_TYPES.join(",")}
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
          className="block text-sm text-[#1B2B40]"
        />
        {uploadStatus && (
          <p role={uploadStatus.tone === "error" ? "alert" : "status"} className={uploadStatus.tone === "error" ? "text-sm font-medium text-[#8A1F1F]" : "text-sm font-medium text-[#1E6B3A]"}>
            {uploadStatus.message}
          </p>
        )}
      </div>

      {listStatus && (
        <p role={listStatus.tone === "error" ? "alert" : "status"} className={listStatus.tone === "error" ? "text-sm font-medium text-[#8A1F1F]" : "text-sm text-[#5B6B80]"}>
          {listStatus.message}
        </p>
      )}
      {receipts && receipts.length === 0 && <p className="text-sm text-[#5B6B80]">No receipts are registered for this expense.</p>}
      {receipts && receipts.length > 0 && (
        <ul className="space-y-3">
          {receipts.map((receipt, index) => {
            const link = safeLink(receipt);
            const details = Object.entries(receipt).filter(
              ([key, value]) => !(SIGNED_KEYS as readonly string[]).includes(key) && (value === null || ["string", "number", "boolean"].includes(typeof value)),
            );
            return (
              <li key={String(receipt["id"] ?? index)} className="rounded-lg border border-[#D5DCE6] bg-white p-3 text-sm">
                <dl className="grid gap-2 sm:grid-cols-2">
                  {details.map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-xs text-[#5B6B80]">{humanize(key)}</dt>
                      <dd className="break-words font-medium text-[#101C2D]">{value === null ? "Not reported" : String(value)}</dd>
                    </div>
                  ))}
                </dl>
                {link ? (
                  <a href={link} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-semibold text-[#1B2B40] underline underline-offset-4">
                    Open receipt (temporary link)
                  </a>
                ) : (
                  <p className="mt-2 text-xs text-[#5B6B80]">No viewing link was returned for this receipt.</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
