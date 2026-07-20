import type { UserRole } from "@/lib/supabase/types";

/** Shared shape submitted by the onboarding wizard (kept out of the "use server"
 *  action module, which may only export async functions). */
export type OnboardingInput = {
  role: UserRole;
  fullName: string;
  countryCode: string;
  stateProvince: string;
  language: string;
  barNumber?: string;
  practiceAreas?: string[];
};
