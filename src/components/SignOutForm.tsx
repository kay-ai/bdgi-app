import type { ReactNode } from "react";

/** Sign-out button: posts to /api/auth/sign-out, so it keeps working on a page opened before a deploy. */
export function SignOutForm({ locale, className, children }: { locale: string; className?: string; children: ReactNode }) {
  return (
    <form method="post" action="/api/auth/sign-out">
      <input type="hidden" name="locale" value={locale} />
      <button type="submit" className={className}>
        {children}
      </button>
    </form>
  );
}
