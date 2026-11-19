import "server-only";
import { verifyPaystackSignature } from "@/lib/paystack-signature";

/**
 * Payments adapters (spec/01 §1, spec/11). Chosen by PAYMENTS_PROVIDER:
 * - `console` (default): no network; the donation is confirmed at once (or failed, see below).
 * - `paystack`: hosted checkout; the webhook and the thank-you page confirm the payment.
 * Card details never reach BGDI's servers with either adapter.
 */
export type Currency = "NGN" | "USD";

export type VerifyResult = {
  status: "success" | "failed" | "pending";
  amountMinor: number;
  currency: string;
  feeMinor: number | null;
  paidAt: Date | null;
  providerReference: string | null;
};

export interface PaymentsProvider {
  name: "console" | "paystack";
  initialize(input: {
    reference: string;
    amountMinor: number;
    currency: Currency;
    email: string;
    callbackUrl: string;
    metadata: Record<string, string | null>;
    plan?: string;
  }): Promise<{ authorizationUrl: string | null }>;
  verify(reference: string): Promise<VerifyResult>;
  createPlan(input: { name: string; amountMinor: number; currency: Currency }): Promise<string>;
  manageLink(subscriptionCode: string): Promise<string | null>;
  verifyWebhook(rawBody: string, signature: string | null): boolean;
}

export class PaymentsError extends Error {}

/* ---------- console ---------- */

/** Local and staging simulator. An amount ending in 13 (e.g. ₦513) fails, so the failure path can be tried. */
const consoleProvider: PaymentsProvider = {
  name: "console",
  async initialize() {
    return { authorizationUrl: null };
  },
  async verify() {
    throw new PaymentsError("The console provider confirms donations at once; nothing to verify.");
  },
  async createPlan({ amountMinor, currency }) {
    return `console-plan-${currency}-${amountMinor}`;
  },
  async manageLink() {
    return null;
  },
  verifyWebhook() {
    return false;
  },
};

export const consoleSimulatesFailure = (amountMinor: number) => Math.round(amountMinor / 100) % 100 === 13;

/* ---------- paystack ---------- */

const PAYSTACK_API = "https://api.paystack.co";

export function paystackSecret(): string {
  const key = process.env.PAYSTACK_SECRET_KEY ?? "";
  if (!key) throw new PaymentsError("PAYSTACK_SECRET_KEY is not set");
  // Live keys only with an explicit switch in production secrets (spec/11 §4).
  if (key.startsWith("sk_live_") && process.env.PAYSTACK_ALLOW_LIVE !== "true") {
    throw new PaymentsError("A live Paystack key is set but PAYSTACK_ALLOW_LIVE is not true");
  }
  return key;
}

async function paystack<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(`${PAYSTACK_API}${path}`, {
    method: init?.method ?? "GET",
    headers: { Authorization: `Bearer ${paystackSecret()}`, "Content-Type": "application/json" },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => null)) as { status?: boolean; message?: string; data?: T } | null;
  if (!res.ok || !json?.status) {
    // The message is Paystack's own text; it never contains the donor's details.
    throw new PaymentsError(`Paystack ${path.split("/")[1]} failed (${res.status}): ${json?.message ?? "no body"}`);
  }
  return json.data as T;
}

const paystackProvider: PaymentsProvider = {
  name: "paystack",
  async initialize({ reference, amountMinor, currency, email, callbackUrl, metadata, plan }) {
    const data = await paystack<{ authorization_url: string }>("/transaction/initialize", {
      method: "POST",
      body: { amount: amountMinor, currency, email, reference, callback_url: callbackUrl, metadata, ...(plan ? { plan } : {}) },
    });
    return { authorizationUrl: data.authorization_url };
  },
  async verify(reference) {
    const d = await paystack<{
      status: string;
      amount: number;
      currency: string;
      fees: number | null;
      paid_at: string | null;
      id: number;
    }>(`/transaction/verify/${encodeURIComponent(reference)}`);
    return {
      status: d.status === "success" ? "success" : d.status === "failed" || d.status === "abandoned" || d.status === "reversed" ? "failed" : "pending",
      amountMinor: d.amount,
      currency: d.currency,
      feeMinor: d.fees ?? null,
      paidAt: d.paid_at ? new Date(d.paid_at) : null,
      providerReference: String(d.id),
    };
  },
  async createPlan({ name, amountMinor, currency }) {
    const d = await paystack<{ plan_code: string }>("/plan", {
      method: "POST",
      body: { name, amount: amountMinor, interval: "monthly", currency },
    });
    return d.plan_code;
  },
  async manageLink(code) {
    try {
      const d = await paystack<{ link: string }>(`/subscription/${encodeURIComponent(code)}/manage/link`);
      return d.link;
    } catch {
      return null;
    }
  },
  verifyWebhook(rawBody, signature) {
    return verifyPaystackSignature(rawBody, signature, paystackSecret());
  },
};

export function paymentsProvider(): PaymentsProvider {
  const name = process.env.PAYMENTS_PROVIDER ?? "console";
  if (name === "console") return consoleProvider;
  if (name === "paystack") return paystackProvider;
  throw new PaymentsError(`Payments provider "${name}" is not implemented`);
}

/** The webhook always verifies with Paystack's secret, whichever adapter takes new gifts. */
export const paystackAdapter = paystackProvider;
