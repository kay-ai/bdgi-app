import "server-only";
import { and, asc, count, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { decrypt, encrypt } from "@/lib/crypto";
import { can, hasRole, type Actor } from "@/server/permissions/can";
import { audit } from "./audit";
import { dispatch, queueTemplate } from "./messaging";
import { reach } from "./reach";

/**
 * Group chat (D-025). Every group has one chat for its students and coaches. A coach and one of her
 * group's students may also chat privately: BGDI chose to allow this, so every private chat is
 * readable by staff, both people are told so, phone numbers, emails and links are refused, and
 * anyone in a chat can report a message, which hides it and opens a safeguarding case.
 */

type Result<T = object> = ({ ok: true } & T) | { ok: false; code: string };
const COACH = ["lead_coach", "assistant_coach"];
const MAX_LEN = 1000;
const isUuid = (x: string) => /^[0-9a-f-]{36}$/.test(x);
const plain = (enc: string) => {
  try {
    return decrypt(enc) ?? "";
  } catch {
    return "";
  }
};

/** Contact details and links are not allowed in chat (code of conduct, rule 4). */
export function blockedContent(body: string): "phone" | "email" | "link" | null {
  if (/[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(body)) return "email";
  if (/\b(https?:\/\/|www\.)|\b[a-z0-9-]+\.(com|ng|org|net|io|me|ly|app|co|link|gl|be)(\/|\b)/i.test(body)) return "link";
  if (/(\+?\d[\s-]?){8,}/.test(body.replace(/[()]/g, ""))) return "phone";
  return null;
}

/** Her current groups and her role in each. */
async function myGroups(personId: string) {
  return db
    .select({ cohortId: s.cohortMember.cohortId, role: s.cohortMember.role, name: s.cohort.name })
    .from(s.cohortMember)
    .innerJoin(s.cohort, eq(s.cohort.id, s.cohortMember.cohortId))
    .where(and(eq(s.cohortMember.personId, personId), isNull(s.cohortMember.leftOn), isNull(s.cohort.deletedAt)));
}

async function roleIn(cohortId: string, personId: string) {
  const [m] = await db
    .select({ role: s.cohortMember.role })
    .from(s.cohortMember)
    .where(and(eq(s.cohortMember.cohortId, cohortId), eq(s.cohortMember.personId, personId), isNull(s.cohortMember.leftOn)));
  return m?.role ?? null;
}

async function stateOf(cohortId: string) {
  const [r] = await db.select({ stateId: s.school.stateId }).from(s.cohort).innerJoin(s.school, eq(s.school.id, s.cohort.schoolId)).where(eq(s.cohort.id, cohortId));
  return r?.stateId ?? null;
}

/** Staff who may read a group's chats: those who manage it, and safeguarding leads. */
export async function staffMayRead(actor: Actor | null, cohortId: string) {
  if (!actor) return false;
  if (hasRole(actor, "safeguarding_lead", "admin")) return true;
  return can(actor, "cohort.manage", { stateId: await stateOf(cohortId) });
}

async function groupThread(cohortId: string) {
  await db.insert(s.chatThread).values({ kind: "group", cohortId }).onConflictDoNothing();
  const [t] = await db.select().from(s.chatThread).where(and(eq(s.chatThread.cohortId, cohortId), eq(s.chatThread.kind, "group")));
  return t!;
}

type Thread = typeof s.chatThread.$inferSelect;

/** Is she a member of this chat (may read and write)? */
async function participant(actor: Actor, t: Thread) {
  const role = await roleIn(t.cohortId, actor.personId);
  if (!role) return false;
  if (t.kind === "group") return true;
  return t.coachId === actor.personId || t.studentId === actor.personId;
}

async function access(actor: Actor | null, threadId: string): Promise<{ t: Thread; as: "member" | "staff" } | null> {
  if (!actor || !isUuid(threadId)) return null;
  const [t] = await db.select().from(s.chatThread).where(eq(s.chatThread.id, threadId));
  if (!t) return null;
  if (await participant(actor, t)) return { t, as: "member" };
  if (await staffMayRead(actor, t.cohortId)) return { t, as: "staff" };
  return null;
}

/** Her chats: each group's chat, her private chats, and who she can start a private chat with. */
export async function myChats(actor: Actor) {
  const groups = await myGroups(actor.personId);
  if (!groups.length) return { threads: [], startable: [] };
  const cohortIds = groups.map((g) => g.cohortId);
  for (const g of groups) await groupThread(g.cohortId);
  const threads = await db
    .select()
    .from(s.chatThread)
    .where(
      and(
        inArray(s.chatThread.cohortId, cohortIds),
        or(eq(s.chatThread.kind, "group"), eq(s.chatThread.coachId, actor.personId), eq(s.chatThread.studentId, actor.personId)),
      ),
    );
  const ids = threads.map((t) => t.id);
  const [unread, people] = await Promise.all([
    db
      .select({ threadId: s.chatMessage.threadId, n: count() })
      .from(s.chatMessage)
      .leftJoin(s.chatRead, and(eq(s.chatRead.threadId, s.chatMessage.threadId), eq(s.chatRead.personId, actor.personId)))
      .where(
        and(
          inArray(s.chatMessage.threadId, ids),
          sql`${s.chatMessage.senderId} <> ${actor.personId}`,
          isNull(s.chatMessage.reportedAt),
          or(isNull(s.chatRead.lastReadAt), gt(s.chatMessage.createdAt, s.chatRead.lastReadAt)),
        ),
      )
      .groupBy(s.chatMessage.threadId),
    db
      .select({ cohortId: s.cohortMember.cohortId, personId: s.person.id, firstName: s.person.firstName, role: s.cohortMember.role })
      .from(s.cohortMember)
      .innerJoin(s.person, eq(s.person.id, s.cohortMember.personId))
      .where(and(inArray(s.cohortMember.cohortId, cohortIds), isNull(s.cohortMember.leftOn), isNull(s.person.deletedAt)))
      .orderBy(asc(s.person.firstName)),
  ]);
  const nameOf = (id: string | null) => people.find((p) => p.personId === id)?.firstName ?? "";
  const list = threads
    .map((t) => {
      const g = groups.find((x) => x.cohortId === t.cohortId)!;
      const other = t.kind === "direct" ? (t.coachId === actor.personId ? t.studentId : t.coachId) : null;
      return {
        id: t.id,
        kind: t.kind,
        cohortName: g.name,
        title: t.kind === "group" ? g.name : nameOf(other),
        otherIsCoach: t.kind === "direct" && other === t.coachId,
        lastMessageAt: t.lastMessageAt,
        unread: unread.find((u) => u.threadId === t.id)?.n ?? 0,
      };
    })
    .sort((a, b) => (a.kind === b.kind ? (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0) : a.kind === "group" ? -1 : 1));

  // A coach can message each student of her groups; a student each of her coaches.
  const have = new Set(threads.filter((t) => t.kind === "direct").map((t) => `${t.cohortId}:${t.coachId === actor.personId ? t.studentId : t.coachId}`));
  const startable = people
    .filter((p) => p.personId !== actor.personId)
    .filter((p) => {
      const mine = groups.find((g) => g.cohortId === p.cohortId)!.role;
      return COACH.includes(mine) ? p.role === "student" : mine === "student" && COACH.includes(p.role);
    })
    .filter((p) => !have.has(`${p.cohortId}:${p.personId}`))
    .map((p) => ({ cohortId: p.cohortId, personId: p.personId, firstName: p.firstName, isCoach: COACH.includes(p.role), cohortName: groups.find((g) => g.cohortId === p.cohortId)!.name }));
  return { threads: list, startable };
}

export async function unreadCount(personId: string) {
  const groups = await myGroups(personId);
  if (!groups.length) return 0;
  const [r] = await db
    .select({ n: count() })
    .from(s.chatMessage)
    .innerJoin(s.chatThread, eq(s.chatThread.id, s.chatMessage.threadId))
    .leftJoin(s.chatRead, and(eq(s.chatRead.threadId, s.chatMessage.threadId), eq(s.chatRead.personId, personId)))
    .where(
      and(
        inArray(
          s.chatThread.cohortId,
          groups.map((g) => g.cohortId),
        ),
        or(eq(s.chatThread.kind, "group"), eq(s.chatThread.coachId, personId), eq(s.chatThread.studentId, personId)),
        sql`${s.chatMessage.senderId} <> ${personId}`,
        isNull(s.chatMessage.reportedAt),
        or(isNull(s.chatRead.lastReadAt), gt(s.chatMessage.createdAt, s.chatRead.lastReadAt)),
      ),
    );
  return r?.n ?? 0;
}

/** Open (or find) the private chat between a coach and a student of the same group. */
export async function openDirect(actor: Actor | null, cohortId: string, otherId: string, ip: string | null = null): Promise<Result<{ id: string }>> {
  if (!actor || !isUuid(cohortId) || !isUuid(otherId)) return { ok: false, code: "invalid" };
  const [mine, theirs] = await Promise.all([roleIn(cohortId, actor.personId), roleIn(cohortId, otherId)]);
  if (!mine || !theirs) return { ok: false, code: "not_allowed" };
  const coachId = COACH.includes(mine) && theirs === "student" ? actor.personId : mine === "student" && COACH.includes(theirs) ? otherId : null;
  if (!coachId) return { ok: false, code: "not_allowed" };
  const studentId = coachId === actor.personId ? otherId : actor.personId;
  await db.insert(s.chatThread).values({ kind: "direct", cohortId, coachId, studentId }).onConflictDoNothing();
  const [t] = await db
    .select({ id: s.chatThread.id })
    .from(s.chatThread)
    .where(and(eq(s.chatThread.kind, "direct"), eq(s.chatThread.cohortId, cohortId), eq(s.chatThread.coachId, coachId), eq(s.chatThread.studentId, studentId)));
  await audit(db, { actor, locale: "en", ip }, { action: "chat.open_direct", entityType: "chat_thread", entityId: t!.id, subjectPersonId: studentId });
  return { ok: true, id: t!.id };
}

/** A chat and its messages. Staff reading it is audited. `after` returns only newer messages. */
export async function readThread(actor: Actor | null, threadId: string, after?: Date | null, ip: string | null = null) {
  const a = await access(actor, threadId);
  if (!a) return null;
  const { t } = a;
  const rows = await db
    .select({ id: s.chatMessage.id, senderId: s.chatMessage.senderId, body: s.chatMessage.body, createdAt: s.chatMessage.createdAt, reportedAt: s.chatMessage.reportedAt, firstName: s.person.firstName })
    .from(s.chatMessage)
    .innerJoin(s.person, eq(s.person.id, s.chatMessage.senderId))
    .where(and(eq(s.chatMessage.threadId, t.id), after ? gt(s.chatMessage.createdAt, after) : undefined))
    .orderBy(desc(s.chatMessage.createdAt))
    .limit(after ? 100 : 200);
  const coaches = new Set(
    (
      await db
        .select({ personId: s.cohortMember.personId })
        .from(s.cohortMember)
        .where(and(eq(s.cohortMember.cohortId, t.cohortId), inArray(s.cohortMember.role, ["lead_coach", "assistant_coach"])))
    ).map((x) => x.personId),
  );
  const [g] = await db.select({ name: s.cohort.name }).from(s.cohort).where(eq(s.cohort.id, t.cohortId));
  const pair = t.kind === "direct" ? await db.select({ id: s.person.id, firstName: s.person.firstName }).from(s.person).where(inArray(s.person.id, [t.coachId!, t.studentId!])) : [];
  const nameOf = (id: string | null) => pair.find((p) => p.id === id)?.firstName ?? "";
  const otherId = t.kind === "direct" ? (t.coachId === actor!.personId ? t.studentId : t.coachId) : null;

  if (a.as === "member") {
    await db
      .insert(s.chatRead)
      .values({ threadId: t.id, personId: actor!.personId, lastReadAt: new Date() })
      .onConflictDoUpdate({ target: [s.chatRead.threadId, s.chatRead.personId], set: { lastReadAt: new Date(), updatedAt: new Date() } });
  } else if (!after) {
    await audit(db, { actor, locale: "en", ip }, { action: "chat.view", entityType: "chat_thread", entityId: t.id, subjectPersonId: t.studentId, meta: { kind: t.kind } });
  }

  return {
    id: t.id,
    kind: t.kind,
    cohortId: t.cohortId,
    title: t.kind === "group" ? (g?.name ?? "") : nameOf(otherId),
    coach: nameOf(t.coachId),
    student: nameOf(t.studentId),
    cohortName: g?.name ?? "",
    as: a.as,
    me: actor!.personId,
    messages: rows.reverse().map((m) => ({
      id: m.id,
      mine: m.senderId === actor!.personId,
      sender: m.firstName,
      isCoach: coaches.has(m.senderId),
      createdAt: m.createdAt.toISOString(),
      // Members no longer see a reported message; staff see it, marked.
      body: m.reportedAt && a.as === "member" ? null : plain(m.body),
      reported: !!m.reportedAt,
    })),
  };
}

export async function sendMessage(actor: Actor | null, threadId: string, raw: string): Promise<Result<{ id: string }>> {
  const a = await access(actor, threadId);
  if (!a || a.as !== "member") return { ok: false, code: "not_allowed" };
  const body = raw.trim().slice(0, MAX_LEN);
  if (!body) return { ok: false, code: "empty" };
  const blocked = blockedContent(body);
  if (blocked) return { ok: false, code: `blocked_${blocked}` };
  const now = new Date();
  const [m] = await db.insert(s.chatMessage).values({ threadId, senderId: actor!.personId, body: encrypt(body)!, createdAt: now }).returning({ id: s.chatMessage.id });
  await db.update(s.chatThread).set({ lastMessageAt: now, updatedAt: now }).where(eq(s.chatThread.id, threadId));
  return { ok: true, id: m!.id };
}

/** Report a message: it is hidden at once and a safeguarding case is opened for the leads. */
export async function reportMessage(actor: Actor | null, messageId: string, ip: string | null = null): Promise<Result> {
  if (!actor || !isUuid(messageId)) return { ok: false, code: "invalid" };
  const [m] = await db.select().from(s.chatMessage).where(eq(s.chatMessage.id, messageId));
  if (!m) return { ok: false, code: "not_found" };
  const a = await access(actor, m.threadId);
  if (!a) return { ok: false, code: "not_allowed" };
  if (m.reportedAt) return { ok: true };
  const year = new Date().getFullYear();
  const ids: string[] = [];
  await db.transaction(async (tx) => {
    const [{ n } = { n: 0 }] = await tx
      .select({ n: count() })
      .from(s.safeguardingCase)
      .where(sql`${s.safeguardingCase.reference} like ${`SG-${year}-%`}`);
    const ref = `SG-${year}-${String(n + 1).padStart(4, "0")}`;
    const [c] = await tx
      .insert(s.safeguardingCase)
      .values({
        reference: ref,
        reporterPersonId: actor.personId,
        aboutPersonId: m.senderId,
        subjectPersonId: a.t.studentId,
        cohortId: a.t.cohortId,
        category: "online",
        severity: "medium",
        description: encrypt(`A chat message was reported in the Hub (${a.t.kind} chat). Message ${m.id}.`)!,
        source: "in_app",
      })
      .returning({ id: s.safeguardingCase.id });
    await tx.update(s.chatMessage).set({ reportedBy: actor.personId, reportedAt: new Date(), caseId: c!.id, updatedAt: new Date() }).where(eq(s.chatMessage.id, m.id));
    const leads = await tx
      .select({ id: s.person.id, phone: s.person.phone, email: s.person.email, preferredChannel: s.person.preferredChannel })
      .from(s.personRole)
      .innerJoin(s.person, eq(s.person.id, s.personRole.personId))
      .where(sql`${s.personRole.role} in ('safeguarding_lead','admin') and ${s.personRole.revokedAt} is null`);
    for (const l of leads) {
      const to = reach(l);
      if (!to) continue;
      const id = await queueTemplate(
        { templateKey: "staff.case_new", to: to.to, channel: to.channel, personId: l.id, vars: { reference: ref, severity: "medium", link: `${process.env.APP_URL ?? ""}/console` }, eventKey: `staff.case_new:${c!.id}:${l.id}` },
        tx,
      );
      if (id) ids.push(id);
    }
    await audit(tx, { actor, locale: "en", ip }, { action: "chat.report", entityType: "chat_message", entityId: m.id, subjectPersonId: m.senderId, meta: { caseId: c!.id } });
  });
  await dispatch(ids).catch(() => undefined);
  return { ok: true };
}

/** Every chat of a group, for staff (the console group page). */
export async function groupChats(actor: Actor | null, cohortId: string) {
  if (!(await staffMayRead(actor, cohortId))) return [];
  await groupThread(cohortId);
  const rows = await db
    .select({ id: s.chatThread.id, kind: s.chatThread.kind, coachId: s.chatThread.coachId, studentId: s.chatThread.studentId, lastMessageAt: s.chatThread.lastMessageAt })
    .from(s.chatThread)
    .where(eq(s.chatThread.cohortId, cohortId))
    .orderBy(asc(s.chatThread.kind), desc(s.chatThread.lastMessageAt));
  const ids = [...new Set(rows.flatMap((r) => [r.coachId, r.studentId]).filter((x): x is string => !!x))];
  const names = ids.length ? await db.select({ id: s.person.id, firstName: s.person.firstName }).from(s.person).where(inArray(s.person.id, ids)) : [];
  const reported = await db
    .select({ threadId: s.chatMessage.threadId, n: count() })
    .from(s.chatMessage)
    .where(and(inArray(s.chatMessage.threadId, rows.length ? rows.map((r) => r.id) : ["00000000-0000-0000-0000-000000000000"]), sql`${s.chatMessage.reportedAt} is not null`))
    .groupBy(s.chatMessage.threadId);
  const n = (id: string | null) => names.find((x) => x.id === id)?.firstName ?? "";
  return rows.map((r) => ({ id: r.id, kind: r.kind, coach: n(r.coachId), student: n(r.studentId), lastMessageAt: r.lastMessageAt, reported: reported.find((x) => x.threadId === r.id)?.n ?? 0 }));
}
