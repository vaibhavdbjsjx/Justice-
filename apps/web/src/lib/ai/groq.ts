import "server-only";
import { AI_TIMEOUT_MS, requireOpenAiEnv } from "./env";
import {
  AiProviderError,
  type AiStreamEvent,
  type AiStreamRequest,
  type AiStructuredRequest,
} from "./types";

/**
 * Groq (OpenAI-compatible, free tier without a card). Model names change over
 * time, so the client asks Groq which models exist and works down a preference
 * list instead of hardcoding one. GROQ_MODEL pins a model when set.
 */

const TEXT_PREFERENCE = [
  "openai/gpt-oss-120b",
  "llama-3.3-70b-versatile",
  "meta-llama/llama-4-maverick-17b-128e-instruct",
  "openai/gpt-oss-20b",
  "llama-3.1-8b-instant",
];
const VISION_HINT = /(llama-4|vision|scout|maverick)/i;
const NOT_CHAT = /(whisper|tts|guard|playai|orpheus|embed|distil|compound)/i;

let cachedModels: { at: number; ids: string[] } | null = null;

async function availableModels(): Promise<string[]> {
  if (cachedModels && Date.now() - cachedModels.at < 10 * 60_000) return cachedModels.ids;
  const { apiKey, baseUrl } = requireOpenAiEnv();
  try {
    const res = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8_000),
    });
    if (res.status === 401 || res.status === 403) {
      throw new AiProviderError("Groq rejected the API key", res.status);
    }
    if (!res.ok) return TEXT_PREFERENCE;
    const json = (await res.json()) as { data?: { id: string; active?: boolean }[] };
    const ids = (json.data ?? [])
      .filter((m) => m.active !== false && !NOT_CHAT.test(m.id))
      .map((m) => m.id);
    cachedModels = { at: Date.now(), ids };
    return ids.length ? ids : TEXT_PREFERENCE;
  } catch (err) {
    if (err instanceof AiProviderError) throw err;
    return TEXT_PREFERENCE;
  }
}

async function candidates(vision: boolean): Promise<string[]> {
  const pinned = requireOpenAiEnv().model;
  const ids = await availableModels();
  if (vision) {
    const v = ids.filter((id) => VISION_HINT.test(id));
    return v.length ? v : ids;
  }
  const ordered = TEXT_PREFERENCE.filter((id) => ids.includes(id));
  const rest = ids.filter((id) => !ordered.includes(id));
  return [...new Set([pinned, ...ordered, ...rest].filter(Boolean))];
}

/** Worth trying the next model: retired, unknown, overloaded, or rate-limited. */
function tryNext(status: number): boolean {
  return status === 404 || status === 400 || status === 413 || status === 429 || status >= 500;
}

async function post(body: unknown, signal: AbortSignal): Promise<Response> {
  const { apiKey, baseUrl } = requireOpenAiEnv();
  return fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
    signal,
  });
}

async function failure(res: Response): Promise<AiProviderError> {
  const detail = await res.text().catch(() => "");
  return new AiProviderError(`Groq request failed (${res.status})`, res.status, detail.slice(0, 2000));
}

const ATTEMPTS_BUDGET_MS = 20_000;

export async function* streamGroq(req: AiStreamRequest): AsyncGenerator<AiStreamEvent> {
  const started = Date.now();
  let lastError: unknown = new AiProviderError("No Groq model available");
  for (const model of await candidates(false)) {
    if (Date.now() - started > ATTEMPTS_BUDGET_MS) break;
    const res = await post(
      {
        model,
        stream: true,
        temperature: 0.3,
        max_completion_tokens: Math.min(req.maxTokens ?? 8192, 8192),
        messages: [
          { role: "system", content: req.system },
          ...req.messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      },
      AbortSignal.timeout(AI_TIMEOUT_MS),
    ).catch((err: unknown) => err);
    if (!(res instanceof Response)) {
      lastError = res;
      console.error("[ai] groq attempt failed:", model, String(res));
      continue;
    }
    if (!res.ok || !res.body) {
      lastError = await failure(res);
      console.error("[ai] groq attempt failed:", model, (lastError as AiProviderError).detail);
      if (res.status === 401 || res.status === 403) throw lastError;
      if (tryNext(res.status)) continue;
      throw lastError;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const parsed = JSON.parse(payload) as {
              choices?: { delta?: { content?: string } }[];
              error?: { message?: string };
            };
            if (parsed.error) throw new AiProviderError("Groq stream error", undefined, parsed.error.message);
            const text = parsed.choices?.[0]?.delta?.content;
            if (text) yield { type: "text", text };
          } catch (err) {
            if (err instanceof AiProviderError) throw err;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
    return;
  }
  throw lastError;
}

async function pdfText(base64: string): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(Buffer.from(base64, "base64")));
  const { text } = await extractText(pdf, { mergePages: false });
  const pages = Array.isArray(text) ? text : [text];
  return pages.map((p, i) => `--- Page ${i + 1} ---\n${p}`).join("\n\n").slice(0, 120_000);
}

export async function completeGroq<T>(req: AiStructuredRequest): Promise<T> {
  let prompt = req.prompt;
  let image: { mediaType: string; base64: string } | null = null;
  if (req.attachment?.kind === "pdf") {
    const text = await pdfText(req.attachment.base64);
    if (!text.replace(/--- Page \d+ ---/g, "").trim()) {
      throw new AiProviderError(
        "This PDF has no selectable text",
        422,
        "Scanned PDFs need a photo or screenshot of each page instead.",
      );
    }
    prompt += `\n\nDocument "${req.attachment.filename}" (extracted text):\n\n${text}`;
  } else if (req.attachment?.kind === "image") {
    image = { mediaType: req.attachment.mediaType, base64: req.attachment.base64 };
  }

  const system =
    `${req.system}\n\nRespond with a single JSON object only, no prose or code fences, ` +
    `that matches this JSON Schema exactly:\n${JSON.stringify(req.schema)}`;

  const started = Date.now();
  let lastError: unknown = new AiProviderError("No Groq model available");
  for (const model of await candidates(Boolean(image))) {
    if (Date.now() - started > ATTEMPTS_BUDGET_MS) break;
    const res = await post(
      {
        model,
        temperature: 0.2,
        max_completion_tokens: Math.min(req.maxTokens ?? 8192, 8192),
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: image
              ? [
                  { type: "text", text: prompt },
                  { type: "image_url", image_url: { url: `data:${image.mediaType};base64,${image.base64}` } },
                ]
              : prompt,
          },
        ],
      },
      AbortSignal.timeout(AI_TIMEOUT_MS),
    ).catch((err: unknown) => err);
    if (!(res instanceof Response)) {
      lastError = res;
      continue;
    }
    if (!res.ok) {
      lastError = await failure(res);
      console.error("[ai] groq structured attempt failed:", model, (lastError as AiProviderError).detail);
      if (res.status === 401 || res.status === 403) throw lastError;
      if (tryNext(res.status)) continue;
      throw lastError;
    }
    const payload = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) {
      lastError = new AiProviderError("Groq returned no content");
      continue;
    }
    try {
      return JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, "")) as T;
    } catch {
      lastError = new AiProviderError("Groq returned malformed JSON");
    }
  }
  throw lastError;
}
