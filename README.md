# BGDI Hub and website

The website and programme platform for Black Girl's Dream Initiative (Ibadan, Oyo State). One Next.js app serves three faces:

- **Website** (`/`, `/about`, `/programmes`, `/impact`, `/donate`, …) for the public, in English and Yorùbá (`/yo/...`).
- **Join flows** (`/join/student`, `/join/volunteer`, `/join/school`, `/consent/[token]`) for students, guardians, volunteers and schools.
- **Hub and console** (`/app`, `/console`) for volunteers and staff. Not built yet: see "Status" below.

The specifications live in [`spec/`](spec/), the design system in [DESIGN.md](DESIGN.md), and the reasons behind departures from either in [DECISIONS.md](DECISIONS.md).

## Run it locally

Requires Node 22 and pnpm 9 (`npm i -g pnpm@9` if `corepack` is blocked).

```bash
pnpm install
```

```bash
pnpm db:migrate
```

```bash
pnpm db:seed
```

```bash
pnpm dev
```

Then open http://localhost:3000.

No database server or Docker is needed: with `DATABASE_URL` empty, the app uses an embedded PostgreSQL (PGlite) stored in `.data/pglite`. Set `DATABASE_URL` to use a real PostgreSQL instead. `pnpm db:reset` wipes and re-seeds the local database (it refuses to run when `DATABASE_URL` is set).

**Only one process may open the PGlite folder at a time.** Stop `pnpm dev` before running `db:migrate`, `db:seed` or `db:reset`; two processes writing to it at once can corrupt it. If every page fails with `RuntimeError: Aborted()`, run `pnpm db:check`. If that fails too, the folder is damaged: move `.data/pglite` aside and run `pnpm db:migrate` and `pnpm db:seed` again.

Messages (WhatsApp, SMS, email) and payments use **console providers** by default: nothing leaves your machine. Outgoing messages print to the terminal, including the guardian's permission link and code, and are stored in the `message` table. Donations are marked paid immediately (an amount ending in 13, such as ₦513, fails instead), and the receipt email prints with its PDF attachment's name and size.

### Paystack test mode

1. In the Paystack dashboard (test mode), copy the test secret key into `.env.local` as `PAYSTACK_SECRET_KEY=sk_test_…` and set `PAYMENTS_PROVIDER=paystack`.
2. Set the test webhook URL to `{APP_URL}/api/webhooks/paystack`. Paystack cannot reach `localhost`, so locally use a tunnel (for example `cloudflared tunnel --url http://localhost:3001`) and set `APP_URL` to the tunnel address. Without a webhook the thank-you page still confirms the payment by asking Paystack.
3. Pay with one of Paystack's published test cards. Never use real card details or live keys outside production.

Staff (programme managers and admins) see gifts at `/console/donations`: totals, filters, CSV export, supporter pages, receipt PDFs, resend receipt, record an offline gift, mark refunded. Anyone can check a receipt at `/verify/receipt/[code]`.

### Environment

Copy `.env.example` to `.env.local`. Everything has a safe local default. Values that matter before going live:

| Variable | Purpose |
|---|---|
| `APP_URL` | Public base URL, used in links inside messages |
| `DATABASE_URL` | PostgreSQL connection string. Empty means PGlite |
| `ENCRYPTION_KEY` | 32 bytes, base64. Encrypts names, phones, dates of birth and free text. **Required in production**; a fixed development key is used locally |
| `*_PROVIDER` | `console` locally. `PAYMENTS_PROVIDER=paystack` uses Paystack; messaging providers arrive with M8 |
| `PAYSTACK_SECRET_KEY` | Paystack secret key. Test key (`sk_test_…`) locally and on staging; signs and checks webhooks |
| `PAYSTACK_ALLOW_LIVE` | `true` only in production secrets. Without it a `sk_live_…` key is refused |
| `CRON_SECRET` | Long random string. Vercel Cron sends it as `Authorization: Bearer …` to `/api/cron/*`. **Required in production**; locally the jobs run without it |

### Sign-in

Students, guardians, volunteers and champions sign in at `/sign-in` with a code sent to their phone (or email). Locally the console provider prints the code in the terminal. Staff sign in at `/staff/sign-in` with a password and a 2-step code from an authenticator app. There is no staff sign-up: create the first admin once, then invite everyone else from `/console/admin/users`.

```bash
pnpm auth:invite-admin -- --email you@example.org --first Ada --surname Obi
```

It emails (and prints) a link to set a password; the first sign-in then sets up 2-step and shows ten backup codes once. See DECISIONS.md D-013.

### Scheduled jobs

Vercel Cron calls `/api/cron/messages` (send retries and messages held by quiet hours) and `/api/cron/consent-reminders` (guardian reminders on day 2 and 6, a staff task on day 10). Locally, run one by opening it in the browser, for example `http://localhost:3000/api/cron/consent-reminders`. See DECISIONS.md D-014.

## Checks

```bash
pnpm typecheck
```

```bash
pnpm test
```

The tests include the M3 acceptance checks (`tests/permissions.test.ts` reads the role × action table from spec/03 and checks every cell; `tests/auth.test.ts` covers codes, the profile chooser, staff 2-step and the volunteer student view) and the M2 checks (`tests/donations.test.ts`): they run the Paystack flow against an in-memory database with Paystack's API replaced by a fake, so they need no keys or network. The M4 checks are `tests/join-consent.test.ts` (intake, guardian permission, the five-try lock, withdrawal, duplicates, reminders, quiet hours, STOP) and `tests/messaging-retry.test.ts` (retries and SMS fallback).

```bash
pnpm test:e2e
```

Runs the browser journeys in `e2e/` with Playwright on the installed Chrome (`PW_CHANNEL=msedge` for Edge). It starts its own dev server on port 3015 with a fresh database in `.data/pglite-e2e`, so stop nothing first. The intake journey fills the student form at 360 px wide, goes offline from step 2 until just before submit, and must finish in under 3 minutes.

```bash
pnpm build
```

To build while `pnpm dev` is running, give the build its own folder and database so it doesn't fight the dev server: `NEXT_DIST_DIR=.next-build PGLITE_DIR=.data/pglite-build` (migrate and seed that database first).

## Layout of the code

```
src/
  app/[locale]/(site)/     website pages (header, footer, phone action bar)
  app/[locale]/(join)/     join and consent flows (minimal shell with an exit)
  app/actions/             shared server actions for the public forms
  components/site|join|ui/ components by face
  content/                 photo slots and policy drafts
  db/schema/               Drizzle tables; migrations in db/migrations
  i18n/, messages/         next-intl routing and strings (en.json, yo.json)
  lib/                     phone numbers, encryption, formatting
  offline/                 Dexie store for intake drafts and the offline queue
  server/services/         all reads and writes; every write is audited
  server/auth/             sessions, codes, staff password + 2-step, invites
  server/permissions/      can(), the spec/03 matrix, SQL scopes
  server/seed/             seed data (programmes, team, FAQs, templates, redirects)
scripts/                   migrate, seed, reset, invite-admin
tests/                     unit tests (vitest)
e2e/                       browser journeys (Playwright)
```

Rules the code follows: pages never query the database directly, only through `src/server/services`. Every write takes a `Ctx` (actor, locale, IP) and writes an `audit_event`. Personal fields are encrypted at rest with lookup hashes for search. Messages are queued inside the same transaction as the change that caused them and sent after it commits, so a rollback never sends a message.

## Status

Built and checked in the browser (1440 and 375 wide):

- Every website page in spec/04 §3 except gallery, press and impact reports: home, about, team, programmes and each programme, impact, stories, events, get involved, partner, donate (console payments), contact, report a concern, FAQ, privacy, safeguarding, terms, cookies, sign-in placeholder, 404.
- Student intake with offline drafts, guardian permission page with code, volunteer application, school request, contact and partner enquiries, safeguarding reports with `SG-YYYY-NNNN` references.
- Old WordPress paths redirect (spec/04 §8).

- Donations (M2): Paystack hosted checkout for one-off and monthly gifts, signed and idempotent webhook, PDF receipts by email, public receipt check, fundraising progress on programme pages, and `/console/donations` (development only until sign-in).

- Sign-in and permissions (M3): phone and email codes, staff password + 2-step, profile chooser, spec/03 permission matrix.
- Join and consent (M4): messaging core with quiet hours, retries and fallback, guardian reminders and staff reissue, scheduled jobs, and the 360 px intake journey in Playwright.

Next milestones (spec/14): M5 onwards, the Hub and the rest of the console.
