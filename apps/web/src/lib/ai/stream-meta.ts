import type { AiSource } from "./types";

/**
 * /api/chat streams plain text. Grounded answers end with this separator and a
 * JSON payload carrying their sources, so plain-text streaming keeps working and
 * clients only have to split the tail. U+001E is a control character that never
 * appears in model prose.
 */
export const STREAM_META_SEPARATOR = "\u001e";

export type StreamMeta = {
  sources: AiSource[];
  searchSuggestionsHtml: string | null;
};

export function splitStreamMeta(raw: string): {
  text: string;
  meta: StreamMeta | null;
} {
  const index = raw.indexOf(STREAM_META_SEPARATOR);
  if (index === -1) return { text: raw, meta: null };
  const text = raw.slice(0, index);
  try {
    return { text, meta: JSON.parse(raw.slice(index + 1)) as StreamMeta };
  } catch {
    // Still arriving, or unreadable: never leak the payload into the answer.
    return { text, meta: null };
  }
}

/** Reads grounded sources back from a stored chat_messages.citations value. */
export function metaFromStored(citations: unknown): StreamMeta | null {
  if (typeof citations !== "object" || citations === null) return null;
  const { sources, searchSuggestionsHtml } = citations as Partial<StreamMeta>;
  if (!Array.isArray(sources) && !searchSuggestionsHtml) return null;
  return {
    sources: Array.isArray(sources) ? sources : [],
    searchSuggestionsHtml: searchSuggestionsHtml ?? null,
  };
}
