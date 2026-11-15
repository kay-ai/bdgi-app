import { eq } from "drizzle-orm";
import { db, schema as s } from "../src/db";
import * as data from "../src/server/seed/data";
import { messageTemplates } from "../src/server/seed/templates";

const DEMO = process.env.SEED_DEMO !== "false" && process.env.NODE_ENV !== "production";

async function main() {
  // States and LGAs
  for (const st of data.states) {
    await db
      .insert(s.state)
      .values({ code: st.code, name: st.name, isActive: !!st.active })
      .onConflictDoNothing({ target: s.state.code });
  }
  const stateRows = await db.select().from(s.state);
  const stateByCode = Object.fromEntries(stateRows.map((r) => [r.code, r]));
  for (const code of ["OY", "OS"] as const) {
    for (const name of data.lgas[code]) {
      await db
        .insert(s.lga)
        .values({ stateId: stateByCode[code]!.id, name, geoCode: data.geoCode(code, name) })
        .onConflictDoNothing({ target: s.lga.geoCode });
    }
  }
  const lgaRows = await db.select().from(s.lga);
  const lgaByName = Object.fromEntries(lgaRows.map((r) => [r.name, r]));

  // Rubric
  let [rubric] = await db.select().from(s.rubric).where(eq(s.rubric.name, "Speaking and debate v1"));
  if (!rubric) {
    [rubric] = await db
      .insert(s.rubric)
      .values({ name: "Speaking and debate v1", version: 1, criteria: data.rubricCriteria })
      .returning();
  }

  // Programmes and lesson plans
  for (const p of data.programmes) {
    await db
      .insert(s.programme)
      .values({ ...p, rubricId: p.kind === "debate" ? rubric!.id : null, status: "published" })
      .onConflictDoNothing({ target: s.programme.slug });
  }
  const progRows = await db.select().from(s.programme);
  const progBySlug = Object.fromEntries(progRows.map((r) => [r.slug, r]));
  const debate = progBySlug["debate-and-public-speaking"]!;
  for (const [i, title] of data.lessonPlans.entries()) {
    await db
      .insert(s.lessonPlan)
      .values({
        programmeId: debate.id,
        position: i + 1,
        titleEn: title,
        objectives: "Coach notes to be added by BGDI",
        durationMinutes: 60,
      })
      .onConflictDoNothing();
  }

  // Historical impact (CONFIRM breakdown with BGDI)
  const existingHist = await db.select().from(s.historicalImpact);
  if (existingHist.length === 0) {
    await db.insert(s.historicalImpact).values([
      {
        year: 2025,
        programmeId: debate.id,
        stateId: stateByCode.OY!.id,
        students: 2000,
        schools: 85,
        volunteers: 200,
        sourceNote: "BGDI programme records 2021–2026, as presented October 2026",
      },
      {
        year: 2025,
        programmeId: progBySlug["inspire-her-future"]!.id,
        stateId: stateByCode.OY!.id,
        students: 92,
        girls: 92,
        schools: 9,
        volunteers: 0,
        sourceNote: "Inspire Her Future, inaugural edition",
      },
    ]);
  }

  // Team, partners, FAQs, motions
  if ((await db.select({ id: s.teamMember.id }).from(s.teamMember)).length === 0) {
    await db.insert(s.teamMember).values(
      data.team.map((t, i) => ({ name: t.name, titleEn: t.title, group: t.group, sort: i, isVisible: true })),
    );
  }
  if ((await db.select({ id: s.partner.id }).from(s.partner)).length === 0) {
    await db
      .insert(s.partner)
      .values(data.partners.map((p, i) => ({ name: p.name, kind: p.kind, sort: i, isVisible: false })));
  }
  if ((await db.select({ id: s.faq.id }).from(s.faq)).length === 0) {
    await db.insert(s.faq).values(
      data.faqs.map((f, i) => ({ audience: f.audience, questionEn: f.q, answerEn: { text: f.a }, sort: i })),
    );
  }
  if ((await db.select({ id: s.motion.id }).from(s.motion)).length === 0) {
    await db.insert(s.motion).values(data.motions.map((m) => ({ textEn: m, programmeId: debate.id })));
  }

  // Settings, templates, redirects
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
  for (const [from, to, code] of data.redirects) {
    await db
      .insert(s.redirect)
      .values({ fromPath: from, toPath: to, statusCode: code ?? 301 })
      .onConflictDoNothing({ target: s.redirect.fromPath });
  }

  // Demo schools (local and staging only)
  if (DEMO) {
    for (const sc of data.demoSchools) {
      const l = lgaByName[sc.lga]!;
      const exists = await db.select({ id: s.school.id }).from(s.school).where(eq(s.school.name, sc.name));
      if (exists.length === 0) {
        await db.insert(s.school).values({
          name: sc.name,
          stateId: l.stateId,
          lgaId: l.id,
          town: sc.town,
          ownership: "public",
          level: "combined_secondary",
          partnershipStatus: "active",
          notes: "is_demo",
        });
      }
    }
  }

  console.log(`Seed complete${DEMO ? " (with demo schools)" : ""}.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
