import { AI_PROVIDER, AI_PROVIDER_LABEL, AI_REVIEW_NOTICE, aiProviderMayReviewContent, isWebSearchEnabled } from "@/lib/ai/env";
import { APPLE_PRODUCTS } from "@/lib/billing/apple-products";
import { PAYMENTS_ENABLED, TIER_FEATURES, TIER_PRICING } from "@/lib/billing/tiers";
import { SUPPORT_EMAIL } from "@/lib/legal/company";

/**
 * Public, non-secret settings the native app needs before sign-in. Keeps the
 * AI provider named on the consent screen and the products on sale in step with
 * the server, without shipping an app update.
 */
export function GET(request: Request): Response {
  const origin = new URL(request.url).origin;
  return Response.json(
    {
      ai: {
        provider: AI_PROVIDER,
        label: AI_PROVIDER_LABEL[AI_PROVIDER],
        webSearch: isWebSearchEnabled && AI_PROVIDER === "gemini",
        reviewNotice: aiProviderMayReviewContent ? AI_REVIEW_NOTICE : null,
      },
      paymentsEnabled: PAYMENTS_ENABLED,
      products: APPLE_PRODUCTS,
      plans: { pricing: TIER_PRICING, features: TIER_FEATURES },
      legal: {
        terms: `${origin}/terms`,
        privacy: `${origin}/privacy`,
        disclaimer: `${origin}/disclaimer`,
        support: `${origin}/contact`,
        resetPassword: `${origin}/reset-password`,
      },
      supportEmail: SUPPORT_EMAIL,
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
