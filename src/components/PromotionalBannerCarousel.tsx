
import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (banners.length <= 1) return;

    const timer = window.setInterval(() => {
      setActiveBanner((current) => (current + 1) % banners.length);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [banners.length]);

  useEffect(() => {
    setActiveBanner(0);
  }, [banners.length]);

  function markImageFailed(key: string) {
    setFailedImages((current) =>
      current.includes(key) ? current : [...current, key],
    );
  }

  if (banners.length === 0) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-gold/40 bg-black shadow-[0_0_24px_rgba(212,175,55,0.12)]">
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
        <div className="absolute bottom-3 right-4 z-10 flex items-center gap-2">
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
      )}
    </div>
  );
                                    }
          
