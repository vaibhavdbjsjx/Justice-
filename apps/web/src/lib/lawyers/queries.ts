import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { Database, LawyerProfile } from "@/lib/supabase/types";

/**
 * Lawyer-profile reads (Phases 7 + 9). licensed_jurisdictions /
 * practice_areas are jsonb and tolerant by design (Part 7): entries may be
 * plain strings or { country, state } objects — normalize to display strings.
 * Marketplace visibility is enforced by RLS (verified rows only, plus own).
 */

export function normalizeJsonStrings(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((j) => {
    if (typeof j === "string") return [j];
    if (typeof j === "object" && j !== null) {
      const { country, state } = j as { country?: string; state?: string | null };
      if (country) return [state ? `${state}, ${country}` : country];
    }
    return [];
  });
}

export async function getLicensedJurisdictions(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("lawyer_profiles")
    .select("licensed_jurisdictions")
    .eq("user_id", userId)
    .maybeSingle();
  return normalizeJsonStrings(data?.licensed_jurisdictions);
}

/** A marketplace card: the safe public subset + display-ready fields. */
export type MarketplaceLawyer = {
  userId: string;
  name: string;
  verified: boolean;
  practiceAreas: string[];
  licensedJurisdictions: string[];
  rateRange: string | null;
  ratingAvg: number | null;
  bio: string | null;
  country: string | null;
  state: string | null;
};

type LawyerRow = LawyerProfile & {
  profile: {
    full_name: string | null;
    country: string | null;
    state_province: string | null;
  } | null;
};

const LAWYER_SELECT =
  "*, profile:profiles!lawyer_profiles_user_id_fkey(full_name, country, state_province)";

function toMarketplaceLawyer(row: LawyerRow): MarketplaceLawyer {
  return {
    userId: row.user_id,
    name: row.profile?.full_name?.trim() || "Justice lawyer",
    verified: row.verification_status === "verified",
    practiceAreas: normalizeJsonStrings(row.practice_areas),
    licensedJurisdictions: normalizeJsonStrings(row.licensed_jurisdictions),
    rateRange: row.rate_range,
    ratingAvg: row.rating_avg === null ? null : Number(row.rating_avg),
    bio: row.bio,
    country: row.profile?.country ?? null,
    state: row.profile?.state_province ?? null,
  };
}

/** Verified lawyers for the consumer directory (RLS already scopes). */
export async function listVerifiedLawyers(): Promise<MarketplaceLawyer[]> {
  if (!isSupabaseConfigured) {
    const { demoMarketplaceLawyers } = await import("./demo");
    return demoMarketplaceLawyers();
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("lawyer_profiles")
    .select(LAWYER_SELECT)
    .eq("verification_status", "verified")
    .order("rating_avg", { ascending: false, nullsFirst: false });
  return ((data as unknown as LawyerRow[] | null) ?? []).map(toMarketplaceLawyer);
}

export async function getLawyerPublicProfile(
  userId: string,
): Promise<MarketplaceLawyer | null> {
  if (!isSupabaseConfigured) {
    const { demoMarketplaceLawyers } = await import("./demo");
    return demoMarketplaceLawyers().find((l) => l.userId === userId) ?? null;
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("lawyer_profiles")
    .select(LAWYER_SELECT)
    .eq("user_id", userId)
    .eq("verification_status", "verified")
    .maybeSingle();
  return data ? toMarketplaceLawyer(data as unknown as LawyerRow) : null;
}

/** The viewer's own lawyer_profiles row (any status) for /marketplace. */
export async function getOwnLawyerProfile(): Promise<LawyerProfile | null> {
  if (!isSupabaseConfigured) {
    const { demoOwnLawyerProfile } = await import("./demo");
    return demoOwnLawyerProfile();
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("lawyer_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  return data;
}
