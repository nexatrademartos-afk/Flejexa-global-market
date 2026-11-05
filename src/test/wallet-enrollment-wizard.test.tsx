import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

const mocks = vi.hoisted(() => {
  const state = {
    enrollResponse: { data: { success: true }, error: null as unknown } as { data: unknown; error: unknown },
    walletRow: null as null | { id: string; wallet_number: string; status: string },
    pinSet: true,
    recoverySet: true,
  };
  const supabase = {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: "u1", email: "thulani@example.com" } },
        error: null,
      })),
    },
    from: vi.fn((table: string) => {
      const result =
        table === "profiles"
          ? { data: { full_name: "Thulani Joseph", phone: "0821234567" }, error: null }
          : table === "wallets"
            ? { data: state.walletRow, error: null }
            : { data: null, error: null };
      const chain: any = {};
      for (const method of ["select", "eq"]) chain[method] = () => chain;
      chain["maybeSingle"] = () => Promise.resolve(result);
      return chain;
    }),
    functions: {
      invoke: vi.fn(async (name: string, _options?: unknown) => {
        if (name === "wallet-enrollment") return state.enrollResponse;
        if (name === "wallet-pin") return { data: { pinSet: state.pinSet }, error: null };
        if (name === "wallet-pin-recovery") return { data: { configured: state.recoverySet }, error: null };
        return { data: null, error: null };
      }),
    },
    rpc: vi.fn(async () => ({ data: null, error: null })),
  };
  return { state, supabase };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: mocks.supabase }));
vi.mock("@/lib/customer-identity", () => ({ fetchVerifiedNexaIdForUser: async () => "NX-0001" }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...rest }: { to: string; children: ReactNode; className?: string }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

import { WalletEnrollmentWizard } from "@/components/wallet/WalletEnrollmentWizard";

async function goToPinStep() {
  await screen.findByText("Thulani Joseph");
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
}

async function goToRecoveryStep(pin = "123456", confirm = "123456") {
  await goToPinStep();
  fireEvent.change(screen.getByLabelText("Six-digit wallet PIN"), { target: { value: pin } });
  fireEvent.change(screen.getByLabelText("Confirm six-digit PIN"), { target: { value: confirm } });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
}

async function goToReviewStep() {
  await goToRecoveryStep();
  fireEvent.change(screen.getByLabelText("First recovery question"), {
    target: { value: "What city were you born in?" },
  });
  fireEvent.change(screen.getByLabelText("First answer"), { target: { value: "Sandton" } });
  fireEvent.change(screen.getByLabelText("Second recovery question"), {
    target: { value: "What was the name of your first school?" },
  });
  fireEvent.change(screen.getByLabelText("Second answer"), { target: { value: "Bishops" } });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByText("Step 4 · Complete wallet setup");
}

describe("Wallet enrolment wizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.enrollResponse = { data: { success: true }, error: null };
    mocks.state.walletRow = { id: "w1", wallet_number: "NXW-0000-1111-2222", status: "active" };
    mocks.state.pinSet = true;
    mocks.state.recoverySet = true;
  });

  it("shows the linked account details as read-only before any PIN is requested", async () => {
    render(<WalletEnrollmentWizard onCompleted={() => {}} />);

    expect(await screen.findByText("Thulani Joseph")).toBeTruthy();
    expect(screen.getByText("thulani@example.com")).toBeTruthy();
    expect(screen.getByText("0821234567")).toBeTruthy();
    expect(screen.getByText("NX-0001")).toBeTruthy();
    expect(mocks.supabase.functions.invoke).not.toHaveBeenCalledWith("wallet-enrollment", expect.anything());
  });

  it("does not create a wallet when the PIN entries do not match", async () => {
    render(<WalletEnrollmentWizard onCompleted={() => {}} />);
    await goToRecoveryStep("123456", "654321");

    expect(await screen.findByRole("alert")).toHaveTextContent("do not match");
    expect(screen.getByLabelText("Six-digit wallet PIN")).toBeTruthy();
    expect(mocks.supabase.functions.invoke).not.toHaveBeenCalledWith("wallet-enrollment", expect.anything());
  });

  it("does not create a wallet when recovery answers are missing or the questions repeat", async () => {
    render(<WalletEnrollmentWizard onCompleted={() => {}} />);
    await goToRecoveryStep();

    fireEvent.change(screen.getByLabelText("First recovery question"), {
      target: { value: "What city were you born in?" },
    });
    fireEvent.change(screen.getByLabelText("Second recovery question"), {
      target: { value: "What city were you born in?" },
    });
    // The second select disables the repeated option, so the wizard must also reject it on submit.
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Choose two different recovery questions.");

    fireEvent.change(screen.getByLabelText("Second recovery question"), {
      target: { value: "What was the name of your first school?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("at least two characters");
    expect(mocks.supabase.functions.invoke).not.toHaveBeenCalledWith("wallet-enrollment", expect.anything());
  });

  it("creates the wallet only through wallet-enrollment, never register_my_wallet, and shows PIN and recovery confirmed", async () => {
    const onCompleted = vi.fn();
    render(<WalletEnrollmentWizard onCompleted={onCompleted} />);
    await goToReviewStep();

    fireEvent.click(screen.getByRole("button", { name: /create wallet/i }));

    expect(await screen.findByText("Wallet created")).toBeTruthy();
    expect(screen.getByText("NXW-0000-1111-2222")).toBeTruthy();
    expect(screen.getAllByText("Configured")).toHaveLength(2);
    expect(screen.queryByText(/balance/i)).toBeNull();

    const enrollCall = mocks.supabase.functions.invoke.mock.calls.find(([name]) => name === "wallet-enrollment");
    expect(enrollCall).toBeTruthy();
    const body = (enrollCall![1] as { body: Record<string, unknown> }).body;
    expect(Object.keys(body).sort()).toEqual(
      ["answerOne", "answerTwo", "confirmPin", "pin", "questionOne", "questionTwo"].sort(),
    );
    expect(body).toMatchObject({
      pin: "123456",
      confirmPin: "123456",
      questionOne: "What city were you born in?",
      questionTwo: "What was the name of your first school?",
      answerOne: "Sandton",
      answerTwo: "Bishops",
    });
    expect(mocks.supabase.rpc).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Continue to unlock wallet" }));
    expect(onCompleted).toHaveBeenCalledTimes(1);
  });

  it("shows the safe backend error, clears the PIN and answers, and never shows success", async () => {
    mocks.state.enrollResponse = {
      data: null,
      error: {
        message: "Edge Function returned a non-2xx status code",
        context: { json: async () => ({ error: "A wallet PIN is already set for this account." }) },
      },
    };
    render(<WalletEnrollmentWizard onCompleted={() => {}} />);
    await goToReviewStep();

    fireEvent.click(screen.getByRole("button", { name: /create wallet/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("A wallet PIN is already set for this account.");
    expect(screen.queryByText("Wallet created")).toBeNull();
    expect((screen.getByLabelText("Six-digit wallet PIN") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Confirm six-digit PIN") as HTMLInputElement).value).toBe("");
    expect(mocks.supabase.functions.invoke.mock.calls.filter(([name]) => name === "wallet-enrollment")).toHaveLength(1);
  });

  it("does not show success when PIN or recovery cannot be confirmed afterwards", async () => {
    mocks.state.recoverySet = false;
    render(<WalletEnrollmentWizard onCompleted={() => {}} />);
    await goToReviewStep();

    fireEvent.click(screen.getByRole("button", { name: /create wallet/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("could not both be confirmed");
    expect(screen.queryByText("Wallet created")).toBeNull();
  });
});
