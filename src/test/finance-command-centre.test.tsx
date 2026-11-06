import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";

const invoke = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke }, storage: { from: vi.fn() } },
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    params,
    children,
    ...rest
  }: {
    to: string;
    params?: Record<string, string>;
    children: ReactNode;
    className?: string;
  }) => (
    <a href={to.replace("$role", params?.["role"] ?? "")} {...rest}>
      {children}
    </a>
  ),
}));

import { FinanceCommandCentre } from "@/components/finance/FinanceCommandCentre";
import { FINANCE_MODULES } from "@/lib/finance-command";

beforeEach(() => {
  invoke.mockReset();
  invoke.mockResolvedValue({ data: { success: true, overview: "ok" }, error: null });
});

afterEach(() => {
  cleanup();
});

function navigation() {
  return screen.getByRole("navigation", { name: "Finance modules" });
}

describe("Finance Command Centre shell", () => {
  it("lists all 21 pages in the sidebar grouped as the brief requires", () => {
    render(<FinanceCommandCentre name="Thulani Joseph" accountCode="NX-0001" roles={["ceo"]} />);
    const nav = within(navigation());
    for (const module of FINANCE_MODULES) {
      expect(nav.getByRole("button", { name: module.label })).toBeTruthy();
    }
    expect(nav.getAllByRole("button").filter((button) => button.getAttribute("aria-current") !== null)).toHaveLength(1);
  });

  it("shows the CEO dashboard link to CEO accounts only", () => {
    const { unmount } = render(<FinanceCommandCentre name="Thulani" accountCode="NX-0001" roles={["ceo"]} />);
    expect(screen.getByRole("link", { name: "CEO dashboard" }).getAttribute("href")).toBe("/workspace/ceo");
    unmount();
    render(<FinanceCommandCentre name="Thulani" accountCode="NX-0002" roles={["finance"]} />);
    expect(screen.queryByRole("link", { name: "CEO dashboard" })).toBeNull();
  });

  it("shows the Finance ID and an honest access label", () => {
    render(<FinanceCommandCentre name="Thulani" accountCode={null} roles={["finance"]} />);
    expect(screen.getByText(/Finance ID Unavailable/)).toBeTruthy();
    expect(screen.getByText(/Access: Finance team/)).toBeTruthy();
  });

  it("opens a module in the main area and marks it current", () => {
    render(<FinanceCommandCentre name="Thulani" accountCode="NX-0001" roles={["ceo"]} />);
    fireEvent.click(within(navigation()).getByRole("button", { name: "Trial Balance" }));
    expect(screen.getByRole("heading", { level: 2, name: "Trial Balance" })).toBeTruthy();
    expect(within(navigation()).getByRole("button", { name: "Trial Balance" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByLabelText(/From/)).toBeTruthy();
  });

  it("keeps real-money operations disabled and exposes no money-movement buttons", () => {
    render(<FinanceCommandCentre name="Thulani" accountCode="NX-0001" roles={["ceo"]} />);
    expect(screen.getByText("Real-money operations are disabled.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /withdraw|transfer|payout/i })).toBeNull();
  });

  it("loads the overview from Finance Core on open and reports loading honestly", async () => {
    render(<FinanceCommandCentre name="Thulani" accountCode="NX-0001" roles={["ceo"]} />);
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("finance-core", { body: { action: "get_overview" } }));
    expect((await screen.findAllByText("Finance Core response")).length).toBeGreaterThan(0);
  });

  it("shows every approval record type, each with its own decision form", () => {
    render(<FinanceCommandCentre name="Thulani" accountCode="NX-0001" roles={["ceo"]} />);
    fireEvent.click(within(navigation()).getByRole("button", { name: "Approval Centre" }));
    for (const label of ["Purchase orders", "Expenses", "Commission rules", "Refund requests", "Payroll runs", "Tax configurations"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(document.querySelectorAll("main details")).toHaveLength(10);
  });

  it("marks the four nested-structure actions as awaiting contract rather than building forms", () => {
    render(<FinanceCommandCentre name="Thulani" accountCode="NX-0001" roles={["ceo"]} />);
    fireEvent.click(within(navigation()).getByRole("button", { name: "Journal Entries" }));
    expect(screen.getAllByText("Awaiting contract").length).toBeGreaterThan(0);
    expect(screen.getByText(/Finance Core action: create_draft_journal/)).toBeTruthy();
  });
});
