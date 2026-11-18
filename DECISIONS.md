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

**D-010 Donations (M2).** `PAYMENTS_PROVIDER` picks the adapter (`src/server/providers/payments.ts`). `paystack` uses Paystack's hosted checkout, so card details never reach BGDI; the webhook (`/api/webhooks/paystack`) and the thank-you page (which asks Paystack's verify endpoint) both settle a gift through one idempotent update that only matches a donation still `initiated`, so replays and double visits change nothing and send nothing. A settlement whose amount or currency differs from the donation is not marked paid and is audited as `donation.amount_mismatch`. `console` (local and staging) settles at once; an amount ending in 13 (e.g. ₦513) fails, so the failure screen can be tried. A `sk_live_` key is refused unless `PAYSTACK_ALLOW_LIVE=true`. Departures from spec/11:
- **Receipts are rendered, not stored.** The PDF (`src/server/receipts/pdf.ts`, pdf-lib, one A4 page) is built from the donation row when the email is sent and when staff open it in the console, instead of a `receipt.generate` job writing a file. `receipt_key` stays empty until media storage (S3) exists. The standard PDF fonts only cover Latin-1, so the PDF writes "NGN 5,000.00" and drops Yorùbá underdots (ọ → o); **CONFIRM** whether BGDI wants an embedded font for full Yorùbá spelling.
- **The receipt email carries no name.** Message variables are stored in plain JSON beside the encrypted body, so the `donation.receipt` body has amount, date, designation, reference and receipt code only; the name is on the PDF.
- **Monthly renewals.** Paystack makes the reference for each renewal, so a `charge.success` with a plan and an unknown reference creates a new `paid` row for that supporter, copying designation and `subscription_code` from their latest monthly gift at the same amount. `subscription.create` writes the code onto the first gift. `invoice.payment_failed` creates one `failed` row per invoice (`BGDI-INV-…`) and sends `donation.failed`. `subscription.disable` is audited only (there is no subscription table). The first receipt says Paystack emails the manage link, because the subscription code arrives after the first charge.
- **USD** works end to end but stays off (`donations_usd_enabled`); **CONFIRM** that BGDI's Paystack account accepts USD before turning it on.
- **Fees** are stored from Paystack's `fees`; totals are gross.
- **CONFIRM** the CAC number and address (`org_cac_number`, `org_address`) so they print on receipts.

**D-012 Console access.** spec/14 built donations (M2) before sign-in (M3), so M2 closed the console outside development. Since M3 the console needs a full staff session (password and 2-step, D-013) and each console service checks `can()` itself: `donation.view` for programme managers and admins, `user.manage` for admins. `donation.manage` (resend, offline gift, refund) follows `donation.view` until spec/03 lists it. `CONSOLE_DEV_ACCESS` is gone. The console's own strings are English only; Yorùbá drafts cover the public and Hub pages.

**D-013 Sign-in built here, not Better Auth.** spec/01 names Better Auth; BGDI asked for no third-party auth library, so sign-in is our own code on Node's `crypto` (`src/lib/auth-crypto.ts`, `src/server/auth/`). What it does:
- **Sessions** are random 32-byte tokens in an httpOnly `bgdi_session` cookie; only the SHA-256 of the token is stored (`auth_session`), so a database leak gives no usable session. Phone and email sessions last 30 days, staff sessions 12 hours. Sign-out deletes the row.
- **Codes** (phone by SMS/WhatsApp, email for volunteers and champions) are 6 digits, stored as a keyed hash, valid 10 minutes, single use, 5 wrong tries, 5 requests an hour per number and 10 per IP. The answer is the same whether or not an account exists. Codes are never kept in message variables, and production logs never print message bodies.
- **Staff** sign in with email + password (scrypt) and then a TOTP code (RFC 6238, any authenticator app), or one of 10 single-use backup codes. Staff roles count only in a session that passed both steps; a code sign-in for a staff email sends nothing, and staff roles are stripped from any other session. Five wrong tries lock the account for 15 minutes and email the owner. Invites (72 hours) and resets (30 minutes) are emailed links. The first admin comes from `pnpm auth:invite-admin`.
- **Profiles.** One phone can be a guardian and their children; the person picked on `/sign-in/who` is the actor until they switch.
- **Not done yet:** passkeys, "sign out everywhere" for non-staff, and an admin reset of someone else's 2-step (today: deactivate and re-invite). **CONFIRM** that BGDI is happy without Better Auth's extras (social sign-in, magic links), which spec/03 does not ask for.

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
