
import { useEffect, useState } from "react";
import { BellRing, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC_KEY =
  "BAjkrZqP5SQdPcSZu3VMNyzauVkU06qgekkaOd2O06lQ7dTb0A3EQcpkyBA_EZnGRQ8z_gXa1hBDAlCNnWOk418";

type PushStatus =
  | "checking"
  | "enabled"
  | "disabled"
  | "blocked"
  | "unsupported"
  | "signed-out"
  | "error";

function urlBase64ToUint8Array(value: string): Uint8Array {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);

  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }

  return output;
}

async function saveSubscription(
  subscription: PushSubscription,
  userId: string
) {
  const details = subscription.toJSON();

  if (!details.endpoint || !details.keys?.p256dh || !details.keys?.auth) {
    throw new Error("The browser returned an incomplete push subscription.");
  }

  const now = new Date().toISOString();

  const { error } = await supabase
    .from("customer_push_subscriptions")
    .upsert(
      {
        user_id: userId,
        endpoint: details.endpoint,
        p256dh: details.keys.p256dh,
        auth_key: details.keys.auth,
        device_label: "This device",
        updated_at: now,
        last_seen_at: now,
        revoked_at: null,
      },
      { onConflict: "endpoint" }
    );

  if (error) throw error;
}

export function PushNotificationSettings() {
  const [status, setStatus] = useState<PushStatus>("checking");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function inspectDevice() {
      try {
        if (
          !window.isSecureContext ||
          !("serviceWorker" in navigator) ||
          !("PushManager" in window) ||
          !("Notification" in window)
        ) {
          if (active) setStatus("unsupported");
          return;
        }

        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error) throw error;

        if (!user) {
          if (active) setStatus("signed-out");
          return;
        }

        if (Notification.permission === "denied") {
          if (active) setStatus("blocked");
          return;
        }

        const registration = await navigator.serviceWorker.ready;
        const subscription =
          await registration.pushManager.getSubscription();

        if (!subscription || Notification.permission !== "granted") {
          if (active) setStatus("disabled");
          return;
        }

        await saveSubscription(subscription, user.id);

        if (active) setStatus("enabled");
      } catch (error) {
        console.error("Push device inspection failed:", error);
        if (active) setStatus("error");
      }
    }

    void inspectDevice();

    return () => {
      active = false;
    };
  }, []);

  async function enableNotifications() {
    if (loading) return;

    setLoading(true);
    setFeedback(null);

    let newlyCreated = false;
    let subscription: PushSubscription | null = null;

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Please sign in first.");

      if (
        !window.isSecureContext ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        setStatus("unsupported");
        throw new Error("This browser does not support device notifications.");
      }

      let permission = Notification.permission;

      if (permission === "default") {
        permission = await Notification.requestPermission();
      }

      if (permission !== "granted") {
        setStatus(permission === "denied" ? "blocked" : "disabled");
        throw new Error(
          "Notification permission was not granted. You can change this in your browser settings."
        );
      }

      const registration = await navigator.serviceWorker.ready;

      subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(
            VAPID_PUBLIC_KEY
          ),
        });

        newlyCreated = true;
      }

      await saveSubscription(subscription, user.id);

      setStatus("enabled");
      setFeedback("Notifications are enabled on this device.");
    } catch (error) {
      console.error("Could not enable push notifications:", error);

      if (newlyCreated && subscription) {
        await subscription.unsubscribe().catch(() => false);
      }

      setStatus("error");
      setFeedback(
        error instanceof Error
          ? error.message
          : "Could not enable notifications. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function disableNotifications() {
    if (loading) return;

    setLoading(true);
    setFeedback(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Please sign in first.");

      const registration = await navigator.serviceWorker.ready;
      const subscription =
        await registration.pushManager.getSubscription();

      if (subscription) {
        const { error } = await supabase
          .from("customer_push_subscriptions")
          .delete()
          .eq("user_id", user.id)
          .eq("endpoint", subscription.endpoint);

        if (error) throw error;

        await subscription.unsubscribe();
      }

      setStatus("disabled");
      setFeedback("Notifications have been disabled on this device.");
    } catch (error) {
      console.error("Could not disable push notifications:", error);
      setFeedback(
        error instanceof Error
          ? error.message
          : "Could not disable notifications. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  const statusText: Record<PushStatus, string> = {
    checking: "Checking this device...",
    enabled: "Enabled on this device",
    disabled: "Not enabled on this device",
    blocked: "Blocked by browser permission settings",
    unsupported: "Device notifications are not supported here",
    "signed-out": "Sign in to manage device notifications",
    error: "Device notification status could not be verified",
  };

  return (
    <section className="surface rounded-2xl border p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold/40 bg-gold/10 text-gold">
          <BellRing className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold">
            Device Notifications
          </h2>

          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Enable notifications on this device so FleJexa can alert
            you about important account updates when you are away
            from the website.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border p-3">
        <p className="text-sm font-semibold">{statusText[status]}</p>

        <p className="mt-1 text-xs text-muted-foreground">
          This setting applies to this device. Your in-app notification
          inbox remains available independently.
        </p>
      </div>

      {status !== "unsupported" &&
        status !== "signed-out" &&
        status !== "blocked" && (
          <button
            type="button"
            onClick={() =>
              void (status === "enabled"
                ? disableNotifications()
                : enableNotifications())
            }
            disabled={loading || status === "checking"}
            className="btn btn-primary mt-4 w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                Please wait...
              </>
            ) : status === "enabled" ? (
              "Disable on this device"
            ) : (
              "Enable Notifications"
            )}
          </button>
        )}

      {status === "blocked" && (
        <p className="mt-3 text-xs text-muted-foreground">
          Open your browser's site settings and allow notifications
          for FleJexa, then return here.
        </p>
      )}

      {feedback && (
        <p className="mt-3 text-xs text-muted-foreground">
          {feedback}
        </p>
      )}
    </section>
  );
      }
        
