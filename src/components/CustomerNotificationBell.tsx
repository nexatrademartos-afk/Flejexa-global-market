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
    if (!isCustomerDashboard) {
      setUserId(null);
      setUnreadCount(0);
      return;
    }

    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function loadNotifications() {
      const { data, error } = await supabase.auth.getUser();

      if (!active || error || !data.user) return;

      const currentUserId = data.user.id;
      setUserId(currentUserId);

      async function refreshUnreadCount() {
        const { count, error: countError } = await supabase
          .from("customer_notifications" as any)
          .select("id", { count: "exact", head: true })
          .eq("user_id", currentUserId)
          .is("read_at", null);

        if (!active || countError) return;
        setUnreadCount(count ?? 0);
      }

      await refreshUnreadCount();

      if (!active) return;

      channel = supabase
        .channel(`customer-notifications-${currentUserId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "customer_notifications",
            filter: `user_id=eq.${currentUserId}`,
          },
          () => void refreshUnreadCount(),
        )
        .subscribe();
    }

    void loadNotifications();

    return () => {
      active = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [isCustomerDashboard]);

  if (!isCustomerDashboard || !userId) return null;

  return (
    <Link
      to="/account/notifications"
      aria-label={`Notifications, ${unreadCount} unread`}
      title="Notifications"
      className="absolute left-1/2 top-10 z-50 grid h-9 w-9 -translate-x-1/2 place-items-center rounded-full text-gold transition hover:bg-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
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
