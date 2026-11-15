# 07 Console (`/console`)

Desktop-first but usable on a phone. Left sidebar groups: **Work** (Home, Inbox, Tasks) · **People** (Students, Volunteers, Schools) · **Programmes** (Programmes, Cohorts, Sessions) · **Messages** · **Impact** (Dashboard, Map, Reports) · **Website** (Pages, Stories, Events, Team, Partners, Gallery, FAQs, Press & downloads, Campaigns, Contact messages, Newsletter) · **Donations** · **AI coach** (P2) · **Safeguarding** (leads only) · **Admin**. Items are hidden when the actor lacks permission. A state filter in the top bar (state leads see only their states; others can pick "All states") applies to every list. Global search (Ctrl/Cmd+K) finds people by first name, schools, cohorts.

All lists: server-side pagination (25), sort, filters in the URL, saved filter chips, CSV export (spec/03 §4.2), bulk-select actions. All destructive actions ask for confirmation and are audited.

## 1. Home `/console`
Tiles: new sign-ups waiting, guardians not yet consented, volunteers awaiting action (by stage), sessions today/this week, sessions held without attendance, open tasks, message failures (24 h). Chart: sign-ups per week by type (12 weeks). List: next 10 sessions. Safeguarding leads also see open case count by severity.

## 2. Inbox `/console/inbox`
Tabs **Students · Volunteers · Schools · Contact**. Each row is one item needing a decision, oldest first, with age badge (amber > 2 days, red > 5).

**Student item** (opens a side panel): answers, school, consent status, duplicate warning if any, **suggestion**: the best open cohort (rule below) or "No group at this school yet (n waiting)". Actions: **Assign to cohort** (select, default = suggestion) → status `active`, add `cohort_member`, send `student.placed`; **Waitlist** → `waitlisted`, send `student.waitlisted`; **Needs follow-up** (note + task); **Decline** (reason; sends `student.declined` to guardian). Bulk: select many from one school → "Create cohort from selection".

Student → cohort suggestion: cohorts with status `open` or `running` (running only if ≤ 2 sessions held), same school, programme in her `programme_ids`, members < capacity; prefer earliest `starts_on`. If none and waitlisted students at that school for that programme ≥ `settings.min_cohort_size` (default 15) → task `waitlist_ready`.

**Volunteer item**: application, references, stage controls (§4). **School item**: request details; actions Accept (creates champion, sets partnership, generates agreement PDF), Mark contacted, Decline. **Contact item**: message; actions Reply by email (opens composer), Close.

## 3. Students `/console/people`, `/console/people/[id]`
List columns: first name, surname (permission), age, class, school, LGA, programme(s), cohort, status, consent, joined. Filters: status, state, LGA, school, programme, cohort, consent state, age band, gender, source campaign, joined date.

Detail tabs:
- **Overview**: profile, status with change control, guardian(s) with consent states and "Resend request" / "Record paper consent" / "Reissue link", intake answers, source campaign.
- **Groups**: memberships, attendance %, move to another cohort, remove (reason).
- **Progress**: baseline, endline, rubric scores, speech attempts (P2).
- **Messages**: log with status; "Send a message" (template or free text within the 24-hour WhatsApp window, else SMS).
- **Notes**: staff notes.
- **History**: audit events about this person (leads and admins).
Actions: Edit, Merge with…, Export data, Anonymise (admin, via data request).

**Import** `/console/people/import`: upload CSV using the provided template; map columns; preview with row-level validation; choose consent basis (school agreement required for under-18s); run as job `import.people`; result with error rows downloadable.

## 4. Volunteers `/console/volunteers`, `/[id]`
Board view by stage (applied, references_pending, interview, training, active) and a table view (also paused, declined, left). Detail: application, references (log call outcome per reference), interview notes, training progress, code of conduct, ID document, cohorts, hours, certificates, messages.

Stage transitions and their effects:
| From → To | Requires | Effect |
|---|---|---|
| applied → references_pending | – | tasks for each reference |
| references_pending → interview | both references `positive` (or override with reason) | message `volunteer.interview_invite` |
| interview → training | interview notes saved | message `volunteer.training_invite` |
| training → active | required modules passed + code of conduct signed (hard requirement, no override) | message `volunteer.activated`; appears in matching |
| any → declined | reason | message `volunteer.declined` |
| active ↔ paused | reason | removed from future `session_coach`; staff task to re-cover sessions |
| any → left | reason | ends memberships |

**Volunteer → cohort matching** (shown when assigning coaches): candidates are `active`, in the cohort's state, with current running cohorts < `max_cohorts`. Score: same LGA or LGA in `can_travel_lgas` +30; a skill matching the programme kind +25; availability covers the cohort's meeting day and part of day +25; speaks the majority preferred language of the cohort's students +10; is an alumna of the school +10. Show top 10 with score reasons. Staff choose one `lead_coach` and up to `settings.max_assistant_coaches` (default 3).

Hours approval queue: pending manual entries with approve/reject.

## 5. Schools `/console/schools`, `/[id]`
List: name, LGA, ownership, partnership status, cohorts, students reached, champion. Filters: state, LGA, partnership, ownership, has waitlist. Detail: profile, EduTracka figures, champion, agreement (upload PDF/image, signed by, dates, covers consent), cohorts, students, waitlist count, requests, notes. Actions: Add school (unverified schools from "not listed" appear in a review queue: Verify as new, or Merge into existing), Create cohort here.

**School import** `scripts/import-schools.ts` and a console upload: CSV/JSON from EduTracka with `edutracka_id, name, state, lga, town, ownership, level, enrolment_girls, enrolment_boys`; upsert by `edutracka_id`. LGA indicator import likewise.

## 6. Programmes `/console/programmes`
List and edit programme fields, enrolling toggle, age range, default number of sessions, rubric, lesson plans (ordered list with Tiptap coach notes). Seeded programmes: spec/14 §5.

## 7. Cohorts `/console/cohorts`, `/[id]`
Create: programme, school, term, start date, meeting day and time, venue, capacity, number of sessions → generates weekly `session` rows with lesson plans in order (skipping dates in `settings.holidays`). Status flow: draft → open (accepting students) → running (first session held or manual) → completed / cancelled.

Detail tabs: **Overview** (status control, key numbers, checklist: coaches assigned, ≥ min students, sessions scheduled), **Students** (add from waitlist, remove, attendance grid student × session), **Coaches** (matching panel), **Sessions** (reschedule, cancel with reason and optional message `session.cancelled`, add extra), **Assessments** (baseline/endline completion, rubric scores, export), **Messages** (broadcast to this cohort), **AI coach** (P2 toggles: enabled, pilot group).

Close cohort: applies rule 4 of spec/02 §15, sends `student.completed` with certificate link and endline prompt, sends coaches `volunteer.cohort_closed`.

## 8. Sessions `/console/sessions`
Calendar (month, week, list) filterable by state, school, coach. Session detail: same as the volunteer view plus edit, coach assignment, attendance override. A daily check creates task `no_attendance` for sessions `held` or past with no attendance after 48 h.

## 9. Messages `/console/messages`
Spec/08. Screens: Log (all messages with filters), New broadcast, Scheduled, Templates.

## 10. Impact `/console/impact`, `/impact/map`, `/reports`
Spec/10.

## 11. Website content `/console/content/*`
- **Pages**: list of `content_page`; editor with block list on the left (add, drag to reorder, duplicate, delete), block form on the right with EN/YO tabs, live preview button (opens `/?preview=token`), Save draft / Publish, version history (last 10 saved JSON snapshots, restore).
- **Stories**: list; editor with title, slug (auto), excerpt, cover (upload with required alt), Tiptap body (headings, bold, italic, lists, links, images, quotes, YouTube embed), programme, tags, author, "This story features a child" → must select the child and confirm consent, schedule or publish.
- **Events**: fields per spec/02; registrations tab with export and check-in tick.
- **Team, Partners, FAQs, Press & downloads, Gallery**: simple CRUD with drag sorting and visibility toggles. Gallery upload requires alt text and a consent note per batch.
- **Campaigns**: create (name, medium, target) → generates `/c/{code}` link and a downloadable QR PNG/SVG; table shows clicks, sign-ups, conversion.
- **Contact messages**, **Newsletter** (subscriber count, export, compose a newsletter email to confirmed subscribers via SES with unsubscribe link).
- **Site settings**: organisation name, address, phone, email, WhatsApp link, socials, CAC number, bank details, announcement bar, default OG image, footer text, signature image and signatory for certificates.

## 12. Donations `/console/donations`
Spec/11: list, filters, supporter page, totals by month and programme, export, resend receipt, refund note.

## 13. Tasks `/console/tasks`
My tasks / All (by state). Task kinds are created automatically (spec/02 §13) with a `dedupe_key`, or manually. Each links to its entity. Staff digest email (weekdays 08:00) lists open tasks and inbox counts to each staff member with any.

## 14. Admin
- **Users** `/console/admin/users`: staff list, invite, edit roles and states, deactivate, reset 2-step.
- **Settings** `/console/admin/settings` (table `setting`), with defaults:

| key | default |
|---|---|
| `min_cohort_size` | 15 |
| `default_cohort_capacity` | 30 |
| `max_assistant_coaches` | 3 |
| `completion_attendance_pct` | 70 |
| `consent_token_days` | 14 |
| `consent_reminder_days` | [2, 6] |
| `session_reminder_hours` | [24, 2] |
| `quiet_student_days` | 14 |
| `holidays` | [] (date ranges) |
| `certificate_min_hours` | 10 |
| `ai_monthly_attempt_cap` | 20 |
| `ai_max_seconds` | 150 |
| `aws_monthly_budget_usd` | 150 |
| `messaging_monthly_budget_ngn` | 100000 |
| `whatsapp_unit_cost_ngn`, `sms_unit_cost_ngn` | 10, 6 (**CONFIRM**) |
| `retention` | see spec/09 §6 |
| `privacy_version`, `conduct_version` | "1.0" |
| `enabled_locales` | ["en","yo"] |
| `safeguarding_contacts` | [] (names shown on the report page) |
- **Languages**: count of unreviewed Yoruba strings; download/upload of translation JSON.
- **Audit log**: filter by actor, action, subject, date; read-only.
- **System health**: spec/01 §12.
- **Data requests**: queue with verify → run export or erase job → mark done.
