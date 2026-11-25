import { describe, expect, it } from "vitest";
import { emailLayout, segments } from "@/server/email/layout";
import { messageTemplates } from "@/server/seed/templates";
import { render } from "@/server/services/messaging";

const site = "https://example.test";

describe("email layout (D-023)", () => {
  it("puts a sign-in code in its own box and keeps the words around it", () => {
    const { html, text } = emailLayout({ subject: "Your BGDI sign-in code", body: "Your BGDI code is 482913. It expires in 10 minutes. Don't share it.", templateKey: "auth.otp", appUrl: site });
    expect(segments("Your BGDI code is 482913. It expires in 10 minutes.")).toEqual([
      { kind: "text", text: "Your BGDI code is:" },
      { kind: "code", code: "482913" },
      { kind: "text", text: "It expires in 10 minutes." },
    ]);
    expect(html).toContain("letter-spacing:8px");
    expect(html).toContain(">482913</td>");
    expect(html).not.toContain("Open link");
    expect(text).toContain("Your BGDI code is 482913.");
  });

  it("turns the first link into a labelled button with a copyable fallback", () => {
    const body = "Hello Mrs Adeyemi. Amara would like to join. Please give your permission here: https://example.test/consent/abc Your code is 1234. Questions? Call +2348137075948.";
    const { html } = emailLayout({ subject: "Your permission for BGDI", body, templateKey: "consent.request", appUrl: site });
    expect(html).toContain('href="https://example.test/consent/abc"');
    expect(html).toContain("Give permission &rarr;");
    expect(html).toContain("If the button doesn't work");
    expect(html).toContain('href="tel:+2348137075948"');
    // The greeting gets its own paragraph.
    expect(html).toMatch(/>Hello Mrs Adeyemi\.<\/p>/);
  });

  it("escapes what it is given", () => {
    const { html } = emailLayout({ subject: "<b>Hi</b>", body: "Thank you, <script>x</script>.", appUrl: site });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;b&gt;Hi&lt;/b&gt;");
  });

  it("shows receipt lines as a table", () => {
    const body = "Thank you.\n\nAmount: ₦25,000\nDate: 6 December 2026\nReference: BGDI-1\n\nAnyone can check it at https://example.test/verify/receipt/R-1";
    const { html } = emailLayout({ subject: "Thank you", body, templateKey: "donation.receipt", appUrl: site });
    expect(html).toContain(">Amount</td>");
    expect(html).toContain(">₦25,000</td>");
    expect(html).toContain("Check the receipt");
    expect(html).not.toContain("R-1.<");
  });

  it("renders every email template without leaving a slot or link as plain text", () => {
    for (const t of messageTemplates.filter((x) => x.subjectEn && x.channels.includes("email"))) {
      const vars = Object.fromEntries((t.variables as readonly string[]).map((v) => [v, v === "link" || v === "verifyUrl" || v === "siteUrl" ? `${site}/x/${v}` : v === "code" ? "123456" : `[${v}]`]));
      const body = render(t.bodyEn, vars);
      const { html } = emailLayout({ subject: render(t.subjectEn!, vars), body, templateKey: t.key, appUrl: site });
      expect(html, t.key).not.toMatch(/\{\{\w+\}\}/);
      if (body.includes(`${site}/x/link`)) expect(html, t.key).toContain('href="https://example.test/x/link"');
    }
  });
});
