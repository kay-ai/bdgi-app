# BGDI design plan

*v1, 15 Nov 2026. Covers the website, the Hub app and the console. On anything visual, on motion and on website copy, this document wins over `spec/`. It was written against three skills: `design-taste-frontend` (tasteskill 2.5), `frontend-animation` and `3d-web-experience`. Where they disagree, the order is: taste rules on the website, animation rules in the app, and 3D only where it does a job.*

---

## 1. Three faces, three sets of rules

| Face | What it is | Rule set |
|---|---|---|
| **Website** (`/`, public pages) | A service organisation's site. Taste kind: **service**, site-kind **other**. | Full tasteskill rules: photographs lead, flat grounds, one section per screen, equal edges, hover layer only. No effects, no scroll animation, no animation library. |
| **Join flows and Hub app** (`/join`, `/app`) | A phone product used by teenagers, guardians and volunteers. | Same tokens, type, buttons and colour as the website. Motion from the animation skill: micro-interactions plus three orchestrated moments. |
| **Console** (`/console`) | A dense work tool for staff. | Same tokens, tighter spacing, almost no motion. |

One design system serves all three. A student who moves from the website to the join form to the app never sees the type, buttons or colours change.

## 2. What this design refuses (the slop list)

Each item is something the AWS proof of concept, the current WordPress site or a typical generated UI does. None of it ships.

| Refused | Used instead |
|---|---|
| Emoji as icons (the PoC used them on every card) | Lucide line icons in ink in the app and console; real full-colour marks for real products (WhatsApp, Paystack) on the website |
| Violet, lavender or purple-to-pink gradients (the AWS kickoff deck's colours) | BGDI's own gold and near-black on warm cream |
| Poppins, Inter, Montserrat, or the system font look | Source Serif 4 for headings, Libre Franklin for text |
| A slogan as the headline ("Every girl deserves to be heard") | A headline that names what BGDI does and for whom, with one hard fact beside it |
| A row of big animated counters (the current site's show 0) | Figures inside sentences, static in the HTML, with a footnoted source |
| Fade-in-up on every element as the page scrolls | Nothing on the website moves on scroll |
| Bounce, elastic overshoot, confetti | Short ease-out steps; one drawn seal at the finish of intake |
| Gradients, glass blur, glow, drop shadows on everything | Flat grounds, 1px hairlines, a shadow only on a hovered linked card |
| Three-column icon feature grid, check-icon lists, a logo wall | Photographs of the work, a list with one photograph that changes, partner marks as one small row |
| Stock photographs of children, invented quotes or testimonials | BGDI's own photographs with recorded permission, or no picture; a quote only when BGDI supplies it |
| Captions under pictures | Alt text only; one credits line in the footer |
| "Learn more", "Discover", "Explore" | A verb and what the visitor gets: "Join a programme", "See the impact report" |
| Cards inside cards, pills on everything, all-caps tracked labels | Two boxes deep at most; sentence case; 13px labels at weight 500 |
| A carousel, auto-advancing slider, timed tabs, marquee | A still; changes happen only on the visitor's click or hover |
| Shimmering skeletons, spinners that fill the screen | Static tinted placeholders that hold the layout |
| A 3D hero, particles, a shader background | Photographs. 3D appears in one place, described in section 9 |
| Dark mode as a default "premium" look | Light pages; dark is used for the footer and one band only |

## 3. The deal (dealt by the skill's scripts, not chosen by taste)

Recorded in `.taste-skill/`. Build exactly this.

| Part | Result |
|---|---|
| Kind | service · page type `service` · site-kind `other` |
| Hero | `photo`: a full-bleed photograph, the words in a solid box on its calm side |
| Type | `source-serif`: Source Serif 4 (display, weight 400) with Libre Franklin (text, 400 and 500) |
| Palette | BGDI's own colours through `start.mjs brand` |
| Nav | `nav-centre` |
| Close | `close-type` |
| Footer | `footer-dark` |
| Rhythm | `surface-pairs`: one band of two neighbouring sections on the surface ground |
| Buttons | `arrow` |
| Radius | `soft` (8 / 12 / 20) |
| Mark | BGDI's own logo SVG (no dealt mark) |
| Effect, moments, scene, CSS grounds | None. The kind forbids them. |

## 4. Tokens

### 4.1 Colour (as printed by `start.mjs brand`; keep the block unchanged)

| Token | Value | Use |
|---|---|---|
| `--p-bg` | `#FBF7EF` | page ground (warm cream) |
| `--p-surface` | `#F1EADC` | the surface band, cards on the ground, fields |
| `--p-ink` | `#1A1712` | text, glyphs, hairlines at 12–15% |
| `--p-muted` | `#67635C` | labels, dates, meta only |
| `--p-accent` | `#FFB800` | BGDI gold: the brand band, small marks, chart highlight, selected states |
| `--p-accent-ink` | `#111111` | text on gold |
| `--p-action` | `#1A1712` | primary button fill, links, focus ring on light grounds |
| `--p-action-ink` | `#FBF7EF` | primary button label |
| `--p-inv-bg` | `#1A1712` | footer and the one dark band |
| `--p-inv-ink` | `#FBF7EF` | text on dark |
| `--p-inv-action` | `#FFB800` | primary button on dark: gold with black label |

Rules:
- Gold is never text and never a link on a light ground: it has too little contrast on cream. On light grounds the primary button is ink. On dark grounds it is gold.
- The interface is 90–95% neutral. Colour comes from the photographs (BGDI's yellow shirts and school uniforms carry it).
- Gold covers under 3% of any screen outside the brand band.
- No gradient anywhere. No tint of violet.

App-only status colours (never on the website): success `#1F7A5A`, danger `#B3261E`, warning is gold with ink text, information is ink. Each has a 10% tint for backgrounds. Status is always shown with an icon or word as well as colour.

Chart ramp (sequential, for the map and choropleths): `#F6EBC8`, `#EBD08A`, `#DDB04A`, `#C28E12`, `#8F6600`. Chart series: ink, gold, `#67635C`, success green. No more than four series in one chart.

### 4.2 Type

| Level | Website 1440 / 390 | App | Face |
|---|---|---|---|
| h1 | 80 / 44 (photo hero), 72 / 38 elsewhere | 28 | Source Serif 4, 400, tracking −2.6% |
| h2 | 48 / 30 | 22 | Source Serif 4, 400 |
| h3, quotes | 28 / 24 | 18 | Source Serif 4, 400 |
| Lead, card titles | 20 / 18 | 18 | Libre Franklin, 500 |
| Body | 16 / 16, line height 1.6 | 16 | Libre Franklin, 400 |
| Small | 14 | 14 | Libre Franklin, 400 |
| Labels, buttons | 13 and 16, 500 | 13 and 16, 500 | Libre Franklin |
| A figure | 38 / 28 | 28 | Source Serif 4, tabular numerals |

- Weights 400 and 500 only. Never 700. Size and tight tracking carry headings.
- Sentence case everywhere. Nothing under 13px. Lines at most 62 characters.
- The console uses Libre Franklin for everything, including headings, at 14px body. Serif appears there only in page titles.
- Fonts are self-hosted through `next/font`, at most four files, `display: swap`.
- **To verify at build:** both faces must draw Yoruba letters with dots below and tone marks (ẹ, ọ, ṣ, á, à). If either fails, deal the pairing again with `start.mjs deal --page service`.

### 4.3 Space, shape, grid

- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128. Nothing else.
- Website: one `.wrap` of 1280 with 80px gutters (24 on a phone), 12 columns, 24px gap. Every block starts and ends on a column line. Splits are text left, picture right, on every split of the site; never mirrored.
- Radius: 8 controls, 12 panels, 20 cards and frames. Buttons 44px high (48 in the app and the phone bar), 24px side padding, 16px label.
- Hairlines: 1px at 12% ink. No shadows at rest.
- App: 16px screen margin, 12px between cards, 48px minimum tap target, bottom tab bar 64px plus the safe area.
- Console: 8px grid, 40px table rows, 240px sidebar.

### 4.4 Buttons, links, cards (one of each)

- Primary: filled, with the drawn arrow as its last child. Secondary: a text link with an underline. No ghost, gradient, shadowed or third style.
- Exactly one filled button in any view.
- Links: one underline style; an ink line draws left to right on hover.
- Card: surface ground, 20px radius, 24px padding, no border at rest. A card that links lifts 2px on hover; a card that doesn't link does nothing.

## 5. Website copy

Rules (from `copy.md`): the h1 names the category and the audience; one hard fact on the first screen; every heading has a noun; buttons are a verb and an object; about 34 words a screen; no slogans, questions, exclamation marks or metaphors.

**The main action is "Join a programme".** It reads the same in the nav, the hero, the close and the phone bar, and is the only filled button. "Donate" is the second action, a plain word in the nav and a text link elsewhere. On `/donate` and `/partner` the main action is "Donate" and "Send an enquiry". If BGDI would rather lead with donations, swap the two; nothing else changes.

Home hero:
- h1 (30 characters; the limit is 32): **Free debate training for girls**
- Sub-line: "Black Girl's Dream Initiative trains secondary school students in public speaking, debate and STEM, at their own schools. 2,000 students in 85 schools across Oyo and Osun since 2021."
- Buttons: **Join a programme** · See our programmes

**CONFIRM with BGDI:** "for girls" in the h1 (boys attend some sessions), the 2,000 and 85 figures, and the 2021 start date.

Headings used on the home page: "Four programmes" · "2,000 students trained since 2021" · "Schools in Oyo and Osun" · "How joining works" · "Volunteer coaches run every session" · "Stories from our schools" · "Join a free programme at your school".

This replaces the draft home copy in `spec/04` §6.1.

## 6. Website pages, planned in screens

Every section is exactly one or two screens tall at 1440×900, with its h2 first and top-aligned, and no neighbour showing. The hero is alone on the first screen.

### 6.1 Home (8 screens)

| # | id | One idea | Picture | Kind | Screens |
|---|---|---|---|---|---|
| 1 | `top` | What BGDI does, for whom, one fact | Full-bleed photograph: a student speaking at the Ibadan Schools Debate Competition. Words in a solid cream box on the calm side. | use | 1 |
| 2 | `programmes` | Four programmes | A list of four rows on the left (name, one line, who it's for). One photograph on the right that changes when a row is hovered or tapped. | use | 1 |
| 3 | `impact` | 2,000 students since 2021 | Photograph of a school session, span 6. Three figures set inside sentences, footnoted. Link: "See the impact report". Surface ground. | use + type | 1 |
| 4 | `reach` | Where BGDI works | The reach map as a still: LGAs of Oyo and Osun shaded in the gold ramp, school dots in ink. Text left, map right. Link: "See the map". Surface ground. | diagram (the page's one) | 1 |
| 5 | `steps` | How joining works | Four numbered steps on the left; photograph of volunteers arriving at a school on the right. | use | 1 |
| 6 | `people` | Volunteer coaches | A row of four to six portraits of volunteers. Text link: "Volunteer as a coach". Partner marks merge in here as one small row at the foot ("Supported by"). | people | 1 |
| 7 | `stories` | Stories | Three linked photographs, each with its title inside the card. Photographs zoom 1.03 on hover. | work | 1 |
| 8 | `closing` | Join | Close: the h2, one line, the large button across the wrap. Then the dark footer directory and the legal row. | type | 1 |

At 390: same order, text before each picture, one column, buttons full width, a fixed bar at the foot with "Join a programme" (filled) and "Donate".

### 6.2 Other pages

| Page | Sections, in order (screens) |
|---|---|
| **About** | hero `photo`: the team (1) · story, text left and a founder portrait right (1) · mission and vision as two statements on the surface band (1) · five values as a plain list beside a photograph (1) · leadership portraits with "Meet the team" (1) · close (1) |
| **Our people** | head and leadership portraits (1) · staff grid of open tiles, name and title only (2) · volunteers photograph with "Volunteer as a coach" (1) · close (1) |
| **Programmes** | head with four large linked photographs, 2×2 (2) · other work as a list with one photograph: Èkó Dára, End FGM, Women in History, EduTracka (1) · close (1) |
| **Programme page** | hero `photo` of that programme (1) · the problem, text and one photograph (1) · what happens in a session, steps and photograph (1) · figures for this programme in sentences, with where it runs as a list (1) · two stories (1) · questions, all answers open (1) · close with that programme's join button (1) |
| **Impact** | head: h1 and four figures in sentences, photograph right (1) · charts: students by year and by programme, two flat bar charts (1) · the reach map, full wrap, with the layer switch (2) · confidence before and after, paired bars, with how it is measured beside it (1) · reports as a list of downloads (1) · close "Fund a school" (1) |
| **Stories** | head and the featured story as a large linked photograph (1) · grid of six (2) · close (1). A story itself uses the reading template below. |
| **Events** | head and next event as a split with its photograph (1) · list of upcoming and past as rows (1 or 2) · close (1) |
| **Get involved** | head and four linked photographs, one per way in (2) · steps "What happens after you sign up" (1) · questions (1) · close (1) |
| **Partner** | hero `photo` (1) · ways to partner as rows with one photograph (1) · figures and report link (1) · enquiry form, six fields (1) · footer (1) |
| **Donate** | split: why give on the left with one photograph, the form on the right (1) · other ways to give as rows, donor questions (1) · footer (1) |
| **Contact** | split: details left, form right (1) · footer (1) |

**Reading template** (stories, privacy, safeguarding, terms, FAQ): a single 62-character column on the left line, cover photograph across the wrap first, h1 at 48, body at 18/30. These pages are exempt from the screen grid because they are long reading.

**System pages** (404, offline, maintenance): one screen, an h1, one line, one button.

### 6.3 Photographs the website needs from BGDI

No section is built with a stand-in for a child. Until a photograph arrives with permission recorded, the section uses a photograph of adults (volunteers, team, venue) or is left out.

1. Hero: a student at the microphone at the debate competition, landscape, at least 1920 wide, with a calm area on one side.
2. A school training session in progress.
3. Volunteers in BGDI shirts arriving at or working in a school.
4. Four to six volunteer portraits.
5. One photograph per programme (debate training, the competition at Mapo Hall, Inspire Her Future hackathon, Èkó Dára).
6. Team portraits for 18 people, same framing and light.
7. A founder portrait.
8. Three story cover photographs.

The decks already contain usable frames for 1, 3 and 5. BGDI must supply the originals and confirm permission for every child shown.

## 7. Website motion (the hover layer only)

Nothing moves by itself, on load, by time or on scroll. No animation library is loaded on public pages. Every change is the visitor's.

| Element | Motion | Time |
|---|---|---|
| Button | fill steps 14% toward ink, box rises 1px; press sinks 1px and scales .985 | 140ms in, 200ms out, 90ms press |
| Arrow in a button | moves 3px right, settles back | 140 / 200ms |
| Link | an ink underline draws left to right | 140 / 200ms |
| Linked card | lifts 2px, border darkens one step | 180ms |
| Linked photograph | scales to 1.03 inside its frame | 600ms |
| Nav panel | opens after 150ms of intent with a 6px drop | 200ms, closes in 120ms |
| Programme list photograph | swaps when a row is hovered or tapped; cross-fade | 200ms |
| Focus | 2px ink ring, offset settling 6px to 2px | 200ms |
| Field | ink border and a 3px soft ring | 140ms |

Ease for all: `cubic-bezier(.2, .8, .2, 1)`. No bounce. Under reduced motion, colours still change and underlines appear without travelling. The header looks the same at every scroll depth: opaque, fixed, one hairline.

## 8. App and join-flow design

### 8.1 Screen shell

Cream ground. A top bar with the page title in serif and the avatar on the right. A bottom tab bar with four Lucide icons and labels; the active tab has an ink icon and a 2px gold bar above it. Content is cards on the surface colour. One primary button per screen, pinned above the tab bar when the screen is a form.

### 8.2 Key screens

| Screen | Composition |
|---|---|
| **Join chooser** | Serif h1 "Join a programme". Three full-width linked rows, each with a photograph thumbnail on the left, a title, one line, and the arrow. No icons in coloured tiles. |
| **Intake step** | Progress as a thin ink line across the top with "2 of 5" beside it. One question group. Choices are large chips: surface at rest, ink fill with cream label when selected, with a drawn tick. Text fields 48px. "Next" pinned at the foot; "Back" as a text link. |
| **Check-in scale** | One statement per screen in serif at 22px. Five circles in a row, growing from small to large, labelled "Not at all" and "Very much" at the ends. No faces, no emoji. |
| **Done** | The student's avatar inside a ring that draws itself. "Thank you, Aisha." in serif. Three numbered next steps. One button. |
| **Student home** | One status card that takes the top half: the next session's date set large in serif, time, venue, lesson. Below: attendance as a row of dots (ink for present, outline for absent, gold ring for today). Then coaches as first names with avatars. |
| **Guardian permission** | A reading page: serif heading, short paragraphs at 18px, four choices as large checkboxes with plain sentences, the code field, two buttons. No decoration. It must look like something a parent can trust and read on a small phone. |
| **Attendance** | A list of students: avatar, first name, class. On the right of each row a three-part switch (Present, Absent, Excused) with a sliding ink indicator. A sticky summary at the top: "24 of 30 marked". A small tick appears on each row when it has synced. |
| **Volunteer stage tracker** | Five steps down the screen joined by a line; done steps have an ink tick, the current step is expanded with its instruction and one button. |
| **Scorecard** (P2) | Stars as five drawn outlines filled in ink. Six horizontal bars with the value at the right end. Then two cards: "What you did well" and "Try this next time", two short lines each. |
| **Record** (P2) | A large ink circle to start. While recording: a timer in serif at 48px, a level meter of thin vertical bars driven by the real microphone level, and a stop square. Nothing else on the screen. |

### 8.3 Avatars

24 flat silhouettes, bust only, derived from the girl in BGDI's logo: no facial features, varied hair (afro, puffs, braids, cornrows, low cut, locs, hijab), drawn as one ink shape on a gold, cream, terracotta `#C4623A` or green `#1F7A5A` disc. This avoids generic cartoon people and ties every avatar to the brand. To be drawn as SVG by a designer or by hand in code; not generated images.

### 8.4 Icons

Lucide, 1.5px stroke, 20 or 24px, always ink or muted. Never inside a coloured rounded square. An icon always has a text label, except the avatar and the bell.

### 8.5 App motion (animation skill)

Library: Motion (Framer Motion), loaded only in `/join` and `/app`. Wrapped in `MotionConfig reducedMotion="user"`. Transform and opacity only. Translate distances 8–16px.

Each motion has a job:

| Where | Motion | Why | Timing |
|---|---|---|---|
| Chip or button press | scale .97, colour change | confirms the tap | 120ms ease-out |
| Chip selected | tick draws | shows the choice registered | 160ms |
| Intake step change | old group fades; new group fades in from 12px in the direction of travel; progress line grows by `scaleX` | shows direction and progress | 120ms out, 220ms in |
| Attendance switch | indicator slides to the tapped part | shows the state changed | spring 400 / 30 |
| Row synced | small tick draws once | confirms it was saved | 160ms |
| Bottom sheet | rises from the foot; backdrop fades | shows where it came from | spring 400 / 36; 200ms |
| Detail page push | slides in 16px with a fade | shows depth | 240ms ease-in-out |
| Tab change | none; instant | speed on slow phones | – |
| Toast | fades in 8px above the tab bar | brief notice | 200ms |
| Recording level meter | bars follow the microphone level | real data, not decoration | live |
| Record button | one ring grows and fades while recording | shows it is live | 2.4s loop, only while recording |

Three orchestrated moments, and no others:

1. **Intake done.** The ring around the avatar draws (600ms), the name appears, the three next steps arrive 60ms apart. Under 900ms in total. No confetti.
2. **Scorecard.** Stars fill left to right (80ms each), the six bars grow from zero 70ms apart over 500ms, the values appear when each bar stops, then the feedback cards. Under 1.2 seconds; a tap skips it. Numbers do not count up.
3. **Certificate.** The seal's outline draws and the name sets beneath it (800ms).

Not used: fade-in on scroll, staggered card entrances on every screen, parallax, bounce, shimmer, page-load animation of the whole screen.

Under reduced motion all three show their finished state at once.

### 8.6 States

Every screen is designed in five states: loading (static tinted blocks in the final layout), empty (one sentence saying what will appear and when, one action), error (what went wrong in plain words, a retry), offline (a banner at the top: "You're offline. We'll save this and send it later."), and done.

## 9. 3D: where it is used, and where it is not

*Revised 15 Nov 2026 at BGDI's request: the first version of this section kept 3D off the website. The site read as too ordinary, so the website now carries one 3D layer, the journey, described first below. The photographs still lead; the journey flies over them and never replaces them.*

### 9.1 The journey (website)

A gold paper plane takes off across the hero when a page loads and flies down the page as the visitor scrolls. On the line between each pair of sections floats an object from a school day: a microphone, a stack of books, a globe, a pencil, a trophy, a light bulb. The plane circles each one, passing behind it and in front of it; the object spins and throws off a few gold sparks. The journey ends at a graduation cap, in the open half of the closing section where there is one.

- **One canvas.** Fixed over the page, see-through, under the header, and it never takes a click or a tap. World space is the page itself (one unit is one CSS pixel), so objects stay pinned to their sections.
- **Where things sit.** Objects sit on section boundaries, inside the 96px of padding on each side, so they do not cover text. The plane crosses the page along the boundary line and travels down the gutter between objects.
- **Built from primitives** in the site's own colours (gold, green, clay, cream, ink), flat-shaded. No models or textures are downloaded.
- **Motion follows the visitor.** The plane moves only as far as the scroll has gone; its dashed trail fades within two seconds. Objects bob slowly and lean toward the pointer.
- **Cost.** three.js (about 124 KB gzipped) is fetched after the page is idle and is never in the first load. Pixel ratio capped at 1.5, two lights, no real shadows (each shadow is one soft sprite), no post-processing.
- **Switched off** for reduced motion, Save-Data, devices reporting 2 GB of memory or less, when WebGL is missing, in print, and on pages where it would be out of place: report a concern, the policy pages, donate, contact and sign-in. The join forms never have it. Without it every page is complete.
- **Code:** `src/components/site/journey/`. A section can end the journey in its open half with `data-journey-end`.

### 9.2 Everywhere else

Beyond the journey, 3D belongs in very few places. BGDI's audience is on low-cost Android phones and slow data, and the taste rules forbid shader effects for a service organisation. So:

| Place | Decision |
|---|---|
| Website hero, section backgrounds, cards | **No 3D of their own.** Photographs; the journey passes over them. |
| **Reach map on `/impact`** | **Yes, on request.** The page loads a flat SVG map drawn on the server (no WebGL, no script needed). A "View in 3D" button swaps in a MapLibre view where each LGA rises as a block, its height showing students reached, with drag to turn and tilt. This is the visitor's own action, so it fits the motion rules, and the third dimension carries real data. Desktop and capable tablets only. |
| Hub app | **No 3D in Phases 1 and 2.** The seal on the certificate is an SVG that draws. |
| **Certificate seal, Phase 3 (optional)** | A gold medal the student can turn with a finger, built with React Three Fiber. Loaded only after the page is usable, only on devices that pass a capability check, never on the critical path. Recommended only if testing with students shows it is wanted. |
| Console | **No 3D.** The console map is the flat one with the layer switch. |

Rules for the 3D that does ship:
- One WebGL context per page at most.
- Always a still fallback that reads as finished: the SVG map; the SVG seal.
- Loaded with a dynamic import after first paint. Its JavaScript is never in the page's first load.
- Device pixel ratio capped at 1.5. No shadows, no post-processing, one light.
- Map geometry simplified to under 150 KB for Oyo and Osun.
- Reduced motion or a phone: the flat version, with no button offered.
- Keyboard: the same data is in the table under the map; the 3D view is an alternative view, never the only one.
- Budget: the 3D view must hold 30 frames a second on a mid-range Android phone or it is switched off for that device class.

## 10. Console design

- White ground instead of cream, for long working sessions and dense tables. Same ink, same gold, same type.
- Left sidebar on the surface colour; the active item has a 2px gold bar and ink text.
- Tables: 40px rows, hairline between rows, no zebra stripes, no card around the table. Numbers right-aligned in tabular numerals. Status as a small word with a coloured dot.
- Filters as a single row of plain selects above the table. Bulk actions appear in a bar when rows are selected.
- Detail opens as a side panel 480px wide on desktop, a full page on a phone.
- Charts: flat bars and lines in ink with gold for the highlighted series; direct labels on the marks; a legend only when there are three or more series; no gradients, no 3D, no pie charts with more than three parts.
- Motion: row hover tint (120ms), side panel slide (200ms), nothing else.
- The block editor for website content shows each block as a labelled row with a small still preview, not a blank canvas.

## 11. Messages, PDFs and other surfaces

- **Email:** cream ground, logo top left on a white bar, serif heading, 16px text, one ink button, footer with address. No hero image, no coloured header block.
- **Certificates and receipts (PDF):** cream page, logo, serif name set large, a single gold seal, signature, verification code and QR in the foot. No borders made of ornaments.
- **Reports (PDF):** the website's type and chart style; a full-page photograph on the cover with the title in a cream box.
- **WhatsApp and SMS:** plain sentences, no emoji, the student's first name once.
- **Open Graph image:** a photograph with the logo in a cream box bottom left.
- **Favicon:** the girl silhouette from the logo in ink on gold.

## 12. Accessibility

- Text contrast 7:1 for reading text, 4.5:1 for labels. Gold is never text on light.
- Every control reachable by keyboard with a visible 2px focus ring.
- Tap targets 44px on the website, 48px in the app.
- Nothing depends on colour alone, on hover alone, or on sound alone.
- Reduced motion respected on every face.
- Language switch on every screen; `lang` set correctly for Yoruba pages.
- Tested with a screen reader on the join flow, the permission page and the donate form.

## 13. How the design gets built and checked

1. **Design masters first.** Before any Next.js component, build the home page, one programme page, `/impact` and `/donate` as static HTML from the taste skill's `starter.html` and assets, in `design/masters/`. This is where layout, type and copy are settled.
2. **Run the skill's checks** on each master at 1440, 1024, 820, 768 and 390: `consistency.mjs`, `layout/check.mjs`, `shoot.mjs`, `perf.mjs`. Every FAIL is fixed or reported with a reason.
3. **Port to Next.js.** The skill's `system.css`, `layout.css` and `motion.css` are brought in as the website's stylesheet. The same token values are exposed to Tailwind for the app and console, so there is one source of truth.
4. **Check the built site.** A script saves the rendered public pages to `dist-check/` and the same four checks run on them in CI.
5. **App screens** are reviewed at 360×740 against sections 8.2, 8.5 and 8.6, and on a real low-cost Android phone before each milestone is called done.
6. **Review with BGDI** at two points: after the masters (look, copy, photographs) and after the first working join flow.

## 14. What is still open

- BGDI's brand guide, if one exists. The gold and near-black here are taken from the logo and the decks.
- Photographs and permission for each (section 6.3). The website cannot be finished without them.
- The "for girls" wording and the figures in the hero.
- Whether "Join a programme" or "Donate" is the main action.
- Whether the two fonts draw Yoruba correctly (checked at build).
- Avatars need drawing. They are specified here, not made.
