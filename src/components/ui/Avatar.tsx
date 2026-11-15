/**
 * The 24 built-in avatars (DESIGN.md §8.3): a faceless bust in one ink shape on a coloured disc.
 * a01–a24 = 6 hair shapes × 4 discs. Drawn in code so they cost no download.
 */
const DISCS = ["#FFB800", "#F1EADC", "#C4623A", "#1F7A5A"] as const;
const INK = "#1A1712";

const HAIR: Record<number, React.ReactNode> = {
  // afro
  0: <circle cx="32" cy="24" r="15" />,
  // two puffs (the logo's girl)
  1: (
    <>
      <circle cx="20" cy="15" r="7" />
      <circle cx="44" cy="15" r="7" />
      <circle cx="32" cy="25" r="11" />
    </>
  ),
  // braids
  2: (
    <>
      <circle cx="32" cy="24" r="11.5" />
      <rect x="19" y="24" width="5" height="20" rx="2.5" />
      <rect x="40" y="24" width="5" height="20" rx="2.5" />
    </>
  ),
  // low cut
  3: <circle cx="32" cy="26" r="10.5" />,
  // locs
  4: (
    <>
      <circle cx="32" cy="23" r="12" />
      <path d="M20 22h24v18c0 2-2 3-4 3s-2-2-2-4V30H26v9c0 2-1 4-2 4-2 0-4-1-4-3Z" />
    </>
  ),
  // hijab
  5: <path d="M32 9c10 0 16 8 16 17 0 6-2 10-5 13l7 9H14l7-9c-3-3-5-7-5-13 0-9 6-17 16-17Z" />,
};

export function avatarIndex(key: string) {
  const n = Math.min(24, Math.max(1, parseInt(key.slice(1), 10) || 1)) - 1;
  return { hair: n % 6, disc: Math.floor(n / 6) };
}

export function Avatar({ avatarKey, size = 48, className }: { avatarKey: string; size?: number; className?: string }) {
  const { hair, disc } = avatarIndex(avatarKey);
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <clipPath id={`av-${avatarKey}`}>
          <circle cx="32" cy="32" r="32" />
        </clipPath>
      </defs>
      <g clipPath={`url(#av-${avatarKey})`}>
        <rect width="64" height="64" fill={DISCS[disc]} />
        <g fill={INK}>
          {HAIR[hair]}
          <circle cx="32" cy="27" r="9" />
          <path d="M12 64c1-11 9-19 20-19s19 8 20 19Z" />
        </g>
      </g>
    </svg>
  );
}
