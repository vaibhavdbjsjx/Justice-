/**
 * Single source of truth for company/legal contact details used across the
 * Terms, Privacy, Disclaimer, Security, About, and Support pages.
 *
 * The email addresses read from env so they can be set once at deploy time
 * (and must point at real, monitored mailboxes before public launch / App
 * Store submission). Sensible defaults keep the UI functional in preview.
 */

export const COMPANY_NAME = "Lexa";
export const COMPANY_LEGAL_NAME =
  process.env.NEXT_PUBLIC_COMPANY_LEGAL_NAME || "Lexa";

/** Apple requires a working Support URL + Privacy Policy. These back them. */
export const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@lexa.app";
export const PRIVACY_EMAIL =
  process.env.NEXT_PUBLIC_PRIVACY_EMAIL || "privacy@lexa.app";
export const LEGAL_EMAIL =
  process.env.NEXT_PUBLIC_LEGAL_EMAIL || "legal@lexa.app";

/** Shown as "Last updated" on the policy pages. Bump when the text changes. */
export const POLICIES_EFFECTIVE_DATE = "November 5, 2026";

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://lexa.app";

/** Third parties that process data on our behalf (named in the Privacy Policy). */
export const SUBPROCESSORS = [
  { name: "Supabase", purpose: "Database, authentication, and file storage", region: "United States / EU" },
  { name: "Google (Gemini API and Google Search)", purpose: "AI processing of chat and document content, and web search to ground answers", region: "United States" },
  { name: "Groq", purpose: "AI processing of chat and document content", region: "United States" },
  { name: "OpenAI", purpose: "AI processing of chat and document content, when used instead of Google", region: "United States" },
  { name: "Stripe", purpose: "Subscription billing and payments on the web", region: "United States" },
  { name: "Apple", purpose: "Subscription billing and payments in the iOS app", region: "United States" },
  { name: "Netlify", purpose: "Application hosting and content delivery", region: "Global edge network" },
] as const;
