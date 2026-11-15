# 09 Safeguarding and privacy

## 1. Rules built into the product

1. Volunteers, champions and other students never see a child's surname, date of birth, phone, guardian details or free-text answers.
2. A child becomes visible to a volunteer only when: participation consent is active, the child is a member of one of the volunteer's current cohorts, and the volunteer's stage is `active`.
3. No feature lets a volunteer message a child directly in P1 or P2. All messages come from BGDI's number.
4. Sessions happen in groups at school. The session screen reminds coaches: "Never be alone with a student."
5. Adults are not rated by children. Students can give private feedback at endline that only staff see.
6. No photos of students are uploaded by anyone but staff, and only with `photo` consent recorded.
7. Every screen has a route to report a concern.
8. AI features are structured, filtered, capped and off by default per cohort (spec/12 §8).

## 2. Report a concern

Entry points: `/report-a-concern` (public, no sign-in), avatar menu in the Hub, student sheet in the volunteer view ("Report a concern about this student"), console button, inbound WhatsApp containing the word "HELP ME" or "UNSAFE" (creates a case with source `whatsapp` and replies with `concern.received`).

Public page content: "If someone is in immediate danger, call 112 or go to the nearest police station." Safeguarding contacts from settings. Then the form:

| Field | Rules |
|---|---|
| Who is this about? | text, optional ("a student", name if known) |
| School or place | picker or text, optional |
| What happened or what worries you? | textarea, required, ≥ 20 chars |
| When? | date, optional |
| Is anyone in danger right now? | yes / no / not sure, required |
| Your name | optional |
| How can we reach you? | phone or email, optional |
| ☐ I want to stay anonymous | hides name/contact fields |

On submit (`safeguarding.report`): create case with next reference `SG-{year}-{seq}`; category `other` and severity `medium` by default; if "in danger" = yes → severity `emergency`; if reported from a student sheet, set `subject_person_id` and `cohort_id`; if signed in, set `reporter_person_id` unless anonymous. Notify all safeguarding leads with `staff.case_new` (emergency: WhatsApp + SMS + email at once, ignoring quiet hours; others: preferred channel). Send `concern.received` to the reporter if contact given. Show the reference and "What happens next" (reviewed within 24 hours; emergency within 2 hours).

If no safeguarding lead is configured, notify all admins and show a red banner in the console until one is set.

## 3. Case management `/console/safeguarding`

Visible only to `safeguarding_lead`. List: reference, severity, category, status, age, owner; filters; overdue highlighting (emergency unreviewed > 2 h, others > 24 h → escalation message to all leads and an admin notification that says only "A safeguarding case is overdue").

Case page: details (decrypted on view, audited), people linked (links open the person page), timeline of notes. Actions: take ownership; set category and severity; add note / action / referral / contact log; link to a student or volunteer; **pause a volunteer immediately** (sets stage `paused`, removes from future sessions, staff task to re-cover; the reason shown to programme staff is only "Paused by safeguarding"); mark referred (agency name, date); close with outcome. Closed cases can be reopened. Cases are never deleted; they are retained 7 years then anonymised.

Reporting: counts by category, severity, status and time-to-review, with no identifying detail, available to admins and programme managers (`case.count`).

## 4. Volunteer vetting (enforced)

Stage gates in spec/07 §4. In addition: date of birth must make the volunteer 18+; two references with at least one `positive` and none `concern` (override requires a programme manager and a written reason, audited); code of conduct version must match current `settings.conduct_version`, else re-sign is required at next sign-in; annual refresher: 12 months after `training_completed_at` the volunteer is prompted to retake `safeguarding-basics` and is blocked from new assignments 30 days after that until passed.

## 5. Privacy by design

- **Lawful basis**: guardian consent for children's participation data; consent for photo, stories and AI; legitimate interest for volunteer and supporter administration. Recorded per consent type with the wording version.
- **Minimisation**: intake collects only fields in spec/05. No address, religion, health or ethnicity fields anywhere. The disability essay track (P3) records only "needs the essay track: yes/no".
- **Encryption**: fields listed in spec/01 §10; TLS everywhere; S3 buckets private with SSE.
- **Access**: role scopes and DTOs (spec/03); audit of sensitive reads.
- **Processors**: AWS, Meta (WhatsApp), Termii, Paystack, Sentry. Listed in the privacy notice. AI prompts include first name at most; transcripts go to Bedrock in BGDI's own account and are not used for model training.
- **Breach handling**: runbook in `README` → Admin: rotate keys, revoke sessions, identify affected persons through the audit log, notify the Nigeria Data Protection Commission within 72 hours and affected guardians.
- **DPIA**: a data protection impact assessment document (`docs/dpia.md`, template generated by the build with the data inventory from this spec) must be completed by BGDI before production launch. **CONFIRM** whether BGDI must register with the NDPC as a data controller of major importance.

## 6. Retention (job `retention.sweep`, defaults in `settings.retention`)

| Data | Kept for | Then |
|---|---|---|
| Speech audio | Until transcription succeeds, max 24 h | Deleted (S3 lifecycle + job) |
| Speech word timings | 30 days | Dropped |
| Speech transcript | 12 months | Deleted; scores kept |
| Students who never got consent | 60 days after request | Person anonymised |
| Declined / left students | 12 months after status change | Anonymised |
| Active student records | While active + 3 years after last activity | Anonymised |
| Volunteer applications declined | 12 months | Anonymised |
| Messages (rendered body) | 12 months | Body cleared; metadata kept |
| Contact messages | 24 months | Deleted |
| Audit events | 7 years | Deleted |
| Safeguarding cases | 7 years after closing | Anonymised |
| Donations | 7 years (financial records) | Supporter anonymised |

**Anonymise** means: replace names with "Former student", null surname, DOB (keep age band), phone, email, hashes, guardian links, free-text answers and notes; keep school, LGA, gender, programme, attendance and assessment scores so that impact figures remain correct; set `status = anonymised`, `anonymised_at`.

## 7. Data requests

Anyone can ask from `/privacy` (form: who you are, relationship, what you want: copy / correction / deletion, contact). Creates `data_request` + task for safeguarding lead/admin. Flow: verify identity (code to the phone on record, or staff call) → `export` job builds a ZIP (JSON + readable PDF summary of the person's data, messages, attendance, assessments) delivered by expiring link; `erase` job anonymises as above and deletes media; `correct` routes to the person editor. Target: completed within 30 days; overdue requests flagged on System health.

## 8. Policy page drafts (seeded as `content_page`, to be reviewed by BGDI and a lawyer)

**Privacy notice `/privacy`** sections: Who we are and how to contact us · What we collect (students; guardians; volunteers; schools; donors; website visitors) · Why we collect it · Who can see it · Who we share it with (the processors above; never sold) · AI speech practice (what is recorded, deletion after scoring) · How long we keep it (table above in plain words) · Your rights and how to use them · Children's privacy and guardian permission · Changes to this notice · Version and date.

**Safeguarding policy `/safeguarding`** sections: Our commitment · Who this applies to · Code of conduct for volunteers and staff (the list below) · How to report a concern · What happens after a report · Our safeguarding leads.

**Volunteer code of conduct** (also the `code-of-conduct` training module):
1. I will treat every young person with respect and dignity.
2. I will never be alone with a student out of sight of others.
3. I will not contact students or their families privately by phone, WhatsApp, social media or in person outside BGDI activities.
4. I will not ask for or keep students' phone numbers, addresses or social media handles.
5. I will not take or share photos or videos of students unless BGDI staff have asked me to and consent is recorded.
6. I will not give gifts or money to individual students, or accept them.
7. I will not use physical punishment, humiliating language or threats.
8. I will report any concern about a child's safety, and any breach of this code, through the Hub or to the safeguarding lead on the same day.
9. I will keep what I learn about students confidential, except when reporting a concern.
10. I understand that breaking this code can end my volunteering and may be reported to the authorities.

**Terms `/terms`**: acceptable use, accounts, content ownership, donations are voluntary and non-refundable except in error, limitation of liability, governing law Nigeria.
