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

Messages (WhatsApp, SMS, email) and payments use **console providers** by default: nothing leaves your machine. Outgoing messages print to the terminal, including the guardian's permission link and code, and are stored in the `message` table. Donations are marked paid immediately.

### Environment

Copy `.env.example` to `.env.local`. Everything has a safe local default. Values that matter before going live:

| Variable | Purpose |
|---|---|
| `APP_URL` | Public base URL, used in links inside messages |
| `DATABASE_URL` | PostgreSQL connection string. Empty means PGlite |
| `ENCRYPTION_KEY` | 32 bytes, base64. Encrypts names, phones, dates of birth and free text. **Required in production**; a fixed development key is used locally |
| `*_PROVIDER` | `console` locally; real providers arrive with M2 (Paystack) and the messaging work |

## Checks

```bash
pnpm typecheck
```

```bash
pnpm test
```

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
  server/seed/             seed data (programmes, team, FAQs, templates, redirects)
scripts/                   migrate, seed, reset
tests/                     unit tests (vitest)
```

Rules the code follows: pages never query the database directly, only through `src/server/services`. Every write takes a `Ctx` (actor, locale, IP) and writes an `audit_event`. Personal fields are encrypted at rest with lookup hashes for search. Messages are queued inside the same transaction as the change that caused them and sent after it commits, so a rollback never sends a message.

## Status

Built and checked in the browser (1440 and 375 wide):

- Every website page in spec/04 §3 except gallery, press and impact reports: home, about, team, programmes and each programme, impact, stories, events, get involved, partner, donate (console payments), contact, report a concern, FAQ, privacy, safeguarding, terms, cookies, sign-in placeholder, 404.
- Student intake with offline drafts, guardian permission page with code, volunteer application, school request, contact and partner enquiries, safeguarding reports with `SG-YYYY-NNNN` references.
- Old WordPress paths redirect (spec/04 §8).

Next milestones (spec/14): M2 Paystack donations, M3 sign-in and permissions, then the Hub and console.
