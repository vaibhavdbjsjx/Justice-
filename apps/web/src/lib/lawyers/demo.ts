import "server-only";
import type { LawyerProfile } from "@/lib/supabase/types";
import type { MarketplaceLawyer } from "./queries";

/** Marketplace demo fixtures (Supabase unconfigured only). */

export function demoMarketplaceLawyers(): MarketplaceLawyer[] {
  return [
    {
      userId: "00000000-0000-0000-0000-0000000000l1",
      name: "Alexandra Reyes",
      verified: true,
      practiceAreas: ["Tenant & Housing", "Contracts", "Employment"],
      licensedJurisdictions: ["California, United States"],
      rateRange: "$200–300/hr",
      ratingAvg: 4.9,
      bio: "Fifteen years helping tenants and small businesses resolve disputes without unnecessary litigation. First consultations focus on whether you actually need a lawyer.",
      country: "United States",
      state: "California",
    },
    {
      userId: "00000000-0000-0000-0000-0000000000l2",
      name: "Priya Raghunathan",
      verified: true,
      practiceAreas: ["Family", "Estate & Wills"],
      licensedJurisdictions: ["Karnataka, India"],
      rateRange: "₹3,000–5,000/hr",
      ratingAvg: 4.7,
      bio: "Family and succession matters handled with discretion — mediation-first where the family relationship can still be preserved.",
      country: "India",
      state: "Karnataka",
    },
    {
      userId: "00000000-0000-0000-0000-0000000000l3",
      name: "Daniel Okafor",
      verified: true,
      practiceAreas: ["Small Business", "Intellectual Property", "Contracts"],
      licensedJurisdictions: ["New York, United States", "New Jersey, United States"],
      rateRange: "$250–400/hr",
      ratingAvg: null,
      bio: "Counsel for founders: formation, financing paperwork, and the contracts that keep small companies out of court.",
      country: "United States",
      state: "New York",
    },
  ];
}

export function demoOwnLawyerProfile(): LawyerProfile {
  const now = new Date().toISOString();
  return {
    user_id: "00000000-0000-0000-0000-000000000000",
    practice_areas: ["Tenant & Housing", "Contracts"] as unknown as LawyerProfile["practice_areas"],
    licensed_jurisdictions: [
      { country: "United States", state: "California" },
    ] as unknown as LawyerProfile["licensed_jurisdictions"],
    bar_number: "CA-123456",
    verification_status: "pending",
    rate_range: "$200–300/hr",
    bio: "Add a short, honest bio — what you handle, how you work, and what a first consultation looks like.",
    rating_avg: null,
    created_at: now,
    updated_at: now,
  };
}
