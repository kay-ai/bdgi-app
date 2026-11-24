/**
 * Permission model (spec/03 §4). `can(actor, action, resource?)` is pure: everything it needs about
 * the actor (roles, states, children, cohorts they coach, schools they champion) is loaded once
 * into the Actor by `loadActor()`, and the caller describes the resource. Lists use the SQL
 * scopes in `scope.ts` so they never fetch rows the actor cannot see.
 */

export const ROLES = [
  "student",
  "guardian",
  "volunteer",
  "school_champion",
  "state_lead",
  "programme_manager",
  "safeguarding_lead",
  "content_editor",
  "admin",
] as const;
export type Role = (typeof ROLES)[number] | "ekodara_officer";

export const STAFF_ROLES = ["state_lead", "programme_manager", "safeguarding_lead", "content_editor", "admin"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export type RoleGrant = { role: Role; stateId: string | null };

export type Actor = {
  userId: string;
  personId: string;
  firstName: string;
  roles: RoleGrant[];
  /** Students this person is the guardian of. */
  childIds: string[];
  /** Cohorts where this person is a current lead or assistant coach. */
  coachCohortIds: string[];
  /** Schools where this person is the champion. */
  championSchoolIds: string[];
};

/**
 * What the action is about. Leave it out to ask "may this actor do this at all?" (e.g. whether to
 * show a menu item); pass it to check one record.
 */
export type Resource = {
  /** The person the record belongs to or is about. */
  personId?: string | null;
  stateId?: string | null;
  schoolId?: string | null;
  cohortIds?: string[];
  /** For `speech.practice`: AI practice consent is given (the coach is never switched per group, D-015). */
  aiReady?: boolean;
};

/** Y allowed · S within the actor's states · O own records · C own cohorts · H own school · - denied. */
export type Grant = "Y" | "S" | "O" | "C" | "H" | "-";

const COLS = ["student", "guardian", "volunteer", "school_champion", "state_lead", "programme_manager", "safeguarding_lead", "content_editor", "admin"] as const;

/** spec/03 §4.1, one row per action, columns in the order of `COLS`. */
const TABLE: Record<string, string> = {
  "person.view_basic": "O O C H S Y Y - Y",
  "person.view_sensitive": "O O - - S Y Y - Y",
  "person.edit": "O O O O S Y - - Y",
  "person.change_status": "- - - - S Y - - Y",
  "person.import": "- - - - S Y - - Y",
  "intake.review": "- - - - S Y - - Y",
  "consent.give": "- O - - - - - - -",
  "consent.withdraw": "- O - - - - - - -",
  "consent.record_paper": "- - - H S Y - - Y",
  "volunteer.view_applications": "- - O - S Y Y - Y",
  "volunteer.advance_stage": "- - - - S Y - - Y",
  "school.view": "- - C H S Y Y - Y",
  "school.edit": "- - - - S Y - - Y",
  "agreement.upload": "- - - - S Y - - Y",
  "cohort.view": "O O C H S Y Y - Y",
  "cohort.manage": "- - - - S Y - - Y",
  "session.manage": "- - - - S Y - - Y",
  "session.mark_held": "- - C - S Y - - Y",
  "session.notes": "- - C - S Y - - Y",
  "attendance.record": "- - C - S Y - - Y",
  "assessment.self": "O - - - - - - - -",
  "assessment.score_rubric": "- - C - S Y - - Y",
  "hours.log": "- - O - - - - - -",
  "hours.approve": "- - - - S Y - - Y",
  "message.send_broadcast": "- - - - S Y - - Y",
  "message.view_log": "O O O O S Y Y - Y",
  "template.edit": "- - - - - Y - - Y",
  "concern.report": "Y Y Y Y Y Y Y Y Y",
  "case.view": "- - - - - - Y - -",
  "case.manage": "- - - - - - Y - -",
  "case.count": "- - - - - Y Y - Y",
  "impact.view": "- - O H S Y - - Y",
  "report.create": "- - - - S Y - - Y",
  "report.share": "- - - - S Y - - Y",
  "content.edit": "- - - - - Y - Y Y",
  "content.publish": "- - - - - Y - Y Y",
  "donation.view": "- - - - - Y - - Y",
  "campaign.manage": "- - - - S Y - Y Y",
  "speech.practice": "O - - - - - - - -",
  "speech.view": "O O C - S Y - - Y",
  "ai.settings": "- - - - - Y - - Y",
  "user.manage": "- - - - - - - - Y",
  "role.grant": "- - - - - - - - Y",
  "settings.edit": "- - - - - - - - Y",
  "audit.view": "- - - - - - Y - Y",
  "data_request.handle": "- - - - - - Y - Y",
};

export type Action = keyof typeof TABLE;

export const MATRIX: Record<string, Partial<Record<Role, Grant>>> = Object.fromEntries(
  Object.entries(TABLE).map(([action, row]) => {
    const cells = row.split(" ") as Grant[];
    return [action, Object.fromEntries(COLS.map((r, i) => [r, cells[i]!]))];
  }),
);

export const ACTIONS = Object.keys(TABLE);

/** `donation.manage` (resend receipt, offline gift, refund) follows `donation.view` until spec/03 says otherwise. */
const ALIASES: Record<string, string> = { "donation.manage": "donation.view" };

function grantAllows(g: Grant, grant: RoleGrant, actor: Actor, action: string, r?: Resource): boolean {
  if (g === "-") return false;
  if (!r) return true;
  switch (g) {
    case "Y":
      return true;
    case "S": {
      const states = actor.roles.filter((x) => x.role === "state_lead" && x.stateId).map((x) => x.stateId);
      return !!r.stateId && states.includes(r.stateId);
    }
    case "O": {
      if (action === "speech.practice" && r.aiReady !== true) return false;
      if (!r.personId) return false;
      if (r.personId === actor.personId) return true;
      // A guardian's "own records" are their children's.
      return grant.role === "guardian" && actor.childIds.includes(r.personId);
    }
    case "C":
      return !!r.cohortIds?.some((c) => actor.coachCohortIds.includes(c));
    case "H":
      return !!r.schoolId && actor.championSchoolIds.includes(r.schoolId);
  }
}

export function can(actor: Actor | null, action: string, resource?: Resource): boolean {
  if (!actor) return false;
  const row = MATRIX[ALIASES[action] ?? action];
  if (!row) return false; // unknown actions are denied
  return actor.roles.some((grant) => {
    const g = row[grant.role];
    return g ? grantAllows(g, grant, actor, action, resource) : false;
  });
}

export const hasRole = (actor: Actor | null, ...roles: Role[]) => !!actor?.roles.some((r) => roles.includes(r.role));
export const isStaff = (actor: Actor | null) => hasRole(actor, ...STAFF_ROLES);
export const actorStates = (actor: Actor) => actor.roles.filter((r) => r.role === "state_lead" && r.stateId).map((r) => r.stateId!);

/** Role → home (spec/03 §2). Staff go to the console; otherwise the most specific Hub area. */
export function homeFor(roles: Role[]): string {
  if (roles.some((r) => (STAFF_ROLES as readonly string[]).includes(r))) return "/console";
  if (roles.includes("volunteer")) return "/app/volunteer";
  if (roles.includes("school_champion")) return "/app/school";
  if (roles.includes("guardian")) return "/app/guardian";
  if (roles.includes("student")) return "/app";
  return "/join";
}
