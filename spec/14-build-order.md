# 14 Design system, build order, seed data, tests

## 1. Design system

The design system is defined in [DESIGN.md](../DESIGN.md), which wins over this file on colour, type, spacing, components, copy and motion. Summary for builders:

- **Colour**: cream ground `#FBF7EF`, surface `#F1EADC`, ink `#1A1712`, muted `#67635C`, gold accent `#FFB800` with `#111111` text on it. Primary buttons are ink on light grounds and gold on dark. Gold is never text or a link on a light ground. No gradients, no violet. App-only status colours: success `#1F7A5A`, danger `#B3261E`.
- **Type**: Source Serif 4 (headings, weight 400) and Libre Franklin (text, 400 and 500), self-hosted with `next/font`. Never Poppins, Inter or weight 700.
- **Shape**: radius 8 / 12 / 20; spacing scale 4, 8, 12, 16, 24, 32, 48, 64, 96, 128; 1px hairlines at 12% ink; no shadows at rest.
- **Icons**: Lucide line icons in ink in the app and console. No emoji anywhere in the interface or in messages. Real product marks in their own colours on the website.
- **Website**: built to the tasteskill rules (kind: service). One section per screen, equal edges, hover layer only, no scroll animation, no animation library, figures static in the HTML.
- **App**: Motion (Framer Motion) only under `/join` and `/app`, with three orchestrated moments (intake done, scorecard, certificate). No confetti, no bounce.
- **3D**: only the optional "View in 3D" reach map on `/impact` (MapLibre extrusion), with a server-drawn SVG map as the default and fallback.
- **Components** (`src/components/ui`): Button (primary, text-link secondary, destructive), Input, Textarea, Select, Combobox, Chips, Stepper, Progress line, Circle scale (five circles, no faces), Three-part switch (attendance), Card, Status word with dot, Tabs, Dialog, Sheet, Toast, Table, Pagination, Empty state, Avatar (24 silhouettes), Static placeholder, Banner, Date picker, File upload, Rich text editor, Block editor.
- **Voice**: plain, short sentences, second person, sentence case. "Group" not "cohort" and "permission" not "consent" on student and guardian screens.

## 2. Milestones

Build strictly in this order. "Done" means the acceptance tests pass in CI and on staging.

### M0 Foundation
Repo, tooling, Docker Compose, SST skeleton, Drizzle with all P1 tables and enums, seed script, design tokens and UI kit, i18n wiring, layouts for site/join/app/console, health endpoint, CI.
- ✔ `pnpm dev` runs with seed data; `pnpm test` passes; staging deploys.
- ✔ Language switch changes every visible string on the sample pages.

### M0b Design masters
Static HTML masters of the home page, one programme page, `/impact` and `/donate`, built from the tasteskill starter in `design/masters/` (DESIGN.md §13). The app UI kit and the 24 avatars.
- ✔ `consistency.mjs`, `layout/check.mjs` and `perf.mjs` report no FAIL on each master at 1440, 1024, 820, 768 and 390 (any finding judged false is listed with its reason).
- ✔ BGDI has reviewed the masters, the copy and the photograph list.
- ✔ Both fonts draw Yoruba letters correctly.

### M1 Website (P1a)
Content tables and block renderer; all pages in spec/04; console content editors; media upload pipeline; campaigns; contact, newsletter, partner forms; redirects; SEO; public impact API reading `historical_impact`.
- ✔ Every URL in the sitemap renders in `en` and `yo` with no placeholder template text.
- ✔ An editor creates a story with a cover image and publishes it; it appears on `/stories` and the home page within 5 minutes.
- ✔ All old WordPress paths in spec/04 §8 return 301 to the right page.
- ✔ Lighthouse mobile performance ≥ 90 and zero serious axe violations on `/`, `/impact`, `/programmes/debate-and-public-speaking`, `/donate`.
- ✔ `/c/{code}` records a click and the following sign-up carries the campaign.

### M2 Donations
Spec/11.
- ✔ A test-mode NGN donation completes, the webhook marks it paid, a receipt PDF is emailed, and it appears in the console; replaying the webhook does not duplicate anything.
- ✔ A tampered webhook signature is rejected with 401.

### M3 Auth and permissions
Better Auth, phone and email codes, staff password + 2-step, profile chooser, guards, `can()`, scopes, audit.
- ✔ Table-driven permission test covers every role × action in spec/03 §4.1.
- ✔ A volunteer API response for a student never contains surname, phone, DOB or guardian fields (asserted by schema test).
- ✔ One phone linked to a guardian and two children shows the chooser.

### M4 Join and consent
Spec/05; messaging core (spec/08 §1–4) with console providers; consent page; reminders.
- ✔ A student completes intake on a 360 px viewport in under 3 minutes (Playwright), with the network turned off for steps 2–4 and restored before submit.
- ✔ Guardian opens the link, enters the code, gives permission; student status becomes `pending_review`; four consent types stored correctly.
- ✔ Wrong code five times locks the code; withdrawal removes the student from cohorts and stops messages.
- ✔ Duplicate submission does not create a second person.
- ✔ First outbound message is queued within 5 seconds of submit.

### M5 Console core
Home, inbox, people, schools (with EduTracka import), programmes, cohorts, sessions, tasks, import.
- ✔ Staff place 20 waitlisted students from one school into a new cohort in one action; `student.placed` is sent once to each.
- ✔ A state lead for Oyo cannot see or fetch an Osun student by URL.
- ✔ Cohort creation generates the right number of weekly sessions, skipping holidays.

### M6 Volunteers and Hub app
Volunteer pipeline, training modules and quiz, code of conduct, matching, volunteer app, offline attendance, hours, certificates, student and guardian screens, endline.
- ✔ A volunteer cannot be assigned to a cohort before training is passed and conduct is signed (service rejects even with a forged request).
- ✔ Attendance taken offline for 30 students syncs when back online with no duplicates; a second device's later edit wins.
- ✔ Marking a session held creates approved hours; certificate PDF verifies at its public URL.
- ✔ Student home shows the correct card for each status.

### M7 Safeguarding and privacy
Spec/09.
- ✔ An anonymous public report creates a case and notifies leads; an admin without the safeguarding role gets 403 on the case page and API.
- ✔ Every sensitive read appears in the audit log.
- ✔ Retention sweep anonymises an eligible test record and impact counts are unchanged.
- ✔ Data export ZIP contains the person's data and nothing about anyone else.

### M8 Messaging live, broadcasts, automations
Real providers, webhooks, broadcasts, cron jobs.
- ✔ Session reminders go out once per person per session at 24 h and 2 h (idempotency test with the cron fired twice).
- ✔ STOP opts a number out and subsequent non-essential sends are `skipped`.
- ✔ A WhatsApp failure falls back to SMS.
- ✔ A state lead cannot broadcast outside their state.

### M9 Impact and reports
Spec/10; live website counters and map switch from historical-only to combined.
- ✔ Metric unit tests against a fixture with known answers for every metric in spec/10 §3.
- ✔ Public endpoints never return a count under 5 as a number.
- ✔ A report generates PDF and CSV; the narrative cannot be shared until approved; a number not in the data is highlighted.

### M10 Launch
WordPress cutover (spec/04 §8), production secrets, WhatsApp templates approved, DPIA completed by BGDI, staff guide and runbook written, training session with Fatimah's team, backup restore tested.
- ✔ Full journey on production with a staff test family, then data removed.

### M11 AI speech coach (P2)
Spec/12, in order: recording UI → upload → transcribe → metrics → scoring → scorecard → coach views → controls → WhatsApp bot → pilot comparison.
- ✔ Metrics unit tests with fixture word lists; ✔ invalid model JSON falls back gracefully; ✔ audio object is gone after scoring; ✔ a student without `ai_practice` consent is refused by the API; ✔ a transcript containing "ignore your instructions" does not change the output format; ✔ cap enforced.

### M12+ Phase 3
One module at a time in this order: school champion portal → competition manager (before the October competition) → learning paths → mentoring → Èkó Dára → grants. Each needs its own acceptance list written before work starts, following the pattern above.

## 3. Definition of done (every feature)

Server-side permission check and test · zod validation shared client/server · audit events where required · strings in `en.json` and `yo.json` · works at 360 px and with keyboard only · loading, empty and error states · unit/integration tests · e2e if it is a listed journey · no PII in logs · documented in the staff guide if staff-facing.

## 4. Deliverables besides code

`README.md` (setup, deploy, runbook: rotate keys, restore backup, handle a failed job, add a state), `docs/staff-guide.md` (task-based, with screenshots), `docs/dpia.md` template, `docs/whatsapp-templates.md` (exact text to submit to Meta), `DECISIONS.md`.

## 5. Seed data (`scripts/seed.ts`)

**States**: all 36 + FCT; `is_active`: Oyo, Osun. **LGAs**: all Oyo (33) and Osun (30) LGAs by name with `geo_code`; others loaded from the GeoJSON at import.

**Schools**: imported from the EduTracka export when supplied (`scripts/import-schools.ts`); otherwise 12 clearly fictional demo schools for local/staging only (e.g. "Demo Grammar School, Ibadan North").

**Programmes**:
| slug | kind | enrolling | ages | sessions |
|---|---|---|---|---|
| debate-and-public-speaking | debate | yes | 10–18 | 8 |
| inspire-her-future | stem | yes | 10–18 | 1 |
| ibadan-schools-debate-competition | debate | no | 13–18 | – |
| eko-dara | education_access | no | – | – |
| end-fgm | advocacy | no | – | – |
| women-in-history | campaign | no | – | – |
| edutracka | other | no | – | – |

**Lesson plans** for debate-and-public-speaking (titles; coach notes to be supplied by BGDI, placeholders say "Coach notes to be added by BGDI"): 1 Finding your voice · 2 Structuring a speech · 3 Building an argument · 4 Evidence and examples · 5 Listening and rebuttal · 6 Delivery: voice, pace, body · 7 Debating the SDGs: practice round · 8 Showcase and reflection.

**Rubric**: "Speaking and debate v1" (spec/10 §1).

**Historical impact** (**CONFIRM** breakdown): one row, year 2025, programme debate-and-public-speaking, state Oyo: students 2000, schools 85, volunteers 200, source note "BGDI programme records 2021–2026, as presented October 2026". A second row for inspire-her-future: students 92, girls 92, schools 9.

**Team** (names and titles from the current website; no bios): Karimot Odebode, Founder and Project Lead (leadership) · Fatimah Adebimpe, Programs Manager · Temitope Boladale, Campaigns and Advocacy Manager · Maryam Lawal, HR/Legal Manager · Khadijah Alade, Operations Manager · Ma'arufah Abdulsalam, Campaigns and Advocacy Assistant · Anjolaoluwa Ogundepo, Operations Assistant · Deronke Abdul, Communications Manager · Oluwagbenga Ige, Digital Media Director · Kawthar Omisore, Fundraising and Partnership Officer I · Zainab Afolabi, Fundraising and Partnership Officer I · Temidayo Arewa, Fundraising and Partnership Officer II · Temilola Ibitomi, Policy and Research Manager · Halimat Ojone, Policy and Research Officer I · Grace Omaruke, Policy and Research Officer II · Ann Ene Agbo, Digital Media Assistant · Precious Adeife, Communications Assistant · Tariq Lawal, Visual Designer.

**Partners** (names only, logos when supplied, hidden until BGDI confirms each): FirstBank, Golden Penny Foods, HP, Global Shapers Community Ibadan Hub, AWS.

**Site settings**: email info@theblackgirlsdream.org, phone +234 813 707 5948, city Ibadan, Oyo State, Nigeria; other fields blank.

**Training modules**: `safeguarding-basics` (5 short pages: What safeguarding means · Signs a child may be at risk · Boundaries: the rules in the code of conduct explained · What to do if a child tells you something: listen, don't promise secrecy, don't investigate, report the same day · How to report in the Hub) with 8 single-choice questions written from that content; `code-of-conduct` (spec/09 §8 list); `using-the-hub` (4 pages, 4 questions).

**Motions** (starter set, 12): This house believes every girl should learn to code · … that social media does more harm than good for teenagers · … that school uniforms should be optional · … that debate should be taught in every school · … that students should help decide school rules · … that phones should be allowed in secondary schools · … that financial literacy should be a compulsory subject · … that sports are as important as academics · … that every community should have a public library · … that young people should be able to vote at 16 · … that climate education should start in primary school · … that reading for pleasure matters more than exam revision.

**FAQs** (seed, editable): Students: "Is it free?" (Yes.) · "Do I need a phone?" (No. Sessions happen at your school.) · "Why do you need my parent's permission?" · Guardians: "Who will work with my child?" (trained, vetted volunteers, in groups, at school) · "What information do you keep?" · "How do I withdraw permission?" · Volunteers: "How much time does it take?" · "Do I need debate experience?" · "Will I get a certificate?" · Schools: "What does it cost the school?" (Nothing.) · "What do we need to provide?" · Donors: "Is my donation secure?" · "Will I get a receipt?" Answers are one to three sentences drawn from this specification.

**Message templates**: all rows in spec/08 §4. **Settings**: defaults in spec/07 §14. **Redirects**: spec/04 §8.

**Demo data** (local and staging only, flagged `is_demo` via a seed marker in `notes`): 3 staff users (admin, programme manager, safeguarding lead), 1 state lead (Oyo), 12 volunteers across stages, 120 students across 4 cohorts in 3 demo schools with attendance and assessments, 10 guardians pending consent, 5 donations, 3 stories, 2 events. All names fictional; no real children.

## 6. Test journeys (Playwright, mobile viewport unless noted)

1. Visitor: home → programme → join as student → done screen.
2. Guardian: consent link → give permission → change a choice → withdraw.
3. Volunteer: apply → (staff advance) → training and quiz → activated → assigned → take attendance offline → mark held → hours → certificate.
4. Staff (desktop): inbox triage → create cohort from waitlist → assign coaches with matching → reschedule a session → broadcast to cohort → close cohort.
5. School: request → accept → upload agreement → class-list enrolment.
6. Safeguarding: public report → lead reviews → pauses a volunteer → closes case; admin denied.
7. Donor: one-off donation (console provider) → thank-you → receipt.
8. Editor (desktop): edit home hero → preview → publish; create event with Hub registration → visitor registers.
9. Funder: staff build a report → approve narrative → share link → open as public.
10. Student (P2): practise a speech with a fixture audio file → scorecard → history.
