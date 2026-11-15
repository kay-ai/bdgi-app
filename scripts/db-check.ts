/** Opens the local PGlite folder and runs one query. Usage: tsx scripts/db-check.ts [dir] */
import { PGlite } from "@electric-sql/pglite";
import path from "node:path";

const dir = process.argv[2] ?? process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite");
const db = new PGlite(dir);
try {
  const r = await db.query<{ n: number }>("select count(*)::int as n from setting");
  console.log(`OK: ${dir} opens; ${r.rows[0]?.n} settings rows`);
} catch (e) {
  console.error(`FAILED: ${dir} does not open`, e);
  process.exitCode = 1;
} finally {
  await db.close().catch(() => {});
}
