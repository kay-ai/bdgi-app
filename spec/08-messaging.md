# 08 Messaging

## 1. Provider interfaces (`src/server/providers`)

```ts
interface WhatsAppProvider {
  sendTemplate(to: string, name: string, lang: 'en'|'yo', params: string[], buttons?: UrlButton[]): Promise<{providerId: string}>
  sendText(to: string, body: string): Promise<{providerId: string}>           // only inside the 24-hour window
  downloadMedia(mediaId: string): Promise<{bytes: Buffer, mime: string}>     // P2 voice notes
}
interface SmsProvider   { send(to: string, body: string): Promise<{providerId: string}> }
interface EmailProvider { send(to: string, subject: string, html: string, text: string, attachments?): Promise<{providerId: string}> }
```
Adapters: `meta` (Graph API `POST /{PHONE_NUMBER_ID}/messages`), `termii`, `ses`, and `console` for each (logs and stores the message as `sent`).

## 2. Sending pipeline

`messaging.send({ personId | address, templateKey, variables, eventKey, channels? })`:
1. If `eventKey` already exists in `message`, return (idempotent).
2. Resolve language (person's, else `en`) and channel order: the template's allowed channels ∩ [preferred channel, then whatsapp, sms, email] ∩ what the person has. WhatsApp requires `whatsapp_opt_in` and an **approved** template; otherwise skip to SMS.
3. Check `channel_opt_out` (authentication and safeguarding messages ignore marketing opt-outs; consent requests are sent once even if opted out, then stop).
4. Block if the person is a student who is `pending_consent`, `declined`, `left` or `anonymised`, except templates flagged `allow_before_consent` (`student.welcome`, `auth.otp`).
5. Render body from the template with variables (missing variable → fail the job loudly).
6. Insert `message` (`queued`), enqueue `message.send`.
7. Worker sends; on provider failure retries with backoff (1 m, 5 m, 30 m); after final failure on one channel, falls to the next channel; if all fail → `failed` and, for consent and session messages, a staff task.
8. Status updates arrive by webhook and update `delivered_at`, `read_at`, `status`.

SMS bodies are capped at 300 characters (two segments); templates have a short `sms` variant when the main body is longer. Quiet hours: non-urgent messages queued between 21:00 and 07:00 WAT are delayed to 07:00 (auth codes and safeguarding are exempt).

## 3. Webhooks

- `GET /api/webhooks/whatsapp`: verification handshake with `WHATSAPP_VERIFY_TOKEN`.
- `POST /api/webhooks/whatsapp`: verify `X-Hub-Signature-256` with `WHATSAPP_APP_SECRET`; handle `statuses` (update message) and `messages` (inbound). Inbound handling:
  - text `STOP` / `UNSUBSCRIBE` (any case) → opt out, reply `system.opted_out`;
  - text `START` → opt in;
  - text `HELP` → reply `system.help`;
  - audio from a known student with AI practice enabled → P2 bot (spec/12 §7);
  - anything else → store as inbound `message`, open the 24-hour window, show in the person's log, create a `contact` inbox item if from an unknown number or if it contains a question mark; auto-reply `system.auto_reply` at most once per 24 h.
- `POST /api/webhooks/termii`: delivery reports. `POST /api/webhooks/ses` (SNS): bounces and complaints → mark email invalid, opt out.

## 4. Templates

Stored in `message_template`, seeded from this table, editable in the console (edits to WhatsApp bodies set `whatsapp_status = not_submitted` and show a warning that Meta must re-approve). Variables are `{{name}}` in storage and mapped to positional parameters for WhatsApp in the order listed. Yoruba bodies are seeded from machine drafts and flagged for review. "Opt-out line" = "Reply STOP to stop messages." appended to non-authentication WhatsApp/SMS bodies.

| key | to | channels | English body |
|---|---|---|---|
| `auth.otp` | anyone | wa, sms, email | "Your BGDI code is {{code}}. It expires in 10 minutes. Don't share it." |
| `student.welcome` | student | wa, sms | "Hi {{firstName}}! Thank you for joining the Dream. We've asked {{guardianName}} for permission. We'll message you once you're placed in a group." |
| `consent.request` | guardian | wa, sms | "Hello {{guardianName}}. {{studentFirstName}} would like to join Black Girl's Dream Initiative, a free programme at {{schoolName}}. Please give your permission here: {{link}} Your code is {{code}}. Questions? Call {{orgPhone}}." |
| `consent.reminder` | guardian | wa, sms | "Reminder: {{studentFirstName}} is waiting for your permission to join BGDI. {{link}} Code: {{code}}" |
| `consent.thanks` | guardian | wa, sms | "Thank you. {{studentFirstName}} can now take part in BGDI. You can change your choices any time: {{link}}" |
| `consent.declined_ack` | guardian | wa, sms | "We've recorded that you do not give permission for {{studentFirstName}}. We will not contact her further. If this was a mistake: {{link}}" |
| `consent.school_notice` | guardian | wa, sms | "Hello. {{schoolName}} has enrolled {{studentFirstName}} in BGDI's {{programmeName}}, a free school activity. Learn more or opt out: {{link}}" |
| `consent.withdrawn` | guardian | wa, sms | "We've recorded that you have withdrawn permission for {{studentFirstName}}. She has been removed from BGDI activities." |
| `student.consent_given` | student | wa, sms | "Good news, {{firstName}}! {{guardianName}} said yes. We're finding your group now." |
| `student.placed` | student + guardian | wa, sms | "{{firstName}} is in! Group: {{cohortName}}. First session: {{date}} at {{time}}, {{venue}}. Coach: {{coachName}}." |
| `student.waitlisted` | student + guardian | wa, sms | "{{firstName}} is on our waiting list for {{programmeName}} at {{schoolName}}. We'll message you as soon as a group opens." |
| `student.declined` | guardian | wa, sms | "Thank you for {{firstName}}'s interest in BGDI. We can't offer a place right now: {{reason}}. We'll keep in touch about future programmes." |
| `session.reminder` | student, coach | wa, sms | "Reminder: {{programmeName}} {{when}} at {{time}}, {{venue}}. See you there!" (`when` = "tomorrow" or "today") |
| `session.cancelled` | student, guardian, coach | wa, sms | "{{programmeName}} on {{date}} is cancelled: {{reason}}. Next session: {{nextDate}}." |
| `session.rescheduled` | same | wa, sms | "{{programmeName}} has moved to {{date}} at {{time}}, {{venue}}." |
| `student.quiet` | guardian | wa, sms | "We've missed {{firstName}} at the last {{count}} sessions of {{programmeName}}. Is everything okay? Reply to this message or call {{orgPhone}}." (sent only after staff approve the task) |
| `student.endline` | student | wa, sms | "You did it, {{firstName}}! Take 2 minutes to tell us how you feel now: {{link}}" |
| `student.completed` | student + guardian | wa, sms | "Congratulations! {{firstName}} has completed {{programmeName}}. Certificate: {{link}}" |
| `volunteer.application_received` | volunteer | wa, sms, email | "Thank you for applying to volunteer with BGDI, {{firstName}}. Next we'll contact your references. Track your application: {{link}}" |
| `volunteer.interview_invite` | volunteer | wa, email | "Hi {{firstName}}, your references are in. We'd like a short call. Please pick a time: {{link}}" (link = staff-entered scheduling URL or a prompt to reply) |
| `volunteer.training_invite` | volunteer | wa, email | "Welcome aboard, {{firstName}}! One last step: complete your safeguarding training (about 30 minutes): {{link}}" |
| `volunteer.activated` | volunteer | wa, email | "You're now an active BGDI volunteer. We'll message you when you're matched to a school. Your Hub: {{link}}" |
| `volunteer.assigned` | volunteer | wa, email | "You've been matched to {{cohortName}} at {{schoolName}} as {{role}}. First session: {{date}} {{time}}. Details: {{link}}" |
| `volunteer.declined` | volunteer | email | "Thank you for your interest in volunteering with BGDI. We're unable to take your application forward at this time." |
| `volunteer.attendance_due` | volunteer | wa | "Please take attendance for {{cohortName}} on {{date}}: {{link}}" |
| `volunteer.cohort_closed` | volunteer | wa, email | "{{cohortName}} is complete. Thank you! You logged {{hours}} hours. Certificate: {{link}}" |
| `volunteer.hours_decision` | volunteer | wa | "Your {{hours}} hours on {{date}} were {{decision}}." |
| `certificate.ready` | volunteer, student | wa, email | "Your BGDI certificate is ready: {{link}}" |
| `school.request_received` | requester | wa, sms, email | "Thank you, {{name}}. We've received {{schoolName}}'s request. A member of our team will call you within 5 working days." |
| `school.accepted` | champion | wa, email | "Great news! BGDI would love to work with {{schoolName}}. Please review and sign the agreement: {{link}}" |
| `event.registered` | registrant | wa, sms, email | "You're registered for {{eventTitle}} on {{date}} at {{venue}}. {{link}}" |
| `event.reminder` | registrant | wa, sms, email | "Reminder: {{eventTitle}} is tomorrow at {{time}}, {{venue}}." |
| `donation.receipt` | supporter | email | Subject "Thank you for your gift to BGDI". HTML email with amount, date, reference, designation, receipt PDF attached. |
| `donation.failed` | supporter | email | "Your donation didn't go through. You can try again here: {{link}}" |
| `contact.auto_reply` | sender | email | "Thank you for contacting BGDI. We've received your message and will reply within 3 working days." |
| `newsletter.confirm` | subscriber | email | "Please confirm your subscription: {{link}}" |
| `staff.invite` | staff | email | "You've been invited to the BGDI Hub as {{roles}}. Set your password: {{link}} (valid 72 hours)" |
| `staff.digest` | staff | email | Daily list of open tasks and inbox counts |
| `staff.case_new` | safeguarding leads | wa, sms, email | "New safeguarding concern {{reference}} ({{severity}}). Sign in to review: {{link}}" (no details in the message) |
| `concern.received` | reporter | wa, sms, email | "Thank you for telling us. Your reference is {{reference}}. Our safeguarding lead will review it. If someone is in immediate danger, call 112." |
| `system.opted_out` | anyone | wa, sms | "You won't receive more messages from BGDI. Reply START to turn them back on." |
| `system.help` | anyone | wa | "This is Black Girl's Dream Initiative. Visit {{siteUrl}} or call {{orgPhone}}. Reply STOP to stop messages." |
| `system.auto_reply` | anyone | wa | "Thanks for your message. A member of the BGDI team will reply soon." |
| `speech.result` (P2) | student | wa | "Here's your scorecard, {{firstName}}! {{stars}} Pace: {{wpm}} wpm. Fillers: {{fillers}}. Well done: {{strength}} Next time: {{nextStep}} Full feedback: {{link}}" |

WhatsApp template names are the key with dots replaced by underscores, prefixed `bgdi_` (e.g. `bgdi_consent_request`). Categories: `auth.otp` = authentication; everything else utility, except broadcasts and newsletters = marketing. A console checklist page lists which templates still need submitting to Meta.

Email layout: one branded HTML shell (black header with logo, white body, gold button, footer with address and unsubscribe where applicable) plus a plain-text alternative. Built with React Email.

## 5. Broadcasts

`/console/messages/new`:
1. **Audience builder**: role (students, guardians of students, volunteers, champions, event registrants, newsletter), state, LGA, school, programme, cohort, status, volunteer stage. Stored as JSON `{role, filters}`. Live recipient count, with breakdown by channel and estimated cost.
2. **Message**: pick a template or write custom text (EN and YO). Custom text to WhatsApp goes only to people inside their 24-hour window; everyone else gets SMS. Guardians are included automatically when messaging students under 18 (toggle, default on).
3. **Review**: preview per language, test-send to self, schedule or send now.
4. Rules: state leads can only target their states; broadcasts over 500 recipients or over the remaining monthly messaging budget need approval by a programme manager or admin; marketing-category sends respect opt-outs.
5. Job `message.broadcast.expand` resolves recipients at send time and creates individual messages with `eventKey = broadcast:{id}:{personId}`.

Results page: sent, delivered, read, failed counts; failures list with reason; resend to failed via the next channel.

## 6. Scheduled automations (cron)

| Job | Rule |
|---|---|
| Session reminders | For sessions `planned` starting in 24 h ± 15 min and 2 h ± 15 min → `session.reminder` to active student members (and guardians if the student has no phone) and confirmed coaches |
| Attendance due | 3 h after a session's end with no attendance → `volunteer.attendance_due` to lead coach; 48 h → staff task |
| Consent reminders | Spec/05 §3 |
| Quiet students | Students absent from the last `n` consecutive held sessions (default 2) → staff task `no_attendance` with a button to send `student.quiet` |
| Event reminders | 24 h before events with Hub registration |
| Staff digest | Weekdays 08:00 |
