import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke } },
}));

import {
  FINANCE_ACTION_NAMES,
  FINANCE_CORE_FUNCTION,
  callFinanceCore,
  kindForStatus,
  mapFinanceError,
  newIdempotencyKey,
  parseRandsToCents,
  parseWholeNumber,
} from "@/lib/finance-core";

function responseError(status: number, body: unknown) {
  return Object.assign(new Error("Edge function error"), {
    name: "FunctionsHttpError",
    context: new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
  });
}

beforeEach(() => {
  invoke.mockReset();
});

describe("Finance Core action contract", () => {
  it("lists exactly the 44 supplied actions, each once", () => {
    expect(FINANCE_ACTION_NAMES).toHaveLength(44);
    expect(new Set(FINANCE_ACTION_NAMES).size).toBe(44);
    expect(FINANCE_CORE_FUNCTION).toBe("finance-core");
  });

  it("does not expose private-schema or invented actions", () => {
    for (const action of FINANCE_ACTION_NAMES) {
      expect(action).toMatch(/^[a-z_]+$/);
      expect(action).not.toMatch(/app_private|drop|delete_all|withdraw|transfer_money|execute_payout/);
    }
  });
});

describe("rand to cents parsing", () => {
  it.each([
    ["100", 10000],
    ["100.5", 10050],
    ["100.50", 10050],
    ["0.01", 1],
    ["1 250.50", 125050],
    ["R 1,250.50", 125050],
    ["0", 0],
  ])("parses %s as %i cents", (input, cents) => {
    expect(parseRandsToCents(input)).toBe(cents);
  });

  it.each(["", "abc", "10.555", "-5", "1.2.3", "1e3", "NaN"])("rejects %s", (input) => {
    expect(parseRandsToCents(input)).toBeNull();
  });

  it("never returns floating-point fractions", () => {
    const cents = parseRandsToCents("19.99");
    expect(Number.isInteger(cents)).toBe(true);
    expect(cents).toBe(1999);
  });

  it("parses whole numbers strictly", () => {
    expect(parseWholeNumber("42")).toBe(42);
    expect(parseWholeNumber("4.2")).toBeNull();
    expect(parseWholeNumber("-1")).toBeNull();
    expect(parseWholeNumber("")).toBeNull();
  });
});

describe("error mapping", () => {
  it.each([
    [401, "unauthenticated"],
    [403, "forbidden"],
    [400, "validation"],
    [422, "validation"],
    [500, "service"],
    [503, "service"],
    [418, "unknown"],
    [undefined, "unknown"],
  ])("maps status %s to %s", (status, kind) => {
    expect(kindForStatus(status)).toBe(kind);
  });

  it("shows the backend's refusal reason for permission and validation failures", async () => {
    const forbidden = await mapFinanceError(responseError(403, { error: "Requesters cannot approve their own expense." }));
    expect(forbidden).toEqual({ ok: false, kind: "forbidden", message: "Requesters cannot approve their own expense." });
  });

  it("hides backend detail for server failures and returns a safe message", async () => {
    const service = await mapFinanceError(responseError(500, { error: "relation app_private.secret does not exist" }));
    expect(service.kind).toBe("service");
    expect(service.message).not.toMatch(/app_private|secret/);
  });

  it("maps a fetch failure to a network message", async () => {
    const result = await mapFinanceError(Object.assign(new Error("x"), { name: "FunctionsFetchError" }));
    expect(result.kind).toBe("network");
  });
});

describe("callFinanceCore", () => {
  it("sends the action with its payload through the authenticated client", async () => {
    invoke.mockResolvedValue({ data: { success: true, id: "exp-1" }, error: null });
    const result = await callFinanceCore("submit_expense", { expenseId: "exp-1" });
    expect(invoke).toHaveBeenCalledWith("finance-core", { body: { expenseId: "exp-1", action: "submit_expense" } });
    expect(result).toEqual({ ok: true, data: { success: true, id: "exp-1" } });
  });

  it("does not report success when the backend does not confirm it", async () => {
    invoke.mockResolvedValue({ data: { message: "queued" }, error: null });
    const result = await callFinanceCore("post_journal", { entryId: "j1" });
    expect(result.ok).toBe(false);
  });

  it("returns the backend's explicit failure message", async () => {
    invoke.mockResolvedValue({ data: { success: false, message: "Period is closed." }, error: null });
    const result = await callFinanceCore("create_expense", {});
    expect(result).toEqual({ ok: false, kind: "validation", message: "Period is closed." });
  });

  it("handles a thrown client error as a network failure", async () => {
    invoke.mockRejectedValue(new Error("offline"));
    const result = await callFinanceCore("get_overview");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("network");
  });

  it("handles an empty or non-object response safely", async () => {
    invoke.mockResolvedValue({ data: null, error: null });
    expect((await callFinanceCore("get_overview")).ok).toBe(false);
    invoke.mockResolvedValue({ data: ["x"], error: null });
    expect((await callFinanceCore("get_overview")).ok).toBe(false);
  });

  it("generates a fresh idempotency key per call", () => {
    expect(newIdempotencyKey()).not.toBe(newIdempotencyKey());
  });
});
