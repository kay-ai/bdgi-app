# 02 Data model

PostgreSQL, Drizzle schema in `src/db/schema/`. Conventions for every table unless noted: `id uuid pk` (UUID v7), `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()` (updated by the service). Names are snake_case. "enc" means encrypted at the field level (spec/01 §10). `?` means nullable. FK = foreign key with `on delete restrict` unless noted.

## 1. Enums

```
role: student | guardian | volunteer | school_champion | state_lead | programme_manager |
      safeguarding_lead | content_editor | admin | ekodara_officer (P3)
person_status: pending_consent | pending_review | active | waitlisted | paused | declined | left | anonymised
gender: female | male | other | prefer_not_to_say
class_level: JSS1 | JSS2 | JSS3 | SS1 | SS2 | SS3 | not_in_school
language: en | yo | pcm
channel: whatsapp | sms | email
consent_type: participation | photo | ai_practice | stories
consent_method: guardian_otp | school_agreement | self_adult | paper_uploaded
school_ownership: public | private | mission | other
school_level: primary | junior_secondary | senior_secondary | combined_secondary | technical
partnership_status: none | requested | in_discussion | agreement_signed | active | paused | ended
programme_kind: debate | stem | education_access | advocacy | campaign | other
cohort_status: draft | open | running | completed | cancelled
cohort_role: student | lead_coach | assistant_coach
session_status: planned | held | cancelled
attendance_status: present | absent | excused
assessment_type: baseline | endline | follow_up_6m | follow_up_12m
volunteer_stage: applied | references_pending | interview | training | active | paused | declined | left
message_status: queued | sent | delivered | read | failed | skipped
message_direction: outbound | inbound
case_severity: low | medium | high | emergency
case_status: new | in_review | action_taken | referred | closed
case_category: physical | emotional | sexual | neglect | online | bullying | volunteer_conduct | data_privacy | other
task_status: open | done | dismissed
content_status: draft | published | archived
donation_status: initiated | paid | failed | refunded
donation_frequency: one_off | monthly
job_status: queued | running | done | failed
speech_status: uploaded | transcribing | scoring | done | failed | rejected
data_request_type: export | erase | correct
data_request_status: received | verified | in_progress | done | refused
```

## 2. Identity and auth

Better Auth creates and owns `user`, `session`, `account`, `verification`, `two_factor`. Do not hand-edit them; extend `user` only with: `phone_number`, `phone_number_verified`, `locale`.

**person**: one human. A login (`user`) can be linked to several persons (a guardian's phone used by her children).

| column | type | notes |
|---|---|---|
| user_id? | uuid FK user, on delete set null | the login that can act as this person |
| first_name | text | |
| surname | text enc | |
| preferred_name? | text | |
| date_of_birth? | date enc | students: required unless `age_at_signup` given |
| age_at_signup? | int | 8–25 |
| gender | gender | |
| phone? | text enc | E.164 |
| phone_hash? | text | index |
| email? | text enc | |
| email_hash? | text | index |
| language | language default en | |
| preferred_channel | channel default whatsapp | |
| whatsapp_opt_in | bool default false | |
| state_id? | FK state | |
| lga_id? | FK lga | |
| school_id? | FK school | students, champions |
| school_other? | text | "my school isn't listed" |
| class_level? | class_level | |
| avatar_key | text default 'a01' | one of 24 built-in avatars `a01`–`a24` |
| status | person_status | |
| source_campaign_id? | FK campaign | |
| notes? | text | staff only |
| anonymised_at?, deleted_at? | timestamptz | |

Indexes: `(status)`, `(school_id)`, `(state_id, lga_id)`, `phone_hash`, `email_hash`, trigram index on `first_name`.

**person_role**: `person_id FK`, `role role`, `state_id? FK` (scope for state_lead), `granted_by FK person`, `revoked_at?`. Unique `(person_id, role, state_id)` where `revoked_at is null`.

**guardian_link**: `guardian_id FK person`, `student_id FK person`, `relationship text` (mother | father | aunt | uncle | grandparent | sibling_adult | other), `is_primary bool`. Unique `(guardian_id, student_id)`.

**consent**: `student_id FK`, `guardian_id? FK`, `type consent_type`, `method consent_method`, `token_hash? text unique`, `code_hash? text`, `code_attempts int default 0`, `requested_at`, `expires_at?`, `given_at?`, `withdrawn_at?`, `guardian_full_name? text enc`, `ip? inet`, `user_agent? text`, `school_agreement_id? FK`, `document_key? text`, `text_version text` (version of the consent wording shown). Index `(student_id, type)`.

## 3. Geography and schools

**state**: `code text unique` (e.g. `OY`), `name`, `is_active bool` (BGDI operates here), `launched_on? date`.

**lga**: `state_id FK`, `name`, `geo_code text unique` (matches GeoJSON feature id), plus EduTracka indicators refreshed by import: `pupils_per_teacher? numeric`, `public_schools? int`, `teachers? int`, `girls_enrolled? int`, `out_of_school_rate_girls? numeric`, `indicators_year? text`, `indicators_updated_at?`.

**school**: `edutracka_id? text unique`, `name`, `state_id FK`, `lga_id FK`, `town? text`, `ownership school_ownership`, `level school_level`, `enrolment_girls? int`, `enrolment_boys? int`, `partnership_status partnership_status default none`, `champion_id? FK person`, `principal_name? text`, `contact_phone? text enc`, `address? text`, `notes? text`, `is_verified bool default true` (false when created from "not listed"), `deleted_at?`. Trigram index on `name`; index `(state_id, lga_id)`.

**school_agreement**: `school_id FK`, `signed_by_name text`, `signed_by_title text`, `signed_on date`, `valid_until? date`, `document_key text`, `covers_consent bool`, `uploaded_by FK person`.

**school_request**: `school_id? FK`, `school_name_other? text`, `state_id`, `lga_id?`, `requester_name`, `requester_role text`, `requester_phone enc`, `requester_email? enc`, `programme_id? FK`, `approx_students? int`, `message? text`, `status` (new | contacted | accepted | declined), `handled_by? FK`, `source_campaign_id?`.

## 4. Programmes, cohorts, sessions

**programme**: `slug unique`, `kind programme_kind`, `name_en`, `name_yo?`, `summary_en`, `summary_yo?`, `is_enrolling bool` (students can pick it at intake), `min_age int`, `max_age int`, `default_sessions int`, `rubric_id? FK rubric`, `page_id? FK content_page`, `accepts_designated_gifts bool default false`, `fundraising_target_minor? int`, `fundraising_currency? text`, `sort int`, `status content_status`.

**lesson_plan**: `programme_id FK`, `position int`, `title_en`, `title_yo?`, `objectives text`, `coach_notes jsonb` (Tiptap), `duration_minutes int`. Unique `(programme_id, position)`.

**cohort**: `programme_id FK`, `school_id FK`, `name` (default `"{school short name} · {programme} · {term}"`), `term text` (e.g. `2026/27 T2`), `starts_on date`, `ends_on date`, `meeting_day? int 0–6`, `meeting_time? time`, `venue? text`, `capacity int default 30`, `status cohort_status`, `ai_coach_enabled bool default false`, `is_pilot_group bool default false`, `closed_at?`, `created_by FK`, `deleted_at?`.

**cohort_member**: `cohort_id FK`, `person_id FK`, `role cohort_role`, `joined_on date`, `left_on? date`, `left_reason? text`, `completed bool default false`. Unique `(cohort_id, person_id)`.

**session**: `cohort_id FK`, `lesson_plan_id? FK`, `starts_at timestamptz`, `duration_minutes int default 60`, `venue? text`, `status session_status`, `cancel_reason? text`, `notes? text`, `held_marked_by? FK`, `reminder_sent_at?`. Index `(cohort_id, starts_at)`.

**session_coach**: `session_id FK`, `person_id FK`, `confirmed bool`. Unique pair.

**attendance**: `session_id FK`, `person_id FK`, `status attendance_status`, `recorded_by FK person`, `recorded_at timestamptz`, `client_id uuid unique` (offline dedupe). Unique `(session_id, person_id)`.

## 5. Intake answers and assessments

**intake_response**: `person_id FK unique`, `dream_career text`, `interests text[]` (debate_public_speaking, stem, writing_essays, leadership, arts_media, sports, business_money), `community_dream? text`, `needs text[]` (speaking_up, building_arguments, confidence, research, school_subject, english, other), `needs_other? text`, `school_subject? text`, `programme_ids uuid[]`, `has_own_phone bool`, `device_access text` (own_smartphone | shared_smartphone | basic_phone | school_computer | none), `anything_else? text`, `completed_at`.

**rubric**: `name`, `version int`, `criteria jsonb` (array of `{key, label_en, label_yo, description, min:1, max:5, weight}`), `is_active`.

**assessment**: `person_id FK`, `cohort_id? FK`, `type assessment_type`, `self_answers? jsonb` (`{q1..q5: 1–5}`), `self_score? numeric` (0–100), `rubric_id? FK`, `rubric_scores? jsonb` (`{key: 1–5}`), `rubric_total? numeric` (0–100), `scored_by? FK person`, `taken_at`. Unique `(person_id, cohort_id, type)`.

## 6. Volunteers

**volunteer_profile**: `person_id FK unique`, `stage volunteer_stage`, `skills text[]` (debate, public_speaking, stem, coding, writing, leadership, financial_literacy, judging, photography, logistics), `languages language[]`, `occupation? text`, `organisation? text`, `is_nysc bool`, `is_alumna bool`, `availability jsonb` (`{mon..sun: ['morning'|'afternoon'|'evening']}`), `max_cohorts int default 1`, `motivation text`, `experience? text`, `can_travel_lgas uuid[]`, `id_document_key? text`, `interview_notes? text`, `interviewed_by? FK`, `code_of_conduct_signed_at?`, `code_of_conduct_version? text`, `training_completed_at?`, `activated_at?`, `paused_reason? text`.

**volunteer_reference**: `volunteer_id FK person`, `name`, `relationship`, `phone enc`, `email? enc`, `status` (pending | contacted | positive | concern | unreachable), `notes?`, `checked_by? FK`, `checked_at?`.

**training_module**: `slug unique`, `title_en`, `title_yo?`, `body jsonb` (Tiptap), `position int`, `is_required bool`, `kind` (safeguarding | coaching | platform), `pass_mark int default 80`.

**training_question**: `module_id FK`, `position`, `prompt_en`, `prompt_yo?`, `options jsonb` (`[{key,label_en,label_yo}]`), `correct_key text`, `explanation?`.

**training_attempt**: `person_id FK`, `module_id FK`, `answers jsonb`, `score int`, `passed bool`, `taken_at`.

**hours_entry**: `person_id FK`, `session_id? FK`, `date date`, `hours numeric(4,2)`, `description? text`, `source` (session | manual), `status` (pending | approved | rejected), `approved_by? FK`. Unique `(person_id, session_id)` where session_id not null.

**certificate**: `person_id FK`, `kind` (volunteer_service | cohort_completion | dream_graduate | competition), `code text unique`, `title text`, `details jsonb` (hours, dates, cohort), `pdf_key text`, `issued_at`, `revoked_at?`.

## 7. Messaging

**message_template**: `key text unique`, `category` (utility | authentication | marketing), `channels channel[]`, `whatsapp_template_name? text`, `whatsapp_status` (not_submitted | pending | approved | rejected), `subject_en?`, `subject_yo?`, `body_en text`, `body_yo? text`, `variables text[]`, `sms_body_en? text`, `sms_body_yo? text` (short variants), `allow_before_consent bool default false`, `ignores_quiet_hours bool default false`, `is_system bool` (system templates can be edited but not deleted).

**message**: `direction`, `person_id? FK`, `to_address text enc`, `channel`, `template_key?`, `variables? jsonb`, `body_rendered text enc`, `status message_status`, `provider_id? text`, `error? text`, `broadcast_id? FK`, `event_key? text unique` (idempotency, e.g. `session.remind:{sessionId}:{personId}`), `cost_minor? int`, `sent_at?`, `delivered_at?`, `read_at?`. Index `(person_id, created_at desc)`.

**broadcast**: `title`, `audience jsonb` (filter definition, spec/08 §5), `template_key?`, `body_en?`, `body_yo?`, `channels channel[]`, `status` (draft | scheduled | sending | sent | cancelled), `scheduled_for?`, `recipient_count int`, `created_by FK`, `approved_by? FK`.

**channel_opt_out**: `address_hash text`, `channel`, `opted_out_at`. Unique pair.

## 8. Safeguarding, audit, privacy

**safeguarding_case**: `reference text unique` (`SG-2026-0001`), `reporter_person_id? FK`, `reporter_name? enc`, `reporter_contact? enc`, `reporter_is_anonymous bool`, `subject_person_id? FK`, `about_person_id? FK` (the person the concern is about), `school_id? FK`, `cohort_id? FK`, `category case_category`, `severity case_severity`, `description text enc`, `immediate_danger bool`, `status case_status`, `owner_id? FK person`, `outcome? text enc`, `closed_at?`, `source` (web_form | in_app | staff | ai_flag | whatsapp).

**case_note**: `case_id FK`, `author_id FK`, `body text enc`, `kind` (note | action | referral | contact).

**audit_event**: `actor_person_id? FK`, `actor_role? role`, `action text` (e.g. `person.view_sensitive`, `consent.give`), `entity_type text`, `entity_id uuid`, `subject_person_id? uuid` (the child concerned, for quick lookup), `meta jsonb`, `ip? inet`, `at timestamptz`. Append-only: no update or delete grants for the app DB user. Indexes `(subject_person_id, at desc)`, `(actor_person_id, at desc)`.

**data_request**: `type`, `person_id? FK`, `requester_name enc`, `requester_contact enc`, `relationship text`, `status`, `verified_by? FK`, `result_key? text`, `completed_at?`, `notes?`.

## 9. Website content

**content_page**: `slug unique` (home, about, get-involved, donate, contact, privacy, safeguarding, terms, faq, press, partner, and one per programme), `title_en`, `title_yo?`, `seo_description_en?`, `seo_description_yo?`, `og_image_key?`, `blocks jsonb` (ordered array of typed blocks, spec/04 §5), `status content_status`, `published_at?`, `updated_by FK`.

**story**: `slug unique`, `title_en`, `title_yo?`, `excerpt_en`, `excerpt_yo?`, `body_en jsonb`, `body_yo? jsonb`, `cover_key?`, `cover_alt?`, `author_person_id? FK`, `author_name? text`, `programme_id? FK`, `tags text[]`, `status`, `published_at?`, `features_child bool`, `consent_confirmed_by? FK` (required when `features_child`).

**event**: `slug unique`, `title_en`, `title_yo?`, `summary_en`, `body_en jsonb`, `starts_at`, `ends_at?`, `venue? text`, `is_online bool`, `online_url?`, `cover_key?`, `programme_id? FK`, `registration` (none | external_link | hub_form), `registration_url?`, `capacity? int`, `competition_id? FK`, `status`.

**event_registration**: `event_id FK`, `name`, `phone? enc`, `email? enc`, `organisation?`, `person_id? FK`, `source_campaign_id?`. 

**team_member**: `person_id? FK`, `name`, `title_en`, `title_yo?`, `bio_en?`, `photo_key?`, `group` (leadership | staff | board | advisor), `sort int`, `linkedin_url?`, `is_visible bool`.

**partner**: `name`, `logo_key?`, `url?`, `kind` (funder | corporate | government | community | media), `sort`, `is_visible`.

**gallery_album**: `slug unique`, `title_en`, `date?`, `programme_id?`, `cover_key?`, `status`. **gallery_photo**: `album_id FK`, `key`, `alt_en text`, `caption_en?`, `sort`, `consent_note text` (who confirmed permission).

**faq**: `question_en`, `question_yo?`, `answer_en jsonb`, `answer_yo? jsonb`, `audience` (general | students | guardians | volunteers | schools | donors), `sort`, `status`.

**press_item**: `title`, `outlet`, `url`, `published_on date`, `sort`. **download**: `title_en`, `file_key`, `kind` (annual_report | impact_report | media_kit | policy | other), `year? int`, `is_public bool`.

**contact_message**: `name`, `email? enc`, `phone? enc`, `topic` (general | partnership | media | volunteering | school | other), `message text`, `status` (new | replied | closed), `handled_by?`.

**newsletter_subscriber**: `email enc`, `email_hash unique`, `name?`, `confirmed_at?`, `unsubscribed_at?`, `confirm_token_hash`.

**redirect**: `from_path unique`, `to_path`, `status_code int default 301`.

**campaign**: `code text unique` (8 chars), `name`, `medium` (instagram | linkedin | whatsapp | webinar | event | school_visit | qr | other), `target` (student | volunteer | school | donate | any), `notes?`, `created_by`, `clicks int default 0`.

**media_asset**: `key unique`, `bucket`, `mime`, `width?`, `height?`, `bytes`, `alt_en?`, `uploaded_by FK`, `processed bool`.

## 10. Impact and reports

**impact_snapshot**: `date date`, `state_id? FK`, `programme_id? FK`, `metrics jsonb` (every metric in spec/10 §3). Unique `(date, state_id, programme_id)` with nulls meaning "all".

**historical_impact**: figures from before the Hub: `year int`, `programme_id FK`, `state_id FK`, `students int`, `girls int?`, `schools int`, `volunteers int`, `source_note text`. Added to live counts for public totals.

**report**: `title`, `date_from`, `date_to`, `programme_ids uuid[]`, `state_ids uuid[]`, `sections text[]`, `data jsonb` (frozen metric values), `narrative jsonb?` (Tiptap), `narrative_status` (none | drafting | draft | edited), `pdf_key?`, `csv_key?`, `status` (generating | ready | failed), `created_by FK`, `grant_id? FK`.

**report_share**: `report_id FK`, `token_hash unique`, `expires_at`, `created_by`, `view_count int`.

## 11. Donations and supporters

**supporter**: `name`, `email enc`, `email_hash unique`, `phone? enc`, `country?`, `is_organisation bool`, `wants_updates bool`, `notes?`.

**donation**: `supporter_id FK`, `reference text unique`, `amount_minor int`, `currency` (NGN | USD), `frequency donation_frequency`, `designation_programme_id? FK`, `status donation_status`, `provider text`, `provider_reference?`, `provider_fee_minor?`, `paid_at?`, `receipt_code? unique`, `receipt_key?`, `is_anonymous bool`, `message? text`, `source_campaign_id?`, `subscription_code? text`.

**grant** (P3): `funder_partner_id FK partner`, `title`, `amount_minor`, `currency`, `starts_on`, `ends_on`, `reporting_due date[]`, `programme_ids uuid[]`, `notes`.

## 12. AI speech coach (P2)

**motion**: `text_en`, `text_yo?`, `programme_id? FK`, `difficulty` (starter | intermediate | advanced), `sdg? int`, `is_active`.

**speech_attempt**: `person_id FK`, `cohort_id? FK`, `motion_id? FK`, `side` (for | against | open), `channel` (web | whatsapp), `audio_key? text` (nulled after cleanup), `duration_seconds? numeric`, `transcript? text enc`, `words? jsonb` (`[{w, start, end, conf}]`, dropped after 30 days), `metrics? jsonb`, `scores? jsonb`, `feedback? jsonb`, `overall_stars? int`, `status speech_status`, `reject_reason? text`, `model_id? text`, `prompt_version? text`, `tokens_in? int`, `tokens_out? int`, `flagged_for_safeguarding bool default false`. Index `(person_id, created_at desc)`.

## 13. System

**setting**: `key text pk`, `value jsonb`, `updated_by`. Keys and defaults in spec/07 §14.

**job**: `type`, `payload jsonb`, `status job_status`, `attempts int`, `dedupe_key? unique`, `run_after?`, `last_error?`, `finished_at?`.

**task**: `title`, `detail?`, `kind` (reference_check | consent_stalled | waitlist_ready | no_attendance | hours_approval | case_follow_up | template_rejected | manual), `entity_type?`, `entity_id?`, `assignee_id? FK`, `state_id? FK`, `due_on?`, `status task_status`, `dedupe_key? unique`.

**rate_limit**: `key text`, `window_start timestamptz`, `count int`. PK `(key, window_start)`.

**import_batch**: `kind` (people | schools | historical), `file_key`, `status`, `row_count`, `ok_count`, `error_rows jsonb`, `created_by`.

**page_view**: `path text`, `date date`, `referrer_host? text`, `campaign_code? text`, `count int`. Unique `(path, date, referrer_host, campaign_code)`. No IP address or user identifier is stored.

**content_version**: `page_id FK content_page`, `blocks jsonb`, `saved_by FK person`, `saved_at`. Keep the latest 10 per page.

**bot_state** (P2): `person_id FK unique`, `motion_id? FK`, `expires_at timestamptz`. Tracks the motion a student has been given on WhatsApp.

Additional `setting` keys used by other spec files: `donations_usd_enabled` (false), `donation_presets` (`{NGN:[2000,5000,10000,25000,50000], USD:[10,25,50,100]}`), `donation_impact_lines` ({}), `ai_enabled` (true), `hub_launch_date`, `max_mentees` (2).

## 14. Phase 3 tables

Defined in spec/13 beside each module: `curriculum_track`, `lesson`, `lesson_step`, `learning_path`, `path_item`, `lesson_progress`, `badge`, `person_badge`, `mentor_match`, `mentor_thread`, `mentor_message`, `competition`, `competition_team`, `team_member_entry`, `judge_assignment`, `round`, `debate`, `ballot`, `essay_entry`, `essay_mark`, `ekodara_child`, `ekodara_support`, `ekodara_visit`, `ekodara_guardian_support`.

## 15. Integrity rules enforced in services (and tested)

1. A student with `age < 18` cannot have `status = active` without a `consent` row of type `participation` with `given_at` set and `withdrawn_at` null.
2. A volunteer cannot be added to `cohort_member` or `session_coach` unless `volunteer_profile.stage = active`.
3. A cohort cannot move to `running` without at least one `lead_coach` and one scheduled session.
4. Closing a cohort (`completed`) requires every session to be `held` or `cancelled`; it marks members with attendance ≥ `settings.completion_attendance_pct` (default 70) as `completed = true` and creates endline assessment tasks.
5. `attendance` rows may only exist for persons who were cohort members on the session date.
6. Withdrawing participation consent sets the student to `left`, ends their cohort memberships, and blocks further messages except the confirmation.
7. A `story` with `features_child = true` cannot be published without `consent_confirmed_by`, and that child must have an active `stories` or `photo` consent.
