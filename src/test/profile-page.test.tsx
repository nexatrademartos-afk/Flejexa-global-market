import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";

const mocks = vi.hoisted(() => {
  const state = {
    user: { id: "u1", email: "thulani@example.com", new_email: undefined as string | undefined },
    profile: { full_name: "Thulani Old", phone: "0820000000", address: "1 Old Road" },
    updateResult: null as null | { data: unknown; error: unknown },
    updatePayloads: [] as Record<string, unknown>[],
    signInCalls: [] as unknown[],
    updateUserCalls: [] as unknown[],
  };

  const readResult = (table: string) => {
    if (table === "profiles") return { data: state.profile, error: null };
    if (table === "customer_addresses") return { data: { country_iso2: "ZA" }, error: null };
    if (table === "nexa_person_identities") return { data: { person_code: "NX-0001" }, error: null };
    return { data: null, error: null };
  };

  const updateResultFor = (table: string) => {
    if (table !== "profiles") return { data: [], error: null };
    if (state.updateResult) return state.updateResult;
    const payload = state.updatePayloads.at(-1) ?? {};
    return {
      data: [{ full_name: payload["full_name"], phone: payload["phone"], address: payload["address"] }],
      error: null,
    };
  };

  const from = vi.fn((table: string) => {
    let isUpdate = false;
    // Minimal query-builder double: reads resolve via maybeSingle or await; writes resolve via await.
    const self: any = {};
    for (const method of ["select", "eq", "limit"]) self[method] = () => self;
    self.update = (payload: Record<string, unknown>) => {
      state.updatePayloads.push(payload);
      isUpdate = true;
      return self;
    };
    self.maybeSingle = () => Promise.resolve(readResult(table));
    self.then = (resolve: (v: unknown) => unknown, reject?: (r: unknown) => unknown) =>
      Promise.resolve(isUpdate ? updateResultFor(table) : readResult(table)).then(resolve, reject);
    return self;
  });

  const supabase = {
    from,
    auth: {
      getUser: vi.fn(async () => ({ data: { user: state.user }, error: null })),
      signInWithPassword: vi.fn(async (args: unknown) => {
        state.signInCalls.push(args);
        return { data: { user: { id: "u1" } }, error: null };
      }),
      updateUser: vi.fn(async (args: { email: string }) => {
        state.updateUserCalls.push(args);
        return { data: { user: { id: "u1", email: "thulani@example.com", new_email: args.email } }, error: null };
      }),
    },
  };

  return { state, supabase };
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

import { Route } from "@/routes/account.profile";

const ProfilePage = (Route as unknown as { component: () => ReactElement }).component;

describe("Customer profile page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.updatePayloads.length = 0;
    mocks.state.updateResult = null;
    mocks.state.signInCalls.length = 0;
    mocks.state.updateUserCalls.length = 0;
    mocks.state.user = { id: "u1", email: "thulani@example.com", new_email: undefined };
    mocks.state.profile = { full_name: "Thulani Old", phone: "0820000000", address: "1 Old Road" };
  });

  it("shows the saved values, a read-only email and the unchanged customer code", async () => {
    render(<ProfilePage />);

    expect(await screen.findByDisplayValue("Thulani Old")).toBeTruthy();
    expect(screen.getByDisplayValue("0820000000")).toBeTruthy();
    expect(screen.getByDisplayValue("1 Old Road")).toBeTruthy();
    expect(screen.getByDisplayValue("thulani@example.com")).toBeDisabled();
    expect(screen.getByText("NX-0001")).toBeTruthy();
    expect(screen.getByDisplayValue(/South Africa/)).toBeDisabled();
  });

  it("saves only full name, phone and address, then shows success after the update returns a row", async () => {
    render(<ProfilePage />);
    const nameInput = await screen.findByDisplayValue("Thulani Old");

    fireEvent.change(nameInput, { target: { value: "Thulani Joseph" } });
    fireEvent.change(screen.getByDisplayValue("0820000000"), { target: { value: "0821234567" } });
    fireEvent.change(screen.getByDisplayValue("1 Old Road"), { target: { value: "2 New Street" } });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByText("Your profile details have been saved successfully.")).toBeTruthy();
    expect(mocks.state.updatePayloads).toHaveLength(1);
    const payload = mocks.state.updatePayloads[0] as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(["address", "full_name", "phone"]);
    expect(payload).not.toHaveProperty("updated_at");
    expect(payload).toEqual({ full_name: "Thulani Joseph", phone: "0821234567", address: "2 New Street" });
    expect(screen.getByDisplayValue("Thulani Joseph")).toBeTruthy();
  });

  it("does not report success when the update matches zero rows", async () => {
    mocks.state.updateResult = { data: [], error: null };
    render(<ProfilePage />);

    fireEvent.change(await screen.findByDisplayValue("Thulani Old"), { target: { value: "Someone Else" } });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("no profile record was updated");
    expect(screen.queryByText("Your profile details have been saved successfully.")).toBeNull();
  });

  it("changes email only through the password-verified Auth flow and keeps the current email until confirmed", async () => {
    render(<ProfilePage />);
    await screen.findByDisplayValue("Thulani Old");

    fireEvent.click(screen.getByRole("button", { name: "Change email" }));
    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "my-password" } });
    fireEvent.change(screen.getByLabelText("New email address"), { target: { value: "New@Example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send confirmation" }));

    expect(await screen.findByText(/Confirmation pending for/)).toBeTruthy();
    expect(mocks.state.signInCalls).toEqual([{ email: "thulani@example.com", password: "my-password" }]);
    expect(mocks.state.updateUserCalls).toEqual([{ email: "new@example.com" }]);
    // The current email is still shown until Supabase confirms the change, and profiles.email is never written.
    expect(screen.getByDisplayValue("thulani@example.com")).toBeDisabled();
    expect(mocks.state.updatePayloads.every((p) => !("email" in p))).toBe(true);
    await waitFor(() => expect(screen.queryByLabelText("Current password")).toBeNull());
  });

  it("does not start an email change when the password is wrong", async () => {
    mocks.supabase.auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "Invalid login credentials" },
    } as never);
    render(<ProfilePage />);
    await screen.findByDisplayValue("Thulani Old");

    fireEvent.click(screen.getByRole("button", { name: "Change email" }));
    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "wrong" } });
    fireEvent.change(screen.getByLabelText("New email address"), { target: { value: "new@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send confirmation" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The current password is incorrect.");
    expect(mocks.state.updateUserCalls).toHaveLength(0);
  });
});
