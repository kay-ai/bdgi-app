import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { encrypt, humanCode, lookupHash } from "@/lib/crypto";
import { audit, type Ctx } from "./audit";
import { dispatch, queueTemplate } from "./messaging";
import { hit } from "./rate-limit";

export const donationInput = z.object({
  amount: z.coerce.number().int().min(500).max(50_000_000), // naira
  frequency: z.enum(["one_off", "monthly"]),
  designation: z.string().uuid().or(z.literal("")),
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(200),
  isAnonymous: z.boolean(),
  wantsUpdates: z.boolean(),
});

/**
 * Starts a donation (spec/11). With PAYMENTS_PROVIDER=console the payment is confirmed at once so
 * the whole journey can be tested locally; the Paystack adapter (M2) returns its checkout URL instead
 * and the webhook marks the donation paid.
 */
export async function startDonation(ctx: Ctx, input: z.infer<typeof donationInput>) {
  if (ctx.ip && !(await hit(`donate:${ctx.ip}`, 10, 3600))) return { ok: false as const, code: "rate_limited" };
  const provider = process.env.PAYMENTS_PROVIDER ?? "console";
  if (provider !== "console") return { ok: false as const, code: "provider_not_ready" };

  const hash = lookupHash(input.email);
  const reference = `BGDI-${humanCode()}`;
  const ids: string[] = [];
  await db.transaction(async (tx) => {
    let [sup] = await tx.select().from(s.supporter).where(eq(s.supporter.emailHash, hash));
    if (!sup) {
      [sup] = await tx
        .insert(s.supporter)
        .values({ name: input.name, email: encrypt(input.email), emailHash: hash, wantsUpdates: input.wantsUpdates })
        .returning();
    }
    const [d] = await tx
      .insert(s.donation)
      .values({
        supporterId: sup!.id,
        reference,
        amountMinor: input.amount * 100,
        currency: "NGN",
        frequency: input.frequency,
        designationProgrammeId: input.designation || null,
        status: "paid",
        provider: "console",
        providerReference: `console-${reference}`,
        paidAt: new Date(),
        receiptCode: humanCode(),
        isAnonymous: input.isAnonymous,
      })
      .returning();
    const id = await queueTemplate(
      {
        templateKey: "donation.receipt",
        to: input.email,
        channel: "email",
        vars: { name: input.name, amount: input.amount, reference },
        eventKey: `donation.receipt:${d!.id}`,
      },
      tx,
    );
    if (id) ids.push(id);
    await audit(tx, ctx, { action: "donation.paid", entityType: "donation", entityId: d!.id, meta: { provider: "console" } });
  });
  await dispatch(ids).catch((e) => console.error("[donation] receipt dispatch failed", e));
  return { ok: true as const, reference };
}

export async function getDonationByReference(reference: string) {
  const [d] = await db.select().from(s.donation).where(eq(s.donation.reference, reference));
  return d ?? null;
}
