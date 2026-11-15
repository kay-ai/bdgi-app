/**
 * Wipes the local embedded database and rebuilds it: migrate, then seed.
 * Refuses to run against DATABASE_URL so it can never touch a real server.
 */
import { rmSync } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

if (process.env.DATABASE_URL) {
  console.error("db:reset only works on the local PGlite database. Unset DATABASE_URL first.");
  process.exit(1);
}
const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite");
rmSync(dir, { recursive: true, force: true });
console.log(`Removed ${dir}`);
execSync("pnpm -s db:migrate", { stdio: "inherit" });
execSync("pnpm -s db:seed", { stdio: "inherit" });
