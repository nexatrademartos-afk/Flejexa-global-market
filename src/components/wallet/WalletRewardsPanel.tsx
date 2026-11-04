import { useEffect, useMemo, useState } from "react";
import { Gift, Users, Clock3, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type RewardPoint = {
  id: string;
  points: number;
  reason: string;
  status: string;
  created_at: string;
  order_id: string | null;
};

type ReferralRecord = {
  id: string;
  referrer_id: string;
  referred_id: string;
  code: string;
  status: string;
  reward_points: number;
  created_at: string;
};

function pointsLabel(value: number) {
  return `${value.toLocaleString()} ${value === 1 ? "point" : "points"}`;
}

export function WalletRewardsPanel() {
  const [rewards, setRewards] = useState<RewardPoint[]>([]);
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadRewardsAndReferrals() {
      setLoading(true);
      setError("");

      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!authData.user) throw new Error("Sign in to view your rewards.");

        const currentUserId = authData.user.id;
        const [rewardResult, referralResult] = await Promise.all([
          supabase
            .from("reward_points")
            .select("id, points, reason, status, created_at, order_id")
            .eq("user_id", currentUserId)
            .order("created_at", { ascending: false }),
          supabase
            .from("referrals")
            .select("id, referrer_id, referred_id, code, status, reward_points, created_at")
            .or(`referrer_id.eq.${currentUserId},referred_id.eq.${currentUserId}`)
            .order("created_at", { ascending: false }),
        ]);

        if (rewardResult.error) throw rewardResult.error;
        if (referralResult.error) throw referralResult.error;

        if (!mounted) return;
        setUserId(currentUserId);
        setRewards((rewardResult.data ?? []) as RewardPoint[]);
        setReferrals((referralResult.data ?? []) as ReferralRecord[]);
      } catch (err) {
        if (!mounted) return;
        setError(
          err instanceof Error
            ? err.message
            : "We couldn't load your rewards right now. Please try again.",
        );
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadRewardsAndReferrals();
    return () => {
      mounted = false;
    };
  }, []);

  const totals = useMemo(() => {
    return rewards.reduce(
      (result, reward) => {
        const points = Number(reward.points) || 0;
        if (reward.status === "approved") result.approved += points;
        else if (reward.status === "pending") result.pending += points;
        else result.other += points;
        return result;
      },
      { approved: 0, pending: 0, other: 0 },
    );
  }, [rewards]);

  const referralsMade = referrals.filter((referral) => referral.referrer_id === userId);
  const referralsReceived = referrals.filter((referral) => referral.referred_id === userId);

  return (
    <section className="surface rounded-2xl border p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold/30 bg-gold/10 text-gold">
          <Gift className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-bold">Rewards & Q Points</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your recorded reward points, kept separate from your cash wallet balance.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading your rewards…</p>
      ) : error ? (
        <div role="alert" className="mt-4 rounded-xl border border-destructive/30 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border p-4">
              <p className="text-xs text-muted-foreground">Approved Q Points</p>
              <p className="mt-2 text-xl font-bold text-gold">{pointsLabel(totals.approved)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Approved reward records only</p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="text-xs text-muted-foreground">Pending Q Points</p>
              <p className="mt-2 text-xl font-bold">{pointsLabel(totals.pending)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Not yet approved or spendable</p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="text-xs text-muted-foreground">Other statuses</p>
              <p className="mt-2 text-xl font-bold">{pointsLabel(totals.other)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Reversed or otherwise non-approved</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border p-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-gold" />
                <p className="text-sm font-semibold">Referral activity</p>
              </div>
              <p className="mt-2 text-sm">
                Referrals made: <strong>{referralsMade.length}</strong>
              </p>
              <p className="mt-1 text-sm">
                Referred by: <strong>{referralsReceived.length > 0 ? "Recorded" : "No record"}</strong>
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Referral points remain reward points; they are not cash commissions.
              </p>
            </div>
            <div className="rounded-xl border p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-gold" />
                <p className="text-sm font-semibold">Cash commissions</p>
              </div>
              <p className="mt-2 text-sm font-semibold">Not connected</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Referral and reward-point records exist, but there is no dedicated commission
                ledger or approved cash-commission calculation.
              </p>
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-gold" />
              <h3 className="text-sm font-semibold">Recent reward records</h3>
            </div>
            {rewards.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                No reward points have been recorded for your account yet.
              </p>
            ) : (
              <div className="mt-3 divide-y">
                {rewards.slice(0, 10).map((reward) => (
                  <div key={reward.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{reward.reason}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {reward.order_id ? `Order: ${reward.order_id} · ` : ""}
                        {new Date(reward.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold">{pointsLabel(reward.points)}</p>
                      <span className="text-xs capitalize text-muted-foreground">
                        {reward.status.replaceAll("_", " ")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
