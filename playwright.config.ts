import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end journeys (spec/14). The app runs on its own port, database and build folder so it
 * never touches `pnpm dev` or the developer's .data/pglite. The installed Chrome is used, so no
 * browser download is needed; set PW_CHANNEL=msedge (or "" for bundled Chromium) to change it.
 */
const PORT = Number(process.env.E2E_PORT ?? 3015);
const env = {
  PGLITE_DIR: ".data/pglite-e2e",
  NEXT_DIST_DIR: ".next-e2e",
  DATABASE_URL: "",
  APP_URL: `http://localhost:${PORT}`,
  NEXT_TELEMETRY_DISABLED: "1",
};

export default defineConfig({
  testDir: "e2e",
  timeout: 5 * 60_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: process.env.PW_CHANNEL ?? "chrome",
    trace: "retain-on-failure",
  },
  projects: [{ name: "phone-360", use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 740 }, hasTouch: true } }],
  webServer: {
    // A fresh database each run: wipe, migrate, seed (with demo schools), then start.
    command: `node e2e/reset-db.mjs && pnpm db:migrate && pnpm db:seed && pnpm exec next dev --port ${PORT}`,
    url: `http://localhost:${PORT}/join/student`,
    timeout: 5 * 60_000,
    reuseExistingServer: false,
    env,
    stdout: "ignore",
    stderr: "pipe",
  },
});
