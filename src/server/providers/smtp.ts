import "server-only";
import type { MessageProvider } from "./index";

/**
 * Email over SMTP (D-018), for any mailbox provider that offers it. Configured by SMTP_HOST,
 * SMTP_PORT (465 uses TLS from the start; anything else upgrades with STARTTLS), SMTP_USER,
 * SMTP_PASS and EMAIL_FROM.
 */
export function smtpProvider(): MessageProvider {
  const host = process.env.SMTP_HOST;
  const from = process.env.EMAIL_FROM;
  if (!host || !from) throw new Error("EMAIL_PROVIDER=smtp needs SMTP_HOST and EMAIL_FROM");
  const port = Number(process.env.SMTP_PORT || 587);
  return {
    name: "smtp",
    async send({ to, body, subject, attachments }) {
      const nodemailer = await import("nodemailer");
      const transport = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" } : undefined,
      });
      try {
        const info = await transport.sendMail({
          from,
          to,
          subject: subject || "A message from BGDI",
          text: body,
          attachments: attachments?.map((a) => ({ filename: a.filename, contentType: a.contentType, content: Buffer.from(a.content) })),
        });
        return { ok: true, providerId: info.messageId };
      } catch (e) {
        // The SMTP server's reply names the problem without echoing the password.
        return { ok: false, error: e instanceof Error ? e.message.slice(0, 300) : "smtp send failed" };
      }
    },
  };
}
