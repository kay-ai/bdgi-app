# 06 Hub app (`/app`)

Mobile-first. Bottom tab bar on phones, left rail on wide screens. Header: BGDI mark, page title, bell (in-app notices = the person's recent messages), avatar menu (Switch profile, Language, Report a concern, Sign out). A persistent, quiet "Report a concern" link sits in the avatar menu and the footer of every screen.

Empty states always say what will happen next, never just "Nothing here".

## 1. Student

Tabs: **Home · Progress · Practise** (P2, only when enabled) **· Me**.

### 1.1 Home `/app`
State-dependent top card:
| Status | Card |
|---|---|
| pending_consent | "We're waiting for {guardianFirstName}'s permission." Button "Remind them" (max 3, shows last sent). Link "How does permission work?" |
| pending_review / waitlisted | "You're on the list! We'll message you when your group is ready." Shows school and chosen programme. |
| active, cohort not started | "Your group starts {date}." Cohort name, venue, coaches (first name + initial). |
| active, running | **Next session** card: date, time, venue, lesson title, countdown. If cancelled, shown in red with reason. |
| completed | "You finished {programme}!" certificate download, "Tell us how you feel now" if endline pending. |

Below: My group (cohort name, school, sessions attended n of m as dots), My coaches, latest notice. If an assessment is due (endline), a gold card "2-minute check-in".

### 1.2 Progress `/app/progress`
Attendance dots per session; confidence: baseline score and, after endline, the change shown as two bars with encouraging text; coach rubric scores when available (as stars per criterion, with the coach's one-line comment); badges (P3); speech practice trend (P2).

### 1.3 Me `/app/profile`
Avatar picker, preferred name, language, my dream (editable), phone (change flow), "My guardian" (first name, consent status), privacy links, "Download my data", "Leave BGDI" (creates a data request and a staff task; does not delete instantly).

### 1.4 Endline `/app/check-in`
Same five statements as baseline, plus: "What was the best part?" (optional text), "Would you recommend this to a friend?" (0–10). Saves `assessment` type `endline`.

## 2. Guardian `/app/guardian`

Reached by signing in with the guardian's phone or from the consent link. Shows each linked child as a card: first name, programme, group status, next session, attendance count, consent choices with "Change", and "Withdraw permission". Message history sent to this guardian. Contact BGDI button (opens contact form prefilled). No AI transcripts; speech practice shows scores only.

## 3. Volunteer `/app/volunteer`

Tabs: **Home · Groups · Hours · Me**.

### 3.1 Home
Before active: a **stage tracker** (Applied → References → Call → Training → Active) with the current step's instruction. In stage `training`: "Start safeguarding training" button.

When active: Next session card (cohort, school, time, lesson, co-coaches, "Open session"); "To do" list (take attendance for past session, score endline rubrics, log hours); offline queue indicator; notices.

### 3.2 Training `/app/volunteer/training`, `/training/[moduleSlug]`
List of modules with status. A module is Tiptap content split into short pages, then a quiz (single-choice). Pass mark 80%; unlimited retries, questions shuffled; wrong answers show the explanation. Required modules (seed text in spec/14 §5):
1. `safeguarding-basics`: recognising harm, boundaries, never being alone with a child, no private contact, how to report.
2. `code-of-conduct`: read and sign (typed full name + tick) → sets `code_of_conduct_signed_at` and version.
3. `using-the-hub`: taking attendance, privacy rules.
Completing all required modules sets `training_completed_at` and creates a staff task to activate. Stage becomes `active` only by staff action.

### 3.3 Groups `/app/volunteer/cohorts/[id]`
Header: cohort name, school, schedule. Tabs:
- **Sessions**: list with status; tap → session.
- **Students**: basic cards (avatar, first name, class, attendance %). Tap → sheet with attendance history, dream career, "needs help with" tags, latest rubric scores, speech scores (P2), and "Report a concern about this student". No surnames, no phone numbers.
- **Plan**: the lesson plans for the programme (coach notes).

### 3.4 Session `/app/volunteer/sessions/[id]`
- Lesson plan (objectives, coach notes), venue, co-coaches.
- **Attendance**: list of students with three large toggles Present / Absent / Excused, "Mark all present", search. Saves locally first, shows a sync tick per row. Works fully offline using `cohortCache`.
- "Mark session as held" (requires attendance for every student) + session note (what went well, issues). Marking held creates `hours_entry` (source session, hours = duration/60, status approved) for each confirmed coach.
- "Session didn't happen" → reason → notifies staff (staff confirm cancellation and whether to message students).
- At the final session: **Score rubric** for each student (four criteria, 1–5 with descriptors, optional one-line comment) → endline `assessment.rubric_scores`.

### 3.5 Hours `/app/volunteer/hours`
Total approved hours, list of entries, "Add hours" (date, hours ≤ 12, description; status pending). Certificates: "Request my certificate" appears at ≥ 10 approved hours; generates PDF (job `certificate.generate`) with name, role, hours, date range, signature image from settings, verification QR to `/verify/certificate/[code]`.

### 3.6 Me
Profile, skills, availability editor, pause volunteering (reason), language, sign out.

## 4. School champion `/app/school` (basic in P1, fuller in P3)

P1: school name, partnership status, agreement (view), cohorts at the school with next sessions, student count, class-list enrolment (when agreement covers consent), contact BGDI. P3: confirm or propose session dates, attendance summary by session, term summary PDF.

## 5. Notices

The bell lists the last 30 outbound messages for the active person (title derived from template, body, time). No separate push infrastructure in P1; WhatsApp/SMS is the push channel.

## 6. Avatars

24 illustrated avatars in `public/avatars/a01.svg`–`a24.svg`: abstract, friendly, varied skin tones and hairstyles including hijab. No photo uploads for students in P1 or P2.
