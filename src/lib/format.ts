/** Numbers and money formatted for Nigeria (spec/01 §9). */
const num = new Intl.NumberFormat("en-NG");
export const fmt = (n: number) => num.format(n);

export const naira = (minor: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(minor / 100);

export const usd = (minor: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(minor / 100);

/** "15 November 2026" in the reader's language (Yorùbá falls back to en-NG month names). */
export const formatDate = (iso: string | Date, locale = "en") =>
  new Intl.DateTimeFormat(locale === "yo" ? "yo-NG" : "en-NG", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" }).format(
    typeof iso === "string" ? new Date(iso) : iso,
  );
