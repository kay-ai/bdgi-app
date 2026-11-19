import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type ReceiptData = {
  org: { name: string; address: string; email: string; phone: string; cacNumber: string };
  supporterName: string;
  amountMinor: number;
  currency: "NGN" | "USD";
  paidAt: Date;
  reference: string;
  receiptCode: string;
  designation: string;
  frequency: "one_off" | "monthly";
  method: string;
  verifyUrl: string;
  manageUrl?: string | null;
};

/**
 * The standard PDF fonts only cover Latin-1, so letters outside it (Yorùbá underdots such as ọ, ṣ)
 * are written without their marks rather than dropped.
 */
export function pdfSafe(text: string): string {
  let out = "";
  for (const ch of text.normalize("NFC")) {
    if (ch.charCodeAt(0) <= 255) out += ch;
    else {
      const base = ch.normalize("NFD").replace(/[̀-ͯ᷀-᷿]/g, "").normalize("NFC");
      out += [...base].every((c) => c.charCodeAt(0) <= 255) ? base : "?";
    }
  }
  return out;
}

/** "NGN 5,000.00" — the naira sign is not in the standard PDF fonts. */
export function receiptAmount(minor: number, currency: string) {
  return `${currency} ${new Intl.NumberFormat("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(minor / 100)}`;
}

const dateFmt = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" });

/** Donation receipt PDF (spec/11 §2.4). One A4 page. */
export async function buildReceiptPdf(r: ReceiptData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Receipt ${r.receiptCode}`);
  pdf.setAuthor(pdfSafe(r.org.name));
  pdf.setCreationDate(r.paidAt);
  pdf.setModificationDate(r.paidAt);
  const page = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.102, 0.09, 0.071);
  const muted = rgb(0.42, 0.39, 0.35);
  const gold = rgb(1, 0.72, 0);

  const left = 56;
  let y = 780;
  const text = (s: string, opts: { size?: number; font?: typeof regular; color?: typeof ink; x?: number } = {}) => {
    page.drawText(pdfSafe(s), { x: opts.x ?? left, y, size: opts.size ?? 11, font: opts.font ?? regular, color: opts.color ?? ink });
  };

  page.drawRectangle({ x: 0, y: 821.89, width: 595.28, height: 20, color: gold });
  text(r.org.name, { size: 18, font: bold });
  y -= 18;
  for (const line of [r.org.address, r.org.email, r.org.phone, r.org.cacNumber ? `CAC registration ${r.org.cacNumber}` : ""].filter(Boolean)) {
    text(line, { size: 10, color: muted });
    y -= 14;
  }

  y -= 30;
  text("Donation receipt", { size: 24, font: bold });
  y -= 22;
  text(`Receipt ${r.receiptCode}`, { size: 11, color: muted });

  y -= 40;
  const rows: [string, string][] = [
    ["Received from", r.supporterName],
    ["Amount", receiptAmount(r.amountMinor, r.currency)],
    ["Date", dateFmt.format(r.paidAt)],
    ["Gift", r.frequency === "monthly" ? "Monthly gift" : "One-off gift"],
    ["Where it goes", r.designation],
    ["Paid by", r.method],
    ["Reference", r.reference],
  ];
  for (const [k, v] of rows) {
    page.drawLine({ start: { x: left, y: y + 16 }, end: { x: 539, y: y + 16 }, thickness: 0.5, color: rgb(0.85, 0.82, 0.76) });
    text(k, { size: 11, color: muted });
    text(v, { size: 11, font: bold, x: 210 });
    y -= 28;
  }

  y -= 24;
  text("Thank you.", { size: 20, font: bold });
  y -= 22;
  text("Your gift keeps every BGDI programme free for students and schools.", { size: 11 });
  if (r.manageUrl) {
    y -= 26;
    text("Manage your monthly gift:", { size: 10, color: muted });
    y -= 14;
    text(r.manageUrl, { size: 9 });
  }

  page.drawText(pdfSafe(`Check this receipt at ${r.verifyUrl}`), { x: left, y: 64, size: 9, font: regular, color: muted });
  page.drawText("No goods or services were provided in return for this gift.", { x: left, y: 50, size: 9, font: regular, color: muted });

  return pdf.save();
}
