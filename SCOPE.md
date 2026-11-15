# BGDI Hub and Website: full build specification

*v2, 15 Nov 2026. This file is the index. The detail lives in [spec/](spec/). Where PLAN.md and the spec disagree, the spec wins.*

## How to use this specification

It is written so that a developer or an AI coding agent can build the whole product without asking what was meant. Rules for whoever builds it:

1. Read this file, then `spec/01` to `spec/14` in order before writing code.
2. Build in the order given in [spec/14-build-order.md](spec/14-build-order.md). Each milestone has acceptance criteria; do not start the next until they pass.
3. Names of routes, tables, columns, enums, env vars and message templates are fixed. Use them exactly.
4. Where the spec says **CONFIRM**, a real-world fact is still owed by BGDI. Build with the stated default and keep it configurable.
5. Never invent content about real people (team bios, quotes, statistics). Use the seed content given, or the placeholder rule in spec/04 §9.
6. If something is truly not covered, choose the simplest option consistent with the principles below and record it in `DECISIONS.md`.

## Product

One Next.js application on one domain (`theblackgirlsdream.org`) with three faces:

| Face | Path | For |
|---|---|---|
| **Website** | `/` and public pages | Visitors, funders, schools, prospective students and volunteers. Replaces the current WordPress site. |
| **Hub app** | `/app` | Students, guardians, volunteers, school champions. Installable on a phone. |
| **Console** | `/console` | BGDI staff: programmes, messaging, safeguarding, impact, website content, administration. |

The website is not a brochure beside the app. It reads the same database: impact numbers, the reach map, events, stories, programme pages and join forms are all live.

## Principles (apply everywhere)

1. **Children's safety first.** No adult sees a child's contact details. No child is visible to a volunteer before guardian consent and volunteer safeguarding training.
2. **Phone first, low data.** Every screen works on a 360 px wide Android phone on 3G.
3. **WhatsApp before email.** Students and guardians are reached by WhatsApp, then SMS, then email.
4. **Staff approve, software suggests.** Matching, AI text and reports are suggestions until a person confirms.
5. **Measure outcomes from day one.** Baseline at intake, endline at cohort close.
6. **One codebase a small team can own.** No microservices.
7. **English and Yoruba.** Every user-facing string goes through the translation files.

## Roles

`student`, `guardian`, `volunteer`, `school_champion`, `state_lead`, `programme_manager`, `safeguarding_lead`, `content_editor`, `admin`. Public visitors have no role. Definitions and permissions: [spec/03](spec/03-auth-permissions.md).

## Phases

| Phase | Contents | Estimate |
|---|---|---|
| **P1a Website** | Revamped website, content management, donations, join forms writing to the Hub database | 4 weeks |
| **P1b Hub core** | Intake and consent, volunteers, schools, console, cohorts, sessions, attendance, messaging, safeguarding, impact, reports, admin | 6–8 weeks (overlaps P1a by 2) |
| **P2 AI coach** | Speech practice in browser and by WhatsApp voice note, pilot measurement | 6–8 weeks |
| **P3 Scale** | Learning paths, competition manager, Èkó Dára case management, 1:1 mentoring, supporter records, school champion portal, Pidgin | 2027 |

## Specification files

| # | File | Contents |
|---|---|---|
| 01 | [Architecture](spec/01-architecture.md) | Stack, repo layout, environments, env vars, conventions, jobs, offline, i18n, testing, deployment |
| 02 | [Data model](spec/02-data-model.md) | Every table, column, enum, index and constraint |
| 03 | [Auth and permissions](spec/03-auth-permissions.md) | Sign-in flows, sessions, roles, permission matrix, field-level rules |
| 04 | [Website](spec/04-website.md) | Sitemap, every page section by section, content management, SEO, WordPress migration and redirects |
| 05 | [Join and consent](spec/05-join-consent.md) | Student intake, guardian consent, volunteer application, school request, partner enquiry |
| 06 | [Hub app](spec/06-hub-app.md) | Student, guardian, volunteer and school champion screens; offline attendance |
| 07 | [Console](spec/07-console.md) | Every staff screen, matching rules, tasks, admin |
| 08 | [Messaging](spec/08-messaging.md) | Channels, routing, every template with its text, broadcasts, webhooks |
| 09 | [Safeguarding and privacy](spec/09-safeguarding-privacy.md) | Concerns, cases, audit, retention, data requests |
| 10 | [Impact and reporting](spec/10-impact-reporting.md) | Assessments, metric definitions, dashboard, map, report builder |
| 11 | [Donations](spec/11-donations.md) | Paystack flow, receipts, supporter records |
| 12 | [AI speech coach](spec/12-ai-speech-coach.md) | Recording, transcription, metrics, prompts, WhatsApp bot, controls |
| 13 | [Phase 3 modules](spec/13-phase3-modules.md) | Learning paths, competition manager, Èkó Dára, mentoring, champion portal |
| 14 | [Build order](spec/14-build-order.md) | Milestones, acceptance criteria, seed data, tests |
| – | [Design plan](DESIGN.md) | Colour, type, layout, copy, motion and 3D for the website, app and console. Wins over the spec on anything visual. |

## Out of scope

- Native iOS or Android apps (the web app installs to the home screen).
- Open-ended AI chat with children.
- Children publicly rating adults.
- Exchange of phone numbers between volunteers and students.
- Rebuilding EduTracka. The Hub imports its data and links to it.
- Accounting, payroll and staff HR.
- USSD access.
- An online shop.

## Facts BGDI still owes (CONFIRM list)

| # | Item | Default used until confirmed |
|---|---|---|
| 1 | Brand colours and fonts | Tokens in DESIGN.md §4, taken from the logo and the AWS decks |
| 2 | Yoruba translations | Machine-drafted strings in `messages/yo.json`, flagged `needsReview`; a native speaker at BGDI must review before launch |
| 3 | WhatsApp Business number and approved templates | Console provider in dev; SMS and email only in production until approved |
| 4 | SMS sender ID ("BGDI") | Generic sender |
| 5 | Paystack account, and whether USD is enabled | NGN only |
| 6 | Safeguarding lead and deputy names | Admin receives concerns |
| 7 | School agreement template | Text in spec/05 §5 |
| 8 | Real impact figures for history before the Hub | Seed values in spec/14 §5 (2,000 students, 85 schools, 200 volunteers, 2 states) |
| 9 | Team bios, photos, board list, partner logos and permission to use them | Names and titles from the current site; initials avatars |
| 10 | School lists for Osun and expansion states | Oyo only; "My school isn't listed" free text elsewhere |
| 11 | Data retention periods | spec/09 §6 |
| 12 | Registered charity details for receipts (CAC number, address) | Placeholders in site settings |
