import Image from "next/image";
import { photos, type PhotoKey } from "@/content/photos";
import { LogoMark } from "./Logo";

/**
 * A photograph in its frame. While BGDI's original is pending, a static placeholder holds the
 * exact layout (no shimmer, no stock image). `alt` is always required.
 */
export function Photo({
  slot,
  alt,
  sizes = "(max-width: 639px) 100vw, 50vw",
  priority = false,
  className,
}: {
  slot: PhotoKey;
  alt: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  const p = photos[slot] as { src: string | null; width: number; height: number; position?: string };
  if (!p.src) {
    return (
      <div className={`ph ${className ?? ""}`} role="img" aria-label={alt} data-photo-slot={slot}>
        <LogoMark className="ph__mark" />
      </div>
    );
  }
  return (
    <Image
      src={p.src}
      alt={alt}
      width={p.width}
      height={p.height}
      sizes={sizes}
      priority={priority}
      className={className}
      style={p.position ? { objectPosition: p.position } : undefined}
    />
  );
}
