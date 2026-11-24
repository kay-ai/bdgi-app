/** Seed data from spec/14 §5. Real facts only; anything BGDI still owes is marked CONFIRM. */

export const states: { code: string; name: string; active?: boolean }[] = [
  { code: "AB", name: "Abia" },
  { code: "AD", name: "Adamawa" },
  { code: "AK", name: "Akwa Ibom" },
  { code: "AN", name: "Anambra" },
  { code: "BA", name: "Bauchi" },
  { code: "BY", name: "Bayelsa" },
  { code: "BE", name: "Benue" },
  { code: "BO", name: "Borno" },
  { code: "CR", name: "Cross River" },
  { code: "DE", name: "Delta" },
  { code: "EB", name: "Ebonyi" },
  { code: "ED", name: "Edo" },
  { code: "EK", name: "Ekiti" },
  { code: "EN", name: "Enugu" },
  { code: "FC", name: "Federal Capital Territory" },
  { code: "GO", name: "Gombe" },
  { code: "IM", name: "Imo" },
  { code: "JI", name: "Jigawa" },
  { code: "KD", name: "Kaduna" },
  { code: "KN", name: "Kano" },
  { code: "KT", name: "Katsina" },
  { code: "KE", name: "Kebbi" },
  { code: "KO", name: "Kogi" },
  { code: "KW", name: "Kwara" },
  { code: "LA", name: "Lagos" },
  { code: "NA", name: "Nasarawa" },
  { code: "NI", name: "Niger" },
  { code: "OG", name: "Ogun" },
  { code: "ON", name: "Ondo" },
  { code: "OS", name: "Osun", active: true },
  { code: "OY", name: "Oyo", active: true },
  { code: "PL", name: "Plateau" },
  { code: "RI", name: "Rivers" },
  { code: "SO", name: "Sokoto" },
  { code: "TA", name: "Taraba" },
  { code: "YO", name: "Yobe" },
  { code: "ZA", name: "Zamfara" },
];

export const lgas: Record<"OY" | "OS", string[]> = {
  OY: [
    "Afijio", "Akinyele", "Atiba", "Atisbo", "Egbeda", "Ibadan North", "Ibadan North-East",
    "Ibadan North-West", "Ibadan South-East", "Ibadan South-West", "Ibarapa Central", "Ibarapa East",
    "Ibarapa North", "Ido", "Irepo", "Iseyin", "Itesiwaju", "Iwajowa", "Kajola", "Lagelu",
    "Ogbomosho North", "Ogbomosho South", "Ogo Oluwa", "Olorunsogo", "Oluyole", "Ona Ara", "Orelope",
    "Ori Ire", "Oyo East", "Oyo West", "Saki East", "Saki West", "Surulere",
  ],
  OS: [
    "Atakunmosa East", "Atakunmosa West", "Aiyedaade", "Aiyedire", "Boluwaduro", "Boripe", "Ede North",
    "Ede South", "Egbedore", "Ejigbo", "Ife Central", "Ife East", "Ife North", "Ife South", "Ifedayo",
    "Ifelodun", "Ila", "Ilesa East", "Ilesa West", "Irepodun", "Irewole", "Isokan", "Iwo", "Obokun",
    "Odo Otin", "Ola Oluwa", "Olorunda", "Oriade", "Orolu", "Osogbo",
  ],
};

export const geoCode = (state: string, lga: string) =>
  `NG-${state}-${lga.toUpperCase().replace(/[^A-Z]+/g, "-")}`;

type Kind = "debate" | "stem" | "education_access" | "advocacy" | "campaign" | "other";
export const programmes: {
  slug: string;
  kind: Kind;
  nameEn: string;
  summaryEn: string;
  isEnrolling: boolean;
  minAge: number;
  maxAge: number;
  defaultSessions: number;
  sort: number;
  acceptsDesignatedGifts?: boolean;
  fundraisingTargetMinor?: number;
  fundraisingCurrency?: string;
}[] = [
  {
    slug: "debate-and-public-speaking",
    kind: "debate",
    nameEn: "Debate and public speaking",
    summaryEn:
      "Eight weekly sessions at school, run by trained volunteer coaches and built around the UN Sustainable Development Goals. Includes an essay track for students who prefer to write.",
    isEnrolling: true,
    minAge: 10,
    maxAge: 18,
    defaultSessions: 8,
    sort: 1,
    acceptsDesignatedGifts: true,
  },
  {
    slug: "inspire-her-future",
    kind: "stem",
    nameEn: "Inspire Her Future",
    summaryEn:
      "A one-day STEM workshop and hackathon for secondary school girls, run with the Global Shapers Community, Ibadan Hub.",
    isEnrolling: true,
    minAge: 10,
    maxAge: 18,
    defaultSessions: 1,
    sort: 2,
  },
  {
    slug: "ibadan-schools-debate-competition",
    kind: "debate",
    nameEn: "Ibadan Schools Debate Competition",
    summaryEn:
      "An annual competition at Mapo Hall, Ibadan, for government and private schools, held for the International Day of the Girl Child.",
    isEnrolling: false,
    minAge: 13,
    maxAge: 18,
    defaultSessions: 0,
    sort: 3,
  },
  {
    slug: "eko-dara",
    kind: "education_access",
    nameEn: "Èkó Dára",
    summaryEn:
      "Getting out-of-school children into government schools in Oyo State: fees and supplies, school meals, a mentor for each child, and support for their guardians.",
    isEnrolling: false,
    minAge: 6,
    maxAge: 18,
    defaultSessions: 0,
    sort: 4,
    acceptsDesignatedGifts: true,
    fundraisingTargetMinor: 250_000_00,
    fundraisingCurrency: "USD",
  },
  {
    slug: "end-fgm",
    kind: "advocacy",
    nameEn: "End FGM",
    summaryEn:
      "Community dialogues, media campaigns and advocacy with community leaders and policymakers in Oyo and Osun States.",
    isEnrolling: false,
    minAge: 0,
    maxAge: 99,
    defaultSessions: 0,
    sort: 5,
  },
  {
    slug: "women-in-history",
    kind: "campaign",
    nameEn: "Women in History",
    summaryEn: "A social media campaign about Black women in history.",
    isEnrolling: false,
    minAge: 0,
    maxAge: 99,
    defaultSessions: 0,
    sort: 6,
  },
  {
    slug: "edutracka",
    kind: "other",
    nameEn: "EduTracka",
    summaryEn: "Tracks Oyo State education budgets and school data across 33 local government areas.",
    isEnrolling: false,
    minAge: 0,
    maxAge: 99,
    defaultSessions: 0,
    sort: 7,
  },
];

export const lessonPlans = [
  "Finding your voice",
  "Structuring a speech",
  "Building an argument",
  "Evidence and examples",
  "Listening and rebuttal",
  "Delivery: voice, pace, body",
  "Debating the SDGs: practice round",
  "Showcase and reflection",
];

export const rubricCriteria = [
  { key: "content", label_en: "Content and argument", label_yo: null, description: "Clear position with reasons", min: 1, max: 5, weight: 1 },
  { key: "evidence", label_en: "Evidence and examples", label_yo: null, description: "Supports points with examples", min: 1, max: 5, weight: 1 },
  { key: "structure", label_en: "Structure", label_yo: null, description: "Opening, points, conclusion", min: 1, max: 5, weight: 1 },
  { key: "delivery", label_en: "Delivery", label_yo: null, description: "Voice, pace, eye contact", min: 1, max: 5, weight: 1 },
  { key: "rebuttal", label_en: "Listening and rebuttal", label_yo: null, description: "Responds to the other side", min: 1, max: 5, weight: 1 },
  { key: "confidence", label_en: "Confidence", label_yo: null, description: "Composure in front of others", min: 1, max: 5, weight: 1 },
];

export const team: { name: string; title: string; group: "leadership" | "staff" }[] = [
  { name: "Karimot Odebode", title: "Founder and Project Lead", group: "leadership" },
  { name: "Fatimah Adebimpe", title: "Programs Manager", group: "staff" },
  { name: "Temitope Boladale", title: "Campaigns and Advocacy Manager", group: "staff" },
  { name: "Maryam Lawal", title: "HR/Legal Manager", group: "staff" },
  { name: "Khadijah Alade", title: "Operations Manager", group: "staff" },
  { name: "Ma'arufah Abdulsalam", title: "Campaigns and Advocacy Assistant", group: "staff" },
  { name: "Anjolaoluwa Ogundepo", title: "Operations Assistant", group: "staff" },
  { name: "Deronke Abdul", title: "Communications Manager", group: "staff" },
  { name: "Oluwagbenga Ige", title: "Digital Media Director", group: "staff" },
  { name: "Kawthar Omisore", title: "Fundraising and Partnership Officer I", group: "staff" },
  { name: "Zainab Afolabi", title: "Fundraising and Partnership Officer I", group: "staff" },
  { name: "Temidayo Arewa", title: "Fundraising and Partnership Officer II", group: "staff" },
  { name: "Temilola Ibitomi", title: "Policy and Research Manager", group: "staff" },
  { name: "Halimat Ojone", title: "Policy and Research Officer I", group: "staff" },
  { name: "Grace Omaruke", title: "Policy and Research Officer II", group: "staff" },
  { name: "Ann Ene Agbo", title: "Digital Media Assistant", group: "staff" },
  { name: "Precious Adeife", title: "Communications Assistant", group: "staff" },
  { name: "Tariq Lawal", title: "Visual Designer", group: "staff" },
];

export const partners: { name: string; kind: "funder" | "corporate" | "community" }[] = [
  { name: "FirstBank", kind: "corporate" },
  { name: "Golden Penny Foods", kind: "corporate" },
  { name: "HP", kind: "corporate" },
  { name: "Global Shapers Community Ibadan Hub", kind: "community" },
  { name: "AWS", kind: "corporate" },
];

export const motions = [
  "This house believes every girl should learn to code",
  "This house believes that social media does more harm than good for teenagers",
  "This house believes that school uniforms should be optional",
  "This house believes that debate should be taught in every school",
  "This house believes that students should help decide school rules",
  "This house believes that phones should be allowed in secondary schools",
  "This house believes that financial literacy should be a compulsory subject",
  "This house believes that sports are as important as academics",
  "This house believes that every community should have a public library",
  "This house believes that young people should be able to vote at 16",
  "This house believes that climate education should start in primary school",
  "This house believes that reading for pleasure matters more than exam revision",
];

type Audience = "general" | "students" | "guardians" | "volunteers" | "schools" | "donors";
export const faqs: { audience: Audience; q: string; a: string }[] = [
  { audience: "students", q: "Is it free?", a: "Yes. Every BGDI programme is free for students and their schools." },
  { audience: "students", q: "Do I need a phone?", a: "No. Sessions happen at your school. A phone only helps us send you reminders." },
  {
    audience: "students",
    q: "Why do you need my parent's permission?",
    a: "If you are under 18, a parent or guardian must agree before you take part. We send them a short message with a link, and they can say yes in two minutes.",
  },
  {
    audience: "guardians",
    q: "Who will work with my child?",
    a: "Trained volunteer coaches who have passed reference checks and safeguarding training. They work with groups, at school, and are supervised by BGDI staff.",
  },
  {
    audience: "guardians",
    q: "What information do you keep?",
    a: "Your child's name, age, class, school and the answers she gives at sign-up. Volunteers see only her first name, class and school. Nobody outside BGDI sees phone numbers.",
  },
  {
    audience: "guardians",
    q: "How do I withdraw permission?",
    a: "Open the link in the message we sent you and choose “Withdraw permission”, or call us. We stop all activity and messages at once.",
  },
  { audience: "volunteers", q: "How much time does it take?", a: "About two hours a week for one term: one session at a school plus travel and preparation." },
  { audience: "volunteers", q: "Do I need debate experience?", a: "No. We train you, and every session follows a written lesson plan." },
  { audience: "volunteers", q: "Will I get a certificate?", a: "Yes. When your group finishes, you receive a certificate showing the hours you gave." },
  { audience: "schools", q: "What does it cost the school?", a: "Nothing. BGDI runs the programme at no cost to the school or students." },
  {
    audience: "schools",
    q: "What do we need to provide?",
    a: "A room, a staff contact, and a list of the students taking part.",
  },
  { audience: "donors", q: "Is my donation secure?", a: "Yes. Payments are handled by Paystack. We never see or store your card details." },
  { audience: "donors", q: "Will I get a receipt?", a: "Yes. A receipt is emailed to you as soon as your payment is confirmed." },
];

export const settings: Record<string, unknown> = {
  org_name: "Black Girl's Dream Initiative",
  org_email: "info@theblackgirlsdream.org",
  org_phone: "+2348137075948",
  org_city: "Ibadan, Oyo State, Nigeria",
  org_address: "", // CONFIRM
  org_cac_number: "", // CONFIRM
  social_links: {},
  completion_attendance_pct: 70,
  quiet_student_sessions: 2,
  quiet_hours: { start: "21:00", end: "07:00" },
  consent_text_version: "2026-11-v1",
  privacy_version: "2026-11-v1",
  donations_usd_enabled: false,
  donation_presets: { NGN: [2000, 5000, 10000, 25000, 50000], USD: [10, 25, 50, 100] },
  donation_impact_lines: {},
  ai_enabled: true,
  ai_monthly_attempt_cap: 8,
  ai_max_seconds: 150,
  ai_min_seconds: 20,
  // Staff's scoring guidance, added to every scoring request (spec/12 §5).
  ai_rubric_anchors: "",
  aws_monthly_budget_usd: 150,
  max_mentees: 2,
  hub_launch_date: "",
};

export const redirects: [string, string, number?][] = [
  ["/about-us", "/about"],
  ["/empower-young-people", "/about/team"],
  ["/host-an-event", "/programmes"],
  ["/what-we-do", "/programmes"],
  ["/causes", "/programmes"],
  ["/host-an-event/inspire-her-future-empowering-girls-in-stem", "/programmes/inspire-her-future"],
  ["/children-aid", "/programmes/eko-dara"],
  ["/protecting-kids", "/programmes/end-fgm"],
  ["/donate-now", "/donate"],
  ["/membership-giving", "/donate"],
  ["/shop-2-2", "/donate"],
  ["/blog", "/stories"],
  ["/contacts", "/contact"],
  ["/terms-of-site", "/terms"],
  ["/children", "/gallery"],
  ["/wp-admin", "/", 410],
  ["/wp-login.php", "/", 410],
];

/** Clearly fictional demo schools for local and staging only (spec/14 §5). */
export const demoSchools: { name: string; lga: string; town: string }[] = [
  { name: "Demo Grammar School", lga: "Ibadan North", town: "Ibadan" },
  { name: "Demo Girls' High School", lga: "Ibadan South-West", town: "Ibadan" },
  { name: "Demo Community Secondary School", lga: "Akinyele", town: "Moniya" },
  { name: "Demo Model College", lga: "Egbeda", town: "Egbeda" },
  { name: "Demo Comprehensive High School", lga: "Oluyole", town: "Idi-Ayunre" },
  { name: "Demo Baptist Secondary School", lga: "Ogbomosho North", town: "Ogbomosho" },
  { name: "Demo Muslim Grammar School", lga: "Oyo West", town: "Oyo" },
  { name: "Demo Anglican Girls' College", lga: "Lagelu", town: "Iyana Offa" },
  { name: "Demo High School", lga: "Ido", town: "Ido" },
  { name: "Demo Technical College", lga: "Iseyin", town: "Iseyin" },
  { name: "Demo Secondary School", lga: "Ona Ara", town: "Akanran" },
  { name: "Demo City College", lga: "Ibadan North-East", town: "Ibadan" },
];
