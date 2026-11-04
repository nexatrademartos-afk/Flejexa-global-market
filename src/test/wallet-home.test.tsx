import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";

const mocks = vi.hoisted(() => {
  const wallet = {
    id: "w1",
    wallet_number: "NXW-0000-1234-5678",
    currency: "ZAR",
    status: "active",
    created_at: "2026-10-01T10:00:00Z",
  };

  const tableResult = (table: string) => {
    if (table === "wallets") return { data: wallet, error: null };
    if (table === "profiles") return { data: { full_name: "Thulani Joseph TJC" }, error: null };
    return { data: [], error: null };
  };

  const builder = (table: string) => {
    const result = tableResult(table);
    const chain: Record<string, unknown> = {
      then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve(result).then(resolve, reject),
      maybeSingle: () => Promise.resolve(result),
    };
    for (const method of ["select", "eq", "or", "order", "limit"]) {
      chain[method] = () => chain;
    }
    return chain;
  };

  const supabase = {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: "u1", user_metadata: { full_name: "Thulani Joseph TJC" } } },
        error: null,
      })),
    },
    from: vi.fn((table: string) => builder(table)),
    rpc: vi.fn(async (fn: string) => {
      if (fn === "get_my_wallet_balance") {
        return {
          data: {
            registered: true,
            has_ledger_records: false,
            available_zar: 0,
            pending_zar: 0,
            reserved_zar: 0,
          },
          error: null,
        };
      }
      return { data: [], error: null };
    }),
    functions: {
      invoke: vi.fn(async (name: string, options: { body: { action: string } }) => {
        if (name === "wallet-pin" && options.body.action === "status") {
          return { data: { pinSet: true }, error: null };
        }
        if (name === "wallet-pin" && options.body.action === "verify") {
          return { data: { verified: true }, error: null };
        }
        return { data: { configured: true, questions: [] }, error: null };
      }),
    },
  };

  return { supabase, wallet };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: mocks.supabase }));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({ options, ...options }),
  Link: ({ to, children, ...rest }: { to: string; children: ReactNode; className?: string }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

import { Route } from "@/routes/account.wallet";

const WalletPage = (Route as unknown as { component: () => ReactElement }).component;

describe("Wallet home screen layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("greets the customer, shows the wallet account number and the balance cards, and keeps money actions inactive", async () => {
    render(<WalletPage />);

    // Locked until the six-digit PIN is verified.
    const pinInput = await screen.findByLabelText("Enter six-digit wallet PIN");
    fireEvent.change(pinInput, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /unlock/i }));

    expect(await screen.findByText("Welcome back, Thulani")).toBeTruthy();

    // Account number comes from the backend wallet row, not invented text.
    expect(screen.getByText("Wallet account number")).toBeTruthy();
    expect(screen.getByText(mocks.wallet.wallet_number)).toBeTruthy();

    // Balance and summary cards.
    expect(screen.getByText("Available wallet balance")).toBeTruthy();
    expect(screen.getByText("Q Points")).toBeTruthy();
    expect(screen.getByText("Commissions")).toBeTruthy();
    expect(screen.getByText("Pending funds")).toBeTruthy();
    expect(screen.getByText("Reserved funds")).toBeTruthy();

    // Q Points total comes from reward_points (no rows = 0 points).
    expect(await screen.findByText("0 points")).toBeTruthy();

    // Money actions are visibly inactive, not clickable buttons.
    for (const label of ["Add money", "Transfer", "Withdraw"]) {
      const tile = screen.getByText(label).closest("[aria-disabled='true']");
      expect(tile).not.toBeNull();
    }
    expect(screen.queryByRole("button", { name: /add money|transfer|withdraw/i })).toBeNull();

    // Removed clutter must not come back.
    expect(screen.queryByText(/Illustrative/i)).toBeNull();
    expect(screen.queryByText(/Identity Brand Wallet/i)).toBeNull();
    expect(screen.queryByText("Change wallet PIN")).toBeNull();
  });

  it("moves PIN and recovery management to wallet settings and lists services in a collapsible menu", async () => {
    render(<WalletPage />);

    fireEvent.change(await screen.findByLabelText("Enter six-digit wallet PIN"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /unlock/i }));
    await screen.findByText("Welcome back, Thulani");

    const settingsLink = screen.getByRole("link", { name: "Open wallet settings" });
    expect(settingsLink.getAttribute("href")).toBe("/account/wallet/settings");

    const services = screen.getByText("Wallet services").closest("details");
    expect(services).not.toBeNull();
    const servicesList = within(services as HTMLElement);
    expect(servicesList.getByText("Transaction history")).toBeTruthy();
    expect(servicesList.getByText("Deposits & withdrawals")).toBeTruthy();
    expect(
      servicesList.getByText("Wallet settings & security").closest("a")?.getAttribute("href"),
    ).toBe("/account/wallet/settings");
    await waitFor(() => expect(mocks.supabase.functions.invoke).toHaveBeenCalled());
  });
});
