import { useEffect, useState } from "react";
import { BRAND } from "@/lib/brand";
import { WifiOff, X } from "lucide-react";

export function OfflineStatusBanner() {
  const [offline, setOffline] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const update = () => {
      setOffline(!navigator.onLine);
      setDismissed(false);
    };

    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);

    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline || dismissed) return null;

  return (
    <aside
      role="status"
      aria-live="polite"
      className="relative z-40 border-b border-gold/40 bg-ink px-4 py-3 text-ink-foreground"
    >
      <div className="mx-auto flex max-w-6xl items-start gap-3">
        <WifiOff className="mt-1 h-5 w-5 shrink-0 text-gold" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gold">
            Out of data? {BRAND.shortName} has your back!
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-200">
            You can keep browsing products saved on this device and prepare
            your shopping list. You can send it through WhatsApp when WhatsApp
            has a connection. Our AI assistant, live checkout and online
            support need internet access. Saved prices and stock may have
            changed.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss offline message"
          className="rounded p-1 text-slate-300 hover:bg-white/10"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
