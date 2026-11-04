import { useEffect, useMemo, useState } from "react";
import { Gift, Users, Clock3, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type RewardPoint = { id: string; points: number; reason: string; status: string; created_at: string; order_id: string | null };
type ReferralRecord = { id: string; referrer_id: string; referred_id: string; code: string; status: string; reward_points: number; created_at: string };
const pointsLabel = (value: number) => `${value.toLocaleString()} ${value === 1 ? "point" : "points"}`;

export function WalletRewardsPanel() {
  const [rewards, setRewards] = useState<RewardPoint[]>([]);
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true); setError("");
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!auth.user) throw new Error("Sign in to view your rewards.");
        const id = auth.user.id;
        const [rewardResult, referralResult] = await Promise.all([
          supabase.from("reward_points").select("id, points, reason, status, created_at, order_id").eq("user_id", id).order("created_at", { ascending: false }),
          supabase.from("referrals").select("id, referrer_id, referred_id, code, status, reward_points, created_at").or(`referrer_id.eq.${id},referred_id.eq.${id}`).order("created_at", { ascending: false }),
        ]);
        if (rewardResult.error) throw rewardResult.error;
        if (referralResult.error) throw referralResult.error;
        if (!mounted) return;
        setUserId(id); setRewards((rewardResult.data ?? []) as RewardPoint[]); setReferrals((referralResult.data ?? []) as ReferralRecord[]);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : "We couldn't load your rewards.");
      } finally { if (mounted) setLoading(false); }
    }
    void load();
    return () => { mounted = false; };
  }, []);

  const totals = useMemo(() => rewards.reduce((a, r) => {
    const p = Number(r.points) || 0;
    if (r.status === "approved" || r.status === "active") a.approved += p;
    else if (r.status === "pending") a.pending += p;
    else a.other += p;
    return a;
  }, { approved: 0, pending: 0, other: 0 }), [rewards]);

  const made = referrals.filter(r => r.referrer_id === userId);
  const received = referrals.filter(r => r.referred_id === userId);

  return <section className="rounded-2xl border bg-card p-5 sm:p-6">
    <div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl border border-gold/30 bg-gold/10 text-gold"><Gift className="h-5 w-5" /></span><div><h2 className="font-bold">Rewards & Q Points</h2><p className="mt-1 text-sm text-muted-foreground">Your verified reward records, separate from cash.</p></div></div>
    {loading ? <p className="mt-4 text-sm text-muted-foreground">Loading rewards…</p> : error ? <p role="alert" className="mt-4 rounded-xl border border-destructive/30 p-3 text-sm text-destructive">{error}</p> : <>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Metric label="Approved Q Points" value={pointsLabel(totals.approved)} note="Approved/active records" />
        <Metric label="Pending Q Points" value={pointsLabel(totals.pending)} note="Not spendable yet" />
        <Metric label="Other statuses" value={pointsLabel(totals.other)} note="Reversed or non-approved" />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border p-4"><div className="flex items-center gap-2"><Users className="h-4 w-4 text-gold" /><h3 className="text-sm font-semibold">Referral activity</h3></div><p className="mt-2 text-sm">Referrals made: <strong>{made.length}</strong></p><p className="mt-1 text-sm">Referred by: <strong>{received.length ? "Recorded" : "No record"}</strong></p><p className="mt-2 text-xs text-muted-foreground">Referral points are not cash commissions.</p></div>
        <div className="rounded-xl border p-4"><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-gold" /><h3 className="text-sm font-semibold">Cash commissions</h3></div><p className="mt-2 text-sm font-semibold">Not connected</p><p className="mt-1 text-xs text-muted-foreground">A separate approved cash-commission ledger and calculation are not connected.</p></div>
      </div>
      <div className="mt-5"><div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-gold" /><h3 className="text-sm font-semibold">Recent reward records</h3></div>
        {rewards.length === 0 ? <p className="mt-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No reward activity recorded yet.</p> : <div className="mt-2 divide-y">{rewards.slice(0, 10).map(r => <div key={r.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{r.reason}</p><p className="mt-1 text-xs text-muted-foreground">{r.order_id ? `Order ${r.order_id.slice(0, 8)} · ` : ""}{new Date(r.created_at).toLocaleDateString()}</p></div><div className="shrink-0 text-right"><p className="text-sm font-bold">{pointsLabel(r.points)}</p><span className="text-xs capitalize text-muted-foreground">{r.status.replaceAll("_", " ")}</span></div></div>)}</div>}
      </div>
    </>}
  </section>;
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="rounded-xl border bg-background/50 p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-xl font-bold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{note}</p></div>;
}
