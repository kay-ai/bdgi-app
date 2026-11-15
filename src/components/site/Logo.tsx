import Image from "next/image";

/**
 * Small round mark (the girl's silhouette in ink on gold) used for the favicon and photo
 * placeholders. The full logo below is BGDI's own, from the current website.
 */
export function LogoMark({ className = "logo__mark" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#FFB800" />
      <circle cx="10.4" cy="9.6" r="3.4" fill="#1A1712" />
      <circle cx="21.6" cy="9.6" r="3.4" fill="#1A1712" />
      <circle cx="16" cy="14" r="5.4" fill="#1A1712" />
      <path d="M6.5 28.5c1.2-5.6 5-8.6 9.5-8.6s8.3 3 9.5 8.6A16 16 0 0 1 6.5 28.5Z" fill="#1A1712" />
    </svg>
  );
}

/** BGDI's logo (926×701 PNG). On dark grounds it sits on a cream tile so the black lettering reads. */
export function Logo({ label, onDark = false, height = 44 }: { label: string; onDark?: boolean; height?: number }) {
  const width = Math.round((height * 926) / 701);
  const img = <Image src="/img/bgdi-logo.png" alt={label} width={width} height={height} priority={!onDark} className="block" />;
  return onDark ? <span className="inline-block rounded-[12px] bg-bg p-3">{img}</span> : img;
}
