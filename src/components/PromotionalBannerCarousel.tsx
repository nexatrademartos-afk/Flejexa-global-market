
import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";
import { OfflineImage } from "@/components/OfflineImage";
import { supabase } from "@/integrations/supabase/client";
import type { StoreBanner } from "@/lib/preview-data";

type Props = {
  banners: StoreBanner[];
};

function getPublicImageUrl(path: string | null | undefined) {
  if (!path) return null;

  const value = path.trim();
  if (!value) return null;

  if (/^https?:\/\//i.test(value)) return value;

  const cleanPath = value
    .replace(/^\/+/, "")
    .replace(/^store-media\//, "");

  const { data } = supabase.storage
    .from("store-media")
    .getPublicUrl(cleanPath);

  return data.publicUrl || null;
}

export function PromotionalBannerCarousel({ banners }: Props) {
  const [activeBanner, setActiveBanner] = useState(0);
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );

    const updatePreference = () => {
      setPrefersReducedMotion(mediaQuery.matches);
    };

    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);

    return () => {
      mediaQuery.removeEventListener("change", updatePreference);
    };
  }, []);

  useEffect(() => {
    if (banners.length <= 1 || isPaused || prefersReducedMotion) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveBanner((current) => (current + 1) % banners.length);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [banners.length, isPaused, prefersReducedMotion]);

  useEffect(() => {
    setActiveBanner(0);
    setFailedImages([]);
  }, [banners.length]);

  function markImageFailed(key: string) {
    setFailedImages((current) =>
      current.includes(key) ? current : [...current, key],
    );
  }

  if (banners.length === 0) return null;

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-gold/40 bg-black shadow-[0_0_24px_rgba(212,175,55,0.12)]"
      aria-label="Store promotions"
    >
      {banners.map((banner, index) => {
        const imageUrl = getPublicImageUrl(banner.image_url);
        const imageFailed = failedImages.includes(`banner-${banner.id}`);

        return (
          <article
            key={banner.id}
            aria-hidden={index !== activeBanner}
            className={index === activeBanner ? "relative block" : "hidden"}
          >
            <div className="relative aspect-[16/7] min-h-[190px] sm:min-h-[260px]">
              {imageUrl && !imageFailed ? (
                <OfflineImage
                  src={imageUrl}
                  alt={banner.title}
                  loading={index === activeBanner ? "eager" : "lazy"}
                  className="h-full w-full object-cover"
                  onError={() => markImageFailed(`banner-${banner.id}`)}
                />
              ) : (
                <div className="grid h-full place-items-center bg-gradient-to-br from-ink via-black to-gold/20 px-5 text-center">
                  <h2 className="text-2xl font-bold text-gold sm:text-4xl">
                    {banner.title}
                  </h2>
                </div>
              )}

              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/65 to-transparent p-4 pt-14 sm:p-7 sm:pt-20">
                <h2 className="text-xl font-bold text-white sm:text-3xl">
                  {banner.title}
                </h2>

                {banner.subtitle && (
                  <p className="mt-1 max-w-xl text-sm text-slate-200 sm:text-base">
                    {banner.subtitle}
                  </p>
                )}
              </div>
            </div>
          </article>
        );
      })}

      {banners.length > 1 && (
        <>
          <div className="absolute bottom-3 left-4 z-10">
            <button
              type="button"
              onClick={() => setIsPaused((current) => !current)}
              disabled={prefersReducedMotion}
              aria-label={
                prefersReducedMotion
                  ? "Automatic promotion rotation is disabled by your reduced-motion setting"
                  : isPaused
                    ? "Resume automatic promotions"
                    : "Pause automatic promotions"
              }
              title={
                prefersReducedMotion
                  ? "Automatic rotation disabled by reduced-motion setting"
                  : isPaused
                    ? "Play promotions"
                    : "Pause promotions"
              }
              className="flex h-8 items-center gap-1.5 rounded-full border border-white/30 bg-black/70 px-3 text-xs font-semibold text-white backdrop-blur transition hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-70"
            >
              {prefersReducedMotion ? (
                <Pause className="h-3.5 w-3.5" />
              ) : isPaused ? (
                <Play className="h-3.5 w-3.5" />
              ) : (
                <Pause className="h-3.5 w-3.5" />
              )}
              {prefersReducedMotion
                ? "Autoplay off"
                : isPaused
                  ? "Play"
                  : "Pause"}
            </button>
          </div>

          <div
            className="absolute bottom-3 right-4 z-10 flex items-center gap-2"
            aria-label="Choose promotion"
          >
            {banners.map((banner, index) => (
              <button
                key={banner.id}
                type="button"
                onClick={() => setActiveBanner(index)}
                aria-label={`Show promotion ${index + 1}`}
                aria-current={index === activeBanner ? "true" : undefined}
                className={`h-2.5 rounded-full transition-all ${
                  index === activeBanner
                    ? "w-7 bg-gold"
                    : "w-2.5 bg-white/60 hover:bg-white"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
