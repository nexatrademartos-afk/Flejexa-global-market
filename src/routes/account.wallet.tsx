import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  ArrowDownToLine,
  ArrowUpFromLine,
  Banknote,
  Clock3,
  Gift,
  History,
  LockKeyhole,
  ReceiptText,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Users,
  Wallet,
  TrendingUp,
  CircleHelp,
  RefreshCw,
} from "lucide-react";
import { AccountPage, accountHead } from "@/components/AccountPage";
import { PlannedBadge } from "@/components/states";
import { BRAND } from "@/lib/brand";
import { supabase } from "@/integrations/supabase/client";
import { WalletRewardsPanel } from "@/components/wallet/WalletRewardsPanel";

type CustomerWallet = {
  id: string;
  wallet_number: string;
  currency: string;
  status: string;
  created_at: string;
};

type WalletBalanceData = {
  registered: boolean;
  wallet_id?: string;
  currency?: string;
  wallet_status?: string;
  has_ledger_records?: boolean;
  available_cents?: number;
  available_zar?: number;
  pending_cents?: number;
  pending_zar?: number;
  reserved_cents?: number;
  reserved_zar?: number;
  refreshed_at?: string;
};

type WalletTransactionItem = {
  id: string;
  amount_cents: number;
  amount_zar: number;
  entry_type: "credit" | "debit";
  category: "deposit" | "purchase" | "transfer" | "withdrawal" | "refund" | "adjustment";
  status: "pending" | "settled" | "reversed" | "failed";
  reference_id: string | null;
  description: string;
  created_at: string;
  metadata: Record<string, unknown>;
};

export const Route = createFileRoute("/account/wallet")({
  head: accountHead(
    `${BRAND.shortName} Wallet`,
    "Wallet overview, rewards, payments and transaction history.",
  ),
  component: WalletPage,
});

const navigationItems = [
  {
    label: "Transaction history",
    description: "Deposits, payments and adjustments",
    icon: History,
  },
  {
    label: "Purchases & payments",
    description: "Wallet payments linked to orders",
    icon: ShoppingBag,
  },
  {
    label: "Rewards & Q Points",
    description: "View rewards separately from cash",
    icon: Gift,
  },
  {
    label: "Referrals & commissions",
    description: "Pending and approved rewards",
    icon: Users,
  },
  {
    label: "Wallet transfers",
    description: "Designed now; activation requires approval",
    icon: ArrowLeftRight,
  },
  {
    label: "Deposits & withdrawals",
    description: "Deposit reconciliation and future payouts",
    icon: Banknote,
  },
  {
    label: "Refunds & reversals",
    description: "Refund and correction records",
    icon: ReceiptText,
  },
  {
    label: "Wallet settings & security",
    description: "PIN setup, recovery and security controls",
    icon: Settings,
  },
];

function WalletPage() {
  const [wallet, setWallet] = useState<CustomerWallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [pinIsSet, setPinIsSet] = useState<boolean | null>(null);
  const [pinStatusLoading, setPinStatusLoading] = useState(false);
  const [pin, setPin] = useState("");
  const [pinConfirmation, setPinConfirmation] = useState("");
  const [savingPin, setSavingPin] = useState(false);
  const [walletUnlocked, setWalletUnlocked] = useState(false);
  const [unlockPin, setUnlockPin] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  // Wallet PIN change
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmNewPin, setConfirmNewPin] = useState("");
  const [changingPin, setChangingPin] = useState(false);

  // Wallet PIN recovery
  const [recoverySet, setRecoverySet] = useState(false);
  const [recoveryQuestions, setRecoveryQuestions] = useState<string[]>([]);
  const [questionOne, setQuestionOne] = useState("");
  const [questionTwo, setQuestionTwo] = useState("");
  const [answerOne, setAnswerOne] = useState("");
  const [answerTwo, setAnswerTwo] = useState("");
  const [recoveryNewPin, setRecoveryNewPin] = useState("");
  const [recoveryMode, setRecoveryMode] = useState<"setup" | "recover" | null>(null);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [ledgerBalance, setLedgerBalance] = useState<WalletBalanceData | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [transactions, setTransactions] = useState<WalletTransactionItem[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);
  const [recoveryPin, setRecoveryPin] = useState("");

  const lockWallet = useCallback(() => {
    setWalletUnlocked(false);
    setLedgerBalance(null);
    setTransactions([]);
    setBalanceError(null);
    setTransactionsError(null);
    setUnlockPin("");
    setError("");
    setNotice("Wallet has been locked for security.");
  }, []);

  const loadLedgerBalance = useCallback(async () => {
    setBalanceLoading(true);
    setBalanceError(null);
    try {
      type RpcClient = {
        rpc: (
          fn: string,
          args?: Record<string, unknown>,
        ) => Promise<{ data: unknown; error: { message: string } | null }>;
      };
      const { data, error: rpcError } = await (supabase as unknown as RpcClient).rpc(
        "get_my_wallet_balance",
      );
      if (rpcError) {
        console.warn("get_my_wallet_balance RPC call failed:", rpcError);
        setBalanceError(rpcError.message || "Could not retrieve ledger balance.");
        setLedgerBalance(null);
      } else if (data && typeof data === "object") {
        const errorMsg = (data as Record<string, unknown>).error;
        if (typeof errorMsg === "string" && errorMsg) {
          setBalanceError(errorMsg);
          setLedgerBalance(null);
        } else {
          setLedgerBalance(data as WalletBalanceData);
          setBalanceError(null);
        }
      } else {
        setBalanceError("Invalid response from ledger service.");
        setLedgerBalance(null);
      }
    } catch (err) {
      console.error("Ledger balance error:", err);
      setBalanceError(err instanceof Error ? err.message : "Error contacting ledger.");
      setLedgerBalance(null);
    } finally {
      setBalanceLoading(false);
    }
  }, []);

  const loadTransactions = useCallback(async () => {
    setTransactionsLoading(true);
    setTransactionsError(null);
    try {
      type RpcClient = {
        rpc: (
          fn: string,
          args?: Record<string, unknown>,
        ) => Promise<{ data: unknown; error: { message: string } | null }>;
      };
      const { data, error: rpcError } = await (supabase as unknown as RpcClient).rpc(
        "get_my_wallet_transactions",
        {
          p_limit: 20,
          p_offset: 0,
        },
      );
      if (rpcError) {
        console.warn("get_my_wallet_transactions RPC call failed:", rpcError);
        setTransactionsError(rpcError.message || "Could not retrieve transaction history.");
        setTransactions([]);
      } else if (Array.isArray(data)) {
        setTransactions(data as WalletTransactionItem[]);
        setTransactionsError(null);
      } else {
        setTransactionsError("Invalid response from transaction ledger.");
        setTransactions([]);
      }
    } catch (err) {
      console.error("Transactions load error:", err);
      setTransactionsError(
        err instanceof Error ? err.message : "Error contacting transaction ledger.",
      );
      setTransactions([]);
    } finally {
      setTransactionsLoading(false);
    }
  }, []);

  const checkPinStatus = useCallback(async () => {
    setPinStatusLoading(true);
    try {
      const { data, error: pinError } = await supabase.functions.invoke("wallet-pin", {
        body: { action: "status" },
      });

      if (pinError) throw pinError;
      setPinIsSet(data?.pinSet === true);
    } catch (err) {
      console.error("Wallet PIN status check failed:", err);
      setPinIsSet(null);
    } finally {
      setPinStatusLoading(false);
    }
  }, []);

  const loadWallet = useCallback(async () => {
    setLoading(true);
    setError("");
    setNotice("");

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!authData.user) {
        setSignedIn(false);
        setWallet(null);
        setPinIsSet(null);
        return;
      }

      setSignedIn(true);

      const { data, error: walletError } = await supabase
        .from("wallets")
        .select("id, wallet_number, currency, status, created_at")
        .maybeSingle();

      if (walletError) throw walletError;

      setWallet(data);
      if (data) {
        await checkPinStatus();
      } else {
        setPinIsSet(null);
      }
    } catch (err) {
      console.error("Wallet loading failed:", err);
      setError("We couldn't load your wallet right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [checkPinStatus]);

  useEffect(() => {
    void loadWallet();
  }, [loadWallet]);

  async function registerWallet() {
    if (registering) return;

    setRegistering(true);
    setError("");
    setNotice("");

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!authData.user) {
        setSignedIn(false);
        setError("Please sign in before registering for a wallet.");
        return;
      }

      setSignedIn(true);

      const { error: registerError } = await supabase.rpc("register_my_wallet");

      if (registerError) throw registerError;

      const { data, error: walletError } = await supabase
        .from("wallets")
        .select("id, wallet_number, currency, status, created_at")
        .maybeSingle();

      if (walletError) throw walletError;

      if (!data) {
        throw new Error("Registration returned successfully, but the wallet could not be loaded.");
      }

      setWallet(data);
      await checkPinStatus();
      setNotice(
        "Your wallet has been registered successfully. Set up your six-digit PIN to secure your wallet.",
      );
    } catch (err) {
      console.error("Wallet registration failed:", err);
      setError(
        "We couldn't register your wallet. Please try again. If the problem continues, the database function or permissions may need checking.",
      );
    } finally {
      setRegistering(false);
    }
  }

  async function savePin() {
    setError("");
    setNotice("");

    if (!/^\d{6}$/.test(pin)) {
      setError("Your wallet PIN must contain exactly six digits.");
      return;
    }

    if (pin !== pinConfirmation) {
      setError("The PIN entries do not match. Please try again.");
      return;
    }

    setSavingPin(true);
    try {
      const { data, error: pinError } = await supabase.functions.invoke("wallet-pin", {
        body: { action: "set", pin },
      });

      if (pinError) throw pinError;
      if (data?.success !== true) {
        throw new Error(data?.error || "We couldn't save your wallet PIN.");
      }

      setPinIsSet(true);
      setWalletUnlocked(true);
      setPin("");
      setPinConfirmation("");
      setNotice("Your six-digit wallet PIN has been set securely.");
      void loadLedgerBalance();
      void loadTransactions();
    } catch (err) {
      console.error("Wallet PIN setup failed:", err);
      setError(
        err instanceof Error ? err.message : "We couldn't save your wallet PIN. Please try again.",
      );
    } finally {
      setSavingPin(false);
    }
  }

  async function unlockWallet() {
    setError("");

    if (!/^\d{6}$/.test(unlockPin)) {
      setError("Enter your six-digit wallet PIN.");
      return;
    }

    setUnlocking(true);

    try {
      const { data, error: verifyError } = await supabase.functions.invoke("wallet-pin", {
        body: {
          action: "verify",
          pin: unlockPin,
        },
      });

      if (verifyError) throw verifyError;

      if (data?.verified !== true) {
        throw new Error(data?.error || "We couldn't verify your wallet PIN.");
      }

      setUnlockPin("");
      setWalletUnlocked(true);
      setError("");
      void loadLedgerBalance();
      void loadTransactions();
    } catch (err) {
      console.error("Wallet PIN verification failed:", err);

      setError(err instanceof Error ? err.message : "PIN verification failed. Please try again.");

      setUnlockPin("");
    } finally {
      setUnlocking(false);
    }
  }
  async function changeWalletPin() {
    setError("");
    setNotice("");

    if (!/^\d{6}$/.test(currentPin)) {
      setError("Enter your current six-digit PIN.");
      return;
    }

    if (!/^\d{6}$/.test(newPin)) {
      setError("Your new PIN must contain exactly six digits.");
      return;
    }

    if (newPin !== confirmNewPin) {
      setError("Your new PIN entries do not match.");
      return;
    }

    if (currentPin === newPin) {
      setError("Your new PIN must be different from your current PIN.");
      return;
    }

    setChangingPin(true);

    try {
      const { data, error: pinError } = await supabase.functions.invoke("wallet-pin", {
        body: {
          action: "change",
          currentPin,
          newPin,
        },
      });

      if (pinError) throw pinError;

      if (data?.success !== true) {
        throw new Error(data?.error || "We couldn't change your wallet PIN.");
      }

      setCurrentPin("");
      setNewPin("");
      setConfirmNewPin("");
      setNotice("Your wallet PIN has been changed successfully.");
    } catch (err) {
      console.error("Wallet PIN change failed:", err);
      setError(
        err instanceof Error
          ? err.message
          : "We couldn't change your wallet PIN. Please try again.",
      );
    } finally {
      setChangingPin(false);
    }
  }

  async function loadRecoveryStatus() {
    const { data, error: recoveryError } = await supabase.functions.invoke("wallet-pin-recovery", {
      body: { action: "status" },
    });

    if (recoveryError) throw recoveryError;

    const configured = data?.recoverySet === true || data?.configured === true;

    setRecoverySet(configured);

    const questions = Array.isArray(data?.questions)
      ? data.questions.filter(
          (question: unknown): question is string => typeof question === "string",
        )
      : [];

    setRecoveryQuestions(questions);

    return configured;
  }

  async function beginPinRecovery() {
    setError("");
    setNotice("");
    setRecoveryMode(null);
    setRecoveryBusy(true);

    try {
      const configured = await loadRecoveryStatus();

      if (!configured) {
        setNotice(
          "PIN recovery has not been configured for this wallet. Please contact customer support to verify your identity and regain access.",
        );
        return;
      }

      setAnswerOne("");
      setAnswerTwo("");
      setRecoveryNewPin("");
      setRecoveryMode("recover");
    } catch (err) {
      console.error("Wallet PIN recovery status failed:", err);
      setError(
        "We couldn't check your recovery settings. Please try again or contact customer support.",
      );
    } finally {
      setRecoveryBusy(false);
    }
  }

  async function setupPinRecovery() {
    setError("");
    setNotice("");

    if (!questionOne.trim() || !questionTwo.trim()) {
      setError("Choose both recovery questions.");
      return;
    }

    if (questionOne === questionTwo) {
      setError("Choose two different recovery questions.");
      return;
    }

    if (answerOne.trim().length < 2 || answerTwo.trim().length < 2) {
      setError("Both recovery answers must contain at least two characters.");
      return;
    }

    if (recoverySet && !/^\d{6}$/.test(recoveryPin)) {
      setError("Enter your current six-digit wallet PIN to update recovery questions.");
      return;
    }

    setRecoveryBusy(true);

    try {
      const { data, error: recoveryError } = await supabase.functions.invoke(
        "wallet-pin-recovery",
        {
          body: {
            action: "setup",
            questionOne,
            questionTwo,
            answerOne: answerOne.trim(),
            answerTwo: answerTwo.trim(),
            pin: recoverySet ? recoveryPin : undefined,
          },
        },
      );

      if (recoveryError) throw recoveryError;

      if (data?.success !== true) {
        throw new Error(data?.error || "We couldn't save your recovery settings.");
      }

      setRecoverySet(true);
      setRecoveryQuestions([questionOne, questionTwo]);
      setAnswerOne("");
      setAnswerTwo("");
      setQuestionOne("");
      setQuestionTwo("");
      setRecoveryPin("");
      setRecoveryMode(null);
      setNotice("Your wallet PIN recovery settings have been saved.");
    } catch (err) {
      console.error("Wallet PIN recovery setup failed:", err);
      setError(
        err instanceof Error
          ? err.message
          : "We couldn't save your recovery settings. Please try again.",
      );
    } finally {
      setRecoveryBusy(false);
    }
  }

  async function recoverWalletPin() {
    setError("");
    setNotice("");

    if (answerOne.trim().length < 1 || answerTwo.trim().length < 1) {
      setError("Enter both recovery answers.");
      return;
    }

    if (!/^\d{6}$/.test(recoveryNewPin)) {
      setError("Your new PIN must contain exactly six digits.");
      return;
    }

    setRecoveryBusy(true);

    try {
      const { data, error: recoveryError } = await supabase.functions.invoke(
        "wallet-pin-recovery",
        {
          body: {
            action: "recover",
            answerOne: answerOne.trim(),
            answerTwo: answerTwo.trim(),
            newPin: recoveryNewPin,
          },
        },
      );

      if (recoveryError) throw recoveryError;

      if (data?.success !== true) {
        throw new Error(data?.error || "We couldn't recover your wallet PIN.");
      }

      setPinIsSet(true);
      setWalletUnlocked(true);
      setRecoveryMode(null);
      setUnlockPin("");
      setAnswerOne("");
      setAnswerTwo("");
      setRecoveryNewPin("");
      setError("");
      setNotice("Your wallet PIN has been reset successfully.");
      void loadLedgerBalance();
      void loadTransactions();
    } catch (err) {
      console.error("Wallet PIN recovery failed:", err);
      setError(
        err instanceof Error
          ? err.message
          : "PIN recovery failed. Check your answers and try again.",
      );
    } finally {
      setRecoveryBusy(false);
    }
  }

  const statusLabel = wallet ? wallet.status.replaceAll("_", " ") : "Not registered";

  if (loading) {
    return (
      <AccountPage title={`${BRAND.shortName} Wallet`} intro="Checking your wallet security.">
        <div className="rounded-2xl border p-6 text-sm text-muted-foreground">
          Checking your wallet and security status…
        </div>
      </AccountPage>
    );
  }

  if (wallet && pinIsSet !== false && !walletUnlocked) {
    return (
      <AccountPage
        title="Unlock Your Wallet"
        intro="Enter your six-digit wallet PIN to access your wallet."
      >
        <section className="mx-auto max-w-md rounded-3xl border border-gold/30 bg-card p-6 shadow-sm sm:p-8">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-gold/40 bg-gold/10 text-gold">
            <LockKeyhole className="h-7 w-7" />
          </div>

          <h2 className="mt-5 text-center text-xl font-bold">Wallet locked</h2>

          <p className="mt-2 text-center text-sm leading-relaxed text-muted-foreground">
            Your wallet details are protected. Verify your PIN before continuing.
          </p>

          {error && (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-destructive/40 p-3 text-sm text-destructive"
            >
              {error}
            </div>
          )}

          {pinIsSet === true ? (
            <form
              className="mt-5 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void unlockWallet();
              }}
            >
              <label className="block text-sm font-medium">
                Six-digit wallet PIN
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={unlockPin}
                  onChange={(event) =>
                    setUnlockPin(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  className="mt-2 min-h-12 w-full rounded-xl border bg-background px-4 text-center text-xl tracking-[0.5em]"
                  aria-label="Enter six-digit wallet PIN"
                  required
                  autoFocus
                />
              </label>

              <button
                type="submit"
                disabled={unlocking || unlockPin.length !== 6}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gold px-5 py-3 text-sm font-bold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <LockKeyhole className="h-4 w-4" />
                {unlocking ? "Verifying PIN…" : "Unlock wallet"}
              </button>
            </form>
          ) : (
            <div className="mt-5">
              <p className="text-sm text-muted-foreground">
                We couldn't confirm your PIN status. Your wallet remains locked until its security
                status can be checked.
              </p>

              <button
                type="button"
                onClick={() => void checkPinStatus()}
                disabled={pinStatusLoading}
                className="mt-4 min-h-11 w-full rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {pinStatusLoading ? "Checking…" : "Check security again"}
              </button>
            </div>
          )}

          <div className="mt-5 border-t pt-4">
            {recoveryMode === "recover" ? (
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void recoverWalletPin();
                }}
              >
                <h3 className="font-semibold">Recover your wallet PIN</h3>

                <p className="text-sm text-muted-foreground">
                  Answer both recovery questions to reset your PIN.
                </p>

                <label className="block text-sm font-medium">
                  {recoveryQuestions[0] || "First recovery answer"}
                  <input
                    type="password"
                    autoComplete="off"
                    value={answerOne}
                    onChange={(event) => setAnswerOne(event.target.value)}
                    className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3"
                    required
                  />
                </label>

                <label className="block text-sm font-medium">
                  {recoveryQuestions[1] || "Second recovery answer"}
                  <input
                    type="password"
                    autoComplete="off"
                    value={answerTwo}
                    onChange={(event) => setAnswerTwo(event.target.value)}
                    className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3"
                    required
                  />
                </label>

                <label className="block text-sm font-medium">
                  New six-digit PIN
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="new-password"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={recoveryNewPin}
                    onChange={(event) =>
                      setRecoveryNewPin(event.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3 text-center tracking-[0.4em]"
                    required
                  />
                </label>

                <button
                  type="submit"
                  disabled={recoveryBusy || recoveryNewPin.length !== 6}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-gold px-4 py-2 text-sm font-bold text-background disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {recoveryBusy ? "Recovering PIN…" : "Reset wallet PIN"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRecoveryMode(null);
                    setAnswerOne("");
                    setAnswerTwo("");
                    setRecoveryNewPin("");
                    setError("");
                  }}
                  className="w-full py-2 text-sm font-semibold underline"
                >
                  Cancel recovery
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => void beginPinRecovery()}
                disabled={recoveryBusy}
                className="min-h-11 w-full rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {recoveryBusy ? "Checking recovery…" : "Forgot your wallet PIN?"}
              </button>
            )}
          </div>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Never share your wallet PIN with anyone.
          </p>
        </section>
      </AccountPage>
    );
  }

  return (
    <AccountPage
      title={`${BRAND.shortName} Wallet`}
      intro="Your wallet overview, rewards and financial activity."
    >
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <Link
            to="/account"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-gold"
          >
            <ArrowLeftRight className="h-4 w-4 rotate-180" />
            Back to account
          </Link>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium capitalize text-muted-foreground">
              <ShieldCheck className="h-4 w-4" />
              {loading ? "Checking wallet" : statusLabel}
            </span>

            {wallet && pinIsSet === true && walletUnlocked && (
              <button
                type="button"
                onClick={lockWallet}
                className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 px-3 py-1 text-xs font-medium text-gold hover:bg-gold/10 transition-colors"
                title="Lock wallet session"
              >
                <LockKeyhole className="h-3.5 w-3.5" />
                Lock wallet
              </button>
            )}
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-destructive/40 p-3 text-sm text-destructive"
          >
            <p>{error}</p>
            <button
              type="button"
              onClick={() => void loadWallet()}
              className="mt-2 font-semibold underline"
            >
              Try again
            </button>
          </div>
        )}

        {notice && (
          <p role="status" className="rounded-xl border border-gold/40 p-3 text-sm">
            {notice}
          </p>
        )}

        <section className="overflow-hidden rounded-3xl border border-gold/30 bg-card p-5 shadow-sm sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Available wallet balance</p>
              {balanceLoading ? (
                <p className="mt-3 text-2xl font-bold tracking-tight text-muted-foreground sm:text-3xl">
                  Refreshing balance…
                </p>
              ) : balanceError ? (
                <div className="mt-2">
                  <p className="text-xl font-bold tracking-tight text-destructive sm:text-2xl">
                    Balance unavailable
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{balanceError}</p>
                  <button
                    type="button"
                    onClick={() => void loadLedgerBalance()}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-gold underline hover:opacity-80"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Retry balance check
                  </button>
                </div>
              ) : ledgerBalance ? (
                <div>
                  {ledgerBalance.has_ledger_records ? (
                    <div>
                      <p className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl text-gold">
                        R{" "}
                        {(ledgerBalance.available_zar ?? 0).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                        Authoritative cash balance derived strictly from committed settled ledger
                        entries.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl text-foreground">
                        No verified balance yet
                      </p>
                      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                        No transactions have been recorded in your wallet ledger yet. Your verified
                        balance will appear once initial transactions are committed and settled.
                      </p>
                    </div>
                  )}
                  {ledgerBalance.refreshed_at && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Refreshed {new Date(ledgerBalance.refreshed_at).toLocaleTimeString()}
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <p className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                    Not available yet
                  </p>
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                    Your cash balance will appear once the secure wallet ledger is verified. We will
                    not display a guessed or placeholder balance.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {wallet && (
                <button
                  type="button"
                  onClick={() => {
                    void loadLedgerBalance();
                    void loadTransactions();
                  }}
                  disabled={balanceLoading}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold/40 text-gold transition-opacity hover:opacity-80 disabled:opacity-50"
                  title="Refresh wallet balance and activity"
                  aria-label="Refresh wallet balance and activity"
                >
                  <RefreshCw className={`h-4 w-4 ${balanceLoading ? "animate-spin" : ""}`} />
                </button>
              )}
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-gold/40 bg-gold/10 text-gold">
                <Wallet className="h-6 w-6" />
              </span>
            </div>
          </div>

          {wallet && (
            <div className="mt-5 grid gap-3 rounded-2xl border p-4 sm:grid-cols-2">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Wallet number</p>
                <p className="mt-1 break-all font-mono text-sm font-semibold">
                  {wallet.wallet_number}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Currency</p>
                <p className="mt-1 text-sm font-semibold">{wallet.currency}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Wallet status</p>
                <p className="mt-1 text-sm font-semibold capitalize">
                  {wallet.status.replaceAll("_", " ")}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Registered</p>
                <p className="mt-1 text-sm font-semibold">
                  {new Date(wallet.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          )}

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <WalletAction icon={ArrowDownToLine} label="Add money" detail="Not activated" />
            <WalletAction icon={ArrowLeftRight} label="Transfer" detail="Not activated" />
            <WalletAction icon={ArrowUpFromLine} label="Withdraw" detail="Payouts disabled" />
          </div>

          <div className="mt-5 rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Wallet enrollment is connected separately from the cash ledger. Deposits, transfers
                and payouts remain disabled until their secure flows are approved.
              </p>
            </div>
          </div>
        </section>

        {wallet && (
          <section className="surface rounded-2xl border p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-gold/40 bg-gold/10 text-gold">
                <LockKeyhole className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-bold">Wallet PIN security</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Set a six-digit PIN for future wallet security. Transfers, deposits and
                  withdrawals remain disabled while their secure flows are being completed.
                </p>

                {pinStatusLoading ? (
                  <p className="mt-3 text-sm text-muted-foreground">Checking PIN status…</p>
                ) : pinIsSet === true ? (
                  <>
                    <p className="mt-3 inline-flex items-center gap-2 text-sm font-semibold">
                      <ShieldCheck className="h-4 w-4 text-gold" />
                      Wallet PIN is set
                    </p>

                    <div className="mt-4 space-y-4 rounded-xl border p-4">
                      <h3 className="font-semibold">Change wallet PIN</h3>

                      <form
                        className="space-y-3"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void changeWalletPin();
                        }}
                      >
                        <label className="block text-sm font-medium">
                          Current six-digit PIN
                          <input
                            type="password"
                            inputMode="numeric"
                            autoComplete="current-password"
                            pattern="[0-9]{6}"
                            maxLength={6}
                            value={currentPin}
                            onChange={(event) =>
                              setCurrentPin(event.target.value.replace(/\D/g, "").slice(0, 6))
                            }
                            className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3"
                            required
                          />
                        </label>

                        <label className="block text-sm font-medium">
                          New six-digit PIN
                          <input
                            type="password"
                            inputMode="numeric"
                            autoComplete="new-password"
                            pattern="[0-9]{6}"
                            maxLength={6}
                            value={newPin}
                            onChange={(event) =>
                              setNewPin(event.target.value.replace(/\D/g, "").slice(0, 6))
                            }
                            className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3"
                            required
                          />
                        </label>

                        <label className="block text-sm font-medium">
                          Confirm new PIN
                          <input
                            type="password"
                            inputMode="numeric"
                            autoComplete="new-password"
                            pattern="[0-9]{6}"
                            maxLength={6}
                            value={confirmNewPin}
                            onChange={(event) =>
                              setConfirmNewPin(event.target.value.replace(/\D/g, "").slice(0, 6))
                            }
                            className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3"
                            required
                          />
                        </label>

                        <button
                          type="submit"
                          disabled={
                            changingPin ||
                            currentPin.length !== 6 ||
                            newPin.length !== 6 ||
                            confirmNewPin.length !== 6
                          }
                          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gold px-4 py-2 text-sm font-bold text-background disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <LockKeyhole className="h-4 w-4" />
                          {changingPin ? "Changing PIN…" : "Change wallet PIN"}
                        </button>
                      </form>
                    </div>

                    <div className="mt-4 space-y-3 rounded-xl border p-4">
                      <h3 className="font-semibold">PIN recovery settings</h3>

                      <p className="text-sm text-muted-foreground">
                        Set two recovery questions while your wallet is unlocked. Keep your answers
                        private and memorable.
                      </p>

                      {recoverySet && recoveryMode !== "setup" ? (
                        <div>
                          <p className="text-sm font-medium">
                            <ShieldCheck className="mr-2 inline h-4 w-4 text-gold" />
                            Recovery settings are configured
                          </p>

                          <button
                            type="button"
                            onClick={() => {
                              setError("");
                              setNotice("");
                              setAnswerOne("");
                              setAnswerTwo("");
                              setQuestionOne("");
                              setQuestionTwo("");
                              setRecoveryMode("setup");
                            }}
                            className="mt-3 min-h-10 rounded-xl border px-4 py-2 text-sm font-semibold"
                          >
                            Update recovery questions
                          </button>
                        </div>
                      ) : recoveryMode === "setup" ? (
                        <form
                          className="space-y-3"
                          onSubmit={(event) => {
                            event.preventDefault();
                            void setupPinRecovery();
                          }}
                        >
                          <label className="block text-sm font-medium">
                            First recovery question
                            <select
                              value={questionOne}
                              onChange={(event) => setQuestionOne(event.target.value)}
                              className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3"
                              required
                            >
                              <option value="">Choose a question</option>
                              <option value="What was the name of your first school?">
                                What was the name of your first school?
                              </option>
                              <option value="What city were you born in?">
                                What city were you born in?
                              </option>
                              <option value="What was your childhood nickname?">
                                What was your childhood nickname?
                              </option>
                            </select>
                          </label>

                          <label className="block text-sm font-medium">
                            First answer
                            <input
                              type="password"
                              autoComplete="off"
                              value={answerOne}
                              onChange={(event) => setAnswerOne(event.target.value)}
                              className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3"
                              required
                            />
                          </label>

                          <label className="block text-sm font-medium">
                            Second recovery question
                            <select
                              value={questionTwo}
                              onChange={(event) => setQuestionTwo(event.target.value)}
                              className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3"
                              required
                            >
                              <option value="">Choose a different question</option>
                              <option value="What was the name of your first school?">
                                What was the name of your first school?
                              </option>
                              <option value="What city were you born in?">
                                What city were you born in?
                              </option>
                              <option value="What was your childhood nickname?">
                                What was your childhood nickname?
                              </option>
                            </select>
                          </label>

                          <label className="block text-sm font-medium">
                            Second answer
                            <input
                              type="password"
                              autoComplete="off"
                              value={answerTwo}
                              onChange={(event) => setAnswerTwo(event.target.value)}
                              className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3"
                              required
                            />
                          </label>

                          <button
                            type="submit"
                            disabled={recoveryBusy}
                            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-gold px-4 py-2 text-sm font-bold text-background disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {recoveryBusy ? "Saving recovery settings…" : "Save recovery settings"}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setRecoveryMode(null);
                              setQuestionOne("");
                              setQuestionTwo("");
                              setAnswerOne("");
                              setAnswerTwo("");
                              setError("");
                            }}
                            className="w-full py-2 text-sm font-semibold underline"
                          >
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <button
                          type="button"
                          onClick={async () => {
                            setError("");
                            setNotice("");
                            setRecoveryBusy(true);

                            try {
                              const configured = await loadRecoveryStatus();

                              if (configured) {
                                setNotice("Your wallet recovery settings are already configured.");
                              } else {
                                setQuestionOne("");
                                setQuestionTwo("");
                                setAnswerOne("");
                                setAnswerTwo("");
                                setRecoveryMode("setup");
                              }
                            } catch (err) {
                              console.error("Recovery settings check failed:", err);
                              setError(
                                "We couldn't check your recovery settings. Please try again.",
                              );
                            } finally {
                              setRecoveryBusy(false);
                            }
                          }}
                          disabled={recoveryBusy}
                          className="min-h-11 w-full rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-50"
                        >
                          {recoveryBusy ? "Checking recovery…" : "Set up PIN recovery"}
                        </button>
                      )}
                    </div>
                  </>
                ) : pinIsSet === false ? (
                  <div className="mt-4 space-y-3">
                    <label className="block text-sm font-medium">
                      Create six-digit PIN
                      <input
                        type="password"
                        inputMode="numeric"
                        autoComplete="new-password"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        value={pin}
                        onChange={(event) =>
                          setPin(event.target.value.replace(/\D/g, "").slice(0, 6))
                        }
                        className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3"
                        aria-label="Create six-digit wallet PIN"
                      />
                    </label>
                    <label className="block text-sm font-medium">
                      Confirm six-digit PIN
                      <input
                        type="password"
                        inputMode="numeric"
                        autoComplete="new-password"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        value={pinConfirmation}
                        onChange={(event) =>
                          setPinConfirmation(event.target.value.replace(/\D/g, "").slice(0, 6))
                        }
                        className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3"
                        aria-label="Confirm six-digit wallet PIN"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => void savePin()}
                      disabled={savingPin || pin.length !== 6 || pinConfirmation.length !== 6}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <LockKeyhole className="h-4 w-4" />
                      {savingPin ? "Saving PIN…" : "Set wallet PIN"}
                    </button>
                  </div>
                ) : (
                  <div className="mt-3">
                    <p className="text-sm text-muted-foreground">
                      PIN status could not be checked. The PIN service may not be deployed or
                      configured yet.
                    </p>
                    <button
                      type="button"
                      onClick={() => void checkPinStatus()}
                      className="mt-2 text-sm font-semibold underline"
                    >
                      Check again
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SummaryCard
            icon={Gift}
            title="Q Points"
            value="Not connected"
            detail="Rewards remain separate from cash."
          />
          <SummaryCard
            icon={TrendingUp}
            title="Commissions"
            value="Not connected"
            detail="Pending and approved amounts will be distinguished."
          />
          <SummaryCard
            icon={Clock3}
            title="Pending funds"
            value={
              balanceLoading
                ? "Checking…"
                : balanceError
                  ? "Unavailable"
                  : ledgerBalance?.pending_zar !== undefined
                    ? `R ${ledgerBalance.pending_zar.toFixed(2)}`
                    : "Not connected"
            }
            detail="Pending deposits and refunds are not spendable cash."
          />
          <SummaryCard
            icon={LockKeyhole}
            title="Reserved funds"
            value={
              balanceLoading
                ? "Checking…"
                : balanceError
                  ? "Unavailable"
                  : ledgerBalance?.reserved_zar !== undefined
                    ? `R ${ledgerBalance.reserved_zar.toFixed(2)}`
                    : "Not connected"
            }
            detail="Funds held for authorized operations."
          />
        </section>
        <WalletRewardsPanel />

        {wallet && (
          <section className="surface rounded-2xl border p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-bold">Recent activity</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Committed ledger entries and transaction history.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void loadTransactions()}
                  disabled={transactionsLoading}
                  className="grid h-8 w-8 place-items-center rounded-lg border text-muted-foreground hover:text-gold transition-colors disabled:opacity-50"
                  title="Refresh activity"
                  aria-label="Refresh activity"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${transactionsLoading ? "animate-spin" : ""}`}
                  />
                </button>
                <History className="h-5 w-5 text-gold" />
              </div>
            </div>

            {transactionsLoading ? (
              <p className="mt-4 text-sm text-muted-foreground">Loading activity…</p>
            ) : transactionsError ? (
              <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4">
                <p className="text-sm font-semibold text-destructive">Unable to load activity</p>
                <p className="text-xs text-muted-foreground mt-1">{transactionsError}</p>
                <button
                  type="button"
                  onClick={() => void loadTransactions()}
                  className="mt-2 text-xs font-semibold text-gold underline"
                >
                  Retry loading transactions
                </button>
              </div>
            ) : transactions.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed p-6 text-center">
                <Clock3 className="mx-auto h-8 w-8 text-muted-foreground/60" />
                <p className="mt-2 text-sm font-semibold">No transactions recorded yet</p>
                <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                  When deposits, purchases, or refunds are committed, they will appear here with an
                  immutable reference and audit trail.
                </p>
              </div>
            ) : (
              <div className="mt-4 divide-y">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between py-3">
                    <div className="min-w-0 pr-3">
                      <p className="text-sm font-semibold capitalize truncate">
                        {tx.description || tx.category}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(tx.created_at).toLocaleString()} • Ref:{" "}
                        {tx.reference_id || tx.id.slice(0, 8)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        className={`text-sm font-bold ${tx.entry_type === "credit" ? "text-emerald-500" : "text-foreground"}`}
                      >
                        {tx.entry_type === "credit" ? "+" : "-"} R {tx.amount_zar.toFixed(2)}
                      </p>
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${
                          tx.status === "settled"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : tx.status === "pending"
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : tx.status === "reversed"
                                ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                                : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {tx.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="surface rounded-2xl border p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-gold/40 bg-gold/10 text-gold">
              <ShieldCheck className="h-5 w-5" />
            </span>

            <div className="min-w-0 flex-1">
              <h2 className="font-bold">
                {wallet ? "Your wallet is registered" : "Register for your wallet"}
              </h2>

              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {wallet
                  ? "Your wallet is linked to your signed-in customer account."
                  : "Wallet enrollment is optional and linked securely to your signed-in customer account. Your website account does not automatically create a wallet."}
              </p>

              {!wallet && (
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <li>• South African rand (ZAR) for the first release</li>
                  <li>• Unique wallet account number</li>
                  <li>• Secure six-digit PIN setup will be a separate step</li>
                  <li>• Verification as required before restricted features activate</li>
                </ul>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-3">
                {loading ? (
                  <span className="text-sm text-muted-foreground">Checking your account…</span>
                ) : wallet ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 px-3 py-1.5 text-sm font-medium capitalize">
                    <ShieldCheck className="h-4 w-4 text-gold" />
                    {wallet.status.replaceAll("_", " ")}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void registerWallet()}
                    disabled={registering || !signedIn}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Wallet className="h-4 w-4" />
                    {registering ? "Registering wallet…" : "Register for my wallet"}
                  </button>
                )}

                {!loading && !signedIn && (
                  <p className="text-xs text-muted-foreground">Sign in to register for a wallet.</p>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="surface rounded-2xl border p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-bold">Wallet navigation</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Wallet services and account records.
              </p>
            </div>
            <Wallet className="h-5 w-5 text-gold" />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-x-5 sm:grid-cols-2">
            {navigationItems.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.label}
                  className="flex min-w-0 items-start gap-3 border-b py-4 last:border-b-0 sm:[&:nth-last-child(2)]:border-b-0"
                >
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{item.label}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {item.description}
                    </p>
                    <span className="mt-2 inline-block">
                      <PlannedBadge label="Not activated" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="surface rounded-2xl border p-5">
          <div className="flex items-start gap-3">
            <CircleHelp className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
            <div>
              <h2 className="font-semibold">Need help?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Contact support if wallet registration fails or you need help with your account.
              </p>
              <Link
                to="/account/returns"
                className="mt-3 inline-flex text-sm font-semibold text-gold hover:underline"
              >
                Open customer support
              </Link>
            </div>
          </div>
        </section>
      </div>
    </AccountPage>
  );
}

function WalletAction({
  icon: Icon,
  label,
  detail,
}: {
  icon: typeof Wallet;
  label: string;
  detail: string;
}) {
  return (
    <div
      aria-disabled="true"
      className="flex min-h-24 items-center gap-3 rounded-2xl border p-4 opacity-60"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold/30 text-gold">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="font-semibold">{label}</p>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  title,
  value,
  detail,
}: {
  icon: typeof Wallet;
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <section className="surface rounded-2xl border p-5">
      <Icon className="h-5 w-5 text-gold" />
      <h2 className="mt-4 text-sm text-muted-foreground">{title}</h2>
      <p className="mt-2 text-xl font-bold">{value}</p>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{detail}</p>
    </section>
  );
}
