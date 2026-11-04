-- Reconcile wallets whose six-digit PIN was already present before the
-- activate_wallet_after_pin_setup INSERT trigger was installed.
-- This only advances pending_setup wallets that already have a matching
-- owner + wallet PIN credential. It does not enable deposits, transfers,
-- withdrawals, payouts, or any ledger writes.

begin;

update public.wallets as wallet
   set status = 'active',
       updated_at = now()
 where wallet.status = 'pending_setup'
   and exists (
     select 1
       from public.wallet_pin_credentials as pin
      where pin.wallet_id = wallet.id
        and pin.user_id = wallet.user_id
   );

commit;

-- Verification (read-only):
-- select wallet.status, count(*)
--   from public.wallets as wallet
--  group by wallet.status
--  order by wallet.status;
