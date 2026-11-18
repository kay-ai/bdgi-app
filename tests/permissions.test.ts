import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ACTIONS, MATRIX, can, homeFor, type Actor, type Grant, type Resource, type Role } from "@/server/permissions/can";

/**
 * M3 acceptance 1 (spec/14): every role × action of the spec/03 §4.1 table, read from the spec
 * itself so the code and the document cannot drift apart.
 */
const COLUMNS: Record<string, Role> = {
  student: "student",
  guardian: "guardian",
  volunteer: "volunteer",
  champion: "school_champion",
  state_lead: "state_lead",
  prog_mgr: "programme_manager",
  safeguarding: "safeguarding_lead",
  content_ed: "content_editor",
  admin: "admin",
};

function parseSpecMatrix() {
  const md = readFileSync("spec/03-auth-permissions.md", "utf8");
  const section = md.slice(md.indexOf("### 4.1 Matrix"), md.indexOf("### 4.2"));
  const lines = section.split("\n").filter((l) => l.startsWith("|"));
  const header = lines[0]!.split("|").slice(2, -1).map((c) => c.trim());
  const roles = header.map((h) => COLUMNS[h]!);
  const rows: { action: string; grants: Record<string, Grant> }[] = [];
  for (const line of lines.slice(2)) {
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    const name = cells[0]!.replace(/\s*\(.*\)\s*$/, "");
    const grants = Object.fromEntries(
      cells.slice(1).map((c, i) => [roles[i]!, (c.startsWith("–") || c.startsWith("-") ? "-" : c[0]) as Grant]),
    );
    // "consent.give / withdraw" → consent.give, consent.withdraw; "school.edit / agreement.upload" as written.
    const parts = name.split("/").map((p) => p.trim());
    const module = parts[0]!.split(".")[0]!;
    for (const p of parts) {
      if (/\s/.test(p)) continue; // descriptive tails like "school route" are not actions
      rows.push({ action: p.includes(".") ? p : `${module}.${p}`, grants });
    }
  }
  return { roles, rows };
}

const { roles: ROLE_COLUMNS, rows: SPEC } = parseSpecMatrix();

const ME = "00000000-0000-7000-8000-00000000000a";
const CHILD = "00000000-0000-7000-8000-00000000000b";
const OTHER = "00000000-0000-7000-8000-00000000000c";
const actorWith = (role: Role): Actor => ({
  userId: "00000000-0000-7000-8000-000000000001",
  personId: ME,
  firstName: "Test",
  roles: [{ role, stateId: role === "state_lead" ? "state-in" : null }],
  childIds: [CHILD],
  coachCohortIds: ["cohort-in"],
  championSchoolIds: ["school-in"],
});
const inScope = (role: Role): Resource => ({
  personId: role === "guardian" ? CHILD : ME,
  stateId: "state-in",
  schoolId: "school-in",
  cohortIds: ["cohort-in"],
  aiReady: true,
});
const outOfScope: Resource = { personId: OTHER, stateId: "state-out", schoolId: "school-out", cohortIds: ["cohort-out"], aiReady: true };

describe("permission matrix (spec/03 §4.1)", () => {
  it("parses all nine roles and every action row", () => {
    expect(ROLE_COLUMNS).toHaveLength(9);
    expect(SPEC.length).toBeGreaterThanOrEqual(45);
  });

  it("has exactly the spec's actions, with the spec's grants", () => {
    expect([...ACTIONS].sort()).toEqual(SPEC.map((r) => r.action).sort());
    for (const r of SPEC) expect(MATRIX[r.action], r.action).toEqual(r.grants);
  });

  const cases = SPEC.flatMap((r) => ROLE_COLUMNS.map((role) => ({ action: r.action, role, grant: r.grants[role]! })));

  it.each(cases)("$role · $action · $grant", ({ action, role, grant }) => {
    const actor = actorWith(role);
    // Y: always. S/O/C/H: only inside the actor's scope. -: never.
    expect(can(actor, action, inScope(role))).toBe(grant !== "-");
    expect(can(actor, action, outOfScope)).toBe(grant === "Y");
    // With no record, the question is "may they do this at all?" (menus, page guards).
    expect(can(actor, action)).toBe(grant !== "-");
  });

  it("speech.practice also needs the cohort's AI coach and the AI consent", () => {
    const student = actorWith("student");
    expect(can(student, "speech.practice", { personId: ME, aiReady: true })).toBe(true);
    expect(can(student, "speech.practice", { personId: ME, aiReady: false })).toBe(false);
  });

  it("denies unknown actions and anonymous actors", () => {
    expect(can(actorWith("admin"), "nothing.here")).toBe(false);
    expect(can(null, "concern.report")).toBe(false);
  });

  it("a guardian's own records are their children's, not other students'", () => {
    const g = actorWith("guardian");
    expect(can(g, "person.view_sensitive", { personId: CHILD })).toBe(true);
    expect(can(g, "person.view_sensitive", { personId: OTHER })).toBe(false);
  });

  it("sends each role to its home", () => {
    expect(homeFor(["admin"])).toBe("/console");
    expect(homeFor(["volunteer", "guardian"])).toBe("/app/volunteer");
    expect(homeFor(["school_champion"])).toBe("/app/school");
    expect(homeFor(["guardian"])).toBe("/app/guardian");
    expect(homeFor(["student"])).toBe("/app");
    expect(homeFor([])).toBe("/join");
  });
});
