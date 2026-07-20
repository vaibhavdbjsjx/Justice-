/**
 * Consumer-facing matter categories (Part 4.1). Stored in `matters.category`
 * as stable slugs; labels are display-only. Slugs deliberately align with
 * HIGH_STAKES_CATEGORIES in lib/legal/disclaimers.ts ("criminal", "family",
 * "immigration", "bankruptcy") so category alone can escalate the
 * professional-help nudge.
 */

export type MatterCategory = {
  value: string;
  label: string;
};

export const MATTER_CATEGORIES: MatterCategory[] = [
  { value: "tenant-housing", label: "Tenant & Housing" },
  { value: "employment", label: "Employment & Workplace" },
  { value: "contracts", label: "Contracts & Agreements" },
  { value: "consumer", label: "Consumer Rights" },
  { value: "small-claims", label: "Small Claims & Money Owed" },
  { value: "family", label: "Family" },
  { value: "immigration", label: "Immigration" },
  { value: "criminal", label: "Criminal" },
  { value: "personal-injury", label: "Personal Injury" },
  { value: "estate", label: "Estate & Wills" },
  { value: "business", label: "Small Business" },
  { value: "bankruptcy", label: "Debt & Bankruptcy" },
  { value: "other", label: "Something else" },
];

/** The lazily created home of /chat history (Phase 3). Not user-pickable. */
export const GENERAL_CATEGORY = "general";

export function categoryLabel(value: string | null | undefined): string {
  if (!value) return "Uncategorized";
  if (value === GENERAL_CATEGORY) return "General consultation";
  return (
    MATTER_CATEGORIES.find((c) => c.value === value)?.label ?? "Uncategorized"
  );
}

export function isKnownCategory(value: string): boolean {
  return MATTER_CATEGORIES.some((c) => c.value === value);
}
