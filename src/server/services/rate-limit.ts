import "server-only";
import { sql } from "drizzle-orm";
import { db, schema as s } from "@/db";

/** Fixed-window counter in the `rate_limit` table (spec/01 §10). Returns false when over the limit. */
export async function hit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const now = Date.now();
  const windowStart = new Date(now - (now % (windowSeconds * 1000)));
  const [row] = await db
    .insert(s.rateLimit)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [s.rateLimit.key, s.rateLimit.windowStart],
      set: { count: sql`${s.rateLimit.count} + 1` },
    })
    .returning({ count: s.rateLimit.count });
  return (row?.count ?? 1) <= limit;
}
