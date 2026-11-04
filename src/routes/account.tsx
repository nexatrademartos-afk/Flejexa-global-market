import { useEffect, useState } from "react";
import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { LayoutGrid, Package, ShoppingCart, Truck, UserRound, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const ACCOUNT_NAV = [
  { to: "/account", label: "Overview" },
  { to: "/account/profile", label: "Profile" },
  { to: "/account/orders", label: "My Orders" },
  { to: "/account/addresses", label: "Delivery Addresses" },
  { to: "/account/cart", label: "My Cart" },
  { to: "/account/wishlist", label: "Shopping & Savings" },
  { to: "/account/rewards", label: "Q Points & Rewards" },
  { to: "/account/notifications", label: "Notifications & Offers" },
  { to: "/account/returns", label: "Help & Support" },
  { to: "/account/settings", label: "Security & Privacy" },
] as const;

export const Route = createFileRoute("/account")({
  component: AccountLayout,
});

function AccountLayout() {
  const navigate = useNavigate();
  const [checkingSession, setCheckingSession] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");

  useEffect(() => {
    let active = true;

    async function checkSession() {
      const { data, error } = await supabase.auth.getSession();

      if (!active) return;

      if (error || !data.session) {
        setSignedIn(false);
        setCheckingSession(false);
        void navigate({ to: "/sign-in", replace: true });
        return;
      }

      setSignedIn(true);
      setCheckingSession(false);
    }

    void checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;

      if (!session) {
        setSignedIn(false);
        void navigate({ to: "/sign-in", replace: true });
      } else {
        setSignedIn(true);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  async function handleSignOut() {
    if (signingOut) return;

    setSigningOut(true);
    setSignOutError("");

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        setSignOutError(error.message || "Failed to sign out. Please try again.");
        setSigningOut(false);
        return;
      }

      await navigate({ to: "/", replace: true });
    } catch {
      setSignOutError("An unexpected error occurred while signing out.");
      setSigningOut(false);
    }
  }

  if (checkingSession || !signedIn) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          {checkingSession ? "Checking your customer session..." : "Taking you to sign in..."}
        </p>
      </main>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 pb-24 md:grid md:grid-cols-[220px_minmax(0,1fr)] md:gap-8 md:py-6 md:pb-6">
      <aside className="mb-4 hidden md:block md:mb-0">
        <nav aria-label="Customer account navigation" className="flex flex-col gap-1">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Customer account
          </p>

          {ACCOUNT_NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: true }}
              activeProps={{
                className: "bg-secondary text-foreground font-semibold",
              }}
              className="flex min-h-11 items-center rounded-lg border border-transparent px-3 text-sm hover:border-gold/30 hover:bg-secondary"
            >
              {item.label}
            </Link>
          ))}

          <Link
            to="/account/applications"
            className="mt-3 flex min-h-11 items-center rounded-lg border border-gold/40 px-3 text-sm hover:bg-secondary"
          >
            Role Applications
          </Link>

          {signOutError && (
            <p role="alert" className="mt-2 text-xs text-red-500">
              {signOutError}
            </p>
          )}

          <button
            type="button"
            onClick={() => void handleSignOut()}
            disabled={signingOut}
            className="mt-1 flex min-h-11 items-center rounded-lg border px-3 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-60"
          >
            {signingOut ? "Signing out..." : "Sign out"}
          </button>
        </nav>
      </aside>

      <section className="min-w-0">
        <Outlet />
      </section>

      <nav
        aria-label="Customer quick navigation"
        className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-6 border-t border-gold/30 bg-background/95 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-5px_20px_rgba(0,0,0,0.3)] backdrop-blur md:hidden"
      >
        <QuickNavItem to="/shop" label="Shop" icon={ShoppingCart} />
        <QuickNavItem to="/account/orders" label="My Orders" icon={Package} />
        <QuickNavItem to="/account" label="Dashboard" icon={LayoutGrid} />
        <QuickNavItem to="/account/wallet" label="Wallet" icon={Wallet} />
        <QuickNavItem to="/account/orders" label="Delivery" icon={Truck} />
        <QuickNavItem to="/account/profile" label="Profile" icon={UserRound} />
      </nav>
    </div>
  );
}

function QuickNavItem({
  to,
  label,
  icon: Icon,
}: {
  to: "/shop" | "/account" | "/account/orders" | "/account/wallet" | "/account/profile";
  label: string;
  icon: typeof ShoppingCart;
}) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: true }}
      activeProps={{ className: "text-gold" }}
      className="flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 px-0.5 text-center text-[9px] leading-tight text-muted-foreground transition-colors hover:text-gold sm:text-[10px]"
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </Link>
  );
}
