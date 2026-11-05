import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchVerifiedNexaIdForUser } from "@/lib/customer-identity";
import {
  WALLET_ENROLLMENT_FALLBACK_ERROR,
  WALLET_RECOVERY_QUESTIONS,
  buildWalletEnrollmentPayload,
  readWalletFunctionError,
  validateWalletPinEntry,
  validateWalletRecovery,
} from "@/lib/wallet-enrollment";

type Step = "account" | "pin" | "recovery" | "review" | "done";

const FORM_STEPS: { id: Exclude<Step, "done">; label: string }[] = [
  { id: "account", label: "Confirm account" },
  { id: "pin", label: "Create PIN" },
  { id: "recovery", label: "Recovery" },
  { id: "review", label: "Complete" },
];

interface LinkedAccount {
  userId: string;
  email: string;
  fullName: string;
  phone: string;
  nexaId: string | null;
}

interface EnrollmentResult {
  walletNumber: string;
  status: string;
  pinConfigured: boolean;
  recoveryConfigured: boolean;
}

const fieldClass =
  "mt-1.5 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-gold";
const primaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButton =
  "inline-flex min-h-11 items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition-colors hover:border-gold disabled:opacity-50";

/**
 * Secure wallet enrolment. Nothing is sent to the server until the last step. The PIN and recovery
 * answers are kept only in component state and cleared after a failed attempt.
 */
export function WalletEnrollmentWizard({
  onCompleted,
  onCancel,
}: {
  onCompleted: () => void;
  onCancel?: (() => void) | undefined;
}) {
  const [step, setStep] = useState<Step>("account");
  const [account, setAccount] = useState<LinkedAccount | null>(null);
  const [accountLoading, setAccountLoading] = useState(true);
  const [accountError, setAccountError] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [questionOne, setQuestionOne] = useState("");
  const [questionTwo, setQuestionTwo] = useState("");
  const [answerOne, setAnswerOne] = useState("");
  const [answerTwo, setAnswerTwo] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<EnrollmentResult | null>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    let active = true;

    async function loadAccount() {
      setAccountLoading(true);
      setAccountError("");
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        const user = auth.user;
        if (!user) throw new Error("Sign in to create your wallet.");

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("full_name, phone")
          .eq("id", user.id)
          .maybeSingle();
        if (profileError) throw profileError;

        const nexaId = await fetchVerifiedNexaIdForUser(user.id);
        if (!active) return;

        setAccount({
          userId: user.id,
          email: user.email ?? "",
          fullName: profile?.full_name?.trim() ?? "",
          phone: profile?.phone?.trim() ?? "",
          nexaId,
        });
      } catch (err) {
        if (active) {
          setAccountError(
            err instanceof Error && err.message
              ? err.message
              : "We couldn't load your account details. Please try again.",
          );
        }
      } finally {
        if (active) setAccountLoading(false);
      }
    }

    void loadAccount();
    return () => {
      active = false;
    };
  }, []);

  const profileIncomplete = Boolean(account && (!account.fullName || !account.phone));
  const stepIndex = FORM_STEPS.findIndex((item) => item.id === step);

  function goTo(next: Step) {
    setError("");
    setStep(next);
  }

  function continueFromPin() {
    const message = validateWalletPinEntry(pin, confirmPin);
    if (message) {
      setError(message);
      return;
    }
    goTo("recovery");
  }

  function continueFromRecovery() {
    const message = validateWalletRecovery({ questionOne, questionTwo, answerOne, answerTwo });
    if (message) {
      setError(message);
      return;
    }
    goTo("review");
  }

  async function confirmEnrollment(): Promise<EnrollmentResult> {
    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("id, wallet_number, status")
      .maybeSingle();
    if (walletError) throw walletError;
    if (!wallet) {
      throw new Error("Your wallet could not be found after setup. Refresh the page and try again.");
    }

    const { data: pinData, error: pinError } = await supabase.functions.invoke("wallet-pin", {
      body: { action: "status" },
    });
    if (pinError) throw pinError;

    const { data: recoveryData, error: recoveryError } = await supabase.functions.invoke(
      "wallet-pin-recovery",
      { body: { action: "status" } },
    );
    if (recoveryError) throw recoveryError;

    return {
      walletNumber: wallet.wallet_number,
      status: wallet.status,
      pinConfigured: pinData?.pinSet === true,
      recoveryConfigured:
        recoveryData?.configured === true || recoveryData?.recoverySet === true,
    };
  }

  async function createWallet() {
    if (submittingRef.current) return;

    const pinMessage = validateWalletPinEntry(pin, confirmPin);
    if (pinMessage) {
      setError(pinMessage);
      setStep("pin");
      return;
    }
    const recoveryMessage = validateWalletRecovery({ questionOne, questionTwo, answerOne, answerTwo });
    if (recoveryMessage) {
      setError(recoveryMessage);
      setStep("recovery");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setError("");

    try {
      const { data, error: functionError } = await supabase.functions.invoke("wallet-enrollment", {
        body: buildWalletEnrollmentPayload({
          pin,
          confirmPin,
          questionOne,
          questionTwo,
          answerOne,
          answerTwo,
        }),
      });
      if (functionError) throw functionError;
      if (data && typeof data === "object" && typeof (data as { error?: unknown }).error === "string") {
        throw new Error((data as { error: string }).error);
      }

      // Confirm the saved state from the existing backend checks before showing success.
      const confirmed = await confirmEnrollment();
      if (!confirmed.pinConfigured || !confirmed.recoveryConfigured) {
        throw new Error(
          "Your wallet request was received, but the PIN and recovery settings could not both be confirmed. Refresh the page before trying again.",
        );
      }

      setResult(confirmed);
      setPin("");
      setConfirmPin("");
      setAnswerOne("");
      setAnswerTwo("");
      setStep("done");
    } catch (err) {
      const message = await readWalletFunctionError(err, WALLET_ENROLLMENT_FALLBACK_ERROR);
      // Clear secrets after a failure; keep the non-secret question choices.
      setPin("");
      setConfirmPin("");
      setAnswerOne("");
      setAnswerTwo("");
      setError(message);
      setStep("pin");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      {step !== "done" && (
        <ol aria-label="Wallet setup steps" className="grid grid-cols-4 gap-2 text-center text-[11px] sm:text-xs">
          {FORM_STEPS.map((item, index) => (
            <li
              key={item.id}
              aria-current={index === stepIndex ? "step" : undefined}
              className={`rounded-full border px-2 py-1.5 font-semibold ${
                index <= stepIndex ? "border-gold/50 bg-gold/10 text-gold" : "text-muted-foreground"
              }`}
            >
              {index + 1}. {item.label}
            </li>
          ))}
        </ol>
      )}

      {error && (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <section className="surface rounded-2xl border p-5 sm:p-6">
        {step === "account" && (
          <AccountStep
            account={account}
            loading={accountLoading}
            loadError={accountError}
            profileIncomplete={profileIncomplete}
            onContinue={() => goTo("pin")}
            onCancel={onCancel}
          />
        )}

        {step === "pin" && (
          <form
            className="space-y-4"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              continueFromPin();
            }}
          >
            <div>
              <h2 className="text-lg font-bold">Step 2 · Create your wallet PIN</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose a six-digit PIN. You will enter it every time you open your wallet.
              </p>
            </div>
            <div>
              <label htmlFor="wallet-pin-new" className="block text-sm font-medium">
                Six-digit wallet PIN
              </label>
              <input
                id="wallet-pin-new"
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={6}
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
                className={fieldClass}
                required
              />
            </div>
            <div>
              <label htmlFor="wallet-pin-confirm" className="block text-sm font-medium">
                Confirm six-digit PIN
              </label>
              <input
                id="wallet-pin-confirm"
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={6}
                value={confirmPin}
                onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
                className={fieldClass}
                required
              />
            </div>
            <WizardNav onBack={() => goTo("account")} nextLabel="Continue" />
          </form>
        )}

        {step === "recovery" && (
          <form
            className="space-y-4"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              continueFromRecovery();
            }}
          >
            <div>
              <h2 className="text-lg font-bold">Step 3 · Set up PIN recovery</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose two different questions and answer both. Answers are sent only to the secure
                wallet function and are never shown again.
              </p>
            </div>
            <div>
              <label htmlFor="wallet-question-one" className="block text-sm font-medium">
                First recovery question
              </label>
              <select
                id="wallet-question-one"
                value={questionOne}
                onChange={(event) => setQuestionOne(event.target.value)}
                className={fieldClass}
                required
              >
                <option value="">Choose a question</option>
                {WALLET_RECOVERY_QUESTIONS.map((question) => (
                  <option key={question} value={question}>
                    {question}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="wallet-answer-one" className="block text-sm font-medium">
                First answer
              </label>
              <input
                id="wallet-answer-one"
                type="password"
                autoComplete="off"
                value={answerOne}
                onChange={(event) => setAnswerOne(event.target.value)}
                className={fieldClass}
                required
              />
            </div>
            <div>
              <label htmlFor="wallet-question-two" className="block text-sm font-medium">
                Second recovery question
              </label>
              <select
                id="wallet-question-two"
                value={questionTwo}
                onChange={(event) => setQuestionTwo(event.target.value)}
                className={fieldClass}
                required
              >
                <option value="">Choose a different question</option>
                {WALLET_RECOVERY_QUESTIONS.map((question) => (
                  <option key={question} value={question} disabled={question === questionOne}>
                    {question}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="wallet-answer-two" className="block text-sm font-medium">
                Second answer
              </label>
              <input
                id="wallet-answer-two"
                type="password"
                autoComplete="off"
                value={answerTwo}
                onChange={(event) => setAnswerTwo(event.target.value)}
                className={fieldClass}
                required
              />
            </div>
            <WizardNav onBack={() => goTo("pin")} nextLabel="Continue" />
          </form>
        )}

        {step === "review" && account && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold">Step 4 · Complete wallet setup</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Check the details below. Your PIN and recovery answers are hidden and will not be shown again.
              </p>
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <ReviewItem label="Account holder" value={account.fullName} />
              <ReviewItem label="Customer / NEXA ID" value={account.nexaId ?? "Not yet linked"} />
              <ReviewItem label="PIN" value="Six-digit PIN set (hidden)" />
              <ReviewItem label="Recovery questions" value={`${questionOne} · ${questionTwo}`} />
            </dl>
            <p className="text-xs leading-relaxed text-muted-foreground">
              No balance is shown during setup. Deposits, transfers and withdrawals stay inactive until their
              approved flows are connected.
            </p>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button type="button" onClick={() => goTo("recovery")} disabled={submitting} className={secondaryButton}>
                Back
              </button>
              <button
                type="button"
                onClick={() => void createWallet()}
                disabled={submitting}
                className={primaryButton}
                aria-busy={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Creating your wallet…
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" /> Create wallet
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {step === "done" && result && (
          <div className="space-y-5 text-center sm:text-left" role="status">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-600 sm:mx-0">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Wallet created</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Your wallet is set up with a PIN and recovery questions.
              </p>
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <ReviewItem label="Wallet number" value={result.walletNumber} mono />
              <ReviewItem label="Wallet status" value={result.status.replaceAll("_", " ")} />
              <ReviewItem label="Wallet PIN" value={result.pinConfigured ? "Configured" : "Not confirmed"} />
              <ReviewItem label="PIN recovery" value={result.recoveryConfigured ? "Configured" : "Not confirmed"} />
            </dl>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <LockKeyhole className="h-4 w-4 text-gold" /> For your security, enter your six-digit PIN to open your wallet.
            </p>
            <button type="button" onClick={onCompleted} className={primaryButton}>
              Continue to unlock wallet
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function AccountStep({
  account,
  loading,
  loadError,
  profileIncomplete,
  onContinue,
  onCancel,
}: {
  account: LinkedAccount | null;
  loading: boolean;
  loadError: string;
  profileIncomplete: boolean;
  onContinue: () => void;
  onCancel?: (() => void) | undefined;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">Step 1 · Confirm your linked account</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          These details come from your existing NEXA account. They are read-only here.
        </p>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading your account details…</p>}

      {!loading && loadError && (
        <p role="alert" className="text-sm text-destructive">
          {loadError}
        </p>
      )}

      {!loading && !loadError && account && (
        <>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <ReviewItem label="Full name" value={account.fullName || "Not set"} />
            <ReviewItem label="Registered email" value={account.email || "Not available"} />
            <ReviewItem label="Contact number" value={account.phone || "Not set"} />
            <ReviewItem label="Customer / NEXA ID" value={account.nexaId ?? "Not yet linked"} mono />
          </dl>

          {profileIncomplete && (
            <div role="alert" className="rounded-xl border border-gold/40 bg-gold/10 p-3 text-sm">
              Complete your profile before creating a wallet. Add your full name and contact number, then return here.{" "}
              <Link to="/account/profile" className="font-semibold text-gold underline">
                Open profile
              </Link>
            </div>
          )}
        </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        {onCancel ? (
          <button type="button" onClick={onCancel} className={secondaryButton}>
            Back to wallet
          </button>
        ) : (
          <span />
        )}
        <button type="button" onClick={onContinue} disabled={loading || !account || profileIncomplete} className={primaryButton}>
          Continue
        </button>
      </div>
    </div>
  );
}

function WizardNav({ onBack, nextLabel }: { onBack: () => void; nextLabel: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
      <button type="button" onClick={onBack} className={secondaryButton}>
        Back
      </button>
      <button type="submit" className={primaryButton}>
        {nextLabel}
      </button>
    </div>
  );
}

function ReviewItem({ label, value, mono = false }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="rounded-xl border bg-muted/30 p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`mt-1 break-words font-semibold ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
