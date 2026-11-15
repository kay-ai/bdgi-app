import Image from "next/image";
import type { PhotoKey } from "@/content/photos";
import { Photo } from "./Photo";

/**
 * A story or event cover. Until media storage (S3) is wired, only covers stored as site paths
 * ("/img/...") render; anything else falls back to one of BGDI's own photographs.
 */
export function Cover({ src, alt, fallback, priority = false }: { src: string | null; alt: string; fallback: PhotoKey; priority?: boolean }) {
  if (src && src.startsWith("/")) {
    return <Image src={src} alt={alt} fill sizes="(max-width: 639px) 100vw, 50vw" priority={priority} className="object-cover" />;
  }
  return <Photo slot={fallback} alt={alt} priority={priority} />;
}
