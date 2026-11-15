# 03 Auth and permissions

## 1. Sign-in flows

### 1.1 Phone code (students, guardians, volunteers, school champions)
Route `/sign-in`.
1. Enter phone number (Nigerian formats accepted; other countries with `+`). Button "Send my code".
2. Server normalises, applies rate limits, creates a 6-digit code valid 10 minutes, sends by the person's preferred channel if known, else WhatsApp if `WHATSAPP_PROVIDER` is live and the number has opted in, else SMS. Template `auth.otp`.
3. `/sign-in/verify`: six input boxes, auto-submit, "Send again" enabled after 60 s, "Use email instead" link.
4. On success, find the `user` by phone, or create one. Then resolve persons linked to that user:
   - none → route to `/join`;
   - one → set as active person, go to that role's home;
   - several → **profile chooser** `/sign-in/who`: "Who's using the Hub?" with avatar and first name for each. The choice is stored in the session as `activePersonId` and can be switched from the profile menu.
5. Unknown numbers never reveal whether an account exists; the same "We've sent a code if this number can receive one" text is shown.

### 1.2 Email code
Same flow with a 6-digit email code (`auth.otp` email version). Offered to volunteers and champions.

### 1.3 Staff (state_lead, programme_manager, safeguarding_lead, content_editor, admin)
Route `/staff/sign-in`. Email + password (min 12 characters, checked against the top-10k common list), then TOTP at `/staff/two-factor`. First sign-in forces 2-step setup and shows 10 backup codes. Staff accounts are created by invitation only (Admin → Users). Password reset by emailed link valid 30 minutes. Five failed attempts lock the account for 15 minutes and email the user.

### 1.4 Tokens that are not sessions
- Guardian consent link `/consent/[token]`: 32-byte random token, hash stored, valid 14 days, single use for giving consent, reusable for viewing and withdrawing.
- Shared report link `/r/[token]`: read-only, expiry chosen at creation (7, 30, 90 days).
- Certificate check `/verify/certificate/[code]` and receipt check: public, show only name, title, date.

## 2. Session contents

`{ userId, activePersonId, roles: [{role, stateId?}], locale }`. Helper `getActor()` returns `Actor | null` on the server. Guards: `requireActor()`, `requireRole(...roles)`, `requireStaff()`. Layouts for `/app` and `/console` call the guard and redirect to the right sign-in page with `?next=`.

Role → home: student `/app`; guardian `/app/guardian`; volunteer `/app/volunteer`; school_champion `/app/school`; any staff role `/console`. A person with both staff and volunteer roles gets a switcher in the header.

## 3. Roles

| Role | Granted how |
|---|---|
| student | Automatically at intake |
| guardian | Automatically when named in an intake or when giving consent |
| volunteer | Automatically at application (limited until stage `active`) |
| school_champion | By staff, when a school request is accepted |
| state_lead | By admin, with one or more states |
| programme_manager | By admin |
| safeguarding_lead | By admin (max 3 holders) |
| content_editor | By admin; edits website content only |
| admin | By another admin; at least one must always exist |

## 4. Permission model

`can(actor, action, resource?) → boolean` in `src/server/permissions/can.ts`. Actions are strings `module.verb`. Scoping helpers return SQL filters so lists never fetch rows the actor cannot see:

- `scopeStudents(actor)`: staff all (state_lead: `state_id in actor.states`); volunteer: students in cohorts where the volunteer is a current coach; champion: students at their school; guardian: linked students; student: self.
- `scopeSchools`, `scopeCohorts`, `scopeVolunteers` follow the same pattern.

### 4.1 Matrix

Y = allowed, S = allowed within state scope, O = own records only, C = within own cohorts, H = own school, – = denied.

| Action | student | guardian | volunteer | champion | state_lead | prog_mgr | safeguarding | content_ed | admin |
|---|---|---|---|---|---|---|---|---|---|
| person.view_basic (first name, class, school, avatar) | O | O (children) | C | H | S | Y | Y | – | Y |
| person.view_sensitive (surname, DOB, phone, guardian) | O | O | – | – | S | Y | Y | – | Y |
| person.edit | O (limited) | O (children, limited) | O | O | S | Y | – | – | Y |
| person.change_status | – | – | – | – | S | Y | – | – | Y |
| person.import | – | – | – | – | S | Y | – | – | Y |
| intake.review (inbox) | – | – | – | – | S | Y | – | – | Y |
| consent.give / withdraw | – | O | – | – | – | – | – | – | – |
| consent.record_paper / school route | – | – | – | H (enrol list) | S | Y | – | – | Y |
| volunteer.view_applications | – | – | O | – | S | Y | Y | – | Y |
| volunteer.advance_stage | – | – | – | – | S | Y | – | – | Y |
| school.view | – | – | C | H | S | Y | Y | – | Y |
| school.edit / agreement.upload | – | – | – | – | S | Y | – | – | Y |
| cohort.view | O | O | C | H | S | Y | Y | – | Y |
| cohort.manage | – | – | – | – | S | Y | – | – | Y |
| session.manage | – | – | – | – | S | Y | – | – | Y |
| session.mark_held / notes | – | – | C | – | S | Y | – | – | Y |
| attendance.record | – | – | C | – | S | Y | – | – | Y |
| assessment.self | O | – | – | – | – | – | – | – | – |
| assessment.score_rubric | – | – | C | – | S | Y | – | – | Y |
| hours.log | – | – | O | – | – | – | – | – | – |
| hours.approve | – | – | – | – | S | Y | – | – | Y |
| message.send_broadcast | – | – | – | – | S | Y | – | – | Y |
| message.view_log | O | O | O | O | S | Y | Y | – | Y |
| template.edit | – | – | – | – | – | Y | – | – | Y |
| concern.report | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| case.view / manage | – | – | – | – | – | – | Y | – | – |
| case.count | – | – | – | – | – | Y | Y | – | Y |
| impact.view | – | – | O (own hours) | H | S | Y | – | – | Y |
| report.create / share | – | – | – | – | S | Y | – | – | Y |
| content.edit (pages, stories, events, team, partners, gallery, faq) | – | – | – | – | – | Y | – | Y | Y |
| content.publish | – | – | – | – | – | Y | – | Y | Y |
| donation.view | – | – | – | – | – | Y | – | – | Y |
| campaign.manage | – | – | – | – | S | Y | – | Y | Y |
| speech.practice | O (if cohort enabled + ai consent) | – | – | – | – | – | – | – | – |
| speech.view | O | O (scores only) | C (scores + feedback, no audio) | – | S | Y | – | – | Y |
| ai.settings | – | – | – | – | – | Y | – | – | Y |
| user.manage / role.grant | – | – | – | – | – | – | – | – | Y |
| settings.edit | – | – | – | – | – | – | – | – | Y |
| audit.view | – | – | – | – | – | – | Y (child-related) | – | Y |
| data_request.handle | – | – | – | – | – | – | Y | – | Y |

Admins deliberately cannot read safeguarding case content. If the safeguarding lead is unavailable, an admin can grant the role to someone else, which is itself audited and emails all current safeguarding leads.

### 4.2 Field-level rules

- Volunteers and champions receive DTOs built by `toBasicStudent()`: `{id, firstName, avatarKey, classLevel, schoolName, attendancePct, lastScore?}`. Sensitive columns are never selected in those queries.
- Students see coaches as first name + surname initial + avatar/photo; never phone or email.
- Free-text fields that might contain contact details (`anything_else`, `community_dream`) are staff-only.
- Exports (CSV) are staff-only, logged as `export.create` with filter and row count, and exclude phones unless the actor ticks "include contact details" and gives a reason.

### 4.3 Auditing reads

`person.view_sensitive`, `consent.view`, `case.view`, `export.create`, `speech.view` (transcript) write an `audit_event` each time. The person detail page in the console shows "Viewed by" history to safeguarding leads and admins.

## 5. Account lifecycle

- **Invite staff**: admin enters name, email, role(s), states → email `staff.invite` with a 72-hour link to set password and 2-step.
- **Deactivate**: revokes sessions and roles; person record kept.
- **Phone number change**: person requests in profile → code to the new number → staff notified if the person is a guardian (consent records keep the old number).
- **Merge duplicates** (staff): choose the surviving person; memberships, attendance, assessments, messages and consents move; audit event records both IDs.
- **Turning 18**: a daily job flags students whose 18th birthday passed; next sign-in asks them to confirm their own consent (`self_adult`) and their own phone number.
