import type { PhotoKey } from "@/content/photos";
import { Photo } from "./Photo";

export type ShapeKind = "arch" | "drop" | "pebble" | "girl";

/**
 * A photograph cut to a shape on a gold disc, with the hard ink shadow of the home hero.
 * Used for the picture of a page head and of a split, so every page speaks the hero's language.
 */
export function Shape({
  slot,
  alt,
  shape = "arch",
  priority = false,
  sizes = "(max-width: 1023px) 100vw, 50vw",
  className,
}: {
  slot: PhotoKey;
  alt: string;
  shape?: ShapeKind;
  priority?: boolean;
  sizes?: string;
  className?: string;
}) {
  return (
    <div className={`shape shape--${shape} ${className ?? ""}`}>
      <span className="shape__disc" aria-hidden="true" />
      <div className="shape__pop">
        <div className="shape__frame">
          <Photo slot={slot} alt={alt} priority={priority} sizes={sizes} />
        </div>
      </div>
    </div>
  );
}
