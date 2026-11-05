/**
 * Wallet enrolment helpers. The wallet-enrollment Edge Function is the only place that creates
 * the wallet, PIN credentials and recovery records. These helpers only validate input, build the
 * request body and decide which wallet screen to show.
 */

// Same options and order as the Wallet Settings recovery form.
export const WALLET_RECOVERY_QUESTIONS: readonly string[] = [
  "What was the name of your first school?",
  "What city were you born in?",
  "What was your childhood nickname?",
];

export const WALLET_ENROLLMENT_FALLBACK_ERROR =
  "We couldn't create your wallet. Please check your details and try again.";

export interface WalletEnrollmentInput {
  pin: string;
  confirmPin: string;
  questionOne: string;
  questionTwo: string;
  answerOne: string;
  answerTwo: string;
}

export interface WalletEnrollmentPayload {
  pin: string;
  confirmPin: string;
  questionOne: string;
  questionTwo: string;
  answerOne: string;
  answerTwo: string;
}

export function validateWalletPinEntry(pin: string, confirmPin: string): string | null {
  if (!/^\d{6}$/.test(pin)) return "Your wallet PIN must contain exactly six digits.";
  if (pin !== confirmPin) return "The PIN entries do not match. Please try again.";
  return null;
}

export function validateWalletRecovery(input: {
  questionOne: string;
  questionTwo: string;
  answerOne: string;
  answerTwo: string;
}): string | null {
  if (
    !WALLET_RECOVERY_QUESTIONS.includes(input.questionOne) ||
    !WALLET_RECOVERY_QUESTIONS.includes(input.questionTwo)
  ) {
    return "Choose both recovery questions from the list.";
  }
  if (input.questionOne === input.questionTwo) {
    return "Choose two different recovery questions.";
  }
  if (input.answerOne.trim().length < 2 || input.answerTwo.trim().length < 2) {
    return "Both recovery answers must contain at least two characters.";
  }
  return null;
}

export function buildWalletEnrollmentPayload(input: WalletEnrollmentInput): WalletEnrollmentPayload {
  return {
    pin: input.pin,
    confirmPin: input.confirmPin,
    questionOne: input.questionOne,
    questionTwo: input.questionTwo,
    answerOne: input.answerOne.trim(),
    answerTwo: input.answerTwo.trim(),
  };
}

export type WalletEntryState = "create_prompt" | "enrollment" | "unlock" | "overview";

/**
 * Decides what the Wallet page shows:
 * - no wallet: a Create Wallet prompt, then the enrolment wizard once requested;
 * - an incomplete pending_setup wallet with no PIN: the wizard, which completes it;
 * - a wallet with a PIN (or an unknown PIN status) that is not unlocked: the PIN screen;
 * - otherwise: the wallet overview.
 */
export function resolveWalletEntryState(input: {
  wallet: { status: string } | null;
  pinSet: boolean | null;
  unlocked: boolean;
  enrollmentOpen: boolean;
}): WalletEntryState {
  if (!input.wallet) return input.enrollmentOpen ? "enrollment" : "create_prompt";
  if (input.wallet.status === "pending_setup" && input.pinSet === false) return "enrollment";
  if (input.pinSet !== false && !input.unlocked) return "unlock";
  return "overview";
}

/**
 * Reads the safe error body returned by a Supabase Edge Function. The client error only says
 * "non-2xx", so the JSON `error` field is preferred when the response contains one.
 */
export async function readWalletFunctionError(error: unknown, fallback: string): Promise<string> {
  const context = (error as { context?: unknown } | null)?.context;
  if (context && typeof (context as Response).json === "function") {
    try {
      const body = (await (context as Response).json()) as { error?: unknown } | null;
      if (typeof body?.error === "string" && body.error.trim()) return body.error;
    } catch {
      // Response was not JSON; fall through to the client message.
    }
  }
  const message = (error as { message?: unknown } | null)?.message;
  if (typeof message === "string" && message.trim() && !/non-2xx/i.test(message)) {
    return message;
  }
  return fallback;
}
