import { z } from "zod";

/** Gift limits in major units (spec/11 §1.3). Amounts are stored in minor units (kobo / cents). */
export const DONATION_LIMITS = {
  NGN: { min: 500, max: 5_000_000 },
  USD: { min: 2, max: 5_000 },
} as const;

export type Currency = keyof typeof DONATION_LIMITS;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

/** Shared by the donate form (client) and `donations.initiate` (server). Error messages are i18n keys. */
export const donationInput = z
  .object({
    amount: z.coerce.number({ invalid_type_error: "amount" }).int("amount"),
    currency: z.enum(["NGN", "USD"]).default("NGN"),
    frequency: z.enum(["one_off", "monthly"]),
    designation: z.string().uuid().or(z.literal("")),
    name: z.string().trim().min(2, "name").max(100, "name"),
    email: z.string().trim().email("email").max(200, "email"),
    phone: optionalText(30).refine((v) => !v || /^\+?[0-9 ()-]{7,20}$/.test(v), "phone"),
    message: optionalText(500),
    isAnonymous: z.boolean().default(false),
    wantsUpdates: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    const lim = DONATION_LIMITS[v.currency];
    if (v.amount < lim.min) ctx.addIssue({ code: "custom", path: ["amount"], message: "amountMin" });
    if (v.amount > lim.max) ctx.addIssue({ code: "custom", path: ["amount"], message: "amountMax" });
  });

export type DonationInput = z.infer<typeof donationInput>;

/** Console: record a bank transfer or cash gift (spec/11 §3). */
export const offlineGiftInput = z.object({
  supporterName: z.string().trim().min(2, "name").max(100, "name"),
  supporterEmail: z.string().trim().email("email").max(200, "email"),
  amount: z.coerce.number().int("amount").positive("amount").max(100_000_000, "amountMax"),
  currency: z.enum(["NGN", "USD"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date"),
  method: z.enum(["bank_transfer", "cash"]),
  designation: z.string().uuid().or(z.literal("")).default(""),
  note: optionalText(500),
});

export type OfflineGiftInput = z.infer<typeof offlineGiftInput>;

/** Console list filters, read from the URL. */
export const donationFilters = z.object({
  status: z.enum(["initiated", "paid", "failed", "refunded"]).optional().catch(undefined),
  frequency: z.enum(["one_off", "monthly"]).optional().catch(undefined),
  currency: z.enum(["NGN", "USD"]).optional().catch(undefined),
  provider: z.enum(["paystack", "console", "offline"]).optional().catch(undefined),
  designation: z.string().uuid().or(z.literal("general")).optional().catch(undefined),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  page: z.coerce.number().int().min(1).default(1).catch(1),
});

export type DonationFilters = z.infer<typeof donationFilters>;
