import { beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { setupDb } from "./support/db";

/** spec/08 §2 step 7: retries at 1, 5 and 30 minutes, then the next channel, then a staff task. */

const failing = new Set<string>();
const sent: { channel: string; to: string }[] = [];
vi.mock("@/server/providers", () => ({
  consoleOutbox: [],
  providerFor: (channel: string) => ({
    name: `fake:${channel}`,
    send: async ({ to }: { to: string }) => {
      if (failing.has(channel)) return { ok: false, error: `${channel} down` };
      sent.push({ channel, to });
      return { ok: true, providerId: `fake-${sent.length}` };
    },
  }),
}));

const { dispatch, queueTemplate, sendDueMessages } = await import("@/server/services/messaging");

beforeAll(async () => {
  await setupDb();
  await db.update(s.setting).set({ value: { start: "00:00", end: "00:00" } }).where(eq(s.setting.key, "quiet_hours"));
});

const t0 = new Date("2026-11-18T10:00:00Z");
const after = (min: number) => new Date(t0.getTime() + min * 60_000);
const row = async (id: string) => (await db.select().from(s.message).where(eq(s.message.id, id)))[0]!;

describe("retries and fallback", () => {
  it("retries WhatsApp three times, then sends by SMS", async () => {
    failing.clear();
    failing.add("whatsapp");
    const id = (await queueTemplate({
      templateKey: "school.request_received",
      to: "+2348095550001",
      channel: "whatsapp",
      vars: { name: "A", schoolName: "B" },
      eventKey: "retry:1",
      now: t0,
    }))!;
    await dispatch([id], t0);
    expect(await row(id)).toMatchObject({ status: "queued", attempts: 1, channel: "whatsapp" });
    expect((await row(id)).sendAfter!.getTime()).toBe(after(1).getTime());

    await sendDueMessages(after(0.5)); // not due yet
    expect((await row(id)).attempts).toBe(1);
    await sendDueMessages(after(1));
    expect(await row(id)).toMatchObject({ attempts: 2 });
    expect((await row(id)).sendAfter!.getTime()).toBe(after(6).getTime());
    await sendDueMessages(after(6));
    expect((await row(id)).sendAfter!.getTime()).toBe(after(36).getTime());
    await sendDueMessages(after(36)); // fourth failure → SMS, sent at once
    expect(await row(id)).toMatchObject({ status: "sent", channel: "sms" });
    expect(sent.at(-1)).toEqual({ channel: "sms", to: "+2348095550001" });
  });

  it("marks a consent message failed after every channel fails and opens a staff task", async () => {
    failing.clear();
    failing.add("whatsapp");
    failing.add("sms");
    const [g] = await db.insert(s.person).values({ firstName: "G", surname: "x", gender: "female", status: "active" }).returning();
    const id = (await queueTemplate({
      templateKey: "consent.thanks",
      to: "+2348095550002",
      channel: "whatsapp",
      personId: g!.id,
      vars: { studentFirstName: "A", link: "L" },
      eventKey: "retry:2",
      now: t0,
    }))!;
    await dispatch([id], t0);
    for (const m of [1, 6, 36, 37, 42, 72]) await sendDueMessages(after(m));
    expect(await row(id)).toMatchObject({ status: "failed", channel: "sms", error: "sms down" });
    const [task] = await db.select().from(s.task).where(eq(s.task.dedupeKey, `message_failed:${id}`));
    expect(task).toMatchObject({ entityId: g!.id, status: "open" });
  });
});
