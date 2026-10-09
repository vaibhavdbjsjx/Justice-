/**
 * Single source of truth for company/legal contact details used across the
 * Terms, Privacy, Disclaimer, Security, About, and Support pages.
 *
 * The email addresses read from env so they can be set once at deploy time
 * (and must point at real, monitored mailboxes before public launch / App
 * Store submission). Sensible defaults keep the UI functional in preview.
 */

export const COMPANY_NAME = "Justice";
export const COMPANY_LEGAL_NAME =
  process.env.NEXT_PUBLIC_COMPANY_LEGAL_NAME || "Justice";

/** Apple requires a working Support URL + Privacy Policy. These back them. */
export const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@justice.app";
export const PRIVACY_EMAIL =
  process.env.NEXT_PUBLIC_PRIVACY_EMAIL || "privacy@justice.app";
export const LEGAL_EMAIL =
  process.env.NEXT_PUBLIC_LEGAL_EMAIL || "legal@justice.app";

/** Shown as "Last updated" on the policy pages. Bump when the text changes. */
export const POLICIES_EFFECTIVE_DATE = "October 9, 2026";

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://justice.app";

/** Third parties that process data on our behalf (named in the Privacy Policy). */
export const SUBPROCESSORS = [
  { name: "Supabase", purpose: "Database, authentication, and file storage", region: "United States / EU" },
  { name: "OpenAI", purpose: "AI processing of chat and document content", region: "United States" },
  { name: "Stripe", purpose: "Subscription billing and payments", region: "United States" },
  { name: "Vercel", purpose: "Application hosting and content delivery", region: "Global edge network" },
] as const;
