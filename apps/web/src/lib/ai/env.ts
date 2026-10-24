/**
 * Central access to the AI provider, mirroring lib/supabase/env.ts — a missing
 * key fails loudly and once, and early phases keep rendering without it.
 *
 * Providers are auto-detected and swappable without touching provider.ts:
 *   - Gemini (preferred when set): Google's free OpenAI-compatible endpoint, so
 *     the same Chat Completions code path works. Great free-tier launch option.
 *   - OpenAI: used when only OPENAI_API_KEY is set.
 * Set GEMINI_API_KEY (free at https://aistudio.google.com/apikey) OR
 * OPENAI_API_KEY. If both are set, Gemini wins.
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export type AiProviderName = "gemini" | "openai" | "none";

export const AI_PROVIDER: AiProviderName = GEMINI_API_KEY
  ? "gemini"
  : OPENAI_API_KEY
    ? "openai"
    : "none";

/** True once an AI provider is usable. */
export const isAiConfigured = AI_PROVIDER !== "none";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
const OPENAI_BASE_URL = "https://api.openai.com/v1";

/** Resolved request config for the active provider. */
export function requireAiEnv(): {
  apiKey: string;
  model: string;
  baseUrl: string;
  provider: AiProviderName;
} {
  if (GEMINI_API_KEY) {
    return {
      apiKey: GEMINI_API_KEY,
      // Fast, multimodal, free-tier friendly. Override with GEMINI_MODEL.
      model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
      baseUrl: process.env.AI_BASE_URL || GEMINI_BASE_URL,
      provider: "gemini",
    };
  }
  if (OPENAI_API_KEY) {
    return {
      apiKey: OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || "gpt-4o",
      baseUrl: process.env.OPENAI_BASE_URL || OPENAI_BASE_URL,
      provider: "openai",
    };
  }
  throw new Error(
    "AI provider is not configured. Set GEMINI_API_KEY (free at " +
      "aistudio.google.com/apikey) or OPENAI_API_KEY.",
  );
}
