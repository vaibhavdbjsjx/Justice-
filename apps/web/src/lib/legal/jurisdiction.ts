/**
 * Jurisdiction is a first-class field everywhere (Part 1 — global from day one).
 * These helpers keep formatting consistent across chat, documents, and matters.
 */

export type Jurisdiction = {
  country: string | null;
  state: string | null;
};

/** Human-readable label, e.g. "California, United States" or "United States". */
export function formatJurisdiction(j: Jurisdiction | null | undefined): string {
  if (!j || !j.country) return "Jurisdiction not set";
  if (j.state) return `${j.state}, ${j.country}`;
  return j.country;
}

/** Compact label for chips, e.g. "CA · US" style is avoided; keep it readable. */
export function shortJurisdiction(j: Jurisdiction | null | undefined): string {
  if (!j || !j.country) return "Set jurisdiction";
  if (j.state) return j.state;
  return j.country;
}

export function hasJurisdiction(j: Jurisdiction | null | undefined): boolean {
  return Boolean(j && j.country);
}
