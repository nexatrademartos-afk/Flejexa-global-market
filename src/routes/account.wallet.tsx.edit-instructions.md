# Apply the wallet page cleanup

Open `src/routes/account.wallet.tsx` and make these exact edits.

## 1. Imports
- Remove `TrendingUp` from the `lucide-react` import list.
- Remove `import { PlannedBadge } from "@/components/states";`

## 2. Navigation status metadata
In `navigationItems`, add a `status` property to every item:
- Transaction history: `status: "Not activated"`
- Purchases & payments: `status: "Not activated"`
- Rewards & Q Points: `status: "Available"`
- Referrals & commissions: `status: "Activity shown"`
- Wallet transfers: `status: "Not activated"`
- Deposits & withdrawals: `status: "Not activated"`
- Refunds & reversals: `status: "Not activated"`
- Wallet settings & security: `status: "Partially available"`

Also update these two descriptions:
- Rewards & Q Points: `View your recorded approved and pending Q Points`
- Referrals & commissions: `Referral activity is recorded; cash commissions are not connected`

## 3. Remove duplicate summary cards
In the summary section immediately above `<WalletRewardsPanel />`, delete only the Q Points and Commissions `SummaryCard` blocks. Keep the Pending funds and Reserved funds cards unchanged. Keep `<WalletRewardsPanel />` in place.

## 4. Replace the navigation badge
Inside `navigationItems.map`, replace:
`<PlannedBadge label="Not activated" />`

with:
```tsx
<span
  className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${
    item.status === "Available"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : item.status === "Partially available" ||
          item.status === "Activity shown"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
        : "border-border bg-muted text-muted-foreground"
  }`}
>
  {item.status ?? "Not activated"}
</span>
```

The complete replacement for `src/components/wallet/WalletRewardsPanel.tsx` is included in this ZIP. Replace that file with the supplied copy.
