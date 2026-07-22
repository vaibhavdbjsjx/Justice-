import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { normalizeJsonStrings } from "@/lib/lawyers/queries";

/**
 * Intake token resolution (Phase 8). Tokens are secrets; intake_links has no
 * anon/public policy, so resolution runs through the service role and returns
 * ONLY the safe branding subset a visitor may see. Demo mode (Supabase
 * unconfigured) accepts any token and previews with a fixture lawyer.
 */

export type IntakeLawyerBranding = {
  lawyerId: string;
  name: string;
  verified: boolean;
  practiceAreas: string[];
  licensedJurisdictions: string[];
  bio: string | null;
};

export const DEMO_INTAKE_LAWYER: IntakeLawyerBranding = {
  lawyerId: "00000000-0000-0000-0000-000000000001",
  name: "Alexandra Reyes",
  verified: true,
  practiceAreas: ["Tenant & Housing", "Contracts", "Employment"],
  licensedJurisdictions: ["California, United States"],
  bio: "Fifteen years helping tenants and small businesses resolve disputes without unnecessary litigation.",
};

/** null = unknown or revoked token (the page 404s without leaking why). */
export async function resolveIntakeToken(
  token: string,
): Promise<IntakeLawyerBranding | null> {
  if (!token || token.length > 200) return null;
  if (!isSupabaseConfigured) return DEMO_INTAKE_LAWYER;

  const admin = createAdminClient();
  const { data: link } = await admin
    .from("intake_links")
    .select("lawyer_id, revoked_at")
    .eq("token", token)
    .maybeSingle();
  if (!link || link.revoked_at) return null;

  const [{ data: profile }, { data: lawyerProfile }] = await Promise.all([
    admin
      .from("profiles")
      .select("full_name")
      .eq("user_id", link.lawyer_id)
      .maybeSingle(),
    admin
      .from("lawyer_profiles")
      .select("practice_areas, licensed_jurisdictions, verification_status, bio")
      .eq("user_id", link.lawyer_id)
      .maybeSingle(),
  ]);

  return {
    lawyerId: link.lawyer_id,
    name: profile?.full_name?.trim() || "A Justice lawyer",
    verified: lawyerProfile?.verification_status === "verified",
    practiceAreas: normalizeJsonStrings(lawyerProfile?.practice_areas),
    licensedJurisdictions: normalizeJsonStrings(
      lawyerProfile?.licensed_jurisdictions,
    ),
    bio: (lawyerProfile?.bio as string | null) ?? null,
  };
}
