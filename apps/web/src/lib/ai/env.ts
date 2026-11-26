/**
 * Central access to the AI provider, mirroring lib/supabase/env.ts — a missing
 * key fails loudly and once, and early phases keep rendering without it.
 *
 * Swapping to a stronger key is an env change only, no code:
 *   - Gemini (preferred when set): GEMINI_API_KEY + optional GEMINI_MODEL, e.g.
 *     GEMINI_MODEL=gemini-4-argon on a paid key for the flagship reasoning model.
 *   - OpenAI: OPENAI_API_KEY + optional OPENAI_MODEL, used when no Gemini key.
 *
 * Use a PAID key for real users. Google's terms forbid sending personal data to
 * unpaid Gemini keys and forbid serving the UK/EEA/Switzerland from them.
 */

const GROQ_API_KEY =
  process.env.GROQ_API_KEY || process.env.Groq_API || process.env.GROQ_API;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export type AiProviderName = "groq" | "gemini" | "openai" | "none";

/** Groq (free, no card) wins when its key is set; then Gemini, then OpenAI. */
export const AI_PROVIDER: AiProviderName = GROQ_API_KEY
  ? "groq"
  : GEMINI_API_KEY
    ? "gemini"
    : OPENAI_API_KEY
      ? "openai"
      : "none";

/** True once an AI provider is usable. */
export const isAiConfigured = AI_PROVIDER !== "none";

/**
 * Who answers, in the words shown to users. Apple Guideline 5.1.2(i) requires
 * naming the third-party AI before sharing data with it, so the consent screens
 * read this rather than hardcoding a vendor that can change with the key.
 */
export const AI_PROVIDER_LABEL: Record<AiProviderName, string> = {
  groq: "Groq",
  gemini: "Google (Gemini)",
  openai: "OpenAI",
  none: "our AI provider",
};

/** Web-grounded answers with real sources. AI_WEB_SEARCH=off disables them. */
export const isWebSearchEnabled = process.env.AI_WEB_SEARCH !== "off";

/**
 * On Gemini's free tier Google may use what is sent to improve its products,
 * and people may review it. Until GEMINI_PAID_TIER=true, the privacy policy and
 * consent screens say so.
 */
export const aiProviderMayReviewContent =
  AI_PROVIDER === "gemini" && process.env.GEMINI_PAID_TIER !== "true";

export const AI_REVIEW_NOTICE =
  "On the free tier Google may use what's sent to improve its products, and people at Google may read it. Please leave out sensitive details such as ID numbers, bank details, or health information.";

/**
 * Per-request budget, under the platform's function limit so a slow model ends
 * in calm retry copy rather than a raw gateway error. Netlify's synchronous
 * functions stop at 30 seconds; AI_TIMEOUT_MS overrides this elsewhere.
 */
export const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 26_000;

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const OPENAI_BASE_URL = "https://api.openai.com/v1";

/**
 * Candidate models, tried in order when one is retired or unavailable. The
 * previous hardcoded default (gemini-2.0-flash) was shut down in June 2026 and
 * took every AI feature with it; `gemini-flash-latest` is Google's rolling alias,
 * and the pinned models behind it keep answers flowing if the alias ever fails.
 */
export function requireGeminiEnv(): {
  apiKey: string;
  baseUrl: string;
  models: string[];
} {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set.");
  const configured = process.env.GEMINI_MODEL?.trim();
  return {
    apiKey: GEMINI_API_KEY,
    baseUrl: process.env.GEMINI_BASE_URL || GEMINI_BASE_URL,
    models: [
      ...new Set(
        [
          configured,
          "gemini-flash-latest",
          "gemini-3.8-flash",
          "gemini-3.6-flash",
          // Free tier: the Flash models allow ~20 requests a day, Flash-Lite ~500.
          "gemini-3.5-flash-lite",
          "gemini-3.1-flash-lite",
          "gemini-flash-lite-latest",
        ].filter((m): m is string => Boolean(m)),
      ),
    ],
  };
}

export function requireOpenAiEnv(): {
  apiKey: string;
  model: string;
  baseUrl: string;
} {
  if (AI_PROVIDER === "groq" && GROQ_API_KEY) {
    return {
      apiKey: GROQ_API_KEY,
      model: process.env.GROQ_MODEL || "",
      baseUrl: "https://api.groq.com/openai/v1",
    };
  }
  if (!OPENAI_API_KEY) {
    throw new Error(
      "AI provider is not configured. Set GEMINI_API_KEY or OPENAI_API_KEY.",
    );
  }
  return {
    apiKey: OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || "gpt-6-astra",
    baseUrl: process.env.OPENAI_BASE_URL || OPENAI_BASE_URL,
  };
}
