import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "yo"],
  defaultLocale: "en",
  localePrefix: "as-needed",
  localeCookie: { name: "locale", maxAge: 60 * 60 * 24 * 365 },
});

export type Locale = (typeof routing.locales)[number];
