import { BRAND } from "@/lib/brand";
import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AccountPage, accountHead } from "@/components/AccountPage";
import { supabase } from "@/integrations/supabase/client";
import { Gift, Loader2, TicketPercent, Wallet } from "lucide-react";
import { PlannedBadge } from "@/components/states";

type RewardPointRecord = {
  id: string;
  user_id: string;
  points: number;
  reason: string;
  status: string;
  order_id: string | null;
  created_at: string;
};

export const Route = createFileRoute("/account/rewards")({
  head: accountHead("Q Points & Rewards", "NEXA Rewards and loyalty program."),
  component: RewardsPage,
});

function RewardsPage() {
  const [loading, setLoading] = useState(true);
  const [pointsHistory, setPointsHistory] = useState<RewardPointRecord[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadRewardPoints() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          if (active) setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("reward_points")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        if (active && data) {
          const records = data as RewardPointRecord[];
          setPointsHistory(records);

          // Calculate active points balance from real records
          const sum = records
            .filter((r) => r.status === "active")
            .reduce((acc, r) => acc + (r.points || 0), 0);
          setTotalPoints(sum);
        }
      } catch {
        // Safe fallback - do not fabricate points
        if (active) {
          setPointsHistory([]);
          setTotalPoints(0);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadRewardPoints();

    return () => {
      active = false;
    };
  }, []);

  return (
    <AccountPage
      title="Q Points & Rewards"
      intro="Your loyalty reward points and marketplace benefits."
    >
      <div className="space-y-4">
        {/* Q Points Card */}
        <div className="rounded-2xl bg-ink p-6 text-ink-foreground">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-gold">
              NEXA Q Points Balance
            </p>
            <Gift className="h-5 w-5 text-gold" />
          </div>

          <div className="mt-3">
            {loading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-gold" />
                <span className="text-sm opacity-80">Loading balance...</span>
              </div>
            ) : (
              <p className="font-display text-4xl font-bold tracking-tight">
                {totalPoints} <span className="text-lg font-normal text-gold">Q Points</span>
              </p>
            )}
          </div>

          <p className="mt-2 text-xs text-ink-foreground/70 leading-relaxed">
            Points are awarded according to verified marketplace program rules. No synthetic or
            simulated balances are displayed.
          </p>
        </div>

        {/* Points History */}
        <div className="surface rounded-2xl border p-5">
          <h2 className="text-base font-bold">Points History</h2>

          {loading ? (
            <p className="mt-3 text-xs text-muted-foreground">Checking history...</p>
          ) : pointsHistory.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No points activity recorded for your account yet. Points earned on eligible purchases
              will appear here.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border text-sm">
              {pointsHistory.map((rec) => (
                <li key={rec.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="font-medium">{rec.reason}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(rec.created_at).toLocaleDateString()} · Status: {rec.status}
                    </p>
                  </div>
                  <span
                    className={`font-mono font-bold ${
                      rec.points >= 0 ? "text-emerald-500" : "text-destructive"
                    }`}
                  >
                    {rec.points > 0 ? `+${rec.points}` : rec.points}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Wallet Status */}
        <div className="surface flex items-start justify-between gap-3 rounded-2xl border p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-gold/40 bg-gold/10 text-gold">
              <Wallet className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-semibold">{BRAND.shortName} Wallet</h3>
              <p className="text-xs text-muted-foreground">
                In-app store balance and deposit account
              </p>
            </div>
          </div>
          <PlannedBadge label="Planned" />
        </div>

        {/* Coupons Status */}
        <div className="surface flex items-start justify-between gap-3 rounded-2xl border p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-gold/40 bg-gold/10 text-gold">
              <TicketPercent className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-semibold">Promotional Coupons</h3>
              <p className="text-xs text-muted-foreground">
                No active promotional coupons at this time
              </p>
            </div>
          </div>
          <PlannedBadge label="No active coupons" />
        </div>
      </div>
    </AccountPage>
  );
}
