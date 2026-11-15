# 11 Donations

Ships with the website (P1a). Card details never touch BGDI's servers: Paystack's hosted checkout handles payment.

## 1. Donate widget (block `donate_widget`, page `/donate`)

1. Frequency toggle: **One-off** | **Monthly**.
2. Currency: NGN (default). USD shown only if `settings.donations_usd_enabled`.
3. Amount: preset buttons from settings (default NGN 2,000 · 5,000 · 10,000 · 25,000 · 50,000; USD 10 · 25 · 50 · 100) and "Other" (min NGN 500 / USD 2; max NGN 5,000,000 / USD 5,000). Each preset can carry an impact line from settings (e.g. "₦5,000 covers training materials for one student for a term" – **CONFIRM** real unit costs; hide lines until confirmed).
4. "Where should it go?": Where it's needed most (default) or a programme with `accepts_designated_gifts`.
5. Your details: full name, email (required), phone (optional), ☐ Give anonymously (name hidden from public lists), ☐ Send me updates, optional message.
6. Button "Give ₦5,000".

## 2. Flow

1. Server Action `donations.initiate`: validate; upsert `supporter` by email hash; create `donation` (`initiated`, reference `BGDI-{base32}`), call Paystack `POST /transaction/initialize` with amount in kobo/cents, email, reference, `callback_url = {APP_URL}/donate/thank-you?ref=…`, metadata (donation id, designation), and for monthly a `plan` code (plans created lazily per amount+currency via `POST /plan`, cached in `setting`). Redirect to `authorization_url`.
2. `/donate/thank-you`: verify with `GET /transaction/verify/{reference}`; show success (amount, reference, "Your receipt is on its way") or failure with "Try again". Never trust the query string alone.
3. `POST /api/webhooks/paystack`: verify `x-paystack-signature` (HMAC-SHA512 of the raw body with the secret key); handle `charge.success` (mark `paid`, store fees and `paid_at`; for recurring charges create a new `donation` row linked by `subscription_code`), `invoice.payment_failed` (create failed row, send `donation.failed`), `subscription.disable`. Idempotent on reference.
4. On `paid`: job `receipt.generate` → PDF (BGDI details and CAC number from settings, supporter name, amount, date, reference, designation, receipt code, "Thank you") → email `donation.receipt`; revalidate programme progress bars.
5. Public verification `/verify/receipt/[code]` shows date, amount and "valid" only.

Monthly donors get a manage link in each receipt → Paystack's subscription management page.

## 3. Console `/console/donations`

- List: date, supporter, amount, currency, frequency, designation, status, campaign. Filters and CSV export.
- Totals: this month, this year, by designation, one-off vs monthly, average gift, new vs returning supporters.
- Supporter page: contact, gifts, total, notes, "wants updates".
- Actions: resend receipt; record an offline gift (bank transfer or cash: amount, date, supporter, note; status `paid`, provider `offline`); mark refunded (after refunding in Paystack).
- Programme fundraising targets: `programme.fundraising_target_minor` and currency drive the progress bar on the programme page (e.g. Èkó Dára $250,000).

## 4. Rules

- Amounts are integers in minor units. NGN and USD totals are never added together; they are shown side by side.
- Donor names appear publicly nowhere in P1.
- The `console` payments adapter simulates success/failure for local and staging use.
- Paystack test keys on staging; live keys only in production secrets.
