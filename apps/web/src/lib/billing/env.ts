/**
 * Billing env (Phase 10), mirroring lib/ai/env.ts: missing config fails
 * loudly in one place, and the app renders fine without it (billing surfaces
 * show a not-connected state instead).
 */

export const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
export const STRIPE_PRICE_PLUS = process.env.STRIPE_PRICE_PLUS;
export const STRIPE_PRICE_PROFESSIONAL = process.env.STRIPE_PRICE_PROFESSIONAL;

/** Override for local mocks/tests — same pattern as OPENAI_BASE_URL. */
export const STRIPE_API_BASE =
  process.env.STRIPE_API_BASE || "https://api.stripe.com";

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/** True once checkout can actually be created. */
export const isBillingConfigured = Boolean(
  STRIPE_SECRET_KEY && STRIPE_PRICE_PLUS && STRIPE_PRICE_PROFESSIONAL,
);

export function requireBillingEnv(): {
  secretKey: string;
  pricePlus: string;
  priceProfessional: string;
} {
  if (!STRIPE_SECRET_KEY || !STRIPE_PRICE_PLUS || !STRIPE_PRICE_PROFESSIONAL) {
    throw new Error(
      "Billing is not configured. Set STRIPE_SECRET_KEY, STRIPE_PRICE_PLUS and " +
        "STRIPE_PRICE_PROFESSIONAL in apps/web/.env.local (see .env.example).",
    );
  }
  return {
    secretKey: STRIPE_SECRET_KEY,
    pricePlus: STRIPE_PRICE_PLUS,
    priceProfessional: STRIPE_PRICE_PROFESSIONAL,
  };
}
