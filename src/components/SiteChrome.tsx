
import { BRAND } from "@/lib/brand";

import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Heart,
  Home,
  ShoppingBag,
  User,
  ShieldCheck,
  Menu,
  MessageCircle,
  X,
  LogIn,
  UserPlus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { useLocalList } from "@/lib/local-list";

function useCustomerSession() {
  const [signedIn, setSignedIn] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkSession() {
      const { data, error } = await supabase.auth.getSession();

      if (!active) return;

      setSignedIn(!error && Boolean(data.session));
      setSessionReady(true);
    }

    void checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;

      setSignedIn(Boolean(session));
      setSessionReady(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return { signedIn, sessionReady };
}

function useCustomerSignOut() {
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    if (signingOut) return;

    setSigningOut(true);

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        setSigningOut(false);
        return;
      }

      await navigate({ to: "/", replace: true });
    } catch {
      setSigningOut(false);
    }
  }

  return { signOut, signingOut };
}

export function Logo() {
  return (
    <Link
      to="/"
      aria-label={`${BRAND.name} home`}
      className="flex min-w-0 flex-none items-center gap-2.5 transition-opacity hover:opacity-90 sm:gap-3"
    >
      <span className="grid h-[72px] w-[72px] shrink-0 place-items-center overflow-hidden rounded-xl border border-gold/50 bg-ink shadow-[0_0_20px_rgba(212,175,55,0.16)] sm:h-[88px] sm:w-[88px]">
        <img
          src={BRAND.logoPath}
          alt=""
          className="h-full w-full object-contain p-0.5"
          fetchPriority="high"
        />
      </span>

      <span className="flex min-w-0 flex-col justify-center leading-tight">
        <span className="font-display text-base font-extrabold tracking-wide text-gold sm:text-xl">
          FleJexa
        </span>

        <span className="font-display text-sm font-bold tracking-wide text-slate-200 sm:text-lg">
          Global Mart
        </span>

        <span className="mt-1 max-w-[170px] text-[9px] font-medium leading-tight text-slate-300 sm:max-w-none sm:text-[10px]">
          {BRAND.tagline}
        </span>

        <span className="mt-1 text-[9px] font-semibold tracking-wide text-slate-400 sm:text-[10px]">
          Powered by <span className="text-gold">{BRAND.poweredBy}</span>
        </span>
      </span>
    </Link>
  );
}

export function SiteHeader() {
  const cart = useLocalList("nexa-cart");
  const [menuOpen, setMenuOpen] = useState(false);
  const { signedIn, sessionReady } = useCustomerSession();
  const { signOut, signingOut } = useCustomerSignOut();

  useEffect(() => {
    setMenuOpen(false);
  }, []);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-gold/30 bg-background/95 backdrop-blur-md shadow-[0_2px_18px_rgba(212,175,55,0.08)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-3 py-3 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-6">
          <Logo />

          <nav
            aria-label="Main navigation"
            className="hidden items-center gap-5 text-sm lg:flex"
          >
            <Link
              to="/shop"
              activeProps={{ className: "font-semibold text-gold" }}
              className="text-muted-foreground transition-colors hover:text-gold"
            >
              Shop
            </Link>
            <Link
              to="/sell"
              activeProps={{ className: "font-semibold text-gold" }}
              className="text-muted-foreground transition-colors hover:text-gold"
            >
              Sell on {BRAND.shortName}
            </Link>
            <Link
              to="/account"
              activeProps={{ className: "font-semibold text-gold" }}
              className="text-muted-foreground transition-colors hover:text-gold"
            >
              Account
            </Link>
            <Link
              to="/about"
              activeProps={{ className: "font-semibold text-gold" }}
              className="text-muted-foreground transition-colors hover:text-gold"
            >
              About Us
            </Link>
            <Link
              to="/policies"
              activeProps={{ className: "font-semibold text-gold" }}
              className="text-muted-foreground transition-colors hover:text-gold"
            >
              Policy Centre
            </Link>
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            to="/wishlist"
            aria-label="Wishlist"
            title="Wishlist"
            className="hidden h-10 w-10 place-items-center rounded-full transition hover:bg-secondary sm:grid"
          >
            <Heart className="h-5 w-5" />
          </Link>

          <Link
            to="/cart"
            aria-label="Cart"
            title="Cart"
            className="relative grid h-10 w-10 place-items-center rounded-full transition hover:bg-secondary"
          >
            <ShoppingBag className="h-5 w-5" />
            {cart.ids.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-gold px-1 text-[10px] font-bold text-gold-foreground">
                {cart.ids.length}
              </span>
            )}
          </Link>

          <div className="hidden sm:block">
            <WorkspaceSwitcher />
          </div>

          <div className="hidden items-center gap-2 lg:flex">
            {sessionReady && signedIn ? (
              <>
                <Link to="/account" className="btn btn-outline">
                  <User className="h-4 w-4" />
                  My dashboard
                </Link>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  disabled={signingOut}
                  className="btn btn-gold disabled:opacity-60"
                >
                  {signingOut ? "Signing out..." : "Sign out"}
                </button>
              </>
            ) : (
              <>
                <Link to="/sign-in" className="btn btn-outline">
                  Sign in
                </Link>
                <Link to="/sign-up" className="btn btn-gold">
                  Create account
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((current) => !current)}
            aria-label={
              menuOpen ? "Close navigation menu" : "Open navigation menu"
            }
            aria-expanded={menuOpen}
            aria-controls="nexa-mobile-menu"
            className="grid h-10 w-10 place-items-center rounded-full border border-gold/30 transition hover:bg-secondary lg:hidden"
          >
            {menuOpen ? (
              <X className="h-5 w-5 text-gold" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div
          id="nexa-mobile-menu"
          className="max-h-[80vh] overflow-y-auto border-t border-gold/20 bg-background/98 px-4 py-4 shadow-xl backdrop-blur-xl lg:hidden"
        >
          <nav
            aria-label="Mobile menu"
            className="mx-auto grid max-w-6xl gap-1"
          >
            <Link
              to="/"
              onClick={closeMenu}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-secondary"
            >
              <Home className="h-4 w-4 text-gold" />
              Home
            </Link>
            <Link
              to="/shop"
              onClick={closeMenu}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-secondary"
            >
              <ShoppingBag className="h-4 w-4 text-gold" />
              Shop products
            </Link>
            <Link
              to="/sell"
              onClick={closeMenu}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-secondary"
            >
              Sell on {BRAND.shortName}
            </Link>
            <Link
              to="/wishlist"
              onClick={closeMenu}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-secondary"
            >
              <Heart className="h-4 w-4 text-gold" />
              Wishlist
            </Link>
            <Link
              to="/cart"
              onClick={closeMenu}
              className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-secondary"
            >
              <span className="flex items-center gap-3">
                <ShoppingBag className="h-4 w-4 text-gold" />
                Shopping cart
              </span>
              {cart.ids.length > 0 && (
                <span className="rounded-full bg-gold px-2 py-0.5 text-xs font-bold text-gold-foreground">
                  {cart.ids.length}
                </span>
              )}
            </Link>
            <Link
              to="/account"
              onClick={closeMenu}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-secondary"
            >
              <User className="h-4 w-4 text-gold" />
              Customer dashboard
            </Link>
            <Link
              to="/about"
              onClick={closeMenu}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-secondary"
            >
              About Us
            </Link>
            <Link
              to="/policies"
              onClick={closeMenu}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-secondary"
            >
              <ShieldCheck className="h-4 w-4 text-gold" />
              Policy Centre
            </Link>

            <div className="my-2 border-t border-gold/20" />

            {sessionReady && signedIn ? (
              <div className="space-y-2 pt-1">
                <Link
                  to="/account"
                  onClick={closeMenu}
                  className="btn btn-outline flex w-full items-center justify-center gap-2 py-3 font-semibold"
                >
                  <User className="h-4 w-4" />
                  My dashboard
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    closeMenu();
                    void signOut();
                  }}
                  disabled={signingOut}
                  className="btn btn-gold flex w-full items-center justify-center gap-2 py-3 font-bold disabled:opacity-60"
                >
                  {signingOut ? "Signing out..." : "Sign out"}
                </button>
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                <Link
                  to="/sign-in"
                  onClick={closeMenu}
                  className="btn btn-outline flex w-full items-center justify-center gap-2 py-3 font-semibold"
                >
                  <LogIn className="h-4 w-4" />
                  Sign in
                </Link>
                <Link
                  to="/sign-up"
                  onClick={closeMenu}
                  className="btn btn-gold flex w-full items-center justify-center gap-2 py-3 font-bold"
                >
                  <UserPlus className="h-4 w-4" />
                  Create account
                </Link>
              </div>
            )}

            <div className="mt-3 flex items-center gap-3 rounded-lg border border-border p-3 sm:hidden">
              <WorkspaceSwitcher />
              <p className="text-xs text-muted-foreground">
                Approved workspace access is checked against your assigned roles.
              </p>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

/**
 * First-visit welcome banner.
 * Guests can dismiss it on this device.
 * Authenticated customers do not see the guest welcome actions.
 */
export function WelcomeBanner() {
  const { signedIn, sessionReady } = useCustomerSession();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!sessionReady || signedIn) {
      setVisible(false);
      return;
    }

    try {
      setVisible(
        localStorage.getItem("nexa-welcome-dismissed") !== "true",
      );
    } catch {
      setVisible(true);
    }
  }, [signedIn, sessionReady]);

  function dismiss() {
    try {
      localStorage.setItem("nexa-welcome-dismissed", "true");
    } catch {
      // The banner can still be dismissed when storage is unavailable.
    }
    setVisible(false);
  }

  if (!sessionReady || signedIn || !visible) return null;

  return (
    <section
      aria-labelledby="nexa-welcome-title"
      className="border-b border-gold/30 bg-gradient-to-r from-gold-soft via-background to-gold-soft"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:py-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">
              Welcome to {BRAND.name}
            </p>
            <h2
              id="nexa-welcome-title"
              className="mt-2 text-xl font-bold sm:text-2xl"
            >
              Your marketplace. Your choice.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Discover products and explore {BRAND.shortName} before creating an account.
              You can browse freely and sign in whenever you need your account.
            </p>
          </div>

          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss welcome message"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border hover:bg-secondary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={dismiss} className="btn btn-gold">
            Continue browsing
          </button>

          <Link
            to="/sign-in"
            onClick={dismiss}
            className="btn btn-outline"
          >
            <LogIn className="h-4 w-4" />
            Log in
          </Link>

          <Link
            to="/sign-up"
            onClick={dismiss}
            className="btn btn-outline"
          >
            <UserPlus className="h-4 w-4" />
            Create account
          </Link>

          <button
            type="button"
            disabled
            title="Google sign-in is not available yet"
            className="btn btn-outline cursor-not-allowed opacity-60"
          >
            Continue with Google
            <span className="text-xs">(Coming soon)</span>
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          Preview storefront: checkout and payments are not live yet.
        </p>
      </div>
    </section>
  );
}

export function MobileTabBar() {
  const { signedIn, sessionReady } = useCustomerSession();

  const items = [
    { to: "/", label: "Home", icon: Home },
    { to: "/sign-in", label: "Account", icon: User },
    { to: "/support", label: "Support", icon: MessageCircle },
    { to: "/policies", label: "Policies", icon: ShieldCheck },
  ] as const;

  if (!sessionReady || signedIn) return null;

  return (
    <nav
      aria-label="Guest navigation"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-gold/20 bg-background md:hidden"
    >
      {items.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          activeOptions={{ exact: to === "/" }}
          activeProps={{ className: "text-gold" }}
          className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-[10px] text-muted-foreground"
        >
          <Icon className="h-5 w-5" />
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function SiteFooter() {
  const { signedIn, sessionReady } = useCustomerSession();
  const { signOut, signingOut } = useCustomerSignOut();

  return (
    <footer className="mt-16 border-t border-gold/30 bg-ink pb-24 text-ink-foreground md:pb-0">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <Link
          to="/"
          aria-label={`${BRAND.name} home`}
          className="inline-flex transition-opacity hover:opacity-90"
        >
          <img
            src={BRAND.logoPath}
            alt={`${BRAND.name} — ${BRAND.tagline}`}
            className="h-8 w-auto max-w-full object-contain sm:h-9"
            loading="lazy"
          />
        </Link>

        <div className="gold-rule my-6" />

        <nav
          aria-label="Footer navigation"
          className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm font-medium"
        >
          <Link
            to="/about"
            className="underline underline-offset-4 hover:text-gold transition-colors"
          >
            About Us
          </Link>

          <Link
            to="/policies"
            className="inline-flex items-center gap-1.5 underline underline-offset-4 hover:text-gold transition-colors"
          >
            <ShieldCheck className="h-4 w-4 text-gold" />
            Policy Centre
          </Link>

          {sessionReady && signedIn ? (
            <>
              <Link
                to="/account"
                className="underline underline-offset-4 hover:text-gold transition-colors"
              >
                My dashboard
              </Link>
              <button
                type="button"
                onClick={() => void signOut()}
                disabled={signingOut}
                className="underline underline-offset-4 hover:text-gold transition-colors disabled:opacity-60"
              >
                {signingOut ? "Signing out..." : "Sign out"}
              </button>
            </>
          ) : (
            <>
              <Link
                to="/sign-in"
                className="underline underline-offset-4 hover:text-gold transition-colors"
              >
                Sign in
              </Link>
              <Link
                to="/sign-up"
                className="underline underline-offset-4 hover:text-gold transition-colors"
              >
                Create account
              </Link>
            </>
          )}
        </nav>

        <p className="text-xs text-slate-400">
          Preview build · storefront UI only. Payments and order placement are
          not live yet.
        </p>

        <div className="mt-6 border-t border-gold/20 pt-4 text-center">
          <p className="text-sm font-semibold tracking-wide text-slate-300">
            Powered by <span className="text-gold">{BRAND.poweredBy}</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
