
import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bell,
  CheckCheck,
  Clock3,
  Inbox,
  MessageCircle,
  Package,
  RefreshCw,
  ShieldCheck,
  Truck,
  Wallet,
} from "lucide-react";
import { AccountPage, accountHead } from "@/components/AccountPage";
import { supabase } from "@/integrations/supabase/client";

type NotificationType =
  | "system"
  | "support"
  | "order"
  | "delivery"
  | "wallet"
  | "security"
  | "promotion";

type CustomerNotification = {
  id: string;
  user_id: string;
  notification_type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

type FilterType =
  | "all"
  | "unread"
  | "support"
  | "orders"
  | "delivery"
  | "wallet";

export const Route = createFileRoute("/account/notifications")({
  head: accountHead(
    "Notifications",
    "Your private FleJexa notifications and support messages.",
  ),
  component: AccountNotificationsPage,
});

function getDestination(type: NotificationType) {
  switch (type) {
    case "support":
      return "/account/returns" as const;
    case "order":
      return "/account/orders" as const;
    case "delivery":
      return "/account/delivery" as const;
    case "wallet":
      return "/account/wallet" as const;
    case "security":
      return "/account/settings" as const;
    default:
      return "/account/notifications" as const;
  }
}

const CUSTOMER_NOTIFICATION_LINKS = [
  "/account/returns",
  "/account/orders",
  "/account/delivery",
  "/account/wallet",
  "/account/settings",
  "/account/notifications",
] as const;

type CustomerNotificationPath =
  (typeof CUSTOMER_NOTIFICATION_LINKS)[number];

function getNotificationDestination(
  notification: CustomerNotification,
): CustomerNotificationPath {
  const savedLink = notification.link;

  if (
    savedLink &&
    (CUSTOMER_NOTIFICATION_LINKS as readonly string[]).includes(savedLink)
  ) {
    return savedLink as CustomerNotificationPath;
  }

  return getDestination(notification.notification_type);
}

function getIcon(type: NotificationType) {
  switch (type) {
    case "support":
      return MessageCircle;
    case "order":
      return Package;
    case "delivery":
      return Truck;
    case "wallet":
      return Wallet;
    case "security":
      return ShieldCheck;
    default:
      return Bell;
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AccountNotificationsPage() {
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const [filter, setFilter] = useState<FilterType>("all");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  const unreadCount = notifications.filter(
    (item) => !item.read_at,
  ).length;

  const loadNotifications = useCallback(async (currentUserId: string) => {
    setError("");

    const { data, error: queryError } = await supabase
      .from("customer_notifications" as any)
      .select(
        "id,user_id,notification_type,title,body,link,read_at,created_at",
      )
      .eq("user_id", currentUserId)
      .order("created_at", { ascending: false })
      .limit(100);
const { data: sessionData } = await supabase.auth.getSession();

if (sessionData.session?.user.id !== currentUserId) {
  return;
}
    
    if (queryError) {
      setError("We couldn't load your notifications. Please try again.");
      return;
    }

    setNotifications((data ?? []) as CustomerNotification[]);
  }, []);

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
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function initialise() {
      const { data, error: authError } = await supabase.auth.getUser();

      if (!active) return;

      if (authError || !data.user) {
        setError("Please sign in again to view your notifications.");
        setLoading(false);
        return;
      }

      const currentUserId = data.user.id;
      setUserId(currentUserId);

      await loadNotifications(currentUserId);

      if (!active) return;

      channel = supabase
        .channel(`customer-inbox-${currentUserId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "customer_notifications",
            filter: `user_id=eq.${currentUserId}`,
          },
          () => {
            void loadNotifications(currentUserId);
          },
        )
        .subscribe();

      setLoading(false);
    }

    void initialise();

    return () => {
      active = false;

      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [loadNotifications]);

  async function markAsRead(notification: CustomerNotification) {
    if (!userId || notification.read_at || busyId) return;

    setBusyId(notification.id);
    setError("");

    const readAt = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("customer_notifications" as any)
      .update({ read_at: readAt })
      .eq("id", notification.id)
      .eq("user_id", userId)
      .is("read_at", null);

    if (updateError) {
      setError("We couldn't update this notification. Please try again.");
    } else {
      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id
            ? { ...item, read_at: readAt }
            : item,
        ),
      );
    }

    setBusyId(null);
  }

  async function markAllAsRead() {
    if (!userId || unreadCount === 0 || markingAll) return;

    setMarkingAll(true);
    setError("");

    const readAt = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("customer_notifications" as any)
      .update({ read_at: readAt })
      .eq("user_id", userId)
      .is("read_at", null);

    if (updateError) {
      setError("We couldn't update your notifications. Please try again.");
    } else {
      setNotifications((current) =>
        current.map((item) => ({
          ...item,
          read_at: item.read_at ?? readAt,
        })),
      );
    }

    setMarkingAll(false);
  }

  const filteredNotifications = notifications.filter((item) => {
  if (filter === "unread") return !item.read_at;
  if (filter === "support") return item.notification_type === "support";
  if (filter === "orders") return item.notification_type === "order";
  if (filter === "delivery") return item.notification_type === "delivery";
  if (filter === "wallet") return item.notification_type === "wallet";
  return true;
});

  return (
    <AccountPage
      title="Notifications & Support"
      intro="Your personal messages and important account updates."
    >
      <div className="space-y-4">
        <section className="surface flex items-center justify-between gap-3 rounded-2xl border border-gold/40 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-gold/40 bg-gold/10 text-gold">
              <Bell className="h-5 w-5" />
            </span>

            <div>
              <p className="font-bold">Your inbox</p>
              <p className="text-xs text-muted-foreground">
                {unreadCount} unread {unreadCount === 1 ? "message" : "messages"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void markAllAsRead()}
            disabled={unreadCount === 0 || markingAll}
            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border border-gold/40 px-3 text-xs font-semibold text-gold transition hover:bg-gold/10 disabled:opacity-40"
          >
            <CheckCheck className="h-4 w-4" />
            {markingAll ? "Updating..." : "Read all"}
          </button>
        </section>

   <div className="flex flex-wrap gap-2" aria-label="Filter notifications">
     {(
     [
     ["all", "All"],
  ["unread", "Unread"],
  ["orders", "Orders"],
  ["delivery", "Delivery"],
  ["wallet", "Wallet"],
  ["support", "Support"],
] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className={[
                "min-h-10 rounded-full border px-4 text-sm font-semibold transition",
                filter === value
                  ? "border-gold bg-gold text-background"
                  : "border-border text-muted-foreground hover:border-gold/50 hover:text-foreground",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-destructive/40 p-3 text-sm text-destructive"
          >
            {error}
            <button
              type="button"
              onClick={() => {
                if (userId) void loadNotifications(userId);
              }}
              className="ml-2 font-semibold underline"
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="surface rounded-2xl border p-10 text-center">
            <RefreshCw className="mx-auto h-6 w-6 animate-spin text-gold" />
            <p className="mt-3 text-sm text-muted-foreground">
              Loading your messages...
            </p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="surface rounded-2xl border p-10 text-center">
            <Inbox className="mx-auto h-9 w-9 text-muted-foreground/60" />
            <h2 className="mt-3 font-bold">
              {filter === "unread"
                ? "You're all caught up"
                : filter === "support"
                  ? "No support messages yet"
                  : "Your inbox is empty"}
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              New account alerts and official FleJexa messages will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((notification) => {
              const Icon = getIcon(notification.notification_type);
              const destination = getNotificationDestination(notification);

              return (
                <article
                  key={notification.id}
                  className={[
                    "surface rounded-2xl border p-4 transition-colors",
                    notification.read_at
                      ? "border-border"
                      : "border-gold/50 bg-gold/[0.035]",
                  ].join(" ")}
                >
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold/30 bg-gold/10 text-gold">
                      <Icon className="h-5 w-5" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-bold">
                          {notification.title}
                        </h2>

                        {!notification.read_at && (
                          <span className="h-2 w-2 rounded-full bg-gold" aria-label="Unread" />
                        )}
                      </div>

                      {notification.body && (
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                          {notification.body}
                        </p>
                      )}

                      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Clock3 className="h-3.5 w-3.5" />
                        {formatDate(notification.created_at)}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        {notification.notification_type !== "system" &&
                          notification.notification_type !== "promotion" && (
                            <Link
                              to={destination}
                              onClick={() => void markAsRead(notification)}
                              className="text-xs font-semibold text-gold hover:underline"
                            >
                              {notification.notification_type === "support"
                                ? "Open support"
                                : "View details"}
                            </Link>
                          )}

                        {!notification.read_at && (
                          <button
                            type="button"
                            onClick={() => void markAsRead(notification)}
                            disabled={busyId === notification.id}
                            className="text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"
                          >
                            {busyId === notification.id
                              ? "Updating..."
                              : "Mark as read"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <section className="surface rounded-2xl border p-4">
          <div className="flex items-center gap-3">
            <MessageCircle className="h-5 w-5 text-gold" />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold">Need help?</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Contact the FleJexa customer support team.
              </p>
            </div>
            <Link
              to="/account/returns"
              className="shrink-0 text-xs font-semibold text-gold hover:underline"
            >
              Get support
            </Link>
          </div>
        </section>
      </div>
    </AccountPage>
  );
}
