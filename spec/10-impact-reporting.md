# 10 Impact and reporting

## 1. What is measured

| Instrument | When | Who fills it | Stored as |
|---|---|---|---|
| Confidence self-assessment (5 statements, 1–5) | Intake (baseline); cohort close (endline); P3: 6 and 12 months | Student | `assessment.self_answers`, `self_score` = mean × 20 |
| Coach rubric (4 criteria, 1–5) | Session 1 or 2 (baseline, optional but encouraged) and final session (endline) | Lead coach | `assessment.rubric_scores`, `rubric_total` = weighted mean × 20 |
| Attendance | Every session | Coach | `attendance` |
| Endline extras | Cohort close | Student | best part (text), recommend 0–10 |
| Volunteer hours | Every session, plus manual | System / volunteer | `hours_entry` |
| Speech practice (P2) | Each attempt | System | `speech_attempt` |

Default rubric "Speaking and debate v1" (seed): 
- **Structure**: 1 no clear order · 3 has opening, points and close · 5 clear signposting and strong close.
- **Argument and evidence**: 1 opinion only · 3 reasons given · 5 reasons with examples or facts and a response to the other side.
- **Delivery**: 1 hard to hear, reads from paper · 3 audible, some eye contact · 5 varied voice, steady pace, eye contact.
- **Confidence**: 1 very hesitant · 3 some nerves but continues · 5 composed and engaging.
Equal weights.

## 2. Definitions (shown on `/impact` under "How we measure")

- **Student trained**: a student with attendance `present` at 1 or more held sessions. **Student completed**: `cohort_member.completed = true` (attendance ≥ 70%).
- **School reached**: a school with at least one cohort that has held a session.
- **Active volunteer**: a volunteer who coached at least one held session in the period.
- **Matched pair**: a student with both baseline and endline for the same instrument in the same cohort.

## 3. Metrics

Computed by `impact.compute({from, to, stateIds?, programmeIds?})` with SQL in `src/server/services/impact/queries.ts`, and frozen nightly into `impact_snapshot`. "Total" metrics add `historical_impact`.

| key | definition | public |
|---|---|---|
| `students_trained` | distinct students trained in range | – |
| `students_trained_total` | all-time trained + historical students | ✔ |
| `girls_trained_total` | as above where gender = female (+ historical girls) | ✔ |
| `students_completed` | completed in range | ✔ (all-time) |
| `students_active` | status active and in a running cohort | – |
| `students_waitlisted`, `students_pending_consent` | counts | – |
| `schools_reached_total` | distinct schools reached + historical | ✔ |
| `cohorts_running`, `cohorts_completed` | counts | ✔ |
| `sessions_held` | count | ✔ |
| `attendance_rate` | present ÷ (present + absent + excused) over held sessions | ✔ |
| `completion_rate` | completed ÷ members of completed cohorts | ✔ |
| `volunteers_total` | active-stage volunteers + historical | ✔ |
| `volunteers_active` | per definition | – |
| `volunteer_hours` | approved hours | ✔ (all-time) |
| `states_active`, `lgas_reached` | counts | ✔ |
| `confidence_baseline_avg`, `confidence_endline_avg`, `confidence_change` | over matched pairs; `n_pairs` | ✔ if n ≥ 30 |
| `confidence_improved_pct` | share of pairs with endline > baseline | ✔ if n ≥ 30 |
| `rubric_baseline_avg`, `rubric_endline_avg`, `rubric_change` | over matched pairs; by criterion too | ✔ if n ≥ 30 |
| `recommend_score` | mean of 0–10 | – |
| `signups_by_source` | by campaign | – |
| `time_to_first_reply_minutes` | median from intake submit to first outbound message `sent` | – |
| `time_to_placement_days` | median from consent to cohort assignment | – |
| `consent_conversion` | consents given ÷ requested | – |
| `speech_attempts`, `speech_students`, `speech_score_change` (P2) | attempts; distinct students; mean stars last 3 − first 3 for students with ≥ 6 attempts | – |
| `pilot_vs_control` (P2) | rubric_change for `is_pilot_group` cohorts vs others in the same programme and term, with n and a simple difference | – |

Breakdowns available for every count: by state, LGA, school, programme, gender, age band (10–13, 14–18, other), term. Small-number suppression on anything public: values under 5 show "<5".

## 4. Console dashboard `/console/impact`

Filter bar: date range (presets: this term, this year, all time, custom), state, programme. Sections:
1. Headline tiles (students trained, completed, schools, sessions, volunteers active, hours) with change vs previous period.
2. Funnel: signed up → consent given → placed → attended first session → completed.
3. Outcomes: baseline vs endline paired bars for confidence and each rubric criterion, with n; distribution of change (histogram).
4. Attendance by cohort (sortable table with sparkline), lowest first.
5. Reach: table by LGA and by school.
6. Operations: time to first reply, time to placement, consent conversion, message delivery rate.
7. Sign-ups by source campaign.
8. P2: AI coach usage and pilot comparison.
Each chart has "Download CSV" and "Add to report".

## 5. Map `/console/impact/map` and public reach map

- Base: LGA polygons from `public/geo/nga-adm2.geojson`, joined on `lga.geo_code`. States without loaded polygons fall back to a table.
- Layers (radio): Students reached (choropleth, 5 steps) · Pupils per teacher (EduTracka; buckets < 50, 50–79, 80+) · Girls enrolled · Out-of-school rate for girls.
- Overlay: dots for schools with cohorts (size = students). Console only: grey dots for schools with waitlists, and all schools on zoom.
- Click LGA → panel: indicators with year and source, BGDI students, schools, cohorts, volunteers living there.
- **"Where next" list** (console): partner-eligible schools ranked by need score = normalised pupils-per-teacher (40%) + normalised out-of-school rate for girls (30%) + waitlisted students at the school (20%) + active volunteers within the LGA (10%). Shows the score parts so staff can judge. Export CSV.
- Source line under every EduTracka figure: "Source: EduTracka, {indicators_year}" linking to `https://edutracka.ai`.

## 6. Report builder `/console/reports`

Create: title, date range, programmes, states, optional grant, sections (tick list): Summary numbers · Reach by state/LGA/school · Outcomes · Attendance and completion · Volunteers · Stories (pick published stories) · Photos (pick from gallery) · AI coach (P2) · Finances (P3, donations by designation) · Methodology.

Generation (job `report.generate`): compute and freeze metrics into `report.data`; render PDF with `@react-pdf/renderer` (cover with logo, title, period; a page per section; charts rendered as SVG; methodology and definitions appendix; footer with generation date) and a CSV bundle (ZIP of one CSV per table).

**Narrative draft** (job `report.narrative`, optional button "Draft the narrative"): sends only the frozen aggregate metrics (no names, no free text from children) to `BEDROCK_MODEL_WRITER` with this system prompt:

> You write the narrative section of an impact report for Black Girl's Dream Initiative, a youth-led Nigerian nonprofit. Use only the figures in the JSON provided. Never invent numbers, names, quotes or events. If a figure is missing, leave it out. Write in clear British English at a general reading level, 350–500 words, in four short sections: What we did, Who we reached, What changed, What we learned and what is next. Where sample sizes are under 30, say that results are early. Do not use superlatives.

The draft opens in a Tiptap editor marked "AI draft – review before sending"; the report cannot be shared until a staff member has edited or explicitly approved it (`narrative_status = edited`). A checker highlights any number in the narrative that does not appear in `report.data`.

Share: create link with expiry → `/r/[token]` shows the web version with PDF and CSV download; view count recorded. Reports can be attached to a `grant` (P3).

## 7. Website feeds

- `GET /api/public/impact` → `{ updatedAt, metrics: {public keys}, byYear: [...], byProgramme: [...] }`, cached 1 h, CORS open.
- `GET /api/public/reach` → LGA-level aggregates with suppression.
- `/embed/impact?metrics=students_trained_total,schools_reached_total&theme=dark` → minimal iframe page.

## 8. Historical figures

Until Hub data accumulates, public totals come mostly from `historical_impact`, entered by staff in Console → Impact → Historical figures (year, programme, state, students, girls, schools, volunteers, source note). The public page footnote reads: "Figures before {hubLaunchDate} come from BGDI programme records; figures after are counted in the BGDI Hub."
