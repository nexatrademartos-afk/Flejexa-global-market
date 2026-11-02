import { useEffect, useState } from "react";
import { readOfflineImage, saveOfflineImage } from "@/lib/offline-storage";

/**
 * Loads each public image once when possible, saves a local copy, and uses
 * that copy when offline. If CORS prevents saving, the normal <img> URL is
 * still used online so the image remains visible.
 */
export function useOfflineImage(url: string | null | undefined): string | null {
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    setDisplayUrl(null);

    if (!url) {
      return () => {
        active = false;
      };
    }

    function showBlob(blob: Blob) {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setDisplayUrl(objectUrl);
    }

    async function loadImage() {
      const online = typeof navigator === "undefined" || navigator.onLine;

      if (online) {
        try {
          const response = await fetch(url, {
            mode: "cors",
            credentials: "omit",
          });

          if (response.ok) {
            const blob = await response.blob();

            if (blob.size > 0 && blob.type.startsWith("image/")) {
              try {
                await saveOfflineImage(url, blob);
              } catch (error) {
                console.warn("Unable to save an offline image:", error);
              }

              showBlob(blob);
              return;
            }
          }

          // Keep normal online display working if the response cannot be saved.
          if (active) setDisplayUrl(url);
          return;
        } catch {
          // CORS or network failure: try a previously saved copy below.
          if (typeof navigator !== "undefined" && navigator.onLine) {
            if (active) setDisplayUrl(url);
            return;
          }
        }
      }

      try {
        const savedBlob = await readOfflineImage(url);
        if (savedBlob) {
          showBlob(savedBlob);
        }
      } catch (error) {
        console.warn("Unable to read a saved product image:", error);
      }
    }

    void loadImage();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  return displayUrl;
}
