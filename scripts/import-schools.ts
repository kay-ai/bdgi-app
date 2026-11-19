import { readFileSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db, schema as s } from "../src/db";

/**
 * School import (spec/07 "School import"). Reads EduTracka's Oyo TESCOM roster
 * (`School_Name,LGA,Zone,School_Type`) and upserts each school by `edutracka_id`, so running it
 * again updates names and levels without touching partnerships, champions or notes.
 *
 *   pnpm tsx scripts/import-schools.ts [file.csv]
 */
const file = process.argv[2] ?? path.join(process.cwd(), "data", "edutracka_oyo_schools.csv");

/** CSV with quoted fields and "" escapes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") row.push(cell), (cell = "");
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell), rows.push(row), (row = []), (cell = "");
    } else cell += ch;
  }
  if (cell || row.length) row.push(cell), rows.push(row);
  return rows.filter((r) => r.some((c) => c.trim()));
}

const key = (v: string) =>
  v
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .replace("ogbomoso", "ogbomosho")
    .replace("oorelope", "orelope");

/** Part of a school's id: letters and digits, with I/II kept apart. */
const idPart = (v: string) => v.toLowerCase().replace(/c0mmunity/g, "community").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const KEEP_UPPER = /^(i{1,3}|iv|vi{0,3}|ix|x|[a-z](\.[a-z])+\.?|c\.?a\.?c\.?|foa|img|lgea|unad|ud)$/i;
/** "ST. BRIGID'S SECONDARY SCHOOL, MOKOLA" -> "St. Brigid's Secondary School, Mokola" */
export function tidyName(raw: string) {
  return raw
    .replace(/C0MMUNITY/g, "COMMUNITY")
    .replace(/\s+,/g, ",")
    .replace(/,(?=\S)/g, ", ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((w) => (KEEP_UPPER.test(w.replace(/[(),]/g, "")) ? w.toUpperCase() : w.toLowerCase().replace(/(^|[(\-./'])([a-z])/g, (_, p: string, c: string) => p + c.toUpperCase())))
    .join(" ")
    .replace(/'S\b/g, "'s")
    .replace(/([A-Za-z]{2,})\s*\.$/, "$1");
}

const LEVEL: Record<string, "junior_secondary" | "senior_secondary" | "combined_secondary"> = {
  JUNIOR: "junior_secondary",
  SENIOR: "senior_secondary",
  MIXED: "combined_secondary",
  "JUNIOR/MIXED": "combined_secondary",
};

async function main() {
  const [header, ...rows] = parseCsv(readFileSync(file, "utf8").replace(/^﻿/, ""));
  const col = (name: string) => header!.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());
  const [iName, iLga, iType] = [col("School_Name"), col("LGA"), col("School_Type")];
  if (iName < 0 || iLga < 0) throw new Error(`${file}: expected School_Name and LGA columns`);

  const [oyo] = await db.select().from(s.state).where(eq(s.state.code, "OY"));
  if (!oyo) throw new Error("Oyo state not found: run the seed first");
  const lgas = await db.select().from(s.lga).where(eq(s.lga.stateId, oyo.id));
  const lgaByKey = new Map(lgas.map((l) => [key(l.name), l]));

  let done = 0;
  const missing = new Set<string>();
  for (const r of rows) {
    const rawName = r[iName]!.trim();
    const lga = lgaByKey.get(key(r[iLga]!));
    if (!rawName || !lga) {
      missing.add(r[iLga]!);
      continue;
    }
    const name = tidyName(rawName);
    const town = name.includes(",") ? name.slice(name.lastIndexOf(",") + 1).trim() || null : null;
    const values = {
      // Stable across runs: the roster has no ids of its own.
      edutrackaId: `oy-tescom:${idPart(rawName)}:${key(lga.name)}`,
      name,
      town,
      stateId: oyo.id,
      lgaId: lga.id,
      ownership: "public" as const,
      level: LEVEL[(r[iType] ?? "").trim().toUpperCase()] ?? ("combined_secondary" as const),
    };
    await db
      .insert(s.school)
      .values(values)
      .onConflictDoUpdate({ target: s.school.edutrackaId, set: { name, town, lgaId: lga.id, level: values.level, updatedAt: new Date() } });
    done++;
  }
  console.log(`Imported ${done} schools.${missing.size ? ` Skipped unknown LGAs: ${[...missing].join(", ")}` : ""}`);
}

if (process.argv[1]?.endsWith("import-schools.ts")) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
