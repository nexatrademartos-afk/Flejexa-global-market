import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";

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

describe("Finance Command Centre shell", () => {
  it("opens on the Overview with awaiting-contract states and no invented figures", () => {
    render(<FinanceCommandCentre name="Thulani Joseph" accountCode="NX-0001" roles={["ceo", "customer"]} />);

    const nav = screen.getByRole("navigation", { name: "Finance modules" });
    expect(within(nav).getAllByRole("button")).toHaveLength(22);
    expect(within(nav).getByRole("button", { name: "Overview" })).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByText("Awaiting contract").length).toBeGreaterThanOrEqual(10);
    expect(screen.getAllByText(/Awaiting the verified Finance Core contract/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/R\s?\d/)).toBeNull();
  });

  it("shows real-money operations as disabled and never as executable", () => {
    render(<FinanceCommandCentre name="Thulani" accountCode={null} roles={["finance"]} />);

    expect(screen.getAllByText(/Real-money operations are disabled/).length).toBeGreaterThan(0);
    expect(
      screen.queryByRole("button", { name: /^(pay|pay now|withdraw|transfer|deposit|send payment|execute payment)$/i }),
    ).toBeNull();
  });

  it("switches modules and marks the active one", () => {
    render(<FinanceCommandCentre name="Thulani" accountCode="NX-0001" roles={["finance"]} />);

    fireEvent.click(screen.getByRole("button", { name: "Trial Balance" }));

    expect(screen.getByRole("navigation", { name: "Finance modules" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Trial Balance" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Overview" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("heading", { level: 2, name: "Trial Balance" })).toBeTruthy();
  });

  it("offers the CEO dashboard link only to CEO accounts", () => {
    const { unmount } = render(<FinanceCommandCentre name="Thulani" accountCode="NX-0001" roles={["ceo"]} />);
    expect(screen.getByRole("link", { name: "CEO dashboard" })).toHaveAttribute("href", "/workspace/ceo");
    unmount();

    render(<FinanceCommandCentre name="Thulani" accountCode="NX-0002" roles={["finance"]} />);
    expect(screen.queryByRole("link", { name: "CEO dashboard" })).toBeNull();
  });

  it("toggles the mobile module drawer with accessible state", () => {
    render(<FinanceCommandCentre name="Thulani" accountCode="NX-0001" roles={["ceo"]} />);

    const toggle = screen.getByRole("button", { name: "Modules" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Close modules" })).toHaveAttribute("aria-expanded", "true");
  });
});
