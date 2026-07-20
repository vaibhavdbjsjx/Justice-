/**
 * Citation parsing for lawyer-side research (Phase 7, Part 4.3).
 *
 * The research prompt ends every substantive answer with a "## Sources"
 * section — a numbered list, one authority per line, each marked "[verify]"
 * (no live citator is wired; Part 6 defers provider selection). This module
 * is the ONE parser for that section, shared by the /api/chat route (which
 * persists structured refs into chat_messages.citations) and the client
 * (which renders them as <CitationList> cards instead of raw markdown).
 *
 * Isomorphic on purpose: no server-only imports.
 */

export type CitationType = "case" | "statute" | "regulation" | "secondary";

/** Display-ready citation for <SourceCitation> / <CitationList>. */
export type Citation = {
  id: string;
  type: CitationType;
  title: string;
  /** e.g. citation string "347 U.S. 483 (1954)" or "29 U.S.C. § 201". */
  reference?: string;
  jurisdiction?: string;
  url?: string;
  snippet?: string;
};

/** Stored shape for chat_messages.citations (Part 7 schema). `ref` keeps the
 * model's line verbatim (including "[verify]") — storage preserves fidelity,
 * display cleans it up. */
export type StoredCitation = { ref: string; type: CitationType };

const SOURCES_HEADING = /(^|\n)#{2,3}\s*Sources\b[^\n]*(\n|$)/i;
const NUMBERED_LINE = /^\d{1,3}[.)]\s+(.+)$/;
const BULLET_LINE = /^[-*•]\s+(.+)$/;
const VERIFY_TAG = /\s*[\[(]\s*verify\s*[\])]/gi;

/**
 * Splits an assistant message into the answer body and the raw source lines.
 * While `streaming`, a trailing line that hasn't been terminated by a newline
 * yet is held back so half-written citations never flash into cards.
 */
export function splitSources(
  content: string,
  opts?: { streaming?: boolean },
): { body: string; refs: string[] } {
  const match = SOURCES_HEADING.exec(content);
  if (!match) return { body: content, refs: [] };

  const body = content.slice(0, match.index).trimEnd();
  const tail = content.slice(match.index + match[0].length);

  const lines = tail.split("\n");
  if (opts?.streaming && !tail.endsWith("\n")) lines.pop();

  const refs: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (/^#{1,6}\s/.test(line)) break; // a later section ends the list
    const m = NUMBERED_LINE.exec(line) ?? BULLET_LINE.exec(line);
    if (m) refs.push(m[1].trim());
  }
  return { body, refs };
}

/** Secondary authority beats the "§" statute hint (e.g. Restatements). */
const SECONDARY_HINTS =
  /\brestatement\b|\bl(aw)?\.?\s?rev(iew)?\b|\btreatise\b|\bwilliston\b|\bcorbin\b|\bhalsbury\b|\bblack'?s law\b|\bpractice guide\b|\bam\.? ?jur\.?\b|\bc\.?j\.?s\.?\b/i;

const REGULATION_HINTS =
  /\bC\.?F\.?R\.?\b|\bFed\.?\s?Reg\.?\b|\bregulations?\b|\badministrative code\b|\bS\.I\.\s?\d|\bG\.S\.R\.|\bdirective\s+\d|\brules?\s+of\s+(court|procedure|practice)\b/i;

const STATUTE_HINTS =
  /§|\bU\.?S\.?C\.?\b|\bstatutes?\b|\bcode\b|\bact\b|\barticle\s+\d|\bsection\s+\d|\bconstitution\b|\bamendment\b|\bpenal\b|\bcivil procedure\b/i;

// Case law: "v." is the strong signal (case-sensitive — "Roe v. Wade"), plus
// procedural styles and common reporter abbreviations across jurisdictions.
const CASE_HINTS = [
  /\bv\.?\s+[A-Z(]/, // lowercase v between party names
  /\bIn re\b/i,
  /\bEx parte\b/i,
  /\bMatter of\b/i,
  /\d+\s+(U\.S\.|S\.\s?Ct\.|F\.\s?(2d|3d|4th)|F\.\s?Supp|P\.\s?(2d|3d)|N\.[EWY]\.|A\.\s?(2d|3d)|S\.[EW]\.|So\.|Cal\.|SCC\b|All\s?ER|A\.?C\.\b|Q\.?B\.\b|EWCA|EWHC|UKSC|UKHL|SCR\b)/,
  // Reporter-first styles: "AIR 1973 SC 1461", "(2017) 10 SCC 1", "[2019] UKSC 41".
  /\bAIR\s+\d{4}\b/,
  /[([]\d{4}[)\]]\s*\d*\s*(SCC|SCR|UKSC|UKHL|EWCA|EWHC|AC|QB|All\s?ER)\b/,
];

export function classifyCitation(text: string): CitationType {
  if (CASE_HINTS.some((re) => re.test(text))) return "case";
  if (REGULATION_HINTS.test(text)) return "regulation";
  if (SECONDARY_HINTS.test(text)) return "secondary";
  if (STATUTE_HINTS.test(text)) return "statute";
  return "secondary";
}

/**
 * Where "Verify source" points. No legal database is wired (deferred, Part 6),
 * so verification honestly links to a search: Google Scholar's case-law corpus
 * for cases, a plain web search for everything else.
 */
export function verifyUrl(type: CitationType, citation: string): string {
  const q = encodeURIComponent(citation);
  return type === "case"
    ? `https://scholar.google.com/scholar?as_sdt=2006&q=${q}`
    : `https://www.google.com/search?q=${q}`;
}

/** One raw "## Sources" line → a display-ready citation card. */
export function toCitation(rawRef: string, index: number): Citation {
  const clean = rawRef.replace(VERIFY_TAG, "").trim();

  // "Authority — what it stands for" (em/en dash or spaced hyphen separator).
  const sep = clean.match(/\s+[—–]\s+|\s+--\s+|\s+-\s+/);
  const title = sep ? clean.slice(0, sep.index).trim() : clean;
  const snippet = sep
    ? clean.slice((sep.index ?? 0) + sep[0].length).trim()
    : undefined;

  const type = classifyCitation(clean);
  return {
    id: `citation-${index}`,
    type,
    title: title || clean,
    snippet: snippet || undefined,
    url: verifyUrl(type, title || clean),
  };
}

/** Full-message parse for persistence (chat_messages.citations). */
export function parseCitationsForStorage(
  content: string,
): StoredCitation[] | null {
  const { refs } = splitSources(content);
  if (refs.length === 0) return null;
  return refs.map((ref) => ({ ref, type: classifyCitation(ref) }));
}
