/**
 * Research → drafting hand-off (Phase 7). "Use in drafting" on a research
 * answer stashes the answer here; the /drafting workspace picks it up on
 * mount. sessionStorage keeps it tab-local and ephemeral — this is a courtesy
 * prefill, not state that may outlive the session.
 */

export const DRAFTING_PREFILL_KEY = "lexmind:drafting-prefill";

const MAX_CONTEXT_CHARS = 6_000;

export type DraftingPrefill = {
  /** Research context to draft from (already stripped of the sources list). */
  context: string;
};

export function saveDraftingPrefill(prefill: DraftingPrefill): void {
  try {
    sessionStorage.setItem(
      DRAFTING_PREFILL_KEY,
      JSON.stringify({ context: prefill.context.slice(0, MAX_CONTEXT_CHARS) }),
    );
  } catch {
    // Storage unavailable (private mode/quota) — the button still navigates.
  }
}

/** Reads AND clears the prefill — it is meant to be consumed exactly once. */
export function takeDraftingPrefill(): DraftingPrefill | null {
  try {
    const raw = sessionStorage.getItem(DRAFTING_PREFILL_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(DRAFTING_PREFILL_KEY);
    const parsed = JSON.parse(raw) as { context?: unknown };
    return typeof parsed.context === "string" && parsed.context
      ? { context: parsed.context }
      : null;
  } catch {
    return null;
  }
}
