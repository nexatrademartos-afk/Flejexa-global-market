
import { useEffect, useState } from "react";
import { Play, Volume2, VolumeX } from "lucide-react";
import {
  disableFlejexaNotificationSound,
  enableFlejexaNotificationSound,
  isFlejexaNotificationSoundEnabled,
  playFlejexaNotificationSound,
} from "@/lib/notification-sound";

export function FlejexaNotificationSoundSettings() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    setEnabled(isFlejexaNotificationSoundEnabled());
  }, []);

  async function handleEnable() {
    if (loading) return;

    setLoading(true);
    setFeedback(null);

    try {
      const success = await enableFlejexaNotificationSound();

      if (!success) {
        setFeedback(
          "Sound could not be enabled. Please check your device volume and try again."
        );
        return;
      }

      setEnabled(true);
      setFeedback("FleJexa notification sound is now enabled.");
    } finally {
      setLoading(false);
    }
  }

  function handleDisable() {
    disableFlejexaNotificationSound();
    setEnabled(false);
    setFeedback("FleJexa notification sound has been disabled.");
  }

  function handleTest() {
    playFlejexaNotificationSound();
    setFeedback("Playing the FleJexa notification sound.");
  }

  return (
    <section className="surface rounded-2xl border p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold/40 bg-gold/10 text-gold">
          {enabled ? (
            <Volume2 className="h-5 w-5" />
          ) : (
            <VolumeX className="h-5 w-5" />
          )}
        </span>

        <div className="min-w-0">
          <h2 className="text-base font-bold">
            FleJexa Notification Sound
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Choose whether your device plays our unique FleJexa sound when
            a new notification arrives while you are using the website.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border p-3">
        <p className="text-sm font-semibold">
          Sound status: {enabled ? "Enabled" : "Disabled"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          This setting applies to this device and browser. It does not
          control background push notification sounds.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {!enabled ? (
          <button
            type="button"
            onClick={() => void handleEnable()}
            disabled={loading}
            className="btn btn-primary inline-flex items-center gap-2"
          >
            <Volume2 className="h-4 w-4" />
            {loading ? "Enabling..." : "Enable & test sound"}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={handleTest}
              className="btn btn-primary inline-flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              Test sound
            </button>

            <button
              type="button"
              onClick={handleDisable}
              className="btn border inline-flex items-center gap-2"
            >
              <VolumeX className="h-4 w-4" />
              Disable sound
            </button>
          </>
        )}
      </div>

      {feedback && (
        <p role="status" className="mt-3 text-xs text-muted-foreground">
          {feedback}
        </p>
      )}
    </section>
  );
}
