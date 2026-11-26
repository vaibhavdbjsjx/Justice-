import "server-only";
import { AI_PROVIDER, AI_TIMEOUT_MS, requireOpenAiEnv } from "./env";
import { completeGemini, streamGemini } from "./gemini";
import { completeGroq, streamGroq } from "./groq";
import {
  AiProviderError,
  type AiStreamEvent,
  type AiStreamRequest,
  type AiStructuredRequest,
} from "./types";

export { AiProviderError } from "./types";
export type {
  AiAttachment,
  AiChatMessage,
  AiSource,
  AiStreamEvent,
  AiStreamRequest,
  AiStructuredRequest,
} from "./types";

/**
 * Provider-agnostic AI interface (server-only). The rest of the app talks to
 * `streamAiChat()` and `completeStructured()` and never to a vendor, so swapping
 * the reasoning engine is an env change (see env.ts). Gemini has its own client
 * in gemini.ts; OpenAI and any compatible endpoint use Chat Completions here.
 */

/** Newer OpenAI models reject a custom temperature; only older ones take it. */
function temperatureFor(model: string, temperature: number) {
  return /^gpt-4/.test(model) ? { temperature } : {};
}

/**
 * Non-streaming multimodal completion with a strict JSON-schema response. Used
 * by Document Intelligence and generation.
 */
export async function completeStructured<T>(
  req: AiStructuredRequest,
): Promise<T> {
  if (AI_PROVIDER === "gemini") return completeGemini<T>(req);
  if (AI_PROVIDER === "groq") return completeGroq<T>(req);

  const { apiKey, model, baseUrl } = requireOpenAiEnv();

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

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    body: JSON.stringify({
      model,
      ...temperatureFor(model, 0.2),
      max_completion_tokens: req.maxTokens ?? 32_000,
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
 * Streams an assistant answer: text deltas, then (for grounded answers) the
 * sources it drew on. Legal information wants precision over flair.
 */
export async function* streamAiChat(
  req: AiStreamRequest,
): AsyncGenerator<AiStreamEvent> {
  if (AI_PROVIDER === "gemini") {
    yield* streamGemini(req, req.webSearch ?? false);
    return;
  }
  if (AI_PROVIDER === "groq") {
    yield* streamGroq(req);
    return;
  }

  const { apiKey, model, baseUrl } = requireOpenAiEnv();

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      stream: true,
      ...temperatureFor(model, 0.3),
      max_completion_tokens: req.maxTokens ?? 8192,
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
        if (delta) yield { type: "text", text: delta };
      }
    }
  } finally {
    reader.releaseLock();
  }
}
