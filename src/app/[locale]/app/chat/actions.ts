"use server";

import { getActor, requestMeta } from "@/server/auth/current";
import { openDirect, readThread, reportMessage, sendMessage } from "@/server/services/chat";

export type ChatMessage = { id: string; mine: boolean; sender: string; isCoach: boolean; createdAt: string; body: string | null; reported: boolean };

/** New messages since `after` (the page polls this every few seconds). */
export async function pollAction(threadId: string, after: string | null): Promise<ChatMessage[] | null> {
  const actor = await getActor();
  const since = after && !Number.isNaN(Date.parse(after)) ? new Date(after) : null;
  const t = await readThread(actor, String(threadId), since).catch(() => null);
  return t ? t.messages : null;
}

export async function sendAction(threadId: string, body: string): Promise<{ ok: true } | { ok: false; code: string }> {
  const actor = await getActor();
  const r = await sendMessage(actor, String(threadId), String(body ?? "")).catch(() => ({ ok: false as const, code: "error" }));
  return r.ok ? { ok: true } : r;
}

export async function reportAction(messageId: string): Promise<{ ok: boolean }> {
  const actor = await getActor();
  const r = await reportMessage(actor, String(messageId), (await requestMeta()).ip).catch(() => ({ ok: false }));
  return { ok: r.ok };
}

export async function openDirectAction(cohortId: string, personId: string): Promise<{ ok: true; id: string } | { ok: false; code: string }> {
  const actor = await getActor();
  return openDirect(actor, String(cohortId), String(personId), (await requestMeta()).ip).catch(() => ({ ok: false as const, code: "error" }));
}
