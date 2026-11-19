import { migrate } from "drizzle-orm/pglite/migrator";
import { db, schema as s } from "@/db";
import { messageTemplates } from "@/server/seed/templates";
import * as data from "@/server/seed/data";

/** Migrate the in-memory database and load what the donation flow needs: settings, templates, programmes. */
export async function setupDb() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await migrate(db as any, { migrationsFolder: "./src/db/migrations" });
  for (const [key, value] of Object.entries(data.settings)) {
    await db.insert(s.setting).values({ key, value: value as object }).onConflictDoNothing();
  }
  for (const t of messageTemplates) {
    await db
      .insert(s.messageTemplate)
      .values({
        key: t.key,
        category: t.category,
        channels: [...t.channels],
        subjectEn: t.subjectEn,
        bodyEn: t.bodyEn,
        variables: [...t.variables],
        allowBeforeConsent: t.allowBeforeConsent,
        ignoresQuietHours: t.ignoresQuietHours,
        isSystem: true,
      })
      .onConflictDoNothing({ target: s.messageTemplate.key });
  }
  for (const p of data.programmes) {
    await db.insert(s.programme).values({ ...p, status: "published" }).onConflictDoNothing({ target: s.programme.slug });
  }
}
