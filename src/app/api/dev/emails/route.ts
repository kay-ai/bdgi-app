import { emailLayout, escapeHtml } from "@/server/email/layout";
import { messageTemplates } from "@/server/seed/templates";
import { render } from "@/server/services/messaging";

export const dynamic = "force-dynamic";

/** Made-up values for every template variable, so each email can be previewed. */
const SAMPLE: Record<string, string> = {
  code: "482913",
  firstName: "Amara",
  guardianName: "Mrs Adeyemi",
  studentFirstName: "Amara",
  schoolName: "Ibadan Girls' High School",
  programmeName: "Speak Up",
  cohortName: "Debate Club, Ibadan Girls' High",
  date: "Saturday 6 December",
  nextDate: "Saturday 13 December",
  time: "10:00",
  when: "this Saturday",
  venue: "School library",
  coachName: "Ms Funmi O.",
  reason: "the group is full",
  count: "3",
  role: "lead coach",
  hours: "12",
  decision: "approved",
  name: "Mr Okafor",
  eventTitle: "Girls Who Speak 2026",
  amount: "₦25,000",
  designation: "Where it's needed most",
  reference: "BGDI-7F3K2Q",
  receiptCode: "R-2026-0142",
  manage: "",
  roles: "programme manager",
  minutes: "15",
  severity: "high",
  orgPhone: "+2348137075948",
  stars: "★★★★☆",
  wpm: "132",
  fillers: "4",
  strength: "Your opening grabbed attention.",
  nextStep: "Slow down before your main point.",
};

/**
 * `/api/dev/emails`: every email template in the BGDI layout (D-023), with made-up details.
 * Only outside production.
 */
export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  const url = new URL(req.url);
  const site = url.origin;
  const key = url.searchParams.get("key");
  const emails = messageTemplates.filter((t) => t.subjectEn && t.channels.includes("email"));
  const html = (body: string) => new Response(body, { headers: { "content-type": "text/html; charset=utf-8" } });

  const tpl = key ? emails.find((t) => t.key === key) : null;
  if (tpl) {
    const vars = { ...SAMPLE, link: `${site}/app`, verifyUrl: `${site}/verify/receipt/R-2026-0142`, siteUrl: site };
    const subject = render(tpl.subjectEn!, vars);
    return html(emailLayout({ subject, body: render(tpl.bodyEn, vars), templateKey: tpl.key, appUrl: site }).html);
  }

  const items = emails
    .map((t) => `<li><a href="?key=${encodeURIComponent(t.key)}">${escapeHtml(t.subjectEn!)}</a> <code>${escapeHtml(t.key)}</code></li>`)
    .join("");
  return html(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Email previews</title>` +
      `<body style="font-family:system-ui,sans-serif;max-width:720px;margin:32px auto;padding:0 16px;line-height:1.7;background:#fbf7ef;color:#1a1712">` +
      `<h1 style="font-family:Georgia,serif;font-weight:400">Email previews</h1><p>Every email template in the BGDI layout, with made-up details. Only on your computer.</p><ul>${items}</ul></body>`,
  );
}
