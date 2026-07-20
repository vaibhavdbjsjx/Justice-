import "server-only";
import { OPENAI_BASE_URL, requireAiEnv } from "./env";

/**
 * Provider-agnostic streaming chat interface (server-only).
 *
 * The rest of the app talks to `streamAiChat()` and never to a vendor SDK or
 * endpoint, so the reasoning engine is swappable in this one file. Current
 * implementation: OpenAI Chat Completions over fetch + SSE (owner decision,
 * 2026-07-03 — the master spec's Part 6 names Claude; the owner supplied an
 * OpenAI key and directed its use).
 */

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

/**
 * Non-streaming multimodal completion with a strict JSON-schema response
 * (OpenAI structured outputs). Used by Document Intelligence: images go as
 * image_url parts, PDFs as file parts — both on the same endpoint.
 */
export async function completeStructured<T>(
  req: AiStructuredRequest,
): Promise<T> {
  const { apiKey, model } = requireAiEnv();

  const attachmentPart = !req.attachment
    ? null
    : req.attachment.kind === "image"
      ? {
          type: "image_url",
          image_url: {
            url: `data:${req.attachment.mediaType};base64,${req.attachment.base64}`,
          },
        }
      : {
          type: "file",
          file: {
            filename: req.attachment.filename,
            file_data: `data:application/pdf;base64,${req.attachment.base64}`,
          },
        };

  const res = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: req.maxTokens ?? 12_000,
      response_format: {
        type: "json_schema",
        json_schema: { name: req.schemaName, strict: true, schema: req.schema },
      },
      messages: [
        { role: "system", content: req.system },
        {
          role: "user",
          content: attachmentPart
            ? [{ type: "text", text: req.prompt }, attachmentPart]
            : req.prompt,
        },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new AiProviderError(
      `AI provider request failed (${res.status})`,
      res.status,
      detail.slice(0, 2000),
    );
  }

  const payload = (await res.json()) as {
    choices?: { message?: { content?: string; refusal?: string } }[];
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new AiProviderError(
      "AI provider returned no content",
      undefined,
      payload.choices?.[0]?.message?.refusal ?? undefined,
    );
  }
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new AiProviderError("AI provider returned malformed JSON");
  }
}

/**
 * Streams assistant text as an async generator of content deltas.
 * Legal information wants precision over flair → low temperature.
 */
export async function* streamAiChat(
  req: AiStreamRequest,
): AsyncGenerator<string> {
  const { apiKey, model } = requireAiEnv();

  const res = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      stream: true,
      temperature: 0.3,
      max_tokens: req.maxTokens ?? 1600,
      messages: [
        { role: "system", content: req.system },
        ...req.messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new AiProviderError(
      `AI provider request failed (${res.status})`,
      res.status,
      detail.slice(0, 2000),
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE frames are newline-delimited `data: {json}` lines.
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);

        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;

        let delta: string | undefined;
        try {
          const parsed = JSON.parse(payload) as {
            choices?: { delta?: { content?: string } }[];
          };
          delta = parsed.choices?.[0]?.delta?.content;
        } catch {
          continue; // tolerate keep-alives / partial frames
        }
        if (delta) yield delta;
      }
    }
  } finally {
    reader.releaseLock();
  }
}
