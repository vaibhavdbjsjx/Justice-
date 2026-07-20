/**
 * Canonical compliance copy for LexMind (Part 1 — load-bearing framing).
 *
 * This is the SINGLE source of truth for every legal disclaimer, notice, and
 * "you may need a lawyer" nudge in the product. Components must import from
 * here rather than hard-coding legal text, so the framing stays consistent and
 * cannot drift. This is product logic, not a cosmetic footer (Part 1).
 *
 * Rule: every consumer-facing AI legal output MUST be accompanied by, at
 * minimum, DISCLAIMER_SHORT (Part 10 hard requirement). The <AiLegalOutput>
 * wrapper enforces this so it can never be forgotten.
 */

/** One-line disclaimer for compact contexts (chips, captions, message footers). */
export const DISCLAIMER_SHORT = "Legal information, not legal advice.";

/** Full disclaimer for banners and the first message of any legal surface. */
export const DISCLAIMER_FULL =
  "LexMind provides legal information to help you understand your situation and options — it is not legal advice. Using LexMind does not create an attorney–client relationship. Laws vary by jurisdiction and change over time; confirm anything important with a licensed lawyer in your area before you act, sign, or file.";

/** Explicit attorney–client statement (Part 1). */
export const ATTORNEY_CLIENT_NOTICE =
  "Using LexMind does not create an attorney–client relationship.";

/** Shown on every generated document (Part 4.1 / Phase 6). */
export const REVIEW_BEFORE_USE_TITLE = "Review before use";
export const REVIEW_BEFORE_USE_BODY =
  "This document was drafted with AI assistance from the information you provided. It is a starting point, not a finished legal instrument. Have a licensed lawyer in the relevant jurisdiction review it before you sign, send, or file it.";

/** Shown on the public intake form (Part 4.3 / Phase 8). */
export const INTAKE_NOTICE =
  "This form sends your information to the lawyer who shared this link so they can review your situation. Submitting it does not create an attorney–client relationship — that happens only if the lawyer agrees to take you on. Do not include information you are not comfortable sharing.";

/** Lawyer-side research notice (Part 4.3 / Part 8) — citation discipline. */
export const RESEARCH_ACCELERATOR_NOTICE =
  "AI research accelerator — an aid to your work, not a substitute for your professional judgment. Verify every citation and confirm it remains good law before relying on it.";

/** Shown when the AI is uncertain how a rule applies in a jurisdiction (Part 1). */
export const JURISDICTION_UNCERTAINTY_NOTICE =
  "Rules for this jurisdiction may vary or be unclear. Treat this as general information and confirm specifics with a local lawyer.";

/**
 * High-stakes matter categories where the product should actively recommend a
 * licensed lawyer rather than just answering (Part 8 consumer prompt guideline).
 * Used by the "Do I need a lawyer?" logic and to escalate the disclaimer tone.
 */
export const HIGH_STAKES_CATEGORIES = [
  "criminal",
  "family", // custody, divorce
  "immigration",
  "medical-malpractice",
  "personal-injury-serious",
  "bankruptcy",
] as const;

export type HighStakesCategory = (typeof HIGH_STAKES_CATEGORIES)[number];

/** Keyword hints that, if present in a matter, should raise a stronger nudge. */
export const HIGH_STAKES_KEYWORDS = [
  "arrest",
  "arrested",
  "criminal",
  "custody",
  "deport",
  "immigration",
  "eviction hearing",
  "restraining order",
  "lawsuit",
  "sued",
  "court date",
  "warrant",
] as const;

export function isHighStakesCategory(
  category: string | null | undefined,
): category is HighStakesCategory {
  if (!category) return false;
  return (HIGH_STAKES_CATEGORIES as readonly string[]).includes(category);
}

/** Heuristic: does this free-text situation smell high-stakes enough to nudge? */
export function looksHighStakes(text: string | null | undefined): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return HIGH_STAKES_KEYWORDS.some((k) => lower.includes(k));
}

export const PROFESSIONAL_HELP_NUDGE =
  "This looks like it could carry significant consequences. Consider speaking with a licensed lawyer in your jurisdiction before taking action — LexMind can help you find one.";
