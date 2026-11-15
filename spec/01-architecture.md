# 01 Architecture

## 1. Stack (fixed)

| Concern | Choice |
|---|---|
| Language | TypeScript, `strict: true` |
| Framework | Next.js 15+ App Router, React 19, Server Components by default |
| Package manager | pnpm |
| Styling | Tailwind CSS v4, shadcn/ui components copied into `src/components/ui` and restyled to DESIGN.md. The website also loads the tasteskill `system.css`, `layout.css` and `motion.css`; both read the same token values. |
| Fonts | Source Serif 4 and Libre Franklin through `next/font` (self-hosted) |
| Icons | lucide-react (app and console) |
| Motion | `motion` (Framer Motion), imported only under `/join` and `/app`; none on public pages |
| 3D | MapLibre `fill-extrusion` for the optional 3D reach map; React Three Fiber only for the optional Phase 3 certificate seal, dynamically imported |
| Forms | react-hook-form + zod (one zod schema shared by client and server) |
| Tables | TanStack Table |
| Charts | Recharts |
| Map | MapLibre GL JS with a static GeoJSON of Nigerian LGAs (geoBoundaries NGA ADM2, stored in `public/geo/`) and no paid tile service: plain polygons on a blank background |
| Rich text | Tiptap, stored as Tiptap JSON, rendered server-side |
| PDF | `@react-pdf/renderer` (certificates, receipts, reports) |
| Dates | date-fns + date-fns-tz. Store UTC, display `Africa/Lagos` |
| Database | PostgreSQL 16 |
| ORM | Drizzle ORM + drizzle-kit migrations |
| Auth | Better Auth with Drizzle adapter; plugins: `phoneNumber`, `emailOTP`, `twoFactor` |
| i18n | next-intl; locales `en` (default, no prefix) and `yo` (`/yo/...`) |
| PWA / offline | Serwist service worker; Dexie (IndexedDB) for offline queues |
| Infrastructure as code | SST v3 |
| Hosting | AWS: `sst.aws.Nextjs` (Lambda + CloudFront), region `eu-west-1` (**CONFIRM**; closest general region with all services) |
| Files | S3 private bucket, presigned PUT for upload, CloudFront for public media |
| Queue and jobs | SQS + one worker Lambda; `sst.aws.Cron` for schedules |
| Email | Amazon SES |
| WhatsApp | Meta WhatsApp Cloud API (Graph API) |
| SMS | Termii |
| Payments | Paystack hosted checkout |
| AI | Amazon Bedrock Converse API; Amazon Transcribe; Amazon Polly |
| Errors | Sentry |
| Tests | Vitest (unit, integration against a Postgres container), Playwright (end to end) |
| Lint / format | ESLint (next config) + Prettier |
| CI | GitHub Actions |

Local development uses Docker Compose for Postgres and MinIO (S3-compatible), and "console" providers for WhatsApp, SMS, email, payments and AI that log to the terminal and to the `message` table.

## 2. Repository layout

```
/
├─ SCOPE.md  PLAN.md  DECISIONS.md  README.md
├─ spec/
├─ sst.config.ts
├─ docker-compose.yml
├─ drizzle.config.ts
├─ messages/            en.json  yo.json
├─ public/              icons, geo/, og/, fonts/
├─ scripts/             seed.ts  import-schools.ts  import-wordpress.ts
├─ tests/               e2e/  integration/
└─ src/
   ├─ app/
   │  ├─ [locale]/
   │  │  ├─ (site)/           public website
   │  │  ├─ (join)/join/...   join flows
   │  │  ├─ (auth)/           sign-in pages
   │  │  ├─ app/              Hub app
   │  │  └─ console/          staff console
   │  ├─ api/                 route handlers (webhooks, uploads, embeds, cron-safe endpoints)
   │  ├─ manifest.ts  sitemap.ts  robots.ts  sw.ts
   ├─ components/  ui/  site/  hub/  console/  forms/  charts/
   ├─ db/          schema/*.ts  index.ts  migrations/
   ├─ server/
   │  ├─ auth/        better-auth config, session helpers, guards
   │  ├─ permissions/ can.ts  scopes.ts
   │  ├─ services/    one folder per module (people, intake, consent, volunteers, schools,
   │  │               cohorts, sessions, attendance, messaging, safeguarding, impact,
   │  │               reports, content, donations, ai, audit, tasks, settings)
   │  ├─ providers/   whatsapp/ sms/ email/ payments/ ai/ storage/  (interface + adapters)
   │  ├─ jobs/        handlers per job type, enqueue.ts, worker.ts
   │  └─ validation/  zod schemas shared with the client
   ├─ lib/           utils, formatters, constants, phone.ts, dates.ts
   └─ offline/       dexie db, sync queue
```

## 3. Layering rules

1. Pages and components never import `db`. They call **services**.
2. Every service function takes `ctx: { actor: Actor | null, locale }` first, calls `can(ctx.actor, action, resource)` before reading or writing, and writes an `audit_event` for any write and for any read of a child's sensitive fields.
3. Mutations are Server Actions in a `actions.ts` beside the page, each a thin wrapper: parse with zod → call service → `revalidatePath`. They return `{ ok: true, data } | { ok: false, error: { code, message, fieldErrors? } }`. Never throw to the client.
4. Route Handlers under `/api` are only for: webhooks, file-upload signing, public JSON embeds, offline sync, and health checks.
5. Providers are behind interfaces. Adapter chosen by env var. Every external call has a 10 s timeout and is retried by the job queue, not inline.
6. Money is stored as integer minor units (kobo, cents). Phone numbers are stored in E.164 (`+234…`), normalised by `lib/phone.ts` (accept `080…`, `80…`, `234…`, `+234…`).
7. IDs are UUID v7 generated in the app. Human-facing codes (certificate, receipt, campaign) are 8-character Crockford base32.
8. Soft delete with `deleted_at` on person, school, cohort, content tables. Everything else hard-deletes only through the data-request flow.

## 4. Environments

| Env | Domain | Data | Providers |
|---|---|---|---|
| local | `localhost:3000` | Docker Postgres, seed data | console adapters |
| staging | `staging.theblackgirlsdream.org` | Seed data only, no real children | real adapters in sandbox/test mode |
| production | `theblackgirlsdream.org` | Real | real |

SST stages: `dev-<name>`, `staging`, `production`. Production has deletion protection and `removal: retain` on the database and buckets.

## 5. Infrastructure (sst.config.ts)

- `Vpc` with `nat: "ec2"` (low-cost NAT instance).
- `Postgres` (Aurora Serverless v2, min 0 ACU with auto-pause on staging, min 0.5 ACU on production; RDS Proxy on).
- `Bucket` `Uploads` (private; lifecycle: prefix `speech/` expires after 1 day), `Bucket` `Media` (public through CloudFront, images only).
- `Queue` `Jobs` with dead-letter queue (max receive 5), subscriber `src/server/jobs/worker.handler`, visibility timeout 120 s.
- `Cron`: `SessionReminders` (every 15 min), `ConsentReminders` (daily 09:00 WAT), `QuietStudentFlags` (daily 07:00), `RetentionSweep` (daily 02:00), `StaffDigest` (weekdays 08:00), `ImpactSnapshot` (daily 01:00), `SpendCheck` (daily 06:00).
- `Email` (SES identity for `theblackgirlsdream.org`, DKIM).
- `Nextjs` linked to all of the above, custom domain, inside the VPC.
- AWS Budgets alarm at 50, 80, 100% of the monthly amount in `settings.aws_monthly_budget_usd` (default 150).

## 6. Environment variables

```
# core
APP_URL  NODE_ENV  DATABASE_URL  BETTER_AUTH_SECRET  ENCRYPTION_KEY (32-byte base64, for field encryption)
DEFAULT_LOCALE=en  TZ_DISPLAY=Africa/Lagos
# storage
S3_UPLOADS_BUCKET  S3_MEDIA_BUCKET  MEDIA_CDN_URL  AWS_REGION
# queue
JOBS_QUEUE_URL
# providers (adapter names)
WHATSAPP_PROVIDER=console|meta   SMS_PROVIDER=console|termii   EMAIL_PROVIDER=console|ses
PAYMENTS_PROVIDER=console|paystack   AI_PROVIDER=console|bedrock
# whatsapp
WHATSAPP_PHONE_NUMBER_ID  WHATSAPP_BUSINESS_ACCOUNT_ID  WHATSAPP_ACCESS_TOKEN
WHATSAPP_VERIFY_TOKEN  WHATSAPP_APP_SECRET
# sms
TERMII_API_KEY  TERMII_SENDER_ID
# email
EMAIL_FROM="Black Girl's Dream Initiative <hello@theblackgirlsdream.org>"  EMAIL_REPLY_TO
# payments
PAYSTACK_SECRET_KEY  PAYSTACK_PUBLIC_KEY
# ai
BEDROCK_MODEL_FAST (default amazon.nova-lite-v1:0)  BEDROCK_MODEL_WRITER (default amazon.nova-pro-v1:0)
BEDROCK_GUARDRAIL_ID  BEDROCK_GUARDRAIL_VERSION  TRANSCRIBE_LANGUAGE=en-NG (fallback en-GB)  POLLY_VOICE=Ayanda (fallback Amy)
# observability
SENTRY_DSN
```
Model IDs and voices must be verified against the AWS region at build time; they are env vars for that reason. Secrets are SST secrets, never committed.

## 7. Jobs

`enqueue(type, payload, { delaySeconds?, dedupeKey? })` writes a row to `job` (for visibility and dedupe) and sends to SQS. The worker loads the row, runs the handler, marks `done` or increments `attempts`. Handlers must be idempotent.

Job types: `message.send`, `message.broadcast.expand`, `consent.remind`, `session.remind`, `certificate.generate`, `report.generate`, `report.narrative`, `receipt.generate`, `speech.transcribe`, `speech.score`, `speech.cleanup`, `import.people`, `import.schools`, `retention.sweep`, `impact.snapshot`, `data_request.export`, `data_request.erase`.

## 8. Offline and PWA

- `manifest.ts`: name "BGDI Hub", short name "BGDI", theme `#1A1A1A`, background `#FDF8F0`, start URL `/app`, display `standalone`, icons 192/512 maskable.
- Service worker precaches the app shell for `/app/**` and `/join/**`; runtime cache: stale-while-revalidate for static assets, network-first with 3 s timeout for pages, never cache `/api/**` or `/console/**`.
- Dexie stores: `intakeDrafts`, `attendanceQueue`, `cohortCache` (roster and sessions for the volunteer's cohorts, refreshed when online).
- Sync: on `online` event and on app open, POST queued items to `/api/sync/attendance` and `/api/sync/intake`. Each item carries a client UUID; server upserts by it. Conflict rule for attendance: latest `recorded_at` wins.
- An offline banner shows "You're offline. We'll save this and send it when you're back online." Queued-item count shown on the volunteer home.

## 9. Internationalisation

- All strings in `messages/en.json`, keyed by area (`site.home.hero.title`). No literals in JSX.
- `messages/yo.json` mirrors every key. A companion `messages/yo.review.json` lists keys not yet human-reviewed; the console Admin → Settings → Languages page shows the count.
- Locale chosen by: URL prefix → `locale` cookie → person's `language` → `en`. The language switch (EN | Yorùbá) is in the header of every face.
- Database content with translations uses paired columns `*_en`, `*_yo` (nullable; fall back to `en`).
- Numbers and dates formatted with `Intl` using `en-NG`. Currency `₦` with no decimals.

## 10. Security

- All role checks on the server. Client hides what the server would refuse, never the reverse.
- Field encryption (AES-256-GCM with `ENCRYPTION_KEY`) for: `person.surname`, `person.phone`, `person.email`, `person.date_of_birth` of students and guardians, safeguarding case text. A `phone_hash` (HMAC-SHA256) column supports lookup.
- CSRF: Server Actions' built-in origin check; webhooks verify signatures.
- Headers: strict CSP (self, Paystack, Sentry, media CDN), HSTS, `X-Frame-Options: DENY` except `/embed/*` which allows `frame-ancestors *`.
- Rate limits (table `rate_limit`, fixed window): OTP send 3 per phone per 15 min and 10 per IP per hour; OTP verify 5 attempts per code; public forms 10 per IP per hour; report-a-concern 5 per IP per hour; speech attempts per `settings.ai_monthly_attempt_cap`.
- Uploads: images only (`jpeg`, `png`, `webp`), max 5 MB, re-encoded with `sharp` and EXIF stripped on a job before being marked usable; audio (`webm`, `ogg`, `m4a`, `mp3`) max 5 MB, P2 only.
- Staff sessions expire after 12 h idle; others after 30 days.

## 11. Testing and CI

- Unit: validation schemas, phone normalisation, matching score, metric formulas, permission checks (table-driven: every role × every action).
- Integration: each service against real Postgres with seed data; webhook signature checks; job idempotency.
- End to end (Playwright, mobile viewport 360×740): the journeys listed as acceptance criteria in spec/14.
- CI on every pull request: typecheck, lint, unit, integration, e2e against a preview build, `drizzle-kit check`. Merge to `main` deploys staging; a tagged release deploys production.
- Accessibility: axe checks in Playwright on every public page and the intake flow; zero serious violations.
- Performance budget (Lighthouse mobile, simulated slow 4G): website pages ≥ 90 performance; first load JS ≤ 120 KB on `/` and `/join/student`.

## 12. Observability

- Sentry for errors (PII scrubbing on; never send names or phones).
- Structured JSON logs with `requestId`, `actorId`, `action`.
- `/api/health` returns DB and queue status.
- Console → Admin → System health reads: failed jobs (DLQ depth), message failure rate last 24 h, month-to-date AWS spend (Cost Explorer), month-to-date message count × unit price, AI attempts this month.
