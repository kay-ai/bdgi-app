# Decisions

Where the build departs from `spec/` or DESIGN.md, or settles something they left open. Items marked **CONFIRM** need an answer from BGDI before launch.

## Engineering

**D-001 Embedded database for local work.** With `DATABASE_URL` empty the app uses PGlite (PostgreSQL compiled to WebAssembly) in `.data/pglite`. Spec/14 M0 asks for Docker Compose; PGlite removes that dependency for development and tests while running the same SQL and migrations. Staging and production use PostgreSQL through `DATABASE_URL`. Messaging inside a transaction takes the transaction's executor (`queueTemplate(..., tx)`) because PGlite has a single connection and would otherwise deadlock.

**D-002 Forms use React state and zod, not react-hook-form.** The forms are short and the same zod schemas validate on the server. Adding react-hook-form bought nothing.

**D-003 Offline intake sync calls the server action.** Spec/05 names `/api/sync/intake`. The Dexie queue replays the same `submitStudentAction` instead, so there is one code path and one validator. Idempotency is by the client-generated `clientId`.

**D-004 Redirects come from a static list in middleware.** Middleware runs before the database is reachable, so it reads the same list the seed writes to the `redirect` table. Console edits to redirects will need a deploy until the edge cache is wired (M5).

**D-005 Policy pages fall back to drafts in code.** `/privacy`, `/safeguarding`, `/terms` and `/cookies` render the drafts from spec/09 §8 (`src/content/legal.ts`) with a visible "draft" notice. Once BGDI publishes reviewed `content_page` rows, those replace the drafts. **CONFIRM:** review by BGDI and a lawyer; names of the safeguarding leads.

**D-006 Report-a-concern fields.** The form asks for category, what happened (at least 20 characters), whether anyone is in danger (yes / no / not sure), and optional name and contact with an "anonymous" switch. Spec/09 §2 also lists "who is this about", "school or place" and "when"; these are left to the free text for now to keep the form short. "Yes" to danger sets severity `emergency`.

**D-007 Story and event covers.** Media upload (S3) is not built yet. Covers stored as site paths (`/img/...`) render; anything else falls back to one of BGDI's own photographs.

**D-008 Partner enquiries reuse the contact form.** Spec/04 §6.9 lists an "interest" multi-select. The partner form stores the organisation in the message body with topic `partnership`; interests are left to the message text.

**D-009 Team cards show initials on gold** until BGDI supplies portraits (`team_member.photo_key`). The single leadership entry is shown as a row, not a large card, so no section is left mostly empty.

**D-010 Donations in development.** The console payments provider marks a donation paid at once. The `donation.receipt` template body is a description placeholder until M2 builds the PDF receipt.

**D-011 A 3D journey on the website.** DESIGN.md §9 first kept 3D off the website (photographs only, for speed on low-cost phones). BGDI asked for more than an ordinary site, so the website now has a scroll-driven 3D layer (DESIGN.md §9.1): a paper plane that visits floating school objects and ends at a graduation cap. It adds nothing to the first load, and is switched off for reduced motion, Save-Data, low-memory devices and the sensitive pages. **CONFIRM:** try it on the phones BGDI's students actually use; if it stutters there, raise the memory threshold in `Journey.tsx` so those phones get the plain site.

## Content

**D-101 Photographs come from BGDI's current website** (theblackgirlsdream.org uploads), stored in `public/img/bgdi/`. The logo is BGDI's own PNG. **CONFIRM:**
- that recorded permission exists for every child shown;
- which event each photograph is from (the programme photo for Inspire Her Future and for Èkó Dára are stand-ins);
- a vector (SVG) logo, which would replace the PNG.

**D-102 Words written for this build.** These were not on the current site and should be checked by BGDI:
- About: the "Our story" paragraphs (founding year 2021 taken from the home page figures), and one line for each value (spec/04 §6.2 leaves these to an editor).
- Get involved: time needed for each way in.
- Report a concern: the "what happens next" lines (taken from spec/09 §2 timings).

**D-103 Yorùbá.** 41 of the 593 strings have a draft Yorùbá translation (`messages/yo.json`, with notes in `yo.review.json`). Missing keys fall back to English. **CONFIRM:** a native-speaker review before the language switch is promoted.

**D-104 Reach map.** `/impact` shows LGAs as a tile grid with a full data table. The geographic map waits for the geoBoundaries GeoJSON for Oyo and Osun.
