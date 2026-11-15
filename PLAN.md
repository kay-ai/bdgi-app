# BGDI Platform: what to build first

*Draft v3, 15 Nov 2026. This document explains why and in what order. The full build specification is [SCOPE.md](SCOPE.md) and [spec/](spec/); where they differ from this document, the spec wins. A from-scratch Next.js build that now includes a rebuilt website; the AWS PoC is a reference only. Sources: AWS x BGDI Kickoff (12 Oct), PoC Week 2, PoC Demo, and the full PoC deck (week of 19 Oct); theblackgirlsdream.org; edutracka.ai.*

---

## 1. What BGDI is

Black Girl's Dream Initiative is a youth-led nonprofit in Ibadan. About 18 staff and 200+ volunteers. Its mission is quality education and closing the gender gap.

| Program | What it is | Scale |
|---|---|---|
| Ibadan Schools Debate & Public Speaking | Volunteers train secondary-school teens (ages 13–18) in schools, linked to the SDGs. There is also an essay track for students with disabilities. | 1,117 teens over 3 years (website). The AWS decks say 2,000 students and 85 schools across Oyo and Osun. |
| Ibadan Schools Debate Competition | Annual flagship at Mapo Hall on International Day of the Girl | Government and private schools |
| Inspire Her Future (STEM) | One-day workshop and hackathon with Global Shapers Ibadan | 92 girls from 9 schools |
| Èkó Dára (education project) | Gets out-of-school children into government schools. Covers fees, feeding, an NYSC mentor, and seed funding for guardians. | Pilot in Oyo; $250k fundraising target |
| End FGM | Community dialogues and media advocacy | Oyo and Osun |
| **EduTracka** (built with you) | Tracks Oyo education budgets and school data across 33 LGAs, with an AI chat | Covers all Oyo public schools at LGA level |

**Where they're going:** from Oyo and Osun to 6 more south-west states in 1–2 years, then all of Nigeria and Africa.

**What slows them down today** (from the decks):
- Students and volunteers arrive through Instagram, LinkedIn and WhatsApp DMs.
- Someone adds them to WhatsApp groups by hand.
- Mentors are paired from memory.
- After the Day of the Girl webinar, 5 people asked to join and there was no form to capture them.
- Funders ask for numbers that BGDI has to rebuild by hand.

**The website makes this worse:**
- Every "Sign Up" button points to `#`.
- The donate page still has template text and only offers a "Test Donation" payment method.
- The contacts page shows a placeholder New York address.
- The blog shows 2020 template posts.
- The impact counters show 0.

A funder who visits today sees an unfinished site.

## 2. What AWS has already proposed (Chris Grant, AWS Social Impact Fellows, Oct 12 – Nov 20)

The proof of concept is serverless on AWS (Amplify/CloudFront/S3, API Gateway, Lambda, DynamoDB, SNS, SES, Cognito, Bedrock Nova Lite with Guardrails, Transcribe, Polly, Rekognition). It is not on the live site, and it uses test data only.

1. **Join & get paired.** A 4-step phone questionnaire (about you, dreams, where I need help, staying in touch and guardian consent). It includes a school picker with 658 Oyo schools from EduTracka data. Mentors are shown as "player cards" with ratings. A mentor accepts or declines by email, with exactly 2 emails per pairing.
2. **Make it yours.** Profile photo or avatar, with Rekognition and a Bedrock moderation check.
3. **AI Dream Coach.** A 4-week learning path generated from her dream. It has three modes: "Teach me", "Let me teach it" and "Practice my speech". The speech scorecard covers timing, pace, filler words, clarity, structure and confidence.
4. **Mentor dashboard.** Streaks and XP. A mentee's card turns amber after 7 quiet days. An "AI side coach" suggests what to do. Graduates earn alumni badges.

Cost estimate: about $0.15 per student per month, so about 2,000 girls for 2.5 years on BGDI's $10k in AWS credits.

**Handover:** Chris leaves on Nov 20. The decks expected either BGDI's tech partner (Option A) or an AWS Partner Network firm (Option B) to build on the PoC. The target is to be live in 2027 across 6 new states.

**Our position: we are not taking over the PoC code. We build from scratch in Next.js.** We use the PoC only as a reference: its screens, questionnaire, matching criteria and email copy show what BGDI has already seen and liked. Building fresh lets us fix the structural problems in section 3 from the start instead of retrofitting them.

## 3. Where the PoC falls short

The PoC demos well. Before it reaches real children it needs these changes:

1. **It assumes 1:1 mentoring, but BGDI teaches in groups.** BGDI's model is volunteers training groups in schools, then competitions. 200 volunteers cannot each take 1:1 mentees for 2,000 students now, let alone 6 more states. The real unit is **school → cohort → coach/volunteer team → sessions**. 1:1 mentoring can sit on top of that for a smaller group.
2. **It sends email to girls aged 10–18 in Nigeria.** Most of them have no email address, and many use a parent's phone. WhatsApp is the channel they actually use, which the Week 2 deck itself raised. Notifications need to go through WhatsApp/SMS first, with email as a fallback.
3. **Safeguarding is thin for a platform that connects adults with minors:**
   - Sharing contact details directly between mentor and child after acceptance is a risk.
   - Mentors need vetting, safeguarding training and a code of conduct before they can see any child.
   - Contact between mentor and child should stay in logged, BGDI-visible channels or group chats.
   - There needs to be a "report a concern" path with someone named to escalate to.
   - Children rating adults "like a driver rating" sends the wrong signal. It should be replaced with private feedback that BGDI staff review.
   - The Nigeria Data Protection Act 2023 applies. It requires verifiable guardian consent (for example an OTP to the guardian's phone, not a checkbox), data minimisation and a privacy notice.
4. **There is no operations console.** Fatimah, the programs manager, is the real daily user. The PoC gives her emails and a QuickSight dashboard marked "next phase". She needs a place to triage sign-ups, approve volunteers, assign schools and cohorts, run sessions, take attendance and export reports.
5. **Impact measurement is engagement, not outcomes.** Streaks and XP are not what funders pay for. Funders need baseline and endline measures: a confidence self-assessment, a speech rubric score, attendance, competition participation and girls reached by LGA. That data has to be collected from day one or it is lost.
6. **The volunteer lifecycle is missing.** Volunteers turn over every year. Onboarding, training modules, logged hours and certificates are what keep volunteers coming back. The Kickoff deck asked "what would help new members contribute in week one?", and the PoC doesn't answer it.
7. **The flagship competition isn't covered.** The annual debate competition (registrations, teams, draws, judges, ballots, results) is BGDI's most visible event and the most work for staff.
8. **EduTracka is used only as a school list.** Its data could be combined with BGDI's own reach:
   - Overlay where BGDI works on LGA gaps (pupil–teacher ratio, girls' enrolment, out-of-school rates) to choose which schools come next.
   - Use the combined picture in funder reports, e.g. "we reach X girls in the 7 LGAs with ratios of 80:1 or worse".
   - No other NGO in Oyo has this combination of data.
9. **Language AI coverage is unverified.** The PoC promises Yoruba and Pidgin. As far as I know, AWS Transcribe and Polly do not support Yoruba (to verify). The interface can be translated, but voice coaching will be English-first until there is an alternative.
10. **The public website is broken,** as described in section 1. Fixing it is cheap and makes the biggest difference to how funders see BGDI.

## 4. Recommendation: build the operating system first, and add AI on top

The PoC already did the AI demo for Karimot. Nothing else matters if sign-ups still disappear into DMs, if a safeguarding incident happens, or if the funder report is still made by hand. So:

> **Phase 1 is the "BGDI Hub" core: one front door, one roster, an ops console for Fatimah, WhatsApp notifications, safeguarding built in, and an impact dashboard that is live from the first sign-up.**
> **Phase 2 adds the AI speech coach as a measured pilot in 3–5 schools.** Then it grows into what the PoC promised.

### Phase 0: Setup and quick wins (1–2 weeks)
- **Set up the foundations:**
  - Agree who in BGDI owns the AWS account (the one with the $10k credits), and get our own access to it, scoped to what we need.
  - Create the repo, CI and environments (dev, staging, prod).
  - Write the data model and the safeguarding and consent rules down before writing screens.
  - Ask BGDI for the PoC screenshots and email copy they approved, so the new build feels familiar to them.
- **Interim website fix only:** take down the broken parts of the WordPress site (the "Test Donation" widget, the placeholder contact address, the template blog posts and sponsor cards). The site itself is rebuilt in Phase 1a and replaces WordPress at launch.
- **Run a 60-minute session with Fatimah** to settle the open questions in section 7. This replaces guessing.

### Phase 1a: Revamped website (about 4 weeks)
The website is rebuilt inside the same Next.js app and on the same database as the Hub, so it stays current without anyone updating it by hand:
- Impact counters, the reach map, programme pages, events and stories read live Hub data.
- Join, volunteer, school and partner forms write straight into the Hub.
- Donations run through Paystack, with emailed receipts.
- Staff edit every page, story and event from the console.
- Old WordPress addresses redirect to the new pages.

Full detail: [spec/04-website.md](spec/04-website.md) and [spec/11-donations.md](spec/11-donations.md).

### Phase 1b: BGDI Hub core (about 6–8 weeks, overlapping the website by 2; about 10 weeks for both, live before the next school term)

**A. Join (students, volunteers, schools)**
- Phone-first PWA intake that works on low data. It follows the same 4-step shape as the PoC questionnaire. The school picker is seeded directly from EduTracka's school data, which we already have, and extends to Osun and the new states.
- Three entry paths:
  - **Student.** If she is under 18, the guardian gets an OTP by SMS or WhatsApp. That OTP is the consent record.
  - **Volunteer/mentor.** Application, then screening, then safeguarding training, then an "active" status.
  - **School / teacher champion.** A school asks BGDI to come.
- Shareable links and QR codes with source tags (e.g. `?src=dayofthegirl-webinar`), so BGDI knows which campaign brought each person in.
- Each sign-up gets an immediate WhatsApp message (template message), with email as a fallback.

**B. Ops console (Fatimah, state leads, Central Planning Committee)**
- Sign-up inbox with Approve / Assign / Waitlist actions and suggested matches. The matching criteria are the same ones BGDI saw in the PoC (age group, interests, language, location, capacity), applied to cohorts as well as people.
- Roster of students, volunteers and schools, with role-based access: state leads see only their state.
- **Cohorts and sessions:** a cohort belongs to a school. It has a coach team, a session schedule and attendance taken on a phone in the classroom.
- Bulk WhatsApp/SMS announcements to a cohort or school, replacing "add to group by hand".
- Volunteer management: application status, safeguarding training done, hours logged, auto-generated certificate.
- Safeguarding: report a concern (anyone can), a case log, a named lead, an audit trail of who viewed child records.

**C. Impact from day one**
- A baseline survey at sign-up and an endline at the end of the cohort: a confidence scale and a short speech-rubric score from the coach.
- Live dashboard: girls reached by state, LGA, school and program; attendance; volunteer hours; baseline→endline change.
- **EduTracka overlay:** a BGDI reach map on top of EduTracka's LGA indicators.
- One-click **funder report export** (PDF/CSV), with an AI-drafted narrative section that staff edit before sending.

**D. Things deliberately left out of Phase 1**
- Children browsing and rating mentors.
- Open AI chat.
- Photo upload. Use avatars only until consent and moderation have been signed off.

### Phase 2: AI speech coach pilot (about 6–8 weeks, 3–5 schools, ~150 students)
- Build the PoC's "Practice my speech" first. It fits BGDI's core program best and is the easiest to measure.
- Flow: record 2 minutes, transcribe, score with a fixed rubric (pace, fillers, timing, structure), then give kind feedback. The coach sees the scorecards before the next session.
- Keep it **structured, not open chat**:
  - The model gets the transcript plus BGDI's rubric and returns JSON.
  - Guardrails stay on.
  - Recordings are deleted after scoring.
- Debate motions and lessons come from BGDI's own curriculum, written once.
- Measure it: compare pilot cohorts with non-pilot cohorts on the endline speech score. That comparison is the funder story.
- Also offer the same coach as a **WhatsApp voice-note bot**. A student sends a voice note and gets her scorecard back. No app, no login, and it works on a shared family phone.

### Phase 3: Scale (2027)
- **Competition manager:** school registration, team rosters, judge pool and allocation, ballots on phones, results. Integrate Tabbycat (open-source debate tab software) instead of rebuilding draw logic.
- **AI learning paths** (Dream Coach "Teach me / Let me teach it"), STEM and money modules, and 1:1 mentoring for graduates and older students. Alumni can become mentors.
- **Multi-state rollout:** a state-lead role and a state switch. Expansion schools chosen with EduTracka data.
- **Èkó Dára case management:** out-of-school child enrolment, fees and feeding disbursements, NYSC mentor visits, guardian business support.

## 5. Proposed architecture

A from-scratch Next.js app, hosted on AWS so it runs on BGDI's credits and keeps the AWS Social Impact team as a path for support. It is one codebase rather than many small cloud functions, so a small team can own it.

| Layer | Choice | Why |
|---|---|---|
| App | **Next.js (App Router, TypeScript)**, Tailwind, BGDI gold and black. One app for the public intake, the student and volunteer views, and the ops console. Server Actions and Route Handlers are the backend. | Same stack as EduTracka, so we reuse skills and components. One deployable is far easier to hand over than API Gateway plus many Lambdas. |
| Offline / PWA | Service worker with an offline queue for attendance and the intake form | Classrooms and phones on poor data |
| Hosting | AWS, deployed with SST (Next.js on Lambda + CloudFront, inside a private network with the database) | Uses BGDI's credits. Amplify Hosting can't reach a private database cleanly, so SST replaces it. |
| Auth | Better Auth inside the app: phone or email one-time codes for students, guardians and volunteers; password plus 2-step verification for staff | Children often have no email. One phone can serve a guardian and several children, which Cognito handles poorly. |
| Data | **Postgres (Aurora Serverless v2, which can scale to zero, or RDS t4g.micro)**, with Drizzle or Prisma for schema and migrations | The data is relational (school→cohort→session→attendance) and needs ad-hoc reporting. That is much harder on DynamoDB, which the PoC used. |
| Messaging | WhatsApp Cloud API (Meta) for WhatsApp, Termii for SMS, Amazon SES for email, Paystack for donations | WhatsApp first. Nigerian SMS needs sender-ID registration and WhatsApp templates need Meta's approval, so start both early. |
| Jobs | Lambda + EventBridge Scheduler | Nudges, "quiet for 7 days" flags, report generation |
| AI | Bedrock (Nova Lite for scoring/feedback, a stronger model only for report drafting) + Guardrails; Transcribe | Low cost, inside BGDI's AWS account, with structured output |
| Files | S3, private, presigned URLs, lifecycle deletion for recordings | |
| Analytics | SQL views, an in-app dashboard, a public "impact" endpoint for the website counters | QuickSight costs per user. An in-app dashboard costs less and is easier to share with funders. |
| IaC / ops | SST, GitHub Actions, Sentry, AWS Budgets alert | So whoever takes over after us can run it |

**Core data model:** Person (role: student / guardian / volunteer / staff), Guardian–Student link and Consent, School (EduTracka id, LGA, state), Program, Cohort, Session, Attendance, Assessment (baseline/endline, rubric scores), Match (optional 1:1), VolunteerProfile (screening, training, hours), SafeguardingCase, Message log, SpeechAttempt.

## 6. Success measures for Phase 1
- 100% of new sign-ups get a reply within 5 minutes, and none of them happen through manual WhatsApp adds.
- At least 1 real cohort run end to end in the Hub: sessions, attendance, baseline and endline.
- Fatimah spends under 1 hour a week on intake admin. Measure her current time first.
- A funder report for any date range comes out in under 5 minutes.
- No child's contact details are visible to any volunteer who hasn't finished safeguarding training.

## 7. Open questions (to settle before building)
1. **Access and role:** Will BGDI give us access to the AWS account with the credits, and does BGDI (and Guyu Ye at AWS) know we are building fresh rather than from the PoC?
2. **Delivery model:** Is it cohort-in-school, 1:1 mentoring, or both? How many volunteers are active right now?
3. **Consent:** What do schools and parents expect? Does a school MoU cover in-school activity?
4. **Channels:** Can BGDI register a WhatsApp Business number and an SMS sender ID?
5. **Ownership:** Who at BGDI owns the AWS account and this platform day to day (the "BGDI owner" from the Kickoff deck)?
6. **Calendar:** When do the next school term and debate season start? That sets the Phase 1 go-live date.
7. **Website:** Is "B-TECH" (the WordPress site's designer) still involved, or do we take the site over?
8. **Budget:** What is the money after the $10k credits run out (WhatsApp messages and SMS cost real money), and do funders want this costed into grants?

## 8. Immediate next steps for us
1. Agree on this plan, especially the "operating system first" decision.
2. Tell BGDI we're building fresh, and ask for AWS account access and the PoC screens they liked (reference only).
3. Book the session with Fatimah to answer section 7.
4. Build in the milestone order in [spec/14-build-order.md](spec/14-build-order.md): foundation, website, donations, sign-in and permissions, join and consent, console, volunteers and the Hub app, safeguarding, live messaging, impact, launch.
