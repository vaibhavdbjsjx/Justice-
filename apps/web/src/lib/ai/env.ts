/**
 * Central access to AI provider env, mirroring lib/supabase/env.ts — a missing
 * key fails loudly and once, and early phases keep rendering without it.
 *
 * Owner decision (2026-07-03): chat runs on the OpenAI API instead of the
 * spec's Claude API. Everything provider-specific stays inside lib/ai/ so a
 * later switch back is contained here (see provider.ts).
 */

export const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/** Vision-capable default; override with OPENAI_MODEL when needed. */
export const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o";

/** OpenAI-compatible endpoint base; override for proxies/Azure/local models. */
export const OPENAI_BASE_URL =
  process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";

/** True once the AI provider is usable. */
export const isAiConfigured = Boolean(OPENAI_API_KEY);

export function requireAiEnv(): { apiKey: string; model: string } {
  if (!OPENAI_API_KEY) {
    throw new Error(
      "AI provider is not configured. Set OPENAI_API_KEY in " +
        "apps/web/.env.local (see .env.example).",
    );
  }
  return { apiKey: OPENAI_API_KEY, model: OPENAI_MODEL };
}
