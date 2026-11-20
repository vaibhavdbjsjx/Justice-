import "server-only";
import type { Profile } from "@/lib/supabase/types";
import { AI_PROVIDER, AI_PROVIDER_LABEL } from "./env";

/**
 * Explicit permission before personal data reaches third-party AI (App Store
 * Guideline 5.1.2(i)). Consent names the provider, so changing provider asks again.
 *
 * Before the launch migration adds the columns, profiles arrive without them and
 * nothing is blocked; the app's own consent step still runs on the device.
 */
export function needsAiConsent(profile: Profile): boolean {
  if (!("ai_consent_at" in profile)) return false;
  if (!profile.ai_consent_at) return true;
  return profile.ai_consent_provider !== AI_PROVIDER;
}

export function aiConsentRequired(): Response {
  return Response.json(
    {
      error: `Lexa needs your permission to send this to ${AI_PROVIDER_LABEL[AI_PROVIDER]} before it can answer.`,
      consentRequired: true,
      provider: AI_PROVIDER_LABEL[AI_PROVIDER],
    },
    { status: 428 },
  );
}
