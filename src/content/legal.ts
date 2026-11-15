/**
 * Policy drafts (spec/09 §8). These stand in until BGDI publishes reviewed versions as
 * `content_page` rows; the page reads a published row first and falls back to this text.
 * CONFIRM: every page must be reviewed by BGDI and a lawyer before launch.
 */
export type LegalBlock = { h: string; p?: string[]; ul?: string[]; ol?: string[]; table?: [string, string][] };
export type LegalDoc = { title: string; lead: string; updated: string; version: string; blocks: LegalBlock[] };

const UPDATED = "2026-11-15";

export const legal: Record<"privacy" | "safeguarding" | "terms" | "cookies", LegalDoc> = {
  privacy: {
    title: "Privacy notice",
    lead: "How Black Girl's Dream Initiative collects, uses and protects personal information, and the choices you have.",
    updated: UPDATED,
    version: "2026-11-v1",
    blocks: [
      {
        h: "Who we are and how to contact us",
        p: [
          "Black Girl's Dream Initiative (BGDI) is a not-for-profit organisation in Ibadan, Oyo State, Nigeria. We decide how the information described here is used.",
          "For any question about your information, write to info@theblackgirlsdream.org or call us on the number in the footer.",
        ],
      },
      {
        h: "What we collect",
        ul: [
          "Students: first name, surname, date of birth, gender, school, class, a phone number if the student has one, and answers to a short check-in about confidence.",
          "Parents and guardians: name, relationship to the student, phone number, and the permissions you give.",
          "Volunteers: name, contact details, date of birth, skills, references, training results and hours.",
          "Schools: the name and role of the staff member who contacts us, and their phone and email.",
          "Donors: name, email, the amount and purpose of each gift. Card details go to our payment provider and never reach us.",
          "Website visitors: a count of pages viewed. We do not store IP addresses or use advertising trackers.",
        ],
        p: ["We never ask for home addresses, religion, health or ethnicity."],
      },
      {
        h: "Why we collect it",
        ul: [
          "To run programmes: placing students in groups, recording attendance and progress, and sending reminders.",
          "To keep children safe: checking volunteers and handling concerns.",
          "To report our impact: figures we publish are totals, and any group of fewer than five students is shown as \"<5\".",
          "To thank donors and send receipts.",
        ],
      },
      {
        h: "Who can see it",
        p: [
          "Staff and volunteers see only what their role needs. A volunteer coach sees the first names and attendance of the students in their own group, never phone numbers. Every view of sensitive records is logged.",
        ],
      },
      {
        h: "Who we share it with",
        p: [
          "We use these service providers to run our systems: Amazon Web Services (hosting), Meta (WhatsApp messages), Termii (SMS), Paystack (payments) and Sentry (error reports). They act on our instructions only. We never sell personal information.",
        ],
      },
      {
        h: "AI speech practice",
        p: [
          "Students who have their guardian's permission can practise speeches in the app. The recording is turned into text and scored, then the audio is deleted within 24 hours. Transcripts are kept for 12 months and are never used to train AI models.",
        ],
      },
      {
        h: "How long we keep it",
        table: [
          ["Speech recordings", "Until scored, at most 24 hours"],
          ["Speech transcripts", "12 months"],
          ["Students whose guardian never replied", "60 days, then anonymised"],
          ["Active students", "While active, then 3 years, then anonymised"],
          ["Declined volunteer applications", "12 months, then anonymised"],
          ["Messages we send", "12 months"],
          ["Contact form messages", "24 months"],
          ["Safeguarding records", "7 years after the case closes"],
          ["Donation records", "7 years"],
        ],
        p: ["Anonymised means names, contact details and free-text answers are removed; only figures needed for our impact totals remain."],
      },
      {
        h: "Your rights",
        p: [
          "You can ask for a copy of your information, ask us to correct it, or ask us to delete it. Write to info@theblackgirlsdream.org. We will confirm who you are and reply within 30 days. You can also complain to the Nigeria Data Protection Commission.",
        ],
      },
      {
        h: "Children's privacy and guardian permission",
        p: [
          "A student under 18 joins only after a parent or guardian gives permission. Photos, stories and AI practice each need a separate yes, and a guardian can change any choice at any time from the link we send.",
        ],
      },
      { h: "Changes to this notice", p: ["When we change this notice we update the version and date below. Permissions record the version a guardian saw."] },
    ],
  },
  safeguarding: {
    title: "Safeguarding policy",
    lead: "Every child in a BGDI programme has the right to be safe. This is how we protect them.",
    updated: UPDATED,
    version: "2026-11-v1",
    blocks: [
      {
        h: "Our commitment",
        p: [
          "BGDI will not tolerate harm to any child. We check every volunteer before they meet students, train them, and act on every concern the same day.",
        ],
      },
      { h: "Who this applies to", p: ["Staff, trustees, volunteers, judges, partners and visitors at any BGDI activity, in person or online."] },
      {
        h: "Code of conduct for volunteers and staff",
        ol: [
          "I will treat every young person with respect and dignity.",
          "I will never be alone with a student out of sight of others.",
          "I will not contact students or their families privately by phone, WhatsApp, social media or in person outside BGDI activities.",
          "I will not ask for or keep students' phone numbers, addresses or social media handles.",
          "I will not take or share photos or videos of students unless BGDI staff have asked me to and consent is recorded.",
          "I will not give gifts or money to individual students, or accept them.",
          "I will not use physical punishment, humiliating language or threats.",
          "I will report any concern about a child's safety, and any breach of this code, through the Hub or to the safeguarding lead on the same day.",
          "I will keep what I learn about students confidential, except when reporting a concern.",
          "I understand that breaking this code can end my volunteering and may be reported to the authorities.",
        ],
      },
      {
        h: "How to report a concern",
        p: [
          "If a child is in immediate danger, call 112 or go to the nearest police station.",
          "Otherwise, use the report-a-concern form on this website. You can stay anonymous. Volunteers can also report from the Hub.",
        ],
      },
      {
        h: "What happens after a report",
        p: [
          "You receive a reference number. Our safeguarding lead reviews every report within 24 hours, and emergencies within 2 hours. Where the law requires it, we refer the matter to the police or social services.",
        ],
      },
      { h: "Our safeguarding leads", p: ["The names of our safeguarding leads will be listed here once BGDI confirms them."] },
    ],
  },
  terms: {
    title: "Terms of use",
    lead: "The rules for using the BGDI website and the Hub.",
    updated: UPDATED,
    version: "2026-11-v1",
    blocks: [
      { h: "Acceptable use", p: ["Use this website and the Hub lawfully and kindly. Do not try to reach information that is not yours, or disrupt the service."] },
      { h: "Accounts", p: ["Keep your sign-in code to yourself. Tell us at once if you think someone else has used your account."] },
      { h: "Content ownership", p: ["Text, photographs and materials on this website belong to BGDI or are used with permission. Ask us before reusing them."] },
      { h: "Donations", p: ["Donations are voluntary and cannot be refunded, except when a payment was made in error. Write to us within 30 days if that happens."] },
      { h: "Limitation of liability", p: ["We work to keep this service accurate and available, but we cannot promise it will always be free of errors or interruptions."] },
      { h: "Governing law", p: ["These terms are governed by the laws of the Federal Republic of Nigeria."] },
    ],
  },
  cookies: {
    title: "Cookies",
    lead: "We use a few small files to make the website work. We do not use advertising or tracking cookies.",
    updated: UPDATED,
    version: "2026-11-v1",
    blocks: [
      {
        h: "Cookies we use",
        table: [
          ["Session", "Keeps you signed in to the Hub"],
          ["Language", "Remembers whether you chose English or Yorùbá"],
          ["Campaign", "Records which campaign link brought you here, without identifying you"],
          ["Notice", "Remembers that you closed this notice"],
        ],
      },
      { h: "Page counts", p: ["We count how many times each page is viewed. The count stores no IP address and no cookie."] },
    ],
  },
};
