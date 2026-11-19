import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(import.meta.dirname, "tests/support/server-only.ts"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Database tests run against an in-memory PGlite, never the developer's .data folder.
    // The suite is written for spec/05's phone journey; email-mode tests set CONTACT_MODE themselves.
    env: { PGLITE_DIR: "memory://", DATABASE_URL: "", CONTACT_MODE: "phone" },
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
