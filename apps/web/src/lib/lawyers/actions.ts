"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { PRACTICE_AREAS } from "@/lib/legal/practice-areas";

/**
 * Marketplace profile mutations (Phase 9). Column grants keep
 * verification_status / rating_avg out of reach regardless of what arrives
 * here — this action only ever touches the lawyer-editable columns.
 */

export type ActionResult = { error: string } | undefined;

const MAX_BIO_CHARS = 800;
const MAX_SHORT_CHARS = 80;
const MAX_JURISDICTIONS = 8;

export type LawyerProfileInput = {
  bio: string;
  practiceAreas: string[];
  /** Display strings, e.g. "California, United States". */
  licensedJurisdictions: string[];
  barNumber: string;
  rateRange: string;
};

export async function updateLawyerProfile(
  input: LawyerProfileInput,
): Promise<ActionResult> {
  if (!isSupabaseConfigured) {
    return { error: "This is a local preview — connect Supabase to save changes." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Please sign in again." };

  const practiceAreas = (input.practiceAreas ?? [])
    .filter((a): a is (typeof PRACTICE_AREAS)[number] =>
      (PRACTICE_AREAS as readonly string[]).includes(a),
    )
    .slice(0, PRACTICE_AREAS.length);

  const licensedJurisdictions = (input.licensedJurisdictions ?? [])
    .map((j) => j.trim().slice(0, 120))
    .filter(Boolean)
    .slice(0, MAX_JURISDICTIONS);

  const { error } = await supabase
    .from("lawyer_profiles")
    .upsert(
      {
        user_id: user.id,
        bio: input.bio.trim().slice(0, MAX_BIO_CHARS) || null,
        practice_areas: practiceAreas,
        licensed_jurisdictions: licensedJurisdictions,
        bar_number: input.barNumber.trim().slice(0, MAX_SHORT_CHARS) || null,
        rate_range: input.rateRange.trim().slice(0, MAX_SHORT_CHARS) || null,
      },
      { onConflict: "user_id" },
    );

  if (error) return { error: "That couldn't be saved. Please try again." };
  revalidatePath("/marketplace");
  revalidatePath("/find-a-lawyer");
  return undefined;
}
