import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function CustomerNotificationBell() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  const [unreadCount, setUnreadCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

  // Keep the bell available throughout customer dashboard sections,
  // including the Shop tab in the customer's quick navigation.
  const isCustomerDashboard =
    pathname === "/account" ||
    pathname.startsWith("/account/") ||
    pathname === "/shop";

  useEffect(() => {
  let active = true;
  let currentUserId: string | null | undefined = undefined;
  let channel: ReturnType<typeof supabase.channel> | null = null;

  async function switchUser(nextUserId: string | null) {
    if (!active || currentUserId !== nextUserId) return;

    if (channel) {
      const previousChannel = channel;
      channel = null;
      await supabase.removeChannel(previousChannel);
    }

    if (!active || currentUserId !== nextUserId) return;

    setUserId(nextUserId);
    setNotifications([]);
    setLoading(true);
    setError("");

    if (!nextUserId) {
      setError("Please sign in again to view your notifications.");
      setLoading(false);
      return;
    }

    await loadNotifications(nextUserId);

    if (!active || currentUserId !== nextUserId) return;

    channel = supabase
      .channel(`customer-inbox-${nextUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "customer_notifications",
          filter: `user_id=eq.${nextUserId}`,
        },
        () => {
          void loadNotifications(nextUserId);
        },
      )
      .subscribe();

    setLoading(false);
  }

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    const nextUserId = session?.user?.id ?? null;

    if (currentUserId === nextUserId) return;

    currentUserId = nextUserId;

    void Promise.resolve().then(() => switchUser(nextUserId));
  });

  return () => {
    active = false;
    subscription.unsubscribe();

    if (channel) {
      void supabase.removeChannel(channel);
    }
  };
}, [loadNotifications]);
  if (!isCustomerDashboard || !userId) return null;

  return (
    <Link
      to="/account/notifications"
      aria-label={`Notifications, ${unreadCount} unread`}
      title="Notifications"
      className="absolute left-1/2 top-8 z-50 grid h-9 w-9 -translate-x-1/2 place-items-center rounded-full text-gold transition hover:bg-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
    >
      <Bell
        className={`h-5 w-5 ${unreadCount > 0 ? "animate-pulse" : ""}`}
        aria-hidden="true"
      />

      {unreadCount > 0 && (
        <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-gold px-1 text-[10px] font-bold text-black shadow">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
