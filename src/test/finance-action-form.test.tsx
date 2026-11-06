import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const invoke = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke }, storage: { from: vi.fn() } },
}));

import { FinanceActionForm } from "@/components/finance/FinanceActionForm";
import { FINANCE_FORM_SPECS } from "@/lib/finance-forms";

beforeEach(() => {
  invoke.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("FinanceActionForm submission safety", () => {
  it("does not send when required fields are empty and names the problem", () => {
    render(<FinanceActionForm spec={FINANCE_FORM_SPECS.decide_expense!} />);
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(invoke).not.toHaveBeenCalled();
    expect(screen.getByText(/Check the highlighted fields/)).toBeTruthy();
  });

  it("blocks a second submission while the first is in flight", async () => {
    let resolve: (value: unknown) => void = () => undefined;
    invoke.mockReturnValue(new Promise((done) => (resolve = done)));
    render(<FinanceActionForm spec={FINANCE_FORM_SPECS.decide_expense!} />);
    fireEvent.change(screen.getByLabelText(/Expense ID/), { target: { value: "exp-7" } });
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: "Receipts match" } });
    const approve = screen.getByRole("button", { name: "Approve" });
    fireEvent.click(approve);
    fireEvent.click(approve);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(approve).toHaveProperty("disabled", true);
    resolve({ data: { success: true }, error: null });
    expect(await screen.findByText("Decision recorded by Finance Core.")).toBeTruthy();
  });

  it("shows success only after the backend confirms it", async () => {
    invoke.mockResolvedValue({ data: { message: "pending" }, error: null });
    render(<FinanceActionForm spec={FINANCE_FORM_SPECS.decide_expense!} />);
    fireEvent.change(screen.getByLabelText(/Expense ID/), { target: { value: "exp-7" } });
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: "Receipts match" } });
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.queryByText("Decision recorded by Finance Core.")).toBeNull();
    expect(invoke).toHaveBeenCalledWith("finance-core", {
      body: { expenseId: "exp-7", reason: "Receipts match", approve: false, action: "decide_expense" },
    });
  });
});
