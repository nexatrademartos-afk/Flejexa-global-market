
import { useEffect, useState } from "react";
import { Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PushNotificationSettings } from "@/components/PushNotificationSettings";
import { FlejexaNotificationSoundSettings } from "@/components/FlejexaNotificationSoundSettings";

type NotificationPreferenceKey =
  | "push_orders"
  | "push_delivery"
  | "push_wallet"
  | "push_support"
  | "push_security"
  | "push_promotions";

type NotificationPreferences = Record<NotificationPreferenceKey, boolean>;

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  push_orders: true,
  push_delivery: true,
  push_wallet: true,
  push_support: true,
  push_security: true,
  push_promotions: false,
};

export function CustomerNotificationSettings() {
  const [notificationPreferences, setNotificationPreferences] =
    useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [preferencesLoading, setPreferencesLoading] = useState(true);
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const [preferencesFeedback, setPreferencesFeedback] =
    useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadNotificationPreferences() {
      setPreferencesLoading(true);

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;

        if (!user) {
          if (active) {
            setPreferencesFeedback(
              "Please sign in to manage notification preferences.",
            );
          }
          return;
        }

        const { data, error } = await supabase
          .from("customer_notification_preferences")
          .select(
            "push_orders, push_delivery, push_wallet, push_support, push_security, push_promotions",
          )
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) throw error;

        if (active && data) {
          setNotificationPreferences({
            push_orders: data.push_orders,
            push_delivery: data.push_delivery,
            push_wallet: data.push_wallet,
            push_support: data.push_support,
            push_security: data.push_security,
            push_promotions: data.push_promotions,
          });
        }
      } catch (error) {
        console.error("Notification preferences could not be loaded:", error);

        if (active) {
          setPreferencesFeedback(
            "Could not load your notification preferences. Please refresh and try again.",
          );
        }
      } finally {
        if (active) setPreferencesLoading(false);
      }
    }

    void loadNotificationPreferences();

    return () => {
      active = false;
    };
  }, []);

  async function handleNotificationPreferenceChange(
    key: NotificationPreferenceKey,
    checked: boolean,
  ) {
    if (preferencesSaving) return;

    setPreferencesSaving(true);
    setPreferencesFeedback(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Please sign in to save your preferences.");

      const nextPreferences = {
        ...notificationPreferences,
        [key]: checked,
      };

      const { error } = await supabase
        .from("customer_notification_preferences")
        .upsert(
          {
            user_id: user.id,
            ...nextPreferences,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );

      if (error) throw error;

      setNotificationPreferences(nextPreferences);
      setPreferencesFeedback(
        "Your notification preferences have been saved.",
      );
    } catch (error) {
      console.error("Notification preferences could not be saved:", error);

      setPreferencesFeedback(
        error instanceof Error
          ? error.message
          : "Could not save your preferences. Please try again.",
      );
    } finally {
      setPreferencesSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="surface rounded-2xl border p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold/40 bg-gold/10 text-gold">
            <Settings2 className="h-5 w-5" />
          </span>

          <div>
            <h2 className="text-base font-bold">
              FleJexa Notification Preferences
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Choose which background notifications FleJexa can send to this
              device.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border p-3">
          <p className="text-xs font-semibold">In-app notifications</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Your FleJexa notification inbox remains available independently
            of these background notification preferences.
          </p>
        </div>

        {preferencesLoading ? (
          <p className="mt-4 text-xs text-muted-foreground">
            Loading your preferences...
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {(
              [
                ["push_orders", "Orders", "Order received and order status updates."],
                ["push_delivery", "Delivery", "Delivery progress and delivery updates."],
                ["push_wallet", "Wallet", "Wallet and rewards account updates."],
                ["push_support", "Support", "Customer support replies and updates."],
                ["push_security", "Security", "Important account security notifications."],
                ["push_promotions", "Promotions", "Optional offers and promotional updates."],
              ] as const
            ).map(([key, title, description]) => (
              <label
                key={key}
                className="flex cursor-pointer items-center justify-between gap-4"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{title}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {description}
                  </span>
                </span>

                <input
                  type="checkbox"
                  checked={notificationPreferences[key]}
                  onChange={(event) =>
                    void handleNotificationPreferenceChange(
                      key,
                      event.target.checked,
                    )
                  }
                  disabled={preferencesSaving}
                  className="h-5 w-5 shrink-0 cursor-pointer accent-gold"
                />
              </label>
            ))}
          </div>
        )}

        {preferencesSaving && (
          <p className="mt-4 text-xs text-muted-foreground">
            Saving your preferences...
          </p>
        )}

        {preferencesFeedback && (
          <p role="status" className="mt-4 text-xs text-muted-foreground">
            {preferencesFeedback}
          </p>
        )}
      </section>

      <FlejexaNotificationSoundSettings />
      <PushNotificationSettings />
    </div>
  );
            }
