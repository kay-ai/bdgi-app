import * as schema from "./schema";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import postgres from "postgres";
import { PGlite } from "@electric-sql/pglite";
import path from "node:path";
import { mkdirSync } from "node:fs";

/**
 * Production and staging use PostgreSQL through DATABASE_URL.
 * Local development without DATABASE_URL uses an embedded PGlite database in .data/pglite,
 * so the app runs with `pnpm dev` and no Docker (see DECISIONS.md D-001).
 */
type Db = ReturnType<typeof drizzlePg<typeof schema>>;

function createPostgres(url: string): Db {
  const client = postgres(url, { max: 5, prepare: false });
  return drizzlePg(client, { schema });
}

/**
 * PGlite runs PostgreSQL as WebAssembly inside the dev server. If the engine aborts
 * ("RuntimeError: Aborted()"), that instance is dead and every later query fails until the
 * process restarts. To keep `pnpm dev` usable, a crashed instance is marked dead and the next
 * query opens a fresh one on the same data folder (PostgreSQL recovers it from its WAL).
 * The request that hit the crash still fails; the ones after it work.
 */
function createPglite(): Db {
  const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite");
  // "memory://" (used by the tests) keeps the database in memory only.
  if (!dir.startsWith("memory://")) mkdirSync(path.dirname(dir), { recursive: true });

  let current: { client: PGlite; db: Db; dead: boolean } | null = null;

  const isAbort = (e: unknown): boolean => {
    const err = e as { message?: string; name?: string; cause?: unknown } | null;
    return !!err && (err.name === "RuntimeError" || /Aborted\(\)/.test(String(err.message)) || (!!err.cause && isAbort(err.cause)));
  };

  const open = () => {
    const client = new PGlite(dir);
    const entry = { client, db: drizzlePglite(client, { schema }) as unknown as Db, dead: false };
    // Watch every entry point drizzle uses so a crash is noticed wherever it happens.
    for (const method of ["query", "exec", "transaction"] as const) {
      const original = client[method].bind(client) as (...args: unknown[]) => Promise<unknown>;
      (client as unknown as Record<string, unknown>)[method] = async (...args: unknown[]) => {
        try {
          return await original(...args);
        } catch (e) {
          if (isAbort(e) && !entry.dead) {
            entry.dead = true;
            console.error("[db] PGlite aborted; the next query will reopen the database.");
            client.close().catch(() => {});
          }
          throw e;
        }
      };
    }
    return entry;
  };

  const get = () => {
    if (!current || current.dead) current = open();
    return current.db;
  };

  // A stable object for importers; each property read goes to the live instance.
  return new Proxy({} as Db, {
    get(_, prop) {
      const target = get() as unknown as Record<string | symbol, unknown>;
      const value = target[prop];
      return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(target) : value;
    },
  });
}

function create(): Db {
  const url = process.env.DATABASE_URL;
  return url ? createPostgres(url) : createPglite();
}

const globalForDb = globalThis as unknown as { __bgdiDb?: Db };

export const db = globalForDb.__bgdiDb ?? create();
if (process.env.NODE_ENV !== "production") globalForDb.__bgdiDb = db;

export type DB = typeof db;
export { schema };
