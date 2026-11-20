"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getCountry } from "@/lib/legal/countries";
import type { OnboardingInput } from "./onboarding-types";

/**
 * Persists onboarding: sets role, jurisdiction, language on the profile (and, for
 * lawyers, seeds lawyer_profiles). Verification stays 'pending' — real lawyer
 * verification is a Phase 9 process, not a toggle (Part 12). Redirects to the
 * dashboard on success.
 */
export async function completeOnboarding(
  input: OnboardingInput,
): Promise<{ error?: string } | undefined> {
  if (!isSupabaseConfigured) {
    return { error: "Accounts aren't connected in this preview." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has expired. Please sign in again." };

  const countryName = getCountry(input.countryCode)?.name ?? input.countryCode ?? null;
  const region = input.stateProvince?.trim() || null;

  const { error } = await supabase
    .from("profiles")
    .update({
      role: input.role,
      full_name: input.fullName?.trim() || null,
      country: countryName,
      state_province: region,
      preferred_language: input.language || "en",
      onboarding_completed: true,
    })
    .eq("user_id", user.id);

  if (error) {
    return { error: "We couldn't save your details just now. Please try again." };
  }

  if (input.role === "lawyer") {
    const licensed = countryName ? [{ country: countryName, state: region }] : [];
    // Lawyers may write these columns but not the row's owner, so update an
    // existing row without touching user_id (an upsert would rewrite it and be
    // refused), and insert only when there is none yet.
    const details = {
      practice_areas: (input.practiceAreas ?? []) as unknown as string[],
      licensed_jurisdictions: licensed,
      bar_number: input.barNumber?.trim() || null,
    };
    const updated = await supabase
      .from("lawyer_profiles")
      .update(details)
      .eq("user_id", user.id)
      .select("user_id");
    let lpErr = updated.error;
    if (!lpErr && (updated.data ?? []).length === 0) {
      ({ error: lpErr } = await supabase
        .from("lawyer_profiles")
        .insert({ user_id: user.id, ...details }));
    }
    if (lpErr) {
      return {
        error:
          "Your account is set up, but we couldn't save your professional details. You can add them from your profile.",
      };
    }
  }

  redirect("/dashboard");
}
