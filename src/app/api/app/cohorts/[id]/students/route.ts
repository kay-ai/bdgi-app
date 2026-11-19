import { NextResponse } from "next/server";
import { z } from "zod";
import { getActor } from "@/server/auth/current";
import { Forbidden } from "@/server/permissions/assert";
import { cohortStudents } from "@/server/services/cohort-students";
import { basicStudentList } from "@/server/validation/student";

export const dynamic = "force-dynamic";

/** GET /api/app/cohorts/:id/students: the basic student view for coaches (spec/03 §4.2). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "not_found" }, { status: 404 });
  try {
    const students = await cohortStudents(actor, id.data);
    return NextResponse.json(basicStudentList.parse({ students }), { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    if (e instanceof Forbidden) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }
}
