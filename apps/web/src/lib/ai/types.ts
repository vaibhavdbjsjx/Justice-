/** Shared AI layer types, free of vendor code so every provider can import them. */

export type AiChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AiStreamRequest = {
  /** System prompt (see prompts.ts — jurisdiction/compliance framing). */
  system: string;
  /** Conversation so far, oldest first, ending with the new user message. */
  messages: AiChatMessage[];
  maxTokens?: number;
  /** Let the model ground this answer in live web sources where supported. */
  webSearch?: boolean;
};

/** A web page the model actually drew on for a grounded answer. */
export type AiSource = { url: string; title: string | null };

export type AiStreamEvent =
  | { type: "text"; text: string }
  | {
      type: "sources";
      sources: AiSource[];
      /**
       * Google's Search Suggestions widget. Google's terms require it to be shown
       * unmodified alongside any grounded answer, so it travels with the sources.
       */
      searchSuggestionsHtml: string | null;
    };

/** One attachment for multimodal requests (document intelligence). */
export type AiAttachment =
  | { kind: "image"; mediaType: string; base64: string }
  | { kind: "pdf"; filename: string; base64: string };

export type AiStructuredRequest = {
  system: string;
  /** The user instruction (accompanying the attachment, when present). */
  prompt: string;
  /** Optional document/image input; omit for text-only structured calls. */
  attachment?: AiAttachment;
  /** Strict JSON schema the reply must satisfy. */
  schemaName: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
};

/** Raised for any upstream failure. Route handlers must map this to calm,
 * professional copy (Part 8) — never surface `detail` to the client. */
export class AiProviderError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly detail?: string,
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}
