import type { ImgHTMLAttributes } from "react";
import { useOfflineImage } from "@/hooks/use-offline-image";

type OfflineImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  src: string | null | undefined;
};

export function OfflineImage({ src, ...props }: OfflineImageProps) {
  const displaySrc = useOfflineImage(src);

  if (!displaySrc) return null;

  return <img {...props} src={displaySrc} />;
}
