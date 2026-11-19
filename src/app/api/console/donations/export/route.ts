import { getActor, requestMeta } from "@/server/auth/current";
import { Forbidden } from "@/server/permissions/assert";
import { exportDonationsCsv } from "@/server/services/console-donations";
import { donationFilters } from "@/server/validation/donation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** CSV of the filtered donations list (spec/11 §3). No emails or phones; logged as export.create. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const filters = donationFilters.parse(Object.fromEntries(url.searchParams));
  try {
    const csv = await exportDonationsCsv(await getActor(), filters, (await requestMeta()).ip);
    const day = new Date().toISOString().slice(0, 10);
    return new Response("﻿" + csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="bgdi-donations-${day}.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof Forbidden) return new Response("Forbidden", { status: 403 });
    throw e;
  }
}
