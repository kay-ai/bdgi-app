import { handlePaystackWebhook } from "@/server/services/donations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Paystack events (spec/11 §2.3). The signature is checked against the raw body before anything else. */
export async function POST(req: Request) {
  const raw = await req.text();
  const res = await handlePaystackWebhook(raw, req.headers.get("x-paystack-signature"));
  return new Response(res.body, { status: res.status, headers: { "content-type": "text/plain" } });
}
