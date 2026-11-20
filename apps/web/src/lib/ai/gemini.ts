import "server-only";
import { AI_TIMEOUT_MS, requireGeminiEnv } from "./env";
import {
  AiProviderError,
  type AiAttachment,
  type AiSource,
  type AiStreamEvent,
  type AiStreamRequest,
  type AiStructuredRequest,
} from "./types";

/**
 * Native Gemini client. Google's OpenAI-compatible endpoint doesn't document PDF
 * input or web grounding, both of which Lexa needs, so this talks to the
 * Interactions API (Google's recommended surface) and falls back to the legacy
 * generateContent API, which Google still fully supports.
 *
 * Model retirement must never take the assistant down: a missing model moves to
 * the next candidate, and a rejected feature retries without it.
 */

const API_REVISION = "2026-05-20";

function headers(apiKey: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-goog-api-key": apiKey,
    "Api-Revision": API_REVISION,
  };
}

async function failure(res: Response, label: string): Promise<AiProviderError> {
  const detail = await res.text().catch(() => "");
  return new AiProviderError(
    `${label} failed (${res.status})`,
    res.status,
    detail.slice(0, 2000),
  );
}

/** Reads `data:` payloads from a server-sent event stream. */
async function* sseEvents(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<Record<string, unknown>> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          yield JSON.parse(payload) as Record<string, unknown>;
        } catch {
          // Tolerate keep-alives and partial frames.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/** Collects de-duplicated citations and Google's Search Suggestions widget. */
class SourceCollector {
  private byUrl = new Map<string, AiSource>();
  suggestionsHtml: string | null = null;

  add(url: unknown, title: unknown) {
    if (typeof url !== "string" || !url || this.byUrl.has(url)) return;
    this.byUrl.set(url, {
      url,
      title: typeof title === "string" && title ? title : null,
    });
  }

  addAnnotations(annotations: unknown) {
    if (!Array.isArray(annotations)) return;
    for (const a of annotations as Record<string, unknown>[]) {
      if (a?.type === "url_citation") this.add(a.url, a.title);
    }
  }

  setSuggestions(html: unknown) {
    if (typeof html === "string" && html.trim()) this.suggestionsHtml = html;
  }

  /** Reads what a finished step carries, for streams that batch it at the end. */
  addStep(step: Record<string, unknown> | undefined) {
    if (!step) return;
    if (step.type === "google_search_result") {
      this.setSuggestions(step.search_suggestions);
    }
    if (Array.isArray(step.content)) {
      for (const block of step.content as Record<string, unknown>[]) {
        this.addAnnotations(block?.annotations);
      }
    }
  }

  event(): AiStreamEvent | null {
    if (this.byUrl.size === 0 && !this.suggestionsHtml) return null;
    return {
      type: "sources",
      sources: [...this.byUrl.values()],
      searchSuggestionsHtml: this.suggestionsHtml,
    };
  }
}

// ---- Interactions API ------------------------------------------------------

function toSteps(req: AiStreamRequest) {
  return req.messages.map((m) => ({
    type: m.role === "user" ? "user_input" : "model_output",
    content: [{ type: "text", text: m.content }],
  }));
}

async function* streamInteractions(
  model: string,
  req: AiStreamRequest,
  webSearch: boolean,
): AsyncGenerator<AiStreamEvent> {
  const { apiKey, baseUrl } = requireGeminiEnv();
  const res = await fetch(`${baseUrl}/interactions?alt=sse`, {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify({
      model,
      stream: true,
      store: false,
      system_instruction: req.system,
      input: toSteps(req),
      generation_config: { max_output_tokens: req.maxTokens ?? 8192 },
      ...(webSearch ? { tools: [{ type: "google_search" }] } : {}),
    }),
  });
  if (!res.ok || !res.body) throw await failure(res, "Gemini interaction");

  const sources = new SourceCollector();
  for await (const event of sseEvents(res.body)) {
    switch (event.event_type) {
      case "step.delta": {
        const delta = event.delta as Record<string, unknown> | undefined;
        if (delta?.type === "text" && typeof delta.text === "string") {
          if (delta.text) yield { type: "text", text: delta.text };
        } else if (delta?.type === "text_annotation_delta") {
          sources.addAnnotations(delta.annotations);
        } else if (delta?.type === "google_search_result") {
          sources.setSuggestions(delta.search_suggestions);
        }
        break;
      }
      case "step.start":
        sources.addStep(event.step as Record<string, unknown> | undefined);
        break;
      case "interaction.completed": {
        const interaction = event.interaction as
          | { steps?: Record<string, unknown>[] }
          | undefined;
        for (const step of interaction?.steps ?? []) sources.addStep(step);
        break;
      }
      case "error": {
        const error = event.error as { message?: string } | undefined;
        throw new AiProviderError("Gemini stream error", undefined, error?.message);
      }
    }
  }
  const final = sources.event();
  if (final) yield final;
}

async function completeInteractions<T>(
  model: string,
  req: AiStructuredRequest,
): Promise<T> {
  const { apiKey, baseUrl } = requireGeminiEnv();
  const res = await fetch(`${baseUrl}/interactions`, {
    method: "POST",
    headers: headers(apiKey),
    signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    body: JSON.stringify({
      model,
      store: false,
      system_instruction: req.system,
      input: [
        {
          type: "user_input",
          content: [
            { type: "text", text: req.prompt },
            ...(req.attachment ? [interactionPart(req.attachment)] : []),
          ],
        },
      ],
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: req.schema,
      },
      generation_config: { max_output_tokens: req.maxTokens ?? 32_000 },
    }),
  });
  if (!res.ok) throw await failure(res, "Gemini interaction");

  const payload = (await res.json()) as {
    status?: string;
    steps?: { type?: string; content?: { type?: string; text?: string }[] }[];
  };
  if (payload.status && payload.status !== "completed") {
    throw new AiProviderError(`Gemini interaction ended: ${payload.status}`);
  }
  const text = (payload.steps ?? [])
    .filter((s) => s.type === "model_output")
    .flatMap((s) => s.content ?? [])
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("");
  return parseJson<T>(text);
}

function interactionPart(attachment: AiAttachment) {
  return attachment.kind === "pdf"
    ? {
        type: "document",
        mime_type: "application/pdf",
        data: attachment.base64,
      }
    : {
        type: "image",
        mime_type: attachment.mediaType,
        data: attachment.base64,
      };
}

// ---- generateContent (legacy, fully supported) -----------------------------

function toContents(req: AiStreamRequest) {
  return req.messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}

type GenerateCandidate = {
  finishReason?: string;
  content?: { parts?: { text?: string; thought?: boolean }[] };
  groundingMetadata?: {
    groundingChunks?: { web?: { uri?: string; title?: string } }[];
    searchEntryPoint?: { renderedContent?: string };
  };
};

async function* streamGenerateContent(
  model: string,
  req: AiStreamRequest,
  webSearch: boolean,
): AsyncGenerator<AiStreamEvent> {
  const { apiKey, baseUrl } = requireGeminiEnv();
  const res = await fetch(
    `${baseUrl}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
    {
      method: "POST",
      headers: headers(apiKey),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: req.system }] },
        contents: toContents(req),
        generationConfig: { maxOutputTokens: req.maxTokens ?? 8192 },
        ...(webSearch ? { tools: [{ google_search: {} }] } : {}),
      }),
    },
  );
  if (!res.ok || !res.body) throw await failure(res, "Gemini generateContent");

  const sources = new SourceCollector();
  for await (const event of sseEvents(res.body)) {
    const candidate = (event.candidates as GenerateCandidate[] | undefined)?.[0];
    for (const part of candidate?.content?.parts ?? []) {
      if (part.text && !part.thought) yield { type: "text", text: part.text };
    }
    for (const chunk of candidate?.groundingMetadata?.groundingChunks ?? []) {
      sources.add(chunk.web?.uri, chunk.web?.title);
    }
    sources.setSuggestions(
      candidate?.groundingMetadata?.searchEntryPoint?.renderedContent,
    );
  }
  const final = sources.event();
  if (final) yield final;
}

async function completeGenerateContent<T>(
  model: string,
  req: AiStructuredRequest,
): Promise<T> {
  const { apiKey, baseUrl } = requireGeminiEnv();
  const inline = req.attachment
    ? [
        {
          inlineData: {
            mimeType:
              req.attachment.kind === "pdf"
                ? "application/pdf"
                : req.attachment.mediaType,
            data: req.attachment.base64,
          },
        },
      ]
    : [];
  const res = await fetch(
    `${baseUrl}/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: headers(apiKey),
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [{ role: "user", parts: [{ text: req.prompt }, ...inline] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: req.schema,
          maxOutputTokens: req.maxTokens ?? 32_000,
        },
      }),
    },
  );
  if (!res.ok) throw await failure(res, "Gemini generateContent");

  const payload = (await res.json()) as { candidates?: GenerateCandidate[] };
  const candidate = payload.candidates?.[0];
  if (candidate?.finishReason === "MAX_TOKENS") {
    throw new AiProviderError("Gemini response was cut off (MAX_TOKENS)");
  }
  const text = (candidate?.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? "")
    .join("");
  return parseJson<T>(text);
}

function parseJson<T>(text: string): T {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/, "")
    .trim();
  if (!trimmed) throw new AiProviderError("Gemini returned no content");
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw new AiProviderError("Gemini returned malformed JSON");
  }
}

// ---- Public surface --------------------------------------------------------

/** A retired, renamed, or otherwise unavailable model: worth trying the next. */
function isModelUnavailable(err: unknown): boolean {
  return (
    err instanceof AiProviderError &&
    (err.status === 404 || (err.status !== undefined && err.status >= 500))
  );
}

/** A bad or unauthorized key won't be fixed by retrying anything. */
function isAuthFailure(err: unknown): boolean {
  return (
    err instanceof AiProviderError && (err.status === 401 || err.status === 403)
  );
}

/**
 * Streams an answer, working down the model list and from the richest request
 * to the plainest. Only failures before the first token can fall through; once
 * text has reached the user, an error surfaces so nothing is silently replaced.
 */
export async function* streamGemini(
  req: AiStreamRequest,
  webSearch: boolean,
): AsyncGenerator<AiStreamEvent> {
  const { models } = requireGeminiEnv();
  const attempts = (model: string) => [
    ...(webSearch ? [() => streamInteractions(model, req, true)] : []),
    () => streamInteractions(model, req, false),
    () => streamGenerateContent(model, req, false),
  ];

  let lastError: unknown = new AiProviderError("No Gemini model available");
  for (const model of models) {
    for (const attempt of attempts(model)) {
      const iterator = attempt();
      let first: IteratorResult<AiStreamEvent>;
      try {
        first = await iterator.next();
      } catch (err) {
        lastError = err;
        console.error("[ai] gemini attempt failed:", model, describe(err));
        if (isAuthFailure(err)) throw err;
        if (isModelUnavailable(err)) break;
        continue;
      }
      if (first.done) {
        lastError = new AiProviderError("Gemini returned an empty response");
        continue;
      }
      yield first.value;
      yield* iterator;
      return;
    }
  }
  throw lastError;
}

export async function completeGemini<T>(req: AiStructuredRequest): Promise<T> {
  const { models } = requireGeminiEnv();
  let lastError: unknown = new AiProviderError("No Gemini model available");
  for (const model of models) {
    for (const attempt of [completeInteractions<T>, completeGenerateContent<T>]) {
      try {
        return await attempt(model, req);
      } catch (err) {
        lastError = err;
        console.error("[ai] gemini structured attempt failed:", model, describe(err));
        if (isAuthFailure(err) || isTimeout(err)) throw err;
        if (isModelUnavailable(err)) break;
      }
    }
  }
  throw lastError;
}

function isTimeout(err: unknown): boolean {
  return err instanceof DOMException && err.name === "TimeoutError";
}

function describe(err: unknown): string {
  if (err instanceof AiProviderError) {
    return `${err.message} ${err.detail ?? ""}`.trim();
  }
  return err instanceof Error ? err.message : String(err);
}
