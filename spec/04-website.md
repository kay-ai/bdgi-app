# 04 Website (revamp)

The public website at `theblackgirlsdream.org` is rebuilt inside the Hub codebase (route group `(site)`) and replaces the WordPress site. It is server-rendered, cached, and reads live data from the Hub database.

> **Design note.** Layout, copy, photographs and motion for every public page are set by [DESIGN.md](../DESIGN.md) sections 5 to 7, which win over the draft copy and section lists below. In particular: the home hero reads "Free debate training for girls"; impact figures are static text inside sentences, not animated counters; no captions are shown under pictures (alt text only); nothing animates on scroll; there is no cookie or announcement bar fixed over the page.

## 1. Goals

1. A visitor understands who BGDI is and what it has achieved within one screen.
2. Every call to action works and lands in the Hub: join, volunteer, bring BGDI to a school, partner, donate, report a concern.
3. Funders see live, sourced impact numbers and can download reports.
4. Staff update all content from the console with no developer.
5. Nothing from the old template remains (placeholder address, sponsor-a-child cards, 2020 blog posts, "Test Donation").

## 2. How the website ties to the Hub

| Website element | Live source |
|---|---|
| Impact counters (home, impact, programme pages, footer strip) | `impact_snapshot` latest + `historical_impact` |
| Reach map on `/impact` | schools with cohorts, aggregated to LGA; LGA indicators from EduTracka import |
| Programme pages: "where it runs", numbers, next cohort dates | `programme`, `cohort`, `session` |
| Events list and detail | `event` (and `competition` in P3) |
| Stories | `story` |
| Team, partners, FAQs, gallery, press, downloads | their content tables |
| Join forms | write `person`, `intake_response`, `volunteer_profile`, `school_request` |
| Donate | `donation`, `supporter`; Paystack |
| "Schools we work with" search | `school` where partnership active |
| Certificate and receipt verification | `certificate`, `donation` |
| Header "Sign in" | Hub auth; signed-in visitors see "Go to my Hub" |
| Campaign links `/c/[code]` | `campaign` → redirect with source recorded in a cookie for 30 days |
| Newsletter | `newsletter_subscriber`, double opt-in |
| Contact form | `contact_message` + task for staff |

Caching: public pages use `revalidate = 300` and tag-based revalidation (`revalidateTag('content:story')`, `'impact'`, `'events'`) fired by console saves and by the nightly snapshot.

## 3. Sitemap

```
/                          Home
/about                     About (story, mission, vision, values, approach)
/about/team                Our people (leadership, staff, board)
/programmes                All programmes
/programmes/[slug]         debate-and-public-speaking | ibadan-schools-debate-competition |
                           inspire-her-future | eko-dara | end-fgm | women-in-history | edutracka
/impact                    Live impact dashboard and map
/impact/reports            Annual and impact reports (downloads)
/stories                   Stories list (filter by programme, tag)
/stories/[slug]            Story
/events                    Upcoming and past events
/events/[slug]             Event (+ registration)
/get-involved              Four ways in: student, volunteer, school, partner/donor
/join                      Chooser → /join/student | /join/volunteer | /join/school  (spec/05)
/partner                   Partner with us (enquiry form)
/donate                    Donate
/donate/thank-you          Confirmation
/gallery                   Albums → /gallery/[slug]
/press                     Press coverage and media kit
/faq                       FAQs by audience
/contact                   Contact
/report-a-concern          Safeguarding report (spec/09)
/privacy  /safeguarding  /terms  /cookies
/verify/certificate/[code]   /verify/receipt/[code]
/newsletter/confirm/[token]  /newsletter/unsubscribe/[token]
/embed/impact              Iframe-able counters
/c/[code]                  Campaign redirect
```
All also under `/yo/...`. `sitemap.ts` lists both locales with `hreflang`; `robots.ts` disallows `/app`, `/console`, `/api`, `/consent`, `/r`.

## 4. Global layout

**Header** (sticky, black background, white logo): Logo → `/`. Nav: About (About, Our people) · Programmes (list of published programmes) · Impact · Stories · Events · Get involved. Right: language switch `EN | Yorùbá`, "Sign in" (or "My Hub"), gold button **Donate**. Mobile: hamburger opens a full-screen menu; Donate and Join stay visible as a bottom bar on scroll.

**Announcement bar** (optional, from site settings): one line + link, dismissible.

**Footer** (black): column 1 logo, one-line mission, social links (Instagram, LinkedIn, X, Facebook, YouTube from settings); column 2 Organisation (About, Our people, Impact, Reports, Press, Contact); column 3 Get involved (Join as a student, Volunteer, Bring BGDI to your school, Partner, Donate); column 4 Stay in touch (newsletter email field + "Subscribe", address, phone, email from settings). Bottom strip: © year Black Girl's Dream Initiative · CAC number · Privacy · Safeguarding · Terms · **Report a concern** · "EduTracka by BGDI" link.

**Every page** has: unique `<title>` (`{Page} | Black Girl's Dream Initiative`), meta description, canonical, Open Graph image (default `public/og/default.png`, 1200×630, or page-specific), `Organization` JSON-LD on home, `Article` on stories, `Event` on events, breadcrumbs on inner pages, skip-to-content link.

## 5. Content blocks

`content_page.blocks` is an ordered array. Editors add, reorder and edit blocks in the console (spec/07 §11). Block types and fields:

| type | fields |
|---|---|
| `hero` | eyebrow, title, subtitle, image, primaryCta {label, href}, secondaryCta |
| `impact_counters` | heading, metrics[] (keys from spec/10 §3 public set), sourceNote on/off |
| `rich_text` | body (Tiptap), width narrow/wide |
| `pillars` | heading, items[] {icon, title, text, href?} |
| `programme_cards` | heading, programmeIds[] or "all" |
| `story_cards` | heading, mode latest/selected, count, storyIds[] |
| `event_cards` | heading, count, includePast |
| `quote` | text, attribution, role, photo? |
| `image_text` | image, alt, heading, body, cta?, imageSide |
| `stats_row` | items[] {value, label} (static numbers) |
| `steps` | heading, items[] {title, text} |
| `partners_strip` | heading, kinds[] |
| `team_grid` | group |
| `faq_list` | audience, count |
| `cta_band` | heading, text, primaryCta, secondaryCta, tone gold/black |
| `donate_widget` | preset amounts, designation programmeId? |
| `map_reach` | heading, stateId? |
| `gallery_strip` | albumId, count |
| `video` | youtubeId, title (loaded only on click; privacy-enhanced domain) |
| `downloads` | kinds[] |
| `join_paths` | (fixed) three cards: student, volunteer, school |
| `newsletter` | heading, text |

Each text field has `_en` and `_yo`. Images are `media_asset` keys with required alt text.

## 6. Pages, section by section

Draft English copy is given where it is safe to write. Text in *italics* is guidance for the editor, not copy.

### 6.1 Home `/`
1. **hero**: eyebrow "Black Girl's Dream Initiative"; title "Every girl deserves to be heard."; subtitle "We train young people in public speaking, debate and STEM, and we fight for every child's right to learn. Youth-led, from Ibadan to all of Nigeria."; primary "Join the Dream" → `/join`; secondary "Support our work" → `/donate`; image: students at the debate competition (**CONFIRM** photo and permission).
2. **impact_counters**: heading "Our impact so far"; metrics `students_trained_total`, `schools_reached_total`, `volunteers_total`, `states_active`; source note "Updated daily from our programme records."
3. **pillars**: heading "What we work on"; Education ("Quality learning for every child, in and out of school."), Gender ("Closing the gap for women and girls, and bringing boys and men along."), Leadership ("Young people who can speak, argue and lead.").
4. **programme_cards**: "Our programmes", all enrolling and flagship programmes.
5. **image_text**: "Find your voice." body about the debate and public speaking training and the practice coach; CTA "See how it works" → `/programmes/debate-and-public-speaking`.
6. **join_paths**: "Three ways to join" — "I'm a student" (ages 10–18), "I want to volunteer", "Bring BGDI to my school".
7. **story_cards**: latest 3.
8. **event_cards**: next 3 upcoming; hidden if none.
9. **quote**: *founder quote supplied by BGDI; block hidden until provided.*
10. **partners_strip**: "Our partners and supporters".
11. **cta_band** (gold): "Help the next girl find her voice." "₦5,000 covers a student's training materials for a term." (**CONFIRM** unit cost) → Donate / Partner with us.
12. **newsletter**.

### 6.2 About `/about`
1. hero: "Youth-led. Girl-centred. Evidence-driven."
2. rich_text "Our story": founded in Ibadan by Karimot Odebode; youth-led not-for-profit promoting quality education and bridging the gender gap. *Editor adds founding year and story.*
3. Mission card: "To build an equitable society by empowering women and girls to be leaders and decision-makers, and reorienting boys and men." Vision card: "To be a foremost organisation that transforms education and bridges the gender gap."
4. pillars "Our values": Best result, Accountability, Leadership, Collaboration, Kindness (one line each, editor-written).
5. image_text "How we work": Art, Advocacy, Research, Technology and Sports as tools for development.
6. stats_row from live counters.
7. team_grid (leadership) + link "Meet the whole team" → `/about/team`.
8. downloads (annual reports) if any.
9. cta_band.

### 6.3 Our people `/about/team`
Groups in order: Leadership, Staff, Board of Trustees, Advisors. Card: photo or initials avatar on gold, name, title; click opens a dialog with bio and LinkedIn. Seeded with the 18 names and titles in spec/14 §5. Board group hidden until populated. Below: "Our volunteers" band with live volunteer count and "Volunteer with us" CTA.

### 6.4 Programmes `/programmes` and `/programmes/[slug]`
Index: intro line, a card per published programme (image, name, one-line summary, "who it's for" chip, live headline number).

Programme page template (blocks, editable):
1. hero with programme name, one-line summary, CTA depending on programme: enrolling programmes → "Join this programme" → `/join/student?programme={slug}`; others → "Support this work" or "Partner with us".
2. "The problem" rich_text.
3. "What we do" steps.
4. Live numbers for this programme (students, schools, cohorts completed, average confidence gain when ≥ 30 endlines exist).
5. "Where it runs": list of states and LGAs with active cohorts, and a small map.
6. Upcoming: next events or cohort start dates.
7. Stories tagged with this programme.
8. FAQs for this programme's audience.
9. cta_band.

Seed pages (content from the current site, tidied):

| slug | key content |
|---|---|
| `debate-and-public-speaking` | Volunteers train teens aged 13–18 in secondary schools in public speaking and debate, built around the UN Sustainable Development Goals. Running since 2021. Includes an essay-writing track for students with speech impediments or other disabilities. Enrolling. |
| `ibadan-schools-debate-competition` | Annual competition at Mapo Hall, Ibadan, marking the International Day of the Girl Child. Government and private schools. Cash prizes. Links to events. |
| `inspire-her-future` | One-day STEM workshop and hackathon with the Global Shapers Community, Ibadan Hub. Inaugural edition: 92 girls from 9 secondary schools. |
| `eko-dara` | Èkó Dára: getting out-of-school children into government schools in Oyo State. Fees and supplies, school feeding, an NYSC mentor for each child, and seed funding and business training for guardians. Context figures quoted with sources (UNESCO; Oyo State Ministry of Education: about 463,280 children out of school). Fundraising target $250,000 with a progress bar from donations designated to it. |
| `end-fgm` | Community dialogues, media campaigns and advocacy with community leaders and policymakers in Oyo and Osun States. *No decline claims without data.* |
| `women-in-history` | Social-media campaign celebrating Black women in history. Links to posts. |
| `edutracka` | "Where does education money go?" Tracks Oyo State education budgets and school data across 33 LGAs. External CTA → `https://edutracka.ai`. |

### 6.5 Impact `/impact`
1. Hero: "The numbers behind the dream." Subtitle "Live from our programme records. Updated daily."
2. Big counters: students trained, girls among them, schools reached, volunteer coaches, volunteer hours, states.
3. Charts: students by year (bar); students by programme (bar); attendance rate and completion rate (stat tiles); confidence before vs after (paired bar, shown only when ≥ 30 matched pairs, with n shown).
4. **Reach map**: LGAs shaded by students reached; toggle to shade by EduTracka indicator (pupils per teacher) with BGDI schools as dots; click an LGA for a panel (students, schools, indicator values, source and year). Text table alternative below for accessibility.
5. "How we measure": plain-language explanation of baseline and endline, and what counts as "trained" (definition from spec/10 §3).
6. Reports: latest 3 downloads → `/impact/reports`.
7. cta_band "Fund what works." → Partner / Donate.

No individual child data ever appears. Any cell with fewer than 5 students is shown as "<5".

### 6.6 Stories `/stories`, `/stories/[slug]`
List: featured story large, then grid, filters by programme and tag, pagination 12. Story page: cover, title, date, author, reading time, body, share buttons (WhatsApp, X, LinkedIn, copy link), related stories, cta_band. Children are named by first name only and only with recorded consent (spec/02 §15 rule 7).

### 6.7 Events `/events`, `/events/[slug]`
Tabs Upcoming | Past. Card: date block, title, venue or "Online", programme chip. Detail: cover, date and time in WAT, venue with map link, body, "Add to calendar" (.ics), registration by mode: none; external link; **Hub form** (name, phone, email optional, organisation; capacity enforced; confirmation by WhatsApp/SMS/email using template `event.registered`). Past events show a gallery strip and a linked story if set.

### 6.8 Get involved `/get-involved`
Four large cards with who it's for, what happens next, and time needed:
- **Students** (ages 10–18): "Join a free programme at your school." → `/join/student`
- **Volunteers**: "Coach, judge or help run events. Training provided." → `/join/volunteer`
- **Schools**: "Bring BGDI to your students." → `/join/school`
- **Partners and donors**: "Fund a school, a state or a programme." → `/partner`, `/donate`
Then steps "What happens after you sign up" (You tell us about you → We reply in minutes → We place you → You start), faq_list, quote.

### 6.9 Partner `/partner`
Why partner (live numbers), ways to partner (fund a cohort, sponsor the competition, in-kind, employee volunteering, research), current partners, enquiry form: organisation, contact name, email, phone, interest (multi-select), message → `contact_message` topic `partnership` + task + auto-reply.

### 6.10 Donate `/donate`
Spec/11. Layout: left, why give with three impact lines; right, the donate widget. Below: other ways to give (bank transfer details from settings), FAQ for donors, receipt and transparency note.

### 6.11 Contact `/contact`
Address (Ibadan, Oyo State — full address from settings), phone +234 813 707 5948, email info@theblackgirlsdream.org, WhatsApp click-to-chat if configured, social links, form (name, email or phone, topic, message, honeypot) → `contact_message` + task + auto-reply. For safeguarding concerns, a prominent link to `/report-a-concern`.

### 6.12 Gallery, Press, FAQ
Gallery: albums grid → album page with lightbox, lazy-loaded, alt text required. Press: logo/outlet, title, date, link; media kit download; press contact. FAQ: tabs by audience; accordion; `FAQPage` JSON-LD. Seed FAQs in spec/14 §5.

### 6.13 Legal pages
`/privacy`, `/safeguarding`, `/terms`, `/cookies` are `content_page`s seeded with the drafts in spec/09 §8. They show "Last updated" and a version number; consent records store the privacy version shown.

### 6.14 System pages
404 ("We couldn't find that page" + search of stories/programmes + home link), 500, offline fallback, maintenance.

## 7. Cookies and analytics

No third-party trackers. First-party, cookieless page-view counting: a `page_view` table (`path`, `date`, `count`, `referrer_host`, `campaign_code`) incremented by middleware, no IP stored. Cookies used: session, locale, campaign source, consent-banner dismissal. Therefore the cookie banner is a one-line notice, not a consent wall.

## 8. Migration from WordPress

1. `scripts/import-wordpress.ts` reads a WordPress export (WXR) if BGDI supplies one and imports only genuine BGDI posts and images as draft stories for an editor to review. Template posts dated 6 May 2020 are skipped.
2. Seed the `redirect` table (middleware serves these as 301):

| From | To |
|---|---|
| `/about-us/` | `/about` |
| `/empower-young-people/` | `/about/team` |
| `/host-an-event/` , `/what-we-do/`, `/causes/` | `/programmes` |
| `/host-an-event/inspire-her-future-empowering-girls-in-stem/` | `/programmes/inspire-her-future` |
| `/children-aid/` | `/programmes/eko-dara` |
| `/protecting-kids/` | `/programmes/end-fgm` |
| `/get-involved/` | `/get-involved` |
| `/donate-now`, `/donate-now/`, `/membership-giving/`, `/shop-2-2/` | `/donate` |
| `/blog`, `/blog/` | `/stories` |
| `/contacts/` | `/contact` |
| `/events/` | `/events` |
| `/terms-of-site/` | `/terms` |
| `/children/`, `/gallery/` | `/gallery` |
| `/wp-admin`, `/wp-login.php` | 410 Gone |
3. Cutover checklist: lower DNS TTL 48 h before; keep MX and email records unchanged; point apex and `www` to CloudFront; verify certificate; submit new sitemap in Google Search Console; keep the WordPress host online at `old.theblackgirlsdream.org` (noindex, password-protected) for 60 days; then retire.

## 9. Placeholder rule

Until BGDI supplies a real asset, use: initials avatars for people; a gold-and-black pattern for missing photos; hidden blocks for missing quotes; `settings` values for address and registration details. Never use stock photos of children, invented quotes, or invented numbers.
