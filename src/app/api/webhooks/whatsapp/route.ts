import { createHmac, timingSafeEqual } from "node:crypto";
import { after, NextResponse } from "next/server";
import { MAX_AUDIO_BYTES, processAttempt } from "@/server/services/speech";
import { handleBotMessage, sendBotReply } from "@/server/services/speech-bot";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * WhatsApp Cloud API webhook for the voice-note coach (spec/12 §7).
 * Inert until WhatsApp is set up: without WHATSAPP_APP_SECRET every POST is refused with 503.
 * Env: WHATSAPP_VERIFY_TOKEN (subscription check), WHATSAPP_APP_SECRET (signature),
 * WHATSAPP_TOKEN (to download voice notes), WHATSAPP_GRAPH_VERSION (default v21.0).
 */

const graph = () => `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_VERSION ?? "v21.0"}`;

/** Meta's subscription handshake. */
export function GET(req: Request) {
  const u = new URL(req.url);
  const want = process.env.WHATSAPP_VERIFY_TOKEN;
  if (want && u.searchParams.get("hub.mode") === "subscribe" && u.searchParams.get("hub.verify_token") === want) {
    return new NextResponse(u.searchParams.get("hub.challenge") ?? "", { status: 200 });
  }
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

function signed(raw: string, header: string | null, secret: string) {
  if (!header?.startsWith("sha256=")) return false;
  const got = Buffer.from(header.slice(7), "hex");
  const want = createHmac("sha256", secret).update(raw).digest();
  return got.length === want.length && timingSafeEqual(got, want);
}

async function downloadMedia(mediaId: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  const token = process.env.WHATSAPP_TOKEN;
  if (!token || !/^\d+$/.test(mediaId)) return null;
  const meta = await fetch(`${graph()}/${mediaId}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) });
  if (!meta.ok) return null;
  const m = (await meta.json()) as { url?: string; mime_type?: string; file_size?: number };
  if (!m.url || (m.file_size ?? 0) > MAX_AUDIO_BYTES) return m.url ? { bytes: new Uint8Array(MAX_AUDIO_BYTES + 1), contentType: "audio/ogg" } : null;
  // The media URL is on Meta's own CDN; only follow it there.
  if (!/^https:\/\/([\w-]+\.)*(fbsbx|facebook|whatsapp)\.(com|net)\//.test(m.url)) return null;
  const file = await fetch(m.url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30_000) });
  if (!file.ok) return null;
  return { bytes: new Uint8Array(await file.arrayBuffer()), contentType: (m.mime_type ?? "audio/ogg").split(";")[0]!.trim() };
}

type WaMessage = { from: string; id: string; type: string; text?: { body?: string }; audio?: { id: string }; voice?: { id: string } };
type WaBody = { entry?: { changes?: { value?: { messages?: WaMessage[] } }[] }[] };

export async function POST(req: Request) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const raw = await req.text();
  if (!signed(raw, req.headers.get("x-hub-signature-256"), secret)) return NextResponse.json({ error: "bad_signature" }, { status: 401 });
  let body: WaBody;
  try {
    body = JSON.parse(raw) as WaBody;
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const messages = (body.entry ?? []).flatMap((e) => e.changes ?? []).flatMap((c) => c.value?.messages ?? []);

  // Meta retries anything that isn't a quick 200, so the work runs after the reply.
  after(async () => {
    for (const m of messages) {
      try {
        const media = m.type === "audio" || m.type === "voice" ? (m.audio?.id ?? m.voice?.id ?? null) : null;
        const audio = media ? await downloadMedia(media) : null;
        if (media && !audio) {
          await sendBotReply(m.from, "Sorry, we couldn't open that voice note. Please send it again.", null);
          continue;
        }
        const r = await handleBotMessage({ from: m.from, text: m.text?.body ?? null, audio, providerMessageId: m.id });
        if (r.reply) await sendBotReply(m.from, r.reply, r.personId ?? null);
        if (r.attemptId) await processAttempt(r.attemptId);
      } catch (e) {
        console.error("[whatsapp] message failed:", e instanceof Error ? e.message : "unknown");
      }
    }
  });
  return NextResponse.json({ ok: true });
}
