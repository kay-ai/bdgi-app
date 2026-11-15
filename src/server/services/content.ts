import "server-only";
import { and, asc, desc, eq, gte, isNull, lt } from "drizzle-orm";
import { db, schema as s } from "@/db";

/** Story and event bodies are stored as `{ text }` or an array of `{ type, text }` blocks. */
export function bodyParagraphs(body: unknown): string[] {
  if (!body) return [];
  if (typeof body === "string") return body.split(/\n{2,}/);
  if (Array.isArray(body)) return body.map((b) => (typeof b === "string" ? b : String((b as { text?: string }).text ?? ""))).filter(Boolean);
  const text = (body as { text?: string }).text;
  return text ? text.split(/\n{2,}/) : [];
}

export async function listStories(limit = 24) {
  return db
    .select({
      id: s.story.id,
      slug: s.story.slug,
      title: s.story.titleEn,
      excerpt: s.story.excerptEn,
      coverKey: s.story.coverKey,
      coverAlt: s.story.coverAlt,
      publishedAt: s.story.publishedAt,
      authorName: s.story.authorName,
    })
    .from(s.story)
    .where(and(eq(s.story.status, "published"), isNull(s.story.deletedAt)))
    .orderBy(desc(s.story.publishedAt))
    .limit(limit);
}

export async function getStory(slug: string) {
  const [row] = await db
    .select()
    .from(s.story)
    .where(and(eq(s.story.slug, slug), eq(s.story.status, "published"), isNull(s.story.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function listEvents() {
  const now = new Date();
  const base = and(eq(s.event.status, "published"), isNull(s.event.deletedAt));
  const cols = {
    id: s.event.id,
    slug: s.event.slug,
    title: s.event.titleEn,
    summary: s.event.summaryEn,
    startsAt: s.event.startsAt,
    venue: s.event.venue,
    isOnline: s.event.isOnline,
  };
  const [upcoming, past] = await Promise.all([
    db.select(cols).from(s.event).where(and(base, gte(s.event.startsAt, now))).orderBy(asc(s.event.startsAt)).limit(24),
    db.select(cols).from(s.event).where(and(base, lt(s.event.startsAt, now))).orderBy(desc(s.event.startsAt)).limit(12),
  ]);
  return { upcoming, past };
}

export async function getEvent(slug: string) {
  const [row] = await db
    .select()
    .from(s.event)
    .where(and(eq(s.event.slug, slug), eq(s.event.status, "published"), isNull(s.event.deletedAt)))
    .limit(1);
  return row ?? null;
}
