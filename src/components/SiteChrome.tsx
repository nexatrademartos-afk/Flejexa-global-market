
import { BRAND } from "@/lib/brand";

import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
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
  Flame,
  Handshake,
  Gift,
 Wallet,
 Briefcase,
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
 * Temporary guest welcome pop-up.
 * Appears once per browser session for visitors who are not signed in.
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
      if (sessionStorage.getItem("flejexa-guest-welcome-seen") === "true") {
        setVisible(false);
        return;
      }
    } catch {
      // Continue if session storage is unavailable.
    }

    setVisible(true);
  }, [signedIn, sessionReady]);

  const dismiss = useCallback(() => {
    try {
      sessionStorage.setItem("flejexa-guest-welcome-seen", "true");
    } catch {
      // The pop-up can still be dismissed without storage.
    }

    setVisible(false);
  }, []);

  useEffect(() => {
    if (!visible) return;

  const timer = window.setTimeout(dismiss, 10000);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") dismiss();
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [visible, dismiss]);

  if (!sessionReady || signedIn || !visible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-transparent p-3 pt-4 sm:pt-6">
      <button
        type="button"
        aria-label="Continue browsing as a guest"
        onClick={dismiss}
        className="absolute inset-0 h-full w-full cursor-default"
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="flejexa-guest-welcome-title"
      className="relative z-10 w-full max-w-[560px] max-h-[85dvh] overflow-y-auto rounded-2xl border border-gold/50 bg-[#101010] text-white shadow-[0_0_35px_rgba(212,175,55,0.2)]"
      >
        <div className="flex items-center justify-between border-b border-gold/20 px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold">
              Welcome to {BRAND.name}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Powered by {BRAND.poweredBy}
            </p>
          </div>

          <button
            type="button"
            onClick={dismiss}
            aria-label="Close welcome pop-up"
            className="grid h-9 w-9 place-items-center rounded-full border border-white/20 text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

      <div className="space-y-3 p-4 sm:p-5">
          <div>
            <h2
              id="flejexa-guest-welcome-title"
              className="text-2xl font-extrabold leading-tight text-gold sm:text-3xl"
            >
              Become Part of FleJexa.
            </h2>

            <p className="mt-2 text-sm font-bold tracking-wide text-white">
              Shop More. Save More. Get Rewarded.
            </p>

            <p className="mt-2 text-sm leading-6 text-slate-300">
              Create your free account and discover more ways to shop,
              earn rewards, explore opportunities and grow with our community.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
              <Wallet className="h-5 w-5 shrink-0 text-gold" />
              <span className="text-sm text-slate-200">
                Wallet access and eligible bonuses
              </span>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
              <Gift className="h-5 w-5 shrink-0 text-gold" />
              <span className="text-sm text-slate-200">
                Rewards, special offers and gifts
              </span>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
              <Handshake className="h-5 w-5 shrink-0 text-gold" />
              <span className="text-sm text-slate-200">
                Partnership opportunities
              </span>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
              <Briefcase className="h-5 w-5 shrink-0 text-gold" />
              <span className="text-sm text-slate-200">
                Team and career opportunities
              </span>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            <Link
              to="/sign-up"
              onClick={dismiss}
              className="btn btn-gold flex w-full justify-center"
            >
              <UserPlus className="h-4 w-4" />
              Create Your Account
            </Link>

            <div className="flex items-center justify-center gap-2">
              <span className="text-xs text-slate-400">
                Already a member?
              </span>
              <Link
                to="/sign-in"
                onClick={dismiss}
                className="text-sm font-semibold text-gold hover:underline"
              >
                Log in
              </Link>
            </div>

            <button
              type="button"
              onClick={dismiss}
              className="w-full py-2 text-xs font-medium text-slate-400 transition hover:text-white"
            >
              Continue exploring as a guest
            </button>
          </div>
        </div>
      </section>
    </div>
  );
 }

export function MobileTabBar() {
  const { signedIn, sessionReady } = useCustomerSession();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  if (!sessionReady || signedIn) return null;

  const items = [
    { to: "/shop", label: "Shop", icon: ShoppingBag },
    { to: "/sell", label: "Partner", icon: Handshake },
    { to: "/#catalogue", label: "FJX Heat", icon: Flame },
    { to: "/policies", label: "Policies", icon: ShieldCheck },
    { to: "/sign-in", label: "My FJX", icon: User },
  ] as const;

  return (
    <nav
      aria-label="Guest navigation"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 items-end border-t border-gold/30 bg-background px-1 pb-1 md:hidden"
    >
      {items.map(({ to, label, icon: Icon }) => {
        const isHeat = label === "FJX Heat";

        const isActive =
          isHeat
            ? pathname === "/"
            : label === "My FJX"
              ? pathname === "/sign-in" || pathname === "/sign-up"
              : pathname === to;

        return (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact: true }}
            className="relative flex min-h-14 flex-col items-center justify-end gap-1 text-[10px] font-medium text-muted-foreground"
          >
            {isHeat ? (
              <span className="-mt-7 flex h-14 w-14 items-center justify-center rounded-full border-4 border-background bg-gradient-to-br from-yellow-300 via-gold to-amber-700 shadow-[0_0_18px_rgba(212,175,55,0.45)]">
                <Flame className="h-7 w-7 text-black" />
              </span>
            ) : (
              <Icon className="h-5 w-5" />
            )}

            <span className={isActive ? "text-gold" : "text-muted-foreground"}>
              {label}
            </span>
          </Link>
        );
      })}
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
