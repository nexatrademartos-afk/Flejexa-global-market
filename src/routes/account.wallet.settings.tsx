import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, LockKeyhole, ShieldCheck, RefreshCw, Settings } from "lucide-react";
import { AccountPage, accountHead } from "@/components/AccountPage";
import { supabase } from "@/integrations/supabase/client";
import { BRAND } from "@/lib/brand";

type WalletRow = { id: string; wallet_number: string; status: string };

const QUESTION_OPTIONS = [
  "What was the name of your first school?",
  "What city were you born in?",
  "What was your childhood nickname?",
];

export const Route = createFileRoute("/account/wallet/settings")({
  head: accountHead(`${BRAND.shortName} Wallet Settings`, "Manage your wallet PIN and recovery security."),
  component: WalletSettingsPage,
});

function WalletSettingsPage() {
  const [wallet, setWallet] = useState<WalletRow | null>(null);
  const [pinSet, setPinSet] = useState<boolean | null>(null);
  const [recoverySet, setRecoverySet] = useState(false);
  const [questions, setQuestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmNewPin, setConfirmNewPin] = useState("");
  const [questionOne, setQuestionOne] = useState("");
  const [questionTwo, setQuestionTwo] = useState("");
  const [answerOne, setAnswerOne] = useState("");
  const [answerTwo, setAnswerTwo] = useState("");
  const [recoveryPin, setRecoveryPin] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!auth.user) throw new Error("Sign in to manage wallet security.");

        const { data: walletData, error: walletError } = await supabase
          .from("wallets")
          .select("id, wallet_number, status")
          .maybeSingle();
        if (walletError) throw walletError;
        if (!walletData) throw new Error("No wallet is registered to this account.");
        if (!active) return;
        setWallet(walletData);

        const { data: pinData, error: pinError } = await supabase.functions.invoke("wallet-pin", {
          body: { action: "status" },
        });
        if (pinError) throw pinError;
        if (!active) return;
        setPinSet(pinData?.pinSet === true);

        const { data: recoveryData, error: recoveryError } = await supabase.functions.invoke(
          "wallet-pin-recovery",
          { body: { action: "status" } },
        );
        if (recoveryError) throw recoveryError;
        if (!active) return;
        setRecoverySet(recoveryData?.configured === true || recoveryData?.recoverySet === true);
        setQuestions(Array.isArray(recoveryData?.questions) ? recoveryData.questions : []);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Could not load wallet security.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  async function setWalletPin() {
    setError(""); setNotice("");
    if (!/^\d{6}$/.test(pin) || pin !== confirmPin) {
      setError("Enter the same six-digit PIN in both fields."); return;
    }
    setBusy(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("wallet-pin", {
        body: { action: "set", pin },
      });
      if (fnError) throw fnError;
      if (data?.success !== true) throw new Error(data?.error || "Could not set wallet PIN.");
      setPinSet(true); setPin(""); setConfirmPin("");
      setNotice("Your wallet PIN has been set.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not set wallet PIN.");
    } finally { setBusy(false); }
  }

  async function changeWalletPin() {
    setError(""); setNotice("");
    if (!/^\d{6}$/.test(currentPin) || !/^\d{6}$/.test(newPin) || newPin !== confirmNewPin) {
      setError("Check your current PIN and make sure the new six-digit PIN entries match."); return;
    }
    if (currentPin === newPin) { setError("Your new PIN must be different."); return; }
    setBusy(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("wallet-pin", {
        body: { action: "change", currentPin, newPin },
      });
      if (fnError) throw fnError;
      if (data?.success !== true) throw new Error(data?.error || "Could not change wallet PIN.");
      setCurrentPin(""); setNewPin(""); setConfirmNewPin("");
      setNotice("Your wallet PIN has been changed.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not change wallet PIN.");
    } finally { setBusy(false); }
  }

  async function saveRecovery() {
    setError(""); setNotice("");
    if (!questionOne || !questionTwo || questionOne === questionTwo) {
      setError("Choose two different recovery questions."); return;
    }
    if (answerOne.trim().length < 2 || answerTwo.trim().length < 2) {
      setError("Both recovery answers must contain at least two characters."); return;
    }
    if (recoverySet && !/^\d{6}$/.test(recoveryPin)) {
      setError("Enter your current six-digit PIN to update recovery settings."); return;
    }
    setBusy(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("wallet-pin-recovery", {
        body: {
          action: "setup", questionOne, questionTwo,
          answerOne: answerOne.trim(), answerTwo: answerTwo.trim(),
          pin: recoverySet ? recoveryPin : undefined,
        },
      });
      if (fnError) throw fnError;
      if (data?.success !== true) throw new Error(data?.error || "Could not save recovery settings.");
      setRecoverySet(true); setQuestions([questionOne, questionTwo]);
      setQuestionOne(""); setQuestionTwo(""); setAnswerOne(""); setAnswerTwo(""); setRecoveryPin("");
      setNotice("Your wallet PIN recovery settings have been saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save recovery settings.");
    } finally { setBusy(false); }
  }

  const field = "mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-gold";

  return (
    <AccountPage title={`${BRAND.shortName} Wallet Settings`} intro="Manage your wallet PIN and recovery options in one secure place.">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/account/wallet" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-gold">
          <ArrowLeft className="h-4 w-4" /> Back to wallet
        </Link>
        {wallet && <span className="rounded-full border px-3 py-1 text-xs capitalize text-muted-foreground">{wallet.status.replaceAll("_", " ")}</span>}
      </div>

      {error && <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">{notice}</div>}

      {loading ? (
        <div className="rounded-2xl border p-6 text-sm text-muted-foreground">Loading wallet security…</div>
      ) : wallet ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border bg-card p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl border border-gold/30 bg-gold/10 text-gold"><LockKeyhole className="h-5 w-5" /></span>
              <div><h2 className="font-semibold">Wallet PIN</h2><p className="text-xs text-muted-foreground">Six-digit access security</p></div>
              <span className="ml-auto text-xs font-semibold">{pinSet ? "PIN set" : "Setup required"}</span>
            </div>
            {pinSet === false ? (
              <form className="mt-5 space-y-3" onSubmit={e => { e.preventDefault(); void setWalletPin(); }}>
                <label className="block text-sm font-medium">Create six-digit PIN<input className={field} type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g,"").slice(0,6))} required /></label>
                <label className="block text-sm font-medium">Confirm six-digit PIN<input className={field} type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g,"").slice(0,6))} required /></label>
                <button disabled={busy || pin.length !== 6 || confirmPin.length !== 6} className="min-h-11 w-full rounded-xl bg-gold px-4 py-2 text-sm font-bold text-background disabled:opacity-50">{busy ? "Saving…" : "Set wallet PIN"}</button>
              </form>
            ) : pinSet ? (
              <form className="mt-5 space-y-3" onSubmit={e => { e.preventDefault(); void changeWalletPin(); }}>
                <label className="block text-sm font-medium">Current six-digit PIN<input className={field} type="password" inputMode="numeric" autoComplete="current-password" maxLength={6} value={currentPin} onChange={e => setCurrentPin(e.target.value.replace(/\D/g,"").slice(0,6))} required /></label>
                <label className="block text-sm font-medium">New six-digit PIN<input className={field} type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g,"").slice(0,6))} required /></label>
                <label className="block text-sm font-medium">Confirm new PIN<input className={field} type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={confirmNewPin} onChange={e => setConfirmNewPin(e.target.value.replace(/\D/g,"").slice(0,6))} required /></label>
                <button disabled={busy || currentPin.length !== 6 || newPin.length !== 6 || confirmNewPin.length !== 6} className="min-h-11 w-full rounded-xl bg-gold px-4 py-2 text-sm font-bold text-background disabled:opacity-50">{busy ? "Updating…" : "Change wallet PIN"}</button>
              </form>
            ) : <p className="mt-4 text-sm text-muted-foreground">PIN status could not be verified. Refresh and try again.</p>}
            <p className="mt-4 text-xs text-muted-foreground">Never share your wallet PIN. Deposits, transfers and withdrawals remain unavailable until their separate secure flows are approved.</p>
          </section>

          <section className="rounded-2xl border bg-card p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl border border-gold/30 bg-gold/10 text-gold"><ShieldCheck className="h-5 w-5" /></span>
              <div><h2 className="font-semibold">PIN recovery</h2><p className="text-xs text-muted-foreground">Recovery questions and answers</p></div>
              <span className="ml-auto text-xs font-semibold">{recoverySet ? "Configured" : "Not configured"}</span>
            </div>
            {questions.length > 0 && recoverySet && <div className="mt-4 rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground"><p>Saved questions</p><p className="mt-2">{questions[0]}</p><p className="mt-1">{questions[1]}</p></div>}
            <form className="mt-5 space-y-3" onSubmit={e => { e.preventDefault(); void saveRecovery(); }}>
              <label className="block text-sm font-medium">First recovery question<select className={field} value={questionOne} onChange={e => setQuestionOne(e.target.value)} required><option value="">Choose a question</option>{QUESTION_OPTIONS.map(q => <option key={q} value={q}>{q}</option>)}</select></label>
              <label className="block text-sm font-medium">First answer<input className={field} type="password" autoComplete="off" value={answerOne} onChange={e => setAnswerOne(e.target.value)} required /></label>
              <label className="block text-sm font-medium">Second recovery question<select className={field} value={questionTwo} onChange={e => setQuestionTwo(e.target.value)} required><option value="">Choose a different question</option>{QUESTION_OPTIONS.map(q => <option key={q} value={q} disabled={q === questionOne}>{q}</option>)}</select></label>
              <label className="block text-sm font-medium">Second answer<input className={field} type="password" autoComplete="off" value={answerTwo} onChange={e => setAnswerTwo(e.target.value)} required /></label>
              {recoverySet && <label className="block text-sm font-medium">Current six-digit PIN<input className={field} type="password" inputMode="numeric" autoComplete="current-password" maxLength={6} value={recoveryPin} onChange={e => setRecoveryPin(e.target.value.replace(/\D/g,"").slice(0,6))} required /></label>}
              <button disabled={busy} className="min-h-11 w-full rounded-xl border border-gold/50 px-4 py-2 text-sm font-semibold hover:bg-gold/5 disabled:opacity-50">{busy ? "Saving…" : recoverySet ? "Update recovery settings" : "Set up PIN recovery"}</button>
            </form>
            <p className="mt-4 text-xs text-muted-foreground">Answers are sent to the secure recovery function and stored as salted hashes. Do not reuse passwords or share these answers.</p>
          </section>
        </div>
      ) : null}

      <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold"><Settings className="h-4 w-4" /> Financial controls remain locked</div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Changing your PIN or recovery settings does not activate deposits, transfers, withdrawals, payouts, or cash commissions.</p>
      </section>
    </AccountPage>
  );
}
