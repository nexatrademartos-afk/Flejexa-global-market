
import { supabase } from "@/integrations/supabase/client";

/**
 * Removes this browser's push subscription before the current
 * account signs out. A subscription must never remain registered
 * to the previous customer on a shared device.
 */
export async function cleanupCurrentDevicePushSubscription(): Promise<void> {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window)
  ) {
    return;
  }

  const registration = await navigator.serviceWorker.getRegistration("/");

  if (!registration) return;

  const pushSubscription =
    await registration.pushManager.getSubscription();

  if (!pushSubscription) return;

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    const unsubscribed = await pushSubscription
      .unsubscribe()
      .catch(() => false);

    if (!unsubscribed) {
      throw new Error(
        "This device's notification subscription could not be safely cleared. Please try again."
      );
    }

    return;
  }

  const { error: deleteError } = await supabase
    .from("customer_push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", pushSubscription.endpoint);

  const unsubscribed = await pushSubscription
    .unsubscribe()
    .catch(() => false);

  if (deleteError && !unsubscribed) {
    console.error(
      "Push subscription database cleanup failed:",
      deleteError
    );

    throw new Error(
      "This device's notification subscription could not be safely cleared. Please try again."
    );
  }

  if (deleteError || !unsubscribed) {
    console.warn(
      "One push cleanup method failed, but the other succeeded.",
      deleteError
    );
  }
      }
