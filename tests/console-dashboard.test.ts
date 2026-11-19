import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { db, schema as s } from "@/db";
import type { Actor, Role } from "@/server/permissions/can";
import { consoleDashboard, consoleNavCounts, lagosWeekStart } from "@/server/services/console-dashboard";
import { setupDb } from "./support/db";

/** Console home: counts, the waiting queue, weekly sign-ups, and scoping by role and state. */

let stateA = "";
let stateB = "";
const NOW = new Date("2026-11-19T20:00:00Z"); // Thursday, 21:00 in Lagos

const actor = (roles: [Role, string | null][]): Actor => ({
  userId: randomUUID(),
  personId: randomUUID(),
  firstName: "Staff",
  roles: roles.map(([role, stateId]) => ({ role, stateId })),
  childIds: [],
  coachCohortIds: [],
  championSchoolIds: [],
});

async function student(stateId: string, status: "pending_review" | "pending_consent" | "active", createdAt: Date) {
  const [p] = await db.insert(s.person).values({ firstName: "Kemi", surname: "enc", gender: "female", status, stateId, createdAt }).returning();
  await db.insert(s.personRole).values({ personId: p!.id, role: "student" });
  return p!.id;
}

beforeAll(async () => {
  await setupDb();
  const [a] = await db.insert(s.state).values({ code: "DA", name: "Dash A", isActive: true }).returning();
  const [b] = await db.insert(s.state).values({ code: "DB", name: "Dash B", isActive: true }).returning();
  stateA = a!.id;
  stateB = b!.id;
  const day = 86_400_000;
  await student(stateA, "pending_review", new Date(NOW.getTime() - 3 * day)); // last Monday-ish: this week
  await student(stateA, "pending_review", new Date(NOW.getTime() - 20 * day));
  await student(stateA, "pending_consent", new Date(NOW.getTime() - 1 * day));
  await student(stateB, "active", new Date(NOW.getTime() - 40 * day));
  await student(stateB, "pending_review", new Date(NOW.getTime() - 200 * day)); // older than the chart
  const [v] = await db.insert(s.person).values({ firstName: "Tobi", surname: "enc", gender: "female", status: "active", stateId: stateA }).returning();
  await db.insert(s.volunteerProfile).values({ personId: v!.id, stage: "applied", motivation: "Help", createdAt: new Date(NOW.getTime() - 2 * day) });
  await db.insert(s.schoolRequest).values({ stateId: stateB, schoolNameOther: "New High", requesterName: "Mrs Ade", requesterRole: "principal", requesterPhone: "enc" });
});

describe("console dashboard", () => {
  it("counts what is waiting for an admin, oldest first in the queue", async () => {
    const d = await consoleDashboard(actor([["admin", null]]), NOW);
    expect(d.students).toMatchObject({ pendingReview: 3, pendingConsent: 1, active: 1 });
    expect(d.volunteers?.open).toBe(1);
    expect(d.schools?.newRequests).toBe(1);
    expect(d.queue.map((q) => q.kind)).toEqual(["student", "student", "student", "volunteer", "school"]);
    expect(d.queue[0]!.createdAt.getTime()).toBeLessThan(d.queue[1]!.createdAt.getTime());
  });

  it("buckets sign-ups into 12 Lagos weeks ending this week", async () => {
    const d = await consoleDashboard(actor([["admin", null]]), NOW);
    expect(d.weekly).toHaveLength(12);
    expect(d.weekly.at(-1)!.start.getTime()).toBe(lagosWeekStart(NOW).getTime());
    expect(d.weekly.reduce((n, w) => n + w.students, 0)).toBe(4);
    expect(d.weekly.reduce((n, w) => n + w.volunteers, 0)).toBe(1);
    expect(d.weekly.at(-1)!.students).toBe(2);
  });

  it("keeps a state lead to their own state and hides areas they cannot open", async () => {
    const lead = actor([["state_lead", stateA]]);
    const d = await consoleDashboard(lead, NOW);
    expect(d.students?.pendingReview).toBe(2);
    expect(d.schools?.newRequests).toBe(0);
    expect(d.donations).toBeNull();
    expect(d.messages).toBeNull();
    expect(await consoleNavCounts(lead)).toEqual({ students: 2, volunteers: 1, schools: 0 });
  });

  it("shows a content editor nothing from the people lists", async () => {
    const d = await consoleDashboard(actor([["content_editor", null]]), NOW);
    expect(d.students).toBeNull();
    expect(d.volunteers).toBeNull();
    expect(d.queue).toEqual([]);
  });
});
