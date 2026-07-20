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
  plus: { label: "Plus", price: "$14.99", cadence: "/month" },
  professional: { label: "Professional", price: "$49.99", cadence: "/month" },
} as const;

export const TIER_FEATURES: Record<"plus" | "professional", string[]> = {
  plus: [
    "Unlimited assistant conversations",
    "Unlimited matters, organized with deadlines",
    "Full document generation — every template",
    "Document Intelligence: upload and understand any legal document",
    "Priority answers during busy hours",
  ],
  professional: [
    "Research accelerator with citation discipline",
    "Drafting assistant — first drafts and redlines",
    "Client intake links with triage-to-brief",
    "Client & case management with communication log",
    "Marketplace profile, discoverable by consumers",
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
