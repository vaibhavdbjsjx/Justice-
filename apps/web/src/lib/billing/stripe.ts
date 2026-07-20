import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { STRIPE_API_BASE, requireBillingEnv } from "./env";

/**
 * Minimal Stripe client (Phase 10) — fetch + form-encoding, in the house
 * style of lib/ai/provider.ts: no SDK, one file to swap, and a base-URL
 * override so the whole flow is testable against a local mock. Only the
 * three calls LexMind needs.
 */

export class StripeError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly detail?: string,
  ) {
    super(message);
    this.name = "StripeError";
  }
}

/** Stripe expects application/x-www-form-urlencoded with bracket nesting. */
function encodeForm(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, value);
  }
  return search.toString();
}

async function stripePost<T>(
  path: string,
  params: Record<string, string | undefined>,
): Promise<T> {
  const { secretKey } = requireBillingEnv();
  const res = await fetch(`${STRIPE_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: encodeForm(params),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new StripeError(
      `Stripe request failed (${res.status})`,
      res.status,
      detail.slice(0, 2000),
    );
  }
  return (await res.json()) as T;
}

export async function createCheckoutSession(input: {
  price: string;
  userId: string;
  tier: "plus" | "professional";
  customerEmail: string | null;
  existingCustomerId: string | null;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ id: string; url: string | null }> {
  return stripePost("/v1/checkout/sessions", {
    mode: "subscription",
    "line_items[0][price]": input.price,
    "line_items[0][quantity]": "1",
    client_reference_id: input.userId,
    "metadata[user_id]": input.userId,
    "metadata[tier]": input.tier,
    // Reuse the customer when we know them; otherwise prefill the email.
    ...(input.existingCustomerId
      ? { customer: input.existingCustomerId }
      : input.customerEmail
        ? { customer_email: input.customerEmail }
        : {}),
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
  });
}

export async function createPortalSession(input: {
  customerId: string;
  returnUrl: string;
}): Promise<{ url: string }> {
  return stripePost("/v1/billing_portal/sessions", {
    customer: input.customerId,
    return_url: input.returnUrl,
  });
}

/**
 * Verifies a `Stripe-Signature` header (v1 scheme: HMAC-SHA256 over
 * "<timestamp>.<payload>"). Constant-time comparison; stale timestamps
 * rejected to blunt replay.
 */
export function verifyStripeSignature(
  payload: string,
  signatureHeader: string | null,
  secret: string,
  toleranceSeconds = 300,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!signatureHeader) return false;

  let timestamp: string | null = null;
  const candidates: string[] = [];
  for (const part of signatureHeader.split(",")) {
    const [key, value] = part.split("=", 2);
    if (key?.trim() === "t" && value) timestamp = value.trim();
    if (key?.trim() === "v1" && value) candidates.push(value.trim());
  }
  if (!timestamp || candidates.length === 0) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > toleranceSeconds) {
    return false;
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  return candidates.some((candidate) => {
    const candidateBuf = Buffer.from(candidate, "utf8");
    return (
      candidateBuf.length === expectedBuf.length &&
      timingSafeEqual(candidateBuf, expectedBuf)
    );
  });
}

/** Maps a Stripe price id to a LexMind tier (null = unknown price). */
export function tierForPrice(
  priceId: string | null | undefined,
  prices: { pricePlus: string; priceProfessional: string },
): "plus" | "professional" | null {
  if (!priceId) return null;
  if (priceId === prices.pricePlus) return "plus";
  if (priceId === prices.priceProfessional) return "professional";
  return null;
}

/** Maps a Stripe subscription status to the stored status. Paid access is
 * effective for active/trialing/past_due (grace while Stripe retries). */
export function normalizeSubscriptionStatus(stripeStatus: string): string {
  switch (stripeStatus) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
      return "past_due";
    default:
      return "canceled";
  }
}
