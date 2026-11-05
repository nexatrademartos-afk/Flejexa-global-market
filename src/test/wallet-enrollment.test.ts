import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  WALLET_RECOVERY_QUESTIONS,
  buildWalletEnrollmentPayload,
  readWalletFunctionError,
  resolveWalletEntryState,
  validateWalletPinEntry,
  validateWalletRecovery,
} from "@/lib/wallet-enrollment";

const FIRST_SCHOOL = "What was the name of your first school?";
const BIRTH_CITY = "What city were you born in?";

const goodRecovery = {
  questionOne: FIRST_SCHOOL,
  questionTwo: BIRTH_CITY,
  answerOne: "Sandton",
  answerTwo: "Bishops",
};

describe("wallet enrolment validation", () => {
  it("requires a six-digit PIN that matches its confirmation", () => {
    expect(validateWalletPinEntry("12345", "12345")).toMatch(/exactly six digits/);
    expect(validateWalletPinEntry("12345a", "12345a")).toMatch(/exactly six digits/);
    expect(validateWalletPinEntry("123456", "123457")).toMatch(/do not match/);
    expect(validateWalletPinEntry("123456", "123456")).toBeNull();
  });

  it("requires two different listed questions and both answers", () => {
    expect(validateWalletRecovery({ ...goodRecovery, answerTwo: "" })).toMatch(/at least two characters/);
    expect(validateWalletRecovery({ ...goodRecovery, answerOne: " a " })).toMatch(/at least two characters/);
    expect(validateWalletRecovery({ ...goodRecovery, questionTwo: goodRecovery.questionOne })).toMatch(
      /different/,
    );
    expect(validateWalletRecovery({ ...goodRecovery, questionOne: "Custom question?" })).toMatch(/from the list/);
    expect(validateWalletRecovery(goodRecovery)).toBeNull();
  });

  it("uses the same recovery questions as Wallet Settings", () => {
    expect(WALLET_RECOVERY_QUESTIONS).toEqual([
      "What was the name of your first school?",
      "What city were you born in?",
      "What was your childhood nickname?",
    ]);
  });

  it("sends exactly the six required fields with trimmed answers", () => {
    const payload = buildWalletEnrollmentPayload({
      pin: "123456",
      confirmPin: "123456",
      ...goodRecovery,
      answerOne: "  Sandton  ",
      answerTwo: " Bishops ",
    });
    expect(Object.keys(payload).sort()).toEqual(
      ["answerOne", "answerTwo", "confirmPin", "pin", "questionOne", "questionTwo"].sort(),
    );
    expect(payload.answerOne).toBe("Sandton");
    expect(payload.answerTwo).toBe("Bishops");
  });
});

describe("wallet entry rules", () => {
  it("shows a create prompt, then the wizard only when requested, when there is no wallet", () => {
    expect(resolveWalletEntryState({ wallet: null, pinSet: null, unlocked: false, enrollmentOpen: false })).toBe(
      "create_prompt",
    );
    expect(resolveWalletEntryState({ wallet: null, pinSet: null, unlocked: false, enrollmentOpen: true })).toBe(
      "enrollment",
    );
  });

  it("lets the wizard complete an incomplete pending_setup wallet with no PIN", () => {
    expect(
      resolveWalletEntryState({
        wallet: { status: "pending_setup" },
        pinSet: false,
        unlocked: false,
        enrollmentOpen: false,
      }),
    ).toBe("enrollment");
  });

  it("requires the PIN before the dashboard for a wallet with a PIN", () => {
    expect(resolveWalletEntryState({ wallet: { status: "active" }, pinSet: true, unlocked: false, enrollmentOpen: false })).toBe(
      "unlock",
    );
    expect(resolveWalletEntryState({ wallet: { status: "active" }, pinSet: true, unlocked: true, enrollmentOpen: false })).toBe(
      "overview",
    );
  });

  it("keeps the PIN screen when the PIN status cannot be confirmed", () => {
    expect(resolveWalletEntryState({ wallet: { status: "active" }, pinSet: null, unlocked: false, enrollmentOpen: false })).toBe(
      "unlock",
    );
  });
});

describe("wallet function error messages", () => {
  it("prefers the safe JSON error returned by the function", async () => {
    const error = {
      message: "Edge Function returned a non-2xx status code",
      context: { json: async () => ({ error: "Wallet PIN is already set." }) },
    };
    await expect(readWalletFunctionError(error, "fallback")).resolves.toBe("Wallet PIN is already set.");
  });

  it("uses the client message when it is meaningful and the fallback otherwise", async () => {
    await expect(readWalletFunctionError(new Error("Session expired"), "fallback")).resolves.toBe("Session expired");
    await expect(
      readWalletFunctionError({ message: "Edge Function returned a non-2xx status code" }, "fallback"),
    ).resolves.toBe("fallback");
  });
});

describe("wallet registration regression guard", () => {
  it("does not call the old register_my_wallet RPC from the wallet pages or wizard", () => {
    const files = [
      "src/routes/account.wallet.tsx",
      "src/routes/account.wallet.settings.tsx",
      "src/components/wallet/WalletEnrollmentWizard.tsx",
    ];
    for (const file of files) {
      expect(readFileSync(file, "utf8")).not.toContain("register_my_wallet");
    }
  });

  it("creates wallets only through the wallet-enrollment function", () => {
    const wizard = readFileSync("src/components/wallet/WalletEnrollmentWizard.tsx", "utf8");
    expect(wizard).toContain('functions.invoke("wallet-enrollment"');
  });
});
