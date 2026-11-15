import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const en = (await import("../../messages/en.json")).default;
  if (locale === "en") return { locale, messages: en };
  const yo = (await import("../../messages/yo.json")).default;
  // Keys missing from yo.json fall back to English (they are listed in messages/yo.review.json).
  return { locale, messages: deepMerge(en, yo) };
});

type Tree = { [k: string]: string | Tree };
function deepMerge(base: Tree, over: Tree): Tree {
  const out: Tree = { ...base };
  for (const [k, v] of Object.entries(over)) {
    const b = base[k];
    out[k] = typeof v === "object" && typeof b === "object" ? deepMerge(b, v) : v;
  }
  return out;
}
