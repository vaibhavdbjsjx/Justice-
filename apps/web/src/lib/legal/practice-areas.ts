/** Common practice areas for lawyer onboarding + marketplace filtering (Part 4.3). */
export const PRACTICE_AREAS = [
  "Tenant & Housing",
  "Employment",
  "Family",
  "Contracts",
  "Immigration",
  "Criminal Defense",
  "Personal Injury",
  "Small Business",
  "Intellectual Property",
  "Estate & Wills",
  "Consumer Rights",
  "Bankruptcy",
  "Civil Litigation",
  "Real Estate",
  "Tax",
  "Immigration & Asylum",
] as const;

export type PracticeArea = (typeof PRACTICE_AREAS)[number];
