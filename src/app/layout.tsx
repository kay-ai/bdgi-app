import type { ReactNode } from "react";

// The <html> element lives in [locale]/layout.tsx so its lang attribute follows the URL.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
