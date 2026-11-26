/**
 * Tier model (Phase 10, Part 4.4). Client-safe: names, prices, and limits.
 * Enforcement lives server-side (lib/billing/gate.ts) — these constants are
 * the single source of truth both sides read.
 */

export type Tier = "free" | "plus" | "professional";

/** Free-consumer allowances (product call, logged in BUILD_LOG Phase 10). */
export const FREE_CHAT_MESSAGES_PER_MONTH = 25;
export const FREE_ACTIVE_MATTERS = 1;
export const FREE_GENERATED_DOCS_PER_MONTH = 3;

export const TIER_PRICING = {
  plus: { label: "Plus", price: "$9.99", cadence: "/month" },
  professional: { label: "Professional", price: "$39.99", cadence: "/month" },
} as const;

/**
 * Paid plans always exist: the iOS app sells them with In-App Purchase and the
 * web sells them with Stripe when Stripe is configured (see isBillingConfigured).
 * Kept as a constant, not a remote switch, so nothing in the app changes after
 * App Review.
 */
export const PAYMENTS_ENABLED = true;

export const TIER_FEATURES: Record<"plus" | "professional", string[]> = {
  plus: [
    "Unlimited assistant conversations",
    "Unlimited matters, organized with deadlines",
    "Unlimited drafts from every template",
    "Document Intelligence for any legal document",
  ],
  professional: [
    "Everything in Plus",
    "Research accelerator with citation discipline",
    "Drafting assistant for first drafts and redlines",
    "Client intake links that become case briefs",
    "Client and case management with secure messaging",
    "A profile in the lawyer directory, once verified",
  ],
};

export function tierLabel(tier: Tier): string {
  return tier === "professional"
    ? "Professional"
    : tier === "plus"
      ? "Plus"
      : "Free";
}

/** Copy for gate errors — always names the path forward. */
export const UPGRADE_CHAT_LIMIT = `You've used this month's ${FREE_CHAT_MESSAGES_PER_MONTH} free messages. Upgrade to Plus for unlimited conversations.`;
export const UPGRADE_MATTER_LIMIT = `The free plan includes ${FREE_ACTIVE_MATTERS} active matter. Upgrade to Plus for unlimited matters.`;
export const UPGRADE_GENERATION_LIMIT = `You've used this month's ${FREE_GENERATED_DOCS_PER_MONTH} free document drafts. Upgrade to Plus for unlimited drafting.`;
export const UPGRADE_ANALYSIS = "Document Intelligence is a Plus feature. Upgrade to upload and understand any legal document.";
export const UPGRADE_PROFESSIONAL = "This is a Professional feature. Upgrade to unlock research, drafting, and client tools.";
