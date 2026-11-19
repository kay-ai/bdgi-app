"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActor, requestMeta } from "@/server/auth/current";
import { Forbidden } from "@/server/permissions/assert";
import { decideSchoolRequest, decideStudent, decideVolunteer } from "@/server/services/console-people";

export type DecisionKind = "student" | "volunteer" | "school";
type Result = { ok: true } | { ok: false; code: string };

const input = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("student"), id: z.string().uuid(), decision: z.enum(["approve", "decline", "waitlist"]) }),
  z.object({ kind: z.literal("volunteer"), id: z.string().uuid(), decision: z.enum(["approve", "decline"]) }),
  z.object({ kind: z.literal("school"), id: z.string().uuid(), decision: z.enum(["accept", "decline", "contacted"]) }),
]);

/** Approve / decline from the console lists. The service checks the permission again. */
export async function decideAction(raw: { kind: DecisionKind; id: string; decision: string }): Promise<Result> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, code: "invalid" };
  const d = parsed.data;
  try {
    const actor = await getActor();
    const ip = (await requestMeta()).ip;
    const r =
      d.kind === "student"
        ? await decideStudent(actor, d.id, d.decision, ip)
        : d.kind === "volunteer"
          ? await decideVolunteer(actor, d.id, d.decision, ip)
          : await decideSchoolRequest(actor, d.id, d.decision, ip);
    revalidatePath(`/[locale]/console/${d.kind === "school" ? "schools" : `${d.kind}s`}`, "page");
    return r.ok ? { ok: true } : { ok: false, code: r.code };
  } catch (e) {
    if (e instanceof Forbidden) return { ok: false, code: "denied" };
    console.error("[console] decision failed", e instanceof Error ? e.message : "unexpected");
    return { ok: false, code: "error" };
  }
}
