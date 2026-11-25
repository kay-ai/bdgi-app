/**
 * The BGDI email layout (D-023). Every template is written once as plain text (spec/08 §4) so the
 * same words work on WhatsApp, SMS and email. For email, this turns that text into a branded HTML
 * message: the logo, the subject as a heading, the first link as a button, any code in a large box,
 * "Label: value" lines as a small table, and a footer. The plain text goes along as the text part.
 *
 * Email clients ignore most CSS, so everything is tables and inline styles, 600px wide at most,
 * with system fonts and Georgia for headings.
 */

const C = {
  page: "#fbf7ef",
  card: "#ffffff",
  ink: "#1a1712",
  muted: "#67635c",
  line: "#e8e1d3",
  gold: "#ffb800",
  codeBg: "#f6ebc8",
  button: "#1a1712",
  buttonInk: "#fbf7ef",
};
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";

/** What the button says for each template's link. Anything not listed gets "Open link". */
export const BUTTON_LABELS: Record<string, string> = {
  "consent.request": "Give permission",
  "consent.reminder": "Give permission",
  "consent.thanks": "Change my choices",
  "consent.declined_ack": "Change my answer",
  "consent.school_notice": "Learn more",
  "student.endline": "Tell us how it went",
  "student.completed": "Get the certificate",
  "volunteer.application_received": "Track my application",
  "volunteer.interview_invite": "Pick a time",
  "volunteer.training_invite": "Start training",
  "volunteer.activated": "Open my Hub",
  "volunteer.assigned": "See the details",
  "volunteer.attendance_due": "Take attendance",
  "volunteer.cohort_closed": "Get my certificate",
  "certificate.ready": "Get my certificate",
  "school.accepted": "Review the agreement",
  "event.registered": "See the event",
  "donation.receipt": "Check the receipt",
  "donation.failed": "Try again",
  "newsletter.confirm": "Confirm my subscription",
  "staff.invite": "Set my password",
  "staff.password_reset": "Reset my password",
  "staff.locked": "Reset my password",
  "staff.case_new": "Review the case",
  "speech.result": "See my full feedback",
};

type Segment = { kind: "text"; text: string } | { kind: "link"; url: string } | { kind: "code"; code: string };

const URL_RE = /https?:\/\/[^\s<>"]+/g;
/** A code follows "code is" or "Code:"; the words stay in the text, the digits go in the box. */
const CODE_RE = /(?<=\b(?:code is|Code:)\s*)\d{4,8}\b/g;
const PHONE_RE = /\+234\d{10}\b/g;

export const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Split the body into text, links and codes, in order. A trailing full stop stays out of a link. */
export function segments(body: string): Segment[] {
  const marks: { at: number; end: number; seg: Segment }[] = [];
  for (const m of body.matchAll(URL_RE)) {
    const url = m[0].replace(/[.,;:!?)]+$/, "");
    marks.push({ at: m.index!, end: m.index! + url.length, seg: { kind: "link", url } });
  }
  for (const m of body.matchAll(CODE_RE)) marks.push({ at: m.index!, end: m.index! + m[0].length, seg: { kind: "code", code: m[0] } });
  marks.sort((a, b) => a.at - b.at);

  const out: Segment[] = [];
  let pos = 0;
  for (const m of marks) {
    if (m.at < pos) continue;
    out.push({ kind: "text", text: body.slice(pos, m.at) });
    out.push(m.seg);
    pos = m.end;
  }
  out.push({ kind: "text", text: body.slice(pos) });

  // Tidy the text around a block: "…here: " → "…here:", "Your code is " → "Your code is:",
  // and a lone ". " left after a code or link goes.
  return out
    .map((s, i) => {
      if (s.kind !== "text") return s;
      let t = s.text;
      if (i > 0) t = t.replace(/^[.,;]?[ \t]*/, "");
      if (i < out.length - 1) {
        t = t.replace(/[ \t]+$/, "");
        if (/\b(?:is|at|here)$/.test(t)) t += ":";
      }
      return { kind: "text" as const, text: t };
    })
    .filter((s) => s.kind !== "text" || s.text.trim() !== "");
}

/** "Hi Amara! Thank you…" → a greeting paragraph, then the rest. */
function splitGreeting(text: string): string[] {
  const m = text.match(/^((?:Hi|Hello|Dear)\b[^.!?\n]{0,40}[.!,]|(?:Good news|Great news|Congratulations)[^.!?\n]{0,40}[.!])\s+(?=\S)/);
  return m ? [m[1]!, text.slice(m[0].length)] : [text];
}

const p = (inner: string, style = "") =>
  `<p style="margin:0 0 16px;font-family:${SANS};font-size:16px;line-height:1.6;color:${C.ink};${style}">${inner}</p>`;

/** Escape, then make phone numbers tappable and keep line breaks. */
const inline = (s: string) =>
  escapeHtml(s)
    .replace(PHONE_RE, (n) => `<a href="tel:${n}" style="color:${C.ink};text-decoration:underline">${n}</a>`)
    .replace(/\n/g, "<br>");

function textBlock(text: string, first: boolean): string {
  const html: string[] = [];
  const paras = text.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean);
  paras.forEach((para, i) => {
    const lines = para.split("\n");
    // Two or more "Label: value" lines read better as a small table (receipts).
    if (lines.length >= 2 && lines.every((l) => /^[^:]{1,30}: \S/.test(l))) {
      const rows = lines
        .map((l) => {
          const [k, ...v] = l.split(": ");
          return `<tr><td style="padding:8px 12px 8px 0;border-bottom:1px solid ${C.line};font-family:${SANS};font-size:14px;color:${C.muted};white-space:nowrap;vertical-align:top">${escapeHtml(k!)}</td><td style="padding:8px 0;border-bottom:1px solid ${C.line};font-family:${SANS};font-size:15px;color:${C.ink};font-weight:600">${escapeHtml(v.join(": "))}</td></tr>`;
        })
        .join("");
      html.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-collapse:collapse">${rows}</table>`);
      return;
    }
    for (const part of first && i === 0 ? splitGreeting(para) : [para]) html.push(p(inline(part)));
  });
  return html.join("");
}

function button(url: string, label: string): string {
  const u = escapeHtml(url);
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 12px"><tr><td style="border-radius:999px;background:${C.button}">
<a href="${u}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${SANS};font-size:16px;font-weight:600;line-height:1.2;color:${C.buttonInk};text-decoration:none;border-radius:999px">${escapeHtml(label)} &rarr;</a>
</td></tr></table>
<p style="margin:0 0 20px;font-family:${SANS};font-size:13px;line-height:1.5;color:${C.muted}">If the button doesn't work, copy this link into your browser:<br><a href="${u}" style="color:${C.muted};word-break:break-all">${u}</a></p>`;
}

const codeBox = (code: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px"><tr><td style="background:${C.codeBg};border-radius:12px;padding:14px 24px;font-family:${SANS};font-size:32px;font-variant-numeric:tabular-nums;letter-spacing:8px;color:${C.ink};font-weight:700">${escapeHtml(code)}</td></tr></table>`;

export type EmailInput = {
  subject: string;
  body: string;
  templateKey?: string | null;
  /** The public site, for the logo and footer link. */
  appUrl?: string;
};

/** The HTML and plain-text parts of one email. */
export function emailLayout({ subject, body, templateKey, appUrl }: EmailInput): { html: string; text: string } {
  const site = (appUrl ?? process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const label = (templateKey && BUTTON_LABELS[templateKey]) || "Open link";
  let buttons = 0;
  let firstText = true;
  const content = segments(body)
    .map((s) => {
      if (s.kind === "code") return codeBox(s.code);
      if (s.kind === "link") {
        // The first link is the button; any further link is a plain one, so there's one clear action.
        buttons++;
        if (buttons === 1) return button(s.url, label);
        const u = escapeHtml(s.url);
        return p(`<a href="${u}" style="color:${C.ink};word-break:break-all">${u}</a>`);
      }
      const html = textBlock(s.text, firstText);
      firstText = false;
      return html;
    })
    .join("\n");

  // The preview line inbox lists show next to the subject: the first sentence, without links.
  const preheader = body.replace(URL_RE, "").replace(/\s+/g, " ").trim().slice(0, 110);
  const host = site.replace(/^https?:\/\//, "");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.page}">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page}">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
<tr><td style="padding:0 4px 20px">
<a href="${escapeHtml(site)}" style="text-decoration:none"><img src="${escapeHtml(site)}/img/bgdi-logo.png" width="64" height="48" alt="Black Girl's Dream Initiative" style="display:block;border:0;height:auto;width:64px"></a>
</td></tr>
<tr><td style="background:${C.card};border:1px solid ${C.line};border-radius:20px;overflow:hidden">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="height:6px;line-height:6px;font-size:0;background:${C.gold};border-radius:20px 20px 0 0">&nbsp;</td></tr>
<tr><td style="padding:32px 32px 16px">
<h1 style="margin:0 0 20px;font-family:${SERIF};font-size:26px;line-height:1.25;font-weight:400;color:${C.ink}">${escapeHtml(subject)}</h1>
${content}
</td></tr>
</table>
</td></tr>
<tr><td style="padding:24px 8px 0;font-family:${SANS};font-size:13px;line-height:1.6;color:${C.muted}">
<strong style="color:${C.ink};font-weight:600">Black Girl's Dream Initiative</strong><br>
Free programmes in public speaking, debate and STEM for secondary school students in Oyo and Osun.<br>
<a href="${escapeHtml(site)}" style="color:${C.muted};text-decoration:underline">${escapeHtml(host)}</a>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = `${body.trim()}\n\n--\nBlack Girl's Dream Initiative\n${site}\n`;
  return { html, text };
}
