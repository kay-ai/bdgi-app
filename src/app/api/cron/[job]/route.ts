import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runConsentReminders } from "@/server/services/consent-reminders";
import { sendDueMessages } from "@/server/services/messaging";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Scheduled jobs (spec/08 §6). Vercel Cron calls these with `Authorization: Bearer $CRON_SECRET`.
 * Without CRON_SECRET they run only outside production (for local testing).
 */
const JOBS: Record<string, () => Promise<unknown>> = {
  messages: () => sendDueMessages(),
  "consent-reminders": () => runConsentReminders(),
};

function authorised(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function GET(req: Request, { params }: { params: Promise<{ job: string }> }) {
  const { job } = await params;
  const run = JOBS[job];
  if (!run) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!authorised(req)) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const result = await run();
  return NextResponse.json({ job, result });
}
