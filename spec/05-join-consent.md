# 05 Join and consent

All join flows live under `/join`, share one layout (black header with logo, language switch, progress bar, "Save and finish later"), work offline for drafts, and record the campaign source from the `src` cookie or `?src=`.

## 1. Chooser `/join`

Title "Join the Dream". Three cards: **I'm a student** ("Ages 10–18. Learn public speaking, debate and more.") → `/join/student`; **I want to volunteer** ("Share your skills with the next generation.") → `/join/volunteer`; **Bring BGDI to my school** ("For teachers and principals.") → `/join/school`. Link below: "Already joined? Sign in".

## 2. Student intake `/join/student`

One question group per screen, large tap targets, Back/Next, progress "Step n of 5". The draft is saved to IndexedDB after every field. Nothing is written to the server until the final submit; if she is offline at submit, the answers are queued and sent by `/api/sync/intake` when she is back online.

### Step 1: About you
| Field | Type | Rules |
|---|---|---|
| First name | text | required, 2–40 letters |
| Surname | text | required; helper "Only BGDI staff see this." |
| How old are you? | number stepper | required, 8–25. Under 10 or over 18 → still accepted, flagged `pending_review` with note |
| I am a… | chips: Girl, Boy, Prefer not to say | required |
| Class | chips JSS1–SS3, "Not in school" | required |
| Which state do you live in? | chips: active states first, then "Other" → select of all 36 + FCT | required |
| Local government | searchable select filtered by state | required if state has LGAs loaded |
| Which school do you attend? | searchable picker (type ≥ 2 letters; shows name, town, LGA); last option "My school isn't listed" → free text | required unless "Not in school" |

### Step 2: Your dreams
| Field | Type | Rules |
|---|---|---|
| When I grow up, I want to be… | text with suggestion chips (Doctor, Lawyer, Engineer, Teacher, Journalist, Entrepreneur, Scientist, Leader) | required, ≤ 60 chars |
| I'm excited about | multi-select tiles: Debate & Public Speaking, STEM, Writing & Essays, Leadership, Arts & Media, Sports, Business & Money | at least 1 |
| One dream I have for my community | textarea | optional, ≤ 200 chars |
| Which programme would you like to join? | cards for programmes with `is_enrolling`, preselected from `?programme=` | at least 1 |

### Step 3: Where I need help
| Field | Type | Rules |
|---|---|---|
| I'd love help with | multi-select: Speaking up, Building arguments, Confidence, Research, A school subject, English, Something else | at least 1 |
| Which subject? | text | shown if "A school subject" |
| Tell us more | text | shown if "Something else" |
| Do you use a phone? | radio: My own smartphone, A shared family smartphone, A phone without internet, Only a school computer, None | required |

### Step 4: Staying in touch
| Field | Type | Rules |
|---|---|---|
| Language I prefer | chips: English, Yorùbá | required |
| My phone number | tel | optional; if given must differ from guardian's unless "shared family phone" was chosen |
| Parent or guardian's name | text | required if age < 18 |
| Their relationship to me | select | required if age < 18 |
| Their phone number | tel | required if age < 18; helper "We'll send them a message to ask their permission." |
| Best way to reach them | chips: WhatsApp, SMS | required if age < 18 |
| Pick your avatar | grid of 24 | default preselected |

### Step 5: Quick check-in (baseline)
"There are no wrong answers." Five statements, each a 5-point scale of five circles growing in size, labelled "Not at all" and "Very much" at the ends (no faces, no emoji):
1. I feel confident speaking in front of my class.
2. I can explain my opinion clearly.
3. I can give reasons and examples to support my point.
4. I feel comfortable asking questions when I don't understand.
5. I believe I can be a leader in my school or community.

Tick: "I agree to BGDI's privacy notice" (link opens in a sheet). Button **Send my answers**.

### On submit (service `intake.submitStudent`)
1. Validate; normalise phones.
2. Duplicate check: same first name + surname (case-insensitive) + school, or same guardian phone + first name → attach to the existing person, update answers, do not create a second record.
3. Create `person` (role student), `intake_response`, baseline `assessment` (`self_score = mean × 20`), guardian `person` + `guardian_link`.
4. Status: age ≥ 18 → `pending_review` with `self_adult` consent recorded; age < 18 → `pending_consent`; if the school has an active agreement with `covers_consent` → `pending_review` with consent method `school_agreement` and guardian notified (`consent.school_notice`).
5. Enqueue messages: student `student.welcome` (if she gave a phone); guardian `consent.request`.
6. Create inbox item for staff (scoped by state).
7. Show the **done screen**: avatar, "Thank you, {firstName}!", what happens next in three steps ("1. We've asked {guardianName} for permission. 2. Our team places you in a group at your school. 3. You get a message with your first session."), buttons "Remind my guardian" (re-sends, max 3) and "Back to home". If she gave her own phone: "Sign in to see your progress".

## 3. Guardian consent `/consent/[token]`

Message to the guardian (template `consent.request`) contains the link and a 6-digit code.

Page (no sign-in, English/Yoruba switch, plain language, readable in under 2 minutes):
1. Header: "{studentFirstName} would like to join Black Girl's Dream Initiative."
2. What BGDI is (two sentences) and what the programme involves (from programme summary, schedule if known).
3. What we collect and why (bulleted, from privacy notice summary), who sees it ("Volunteers see only her first name, class and school. They never see phone numbers.").
4. Choices (each a separate tick, participation required to proceed):
   - ☐ I give permission for {name} to take part. *(participation)*
   - ☐ BGDI may use photos or video of {name} taken at events. *(photo, optional)*
   - ☐ {name} may use the AI speech practice coach. Recordings are deleted after scoring. *(ai_practice, optional)*
   - ☐ BGDI may share {name}'s story, first name only. *(stories, optional)*
5. Guardian's full name (text), relationship (prefilled), the 6-digit code.
6. Buttons **I give permission** / "I do not give permission".

On agree: verify code (5 attempts, then a new message must be requested), write one `consent` row per ticked type with `given_at`, method `guardian_otp`, `ip`, `user_agent`, `text_version`; student → `pending_review`; send `consent.thanks` to guardian and `student.consent_given` to student; audit. On decline: student → `declined`, message `consent.declined_ack`, staff task. The same link later shows current choices with "Change" and "Withdraw permission" (confirm dialog; applies rule 6 of spec/02 §15).

Reminders: job `consent.remind` at 2 and 6 days if still pending; at 10 days a staff task `consent_stalled` ("Call guardian or arrange school route"). Token expires at 14 days; staff can reissue.

**Paper route**: staff upload a signed paper form on the person page → consent method `paper_uploaded`.

## 4. Volunteer application `/join/volunteer`

Steps:
1. **About you**: first name, surname, date of birth (must be 18+), gender, phone, email, state, LGA, occupation, organisation or school, "I am a current NYSC member" tick, "I took part in a BGDI programme as a student" tick.
2. **What you bring**: skills (multi-select list from `volunteer_profile.skills`), languages, experience with young people (textarea), "Why do you want to volunteer?" (required, 50–600 chars).
3. **Availability**: grid of days × morning/afternoon/evening, how many groups you can take (1–3), LGAs you can travel to (multi-select within state).
4. **References**: two people, each name, relationship, phone, email optional. Helper "Not family members."
5. **Agreements**: ☐ I consent to reference and identity checks. ☐ I have read the Safeguarding Policy. ☐ I agree to the privacy notice. Optional upload of a government ID photo.

On submit: create person (role volunteer), `volunteer_profile` stage `applied`, references `pending`; message `volunteer.application_received`; inbox item; task `reference_check`. Done screen explains the four steps: references → short call → safeguarding training → active.

## 5. School request `/join/school`

Fields: school (picker or other), state, LGA, your name, your role (Principal, Vice Principal, Teacher, Counsellor, Other), phone, email, programme of interest, roughly how many students, preferred term and day, message. On submit: `school_request` status `new`; message `school.request_received`; inbox item.

When staff accept: school `partnership_status = in_discussion`, requester becomes a person with role `school_champion`, and the **school agreement** is generated as a PDF from this template (settings-editable) for signature and upload:

> **Agreement between Black Girl's Dream Initiative and {School}.** BGDI will run {programme} for students of {School} during {term}, on school premises, at no cost to the school or students. BGDI volunteers are trained in safeguarding and are supervised by BGDI staff. The school will provide a venue, a staff contact, and a class list of participating students. The school confirms that it has informed parents and guardians and holds their permission for participation in this school activity. BGDI will collect students' first name, surname, class and age, will keep them private, and will delete them on request. Either party may end this agreement in writing. Signed: Principal / BGDI Programmes Manager.

With `covers_consent = true` on the uploaded agreement, the champion (or staff) can use **class-list enrolment**: paste or upload CSV (first name, surname, age, gender, class, guardian phone optional) → students created at `pending_review` with consent method `school_agreement`; guardians with phones receive `consent.school_notice` with an opt-out link.

## 6. Validation and error copy

Shared zod schemas in `src/server/validation/join.ts`. Messages are short and human: "Please tell us your first name." "That phone number doesn't look right. Try 0803 123 4567." "Please pick at least one." Server errors show "Something went wrong on our side. Your answers are saved. Try again." with a retry button.

## 7. Abuse protection

Honeypot field, IP rate limit, per-phone rate limit, and a minimum fill time of 20 s for the student form. No CAPTCHA.
