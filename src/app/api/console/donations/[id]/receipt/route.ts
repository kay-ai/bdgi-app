import { consoleAllowed } from "@/server/services/console-access";
import { receiptPdf } from "@/server/services/receipts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Staff download of a receipt PDF, rendered from the donation row. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!consoleAllowed("donation.view")) return new Response("Not found", { status: 404 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const pdf = await receiptPdf(id);
  if (!pdf) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(pdf.content), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${pdf.filename}"`,
      "cache-control": "no-store",
    },
  });
}
