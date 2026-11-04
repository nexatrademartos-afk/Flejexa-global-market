import { useEffect, useState } from "react";

/**
 * Tracks whether the browser reports a network connection.
 *
 * Starts as `true` so server-rendered and first client render match, then
 * syncs with `navigator.onLine` after mount and follows the `online` and
 * `offline` window events. Listeners are removed when the component unmounts.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);

    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);

    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return online;
}
