# 13 Phase 3 modules

Each module follows the same layering, permission, audit and i18n rules as Phase 1. Tables use the conventions of spec/02.

## 1. Learning paths (Dream Coach)

**Purpose**: self-paced lessons written by BGDI, sequenced for each student from her dream and needs. The AI personalises and checks understanding; it never free-chats.

**Tables**
- `curriculum_track`: `slug`, `name_en/yo`, `programme_id?`, `sort`, `status`. Seed tracks: Public speaking & debate, STEM, Money & budgeting, Wellbeing & online safety.
- `lesson`: `track_id`, `slug`, `title_en/yo`, `summary_en/yo`, `level` (starter | intermediate | advanced), `minutes int`, `tags text[]` (maps to intake `needs` and `interests`), `status`.
- `lesson_step`: `lesson_id`, `position`, `kind` (read | example | check | teach_back | practise_speech), `body_en/yo jsonb`, `check jsonb?` (`{question, options[], correctKey, explanation}`), `teach_back_prompt_en/yo?`, `motion_id?`.
- `learning_path`: `person_id`, `title`, `weeks int default 4`, `status` (suggested | active | completed), `generated_from jsonb` (inputs), `approved_by?`.
- `path_item`: `path_id`, `week int`, `position`, `lesson_id`.
- `lesson_progress`: `person_id`, `lesson_id`, `step_position`, `completed_at?`, `check_correct int`, `teach_back_score int?`.
- `badge`: `key`, `name_en/yo`, `icon`, `rule jsonb`. `person_badge`: `person_id`, `badge_id`, `awarded_at`.

**Path generation**: deterministic first: score each published lesson = 3 × (tags ∩ needs) + 2 × (tags ∩ interests) + 1 if level fits class (JSS → starter, SS → intermediate); take the top 8, order by level then track, 2 per week. Then the LLM only writes the path title and a one-line "why this is for you" per week from `{dreamCareer, needs, lesson titles}`. Coaches or staff can edit the path.

**Lesson player** `/app/path/[lessonSlug]`: one step per screen. `read`/`example` render content. `check` is single-choice with explanation. `teach_back`: "Explain it in your own words to a younger student" → text box (or voice, reusing the P2 pipeline) → LLM returns `{score 1–3, what_was_right, one_thing_to_add}` against the lesson's key points (provided in the prompt); structured, guardrailed, 200-token cap. `practise_speech` opens the speech coach with the lesson's motion.

**Progress**: streak = consecutive weeks with ≥ 1 completed lesson (weekly, not daily, to suit shared phones). Badges: First lesson, Path complete, 5 speeches, Dream Graduate (path complete + cohort completed). Dream Graduate issues a certificate and, for SS3 leavers and 18+, an invitation to apply as a volunteer (`is_alumna` prefilled).

**Coach view**: cohort table of path progress; amber flag when no lesson or speech for `settings.quiet_student_days`; suggested nudge text. **Console** `/console/curriculum`: tracks, lessons, step editor with preview, publish.

## 2. 1:1 mentoring

For students aged 16+ and graduates, by staff invitation only.

- `mentor_match`: `mentor_id`, `mentee_id`, `status` (suggested | proposed_to_mentor | accepted | declined | active | ended), `goals text`, `approved_by`, `started_on`, `ended_on?`, `end_reason?`.
- `mentor_thread`: `match_id`. `mentor_message`: `thread_id`, `sender_id`, `body enc`, `flagged bool`, `read_at?`.

Rules: mentor must be `active`, have passed an additional `mentoring` training module, and have ≤ `max_mentees` (default 2). Matching score: shared interest/skill 40, language 20, same state 20, availability 20; staff approve; mentor accepts in the Hub; mentee and guardian are told (`mentor.matched`). All conversation happens in the in-Hub thread: no phone numbers, links or emails allowed in messages (regex block with explanation), messages scanned by the Guardrail; flagged messages are held and create a safeguarding case. Staff and safeguarding leads can read every thread; both parties are told so. Mentor logs meetings (date, mode: in person at school / group call, notes). Guardian can end the match from the guardian page.

## 3. Competition manager

**Tables**
- `competition`: `slug`, `name`, `edition_year`, `programme_id`, `venue`, `starts_on`, `ends_on`, `registration_opens/closes`, `format` (ibadan_schools | british_parliamentary | custom), `team_size int`, `entry_fee_minor int default 0`, `status` (draft | registration | closed | running | finished), `tabbycat_url?`, `tabbycat_token? enc`, `event_id?`.
- `competition_team`: `competition_id`, `school_id`, `name`, `coach_contact_person_id`, `status` (registered | confirmed | withdrawn), `payment_donation_id?`.
- `team_member_entry`: `team_id`, `person_id`, `role` (speaker | reserve).
- `judge_assignment`: `competition_id`, `person_id`, `conflict_school_ids uuid[]`, `available_rounds int[]`.
- `round`: `competition_id`, `number`, `name`, `motion_id?`, `stage` (preliminary | quarter | semi | final), `starts_at`. `debate`: `round_id`, `room`, `team_ids uuid[]`, `positions jsonb`, `judge_ids uuid[]`. `ballot`: `debate_id`, `judge_id`, `scores jsonb`, `winner_team_id`, `submitted_at`, `confirmed_by?`.
- `essay_entry`: `competition_id`, `person_id`, `title`, `file_key`, `anonymous_code`. `essay_mark`: `entry_id`, `marker_id`, `scores jsonb`, `total`.

**Flow**: staff create a competition (also creates a website `event`). Schools register from the public competition page (champion signs in; picks students already in the Hub or adds new ones through the school consent route; pays any fee through Paystack). Staff confirm teams. Judges are volunteers with the `judging` skill; conflicts auto-filled from their school and alumni school.

**Draws and tab**: integrate Tabbycat (self-hosted instance per competition; URL and API token stored in the competition). Sync: push teams, speakers, judges and venues through the Tabbycat API; pull draws, results and speaker standings back for display. The Hub does not reimplement draw algorithms. If no Tabbycat instance is configured, a simple built-in mode supports single-elimination brackets with manual pairing.

**Ballots**: judges open `/app/volunteer/judging/[debateId]` on a phone, enter speaker scores and the winner, submit; chief adjudicator (staff) confirms. Public pages `/events/[slug]/results` show fixtures, results by round, final standings, top speakers (first name + school). Certificates generated for participants, winners and judges. **Essay track**: upload, anonymous codes, two markers per essay using an essay rubric, ranked results.

## 4. Èkó Dára case management

Access limited to a new role `ekodara_officer` plus programme managers and admins. Children in this programme are often younger than Hub students; no child-facing screens.

**Tables**
- `ekodara_child`: `person_id` (student record with minimal fields), `guardian_id`, `enrolment_status` (identified | assessed | enrolled | attending | dropped_out | graduated), `out_of_school_reason`, `school_id?`, `enrolled_on?`, `class_level?`, `nysc_mentor_id?`, `risk_level` (low | medium | high), `notes enc`.
- `ekodara_support`: `child_id`, `kind` (fees | uniform | books | feeding | transport | other), `amount_minor`, `currency`, `date`, `term`, `paid_to`, `receipt_key?`, `recorded_by`.
- `ekodara_visit`: `child_id`, `visitor_id`, `date`, `kind` (school | home | phone), `attendance_ok bool`, `wellbeing 1–5`, `notes enc`, `follow_up_needed bool`.
- `ekodara_guardian_support`: `guardian_id`, `kind` (seed_funding | business_training | financial_training), `amount_minor?`, `date`, `business_type?`, `follow_up_3m jsonb?`, `follow_up_6m jsonb?`.

**Screens** `/console/eko-dara`: caseload list with filters and risk flags; child page (timeline of support, visits, attendance from the school each term); record support (with receipt photo); visit log (mobile-friendly, offline queue like attendance); guardian support; mentor assignment from NYSC volunteers. **Dashboard**: children enrolled, still attending after 1/2/3 terms, cost per child per term, guardian businesses active at 6 months, funds raised vs target. Feeds the programme page and report builder section "Èkó Dára". Safeguarding and consent rules apply; consent is collected from the guardian in person on a staff device (method `paper_uploaded` or OTP).

## 5. School champion portal

`/app/school` gains: confirm, decline or propose session dates (staff notified); see attendance summary per session; add students by class list; download a term summary PDF (sessions held, students taking part, completion, average confidence change if n ≥ 10); request another programme; message BGDI. Champions never see assessment scores of individual students.

## 6. Supporter and grant records

`grant` table (spec/02 §11). Console: grants list with reporting due dates → tasks 30 and 7 days before; link reports to grants; funder page (partner) with grants, reports shared and view counts. Donor updates: segment supporters (`wants_updates`) and send a quarterly email built from the latest report summary.

## 7. Languages

Add `pcm` (Nigerian Pidgin) to `enabled_locales` with its own `messages/pcm.json`, reviewed by a native speaker. Yoruba or Pidgin speech practice only once a transcription service with adequate accuracy for children's speech is verified on a test set of at least 50 recordings collected with consent; until then the coach stays English-only.

## 8. Longer-term tracking

Follow-up self-assessments at 6 and 12 months after cohort completion (`assessment.type = follow_up_6m/12m`), sent by `student.followup` to students with consent still active; alumni page showing volunteers who were once students; competition participation linked to earlier cohort membership for the "trained → competed" metric.
