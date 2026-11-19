"use server";

import { redirect } from "next/navigation";
import { currentSession } from "@/server/auth/current";
import { profilesForUser, setActivePerson } from "@/server/auth/sessions";
import { homeFor, type Role } from "@/server/permissions/can";

/** Pick (or switch) the person this sign-in acts as (spec/03 §1.1.4). */
export async function choosePersonAction(personId: string, next?: string) {
  const row = await currentSession();
  if (!row || row.session.stage !== "full") redirect("/sign-in");
  const ok = typeof personId === "string" && (await setActivePerson(row.session.id, row.user.id, personId));
  if (!ok) redirect("/sign-in/who");
  const profile = (await profilesForUser(row.user.id)).find((p) => p.personId === personId)!;
  const home = row.session.method === "staff" ? "/console" : homeFor(profile.roles as Role[]);
  redirect(next && next.startsWith("/") && !next.startsWith("//") ? next : home);
}
