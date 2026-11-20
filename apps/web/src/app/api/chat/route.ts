import { getViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  AI_PROVIDER,
  isAiConfigured,
  isWebSearchEnabled,
} from "@/lib/ai/env";
import {
  AiProviderError,
  streamAiChat,
  type AiChatMessage,
} from "@/lib/ai/provider";
import { aiConsentRequired, needsAiConsent } from "@/lib/ai/consent";
import { STREAM_META_SEPARATOR, type StreamMeta } from "@/lib/ai/stream-meta";
import {
  buildConsumerSystemPrompt,
  buildLawyerResearchPrompt,
} from "@/lib/ai/prompts";
import { categoryLabel } from "@/lib/matters/categories";
import {
  ensureGeneralMatter,
  ensureResearchMatter,
  RESEARCH_MATTER_TITLE,
} from "@/lib/matters/default-matter";
import {
  AI_ERROR_RETRY,
  AI_MESSAGE_INVALID,
  AI_NOT_CONFIGURED,
} from "@/lib/ai/copy";
import { parseCitationsForStorage } from "@/lib/legal/citations";
import type { Json } from "@/lib/supabase/types";
import { getLicensedJurisdictions } from "@/lib/lawyers/queries";
import { getViewerTier, upgradeError } from "@/lib/billing/gate";
import {
  countChatMessagesSince,
  countChatMessagesThisMonth,
} from "@/lib/billing/usage";
import { resolveJurisdiction } from "@/lib/legal/jurisdiction";
import {
  FREE_CHAT_MESSAGES_PER_MONTH,
  UPGRADE_CHAT_LIMIT,
  UPGRADE_PROFESSIONAL,
} from "@/lib/billing/tiers";

/**
 * Consumer chat endpoint (Phase 3). Streams plain UTF-8 text.
 *
 * Persistence: when Supabase is configured, messages land in `chat_messages`
 * under the viewer's default "General consultation" matter — the user turn via
 * the user-scoped client (RLS-checked), the assistant turn via the service
 * role (the RLS design reserves assistant authorship for the server). In demo
 * mode (Supabase unconfigured) the chat works without persistence.
 *
 * Errors are always the calm copy from lib/ai/copy.ts — never raw API errors
 * (Part 8).
 */

const MAX_MESSAGE_CHARS = 8_000;
const MAX_HISTORY_MESSAGES = 30;
/** Stops runaway clients on every plan, including the unlimited one. */
const MAX_MESSAGES_PER_MINUTE = 20;

type ChatRequestBody = {
  message?: unknown;
  history?: unknown;
  /** Optional matter to scope + persist to (Phase 4); ownership is verified. */
  matterId?: unknown;
  /** "lawyer" switches to the research prompt (Phase 7); role-gated. */
  audience?: unknown;
};

function parseHistory(raw: unknown): AiChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const items: AiChatMessage[] = [];
  for (const entry of raw) {
    if (
      typeof entry === "object" &&
      entry !== null &&
      "role" in entry &&
      "content" in entry &&
      (entry.role === "user" || entry.role === "assistant") &&
      typeof entry.content === "string" &&
      entry.content.length > 0
    ) {
      items.push({
        role: entry.role,
        content: entry.content.slice(0, MAX_MESSAGE_CHARS),
      });
    }
  }
  return items.slice(-MAX_HISTORY_MESSAGES);
}

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request): Promise<Response> {
  if (!isAiConfigured) return jsonError(AI_NOT_CONFIGURED, 503);

  const viewer = await getViewer();
  if (!viewer.user || !viewer.profile) {
    return jsonError("Please sign in to use the assistant.", 401);
  }
  const { profile } = viewer;

  if (!viewer.isDemo && needsAiConsent(profile)) return aiConsentRequired();

  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return jsonError(AI_MESSAGE_INVALID, 400);
  }

  const message =
    typeof body.message === "string" ? body.message.trim() : "";
  if (!message || message.length > MAX_MESSAGE_CHARS) {
    return jsonError(AI_MESSAGE_INVALID, 400);
  }
  const history = parseHistory(body.history);
  const requestedMatterId =
    typeof body.matterId === "string" && body.matterId ? body.matterId : null;
  const audience = body.audience === "lawyer" ? "lawyer" : "consumer";

  // Research mode is for legal professionals (demo previews both roles).
  if (
    audience === "lawyer" &&
    profile.role !== "lawyer" &&
    !viewer.isDemo
  ) {
    return jsonError("Research tools are available to legal professionals.", 403);
  }

  // ---- Tier gates (Phase 10; demo previews ungated) -------------------------
  if (!viewer.isDemo && isSupabaseConfigured) {
    // Plan limits first: someone out of questions should hear how to get more,
    // not to wait a minute.
    const tier = await getViewerTier(viewer);
    if (audience === "lawyer" && tier !== "professional") {
      return upgradeError(UPGRADE_PROFESSIONAL);
    }
    if (audience === "consumer" && tier === "free") {
      const supabase = await createClient();
      const used = await countChatMessagesThisMonth(supabase, viewer.user.id);
      if (used >= FREE_CHAT_MESSAGES_PER_MONTH) {
        return upgradeError(UPGRADE_CHAT_LIMIT);
      }
    }

    const recent = await countChatMessagesSince(
      await createClient(),
      viewer.user.id,
      new Date(Date.now() - 60_000).toISOString(),
    );
    if (recent >= MAX_MESSAGES_PER_MINUTE) {
      return jsonError(
        "That's a lot of questions at once. Give it a minute and try again.",
        429,
      );
    }
  }

  // ---- Matter scope + persistence (persistence skipped in demo mode) -------
  // A named matter overrides the profile's jurisdiction (re-askable per case).
  let matterId: string | null = null;
  let matterContext: {
    title: string;
    category: string | null;
    jurisdiction_country: string | null;
    jurisdiction_state: string | null;
  } | null = null;
  let matterDocuments: { title: string; summary: string }[] = [];
  let licensedJurisdictions: string[] = [];

  if (isSupabaseConfigured && !viewer.isDemo) {
    try {
      const supabase = await createClient();

      if (audience === "lawyer") {
        // Research chat lives in the lawyer's research workspace matter.
        matterId = await ensureResearchMatter(supabase, viewer.user.id, profile);
        licensedJurisdictions = await getLicensedJurisdictions(
          supabase,
          viewer.user.id,
        );
      } else if (requestedMatterId) {
        // RLS + the explicit owner filter reject matters that aren't theirs.
        const { data: matter } = await supabase
          .from("matters")
          .select("id, title, category, jurisdiction_country, jurisdiction_state")
          .eq("id", requestedMatterId)
          .eq("user_id", viewer.user.id)
          .maybeSingle();
        if (!matter) return jsonError("That matter isn't available.", 404);
        matterId = matter.id;
        matterContext = matter;

        // Analyzed documents give the assistant matter-document context
        // (Part 4.1). Summaries only — full text would blow the budget.
        const { data: docs } = await supabase
          .from("documents")
          .select("title, ai_annotations")
          .eq("matter_id", matter.id)
          .order("created_at", { ascending: false })
          .limit(3);
        matterDocuments = (docs ?? []).flatMap((d) => {
          const summary = (
            d.ai_annotations as { plain_language_summary?: string } | null
          )?.plain_language_summary;
          return summary ? [{ title: d.title ?? "Document", summary }] : [];
        });
      } else {
        matterId = await ensureGeneralMatter(supabase, viewer.user.id, profile);
      }

      const { error: insertError } = await supabase
        .from("chat_messages")
        .insert({
          matter_id: matterId,
          user_id: viewer.user.id,
          role: "user",
          content: message,
        });
      if (insertError) throw insertError;
    } catch (err) {
      // A storage hiccup must not take the assistant down — answer anyway.
      console.error("[chat] failed to persist user message:", err);
      matterId = null;
    }
  } else if (requestedMatterId && audience === "consumer") {
    // Demo mode: matter fixtures still provide prompt context (unpersisted).
    const { demoMatterDetail } = await import("@/lib/matters/demo");
    const demo = demoMatterDetail(requestedMatterId);
    if (demo) {
      matterContext = demo.matter;
      const { demoDocumentList } = await import("@/lib/documents/demo");
      matterDocuments = demoDocumentList()
        .filter((d) => d.matter_id === requestedMatterId)
        .slice(0, 3)
        .flatMap((d) => {
          const summary = (
            d.ai_annotations as { plain_language_summary?: string } | null
          )?.plain_language_summary;
          return summary ? [{ title: d.title ?? "Document", summary }] : [];
        });
    }
  }

  // Grounding needs Gemini's native client; other providers answer from the model.
  const webSearch = isWebSearchEnabled && AI_PROVIDER === "gemini";

  const system =
    audience === "lawyer"
      ? buildLawyerResearchPrompt({
          jurisdiction: {
            country: profile.country,
            state: profile.state_province,
          },
          licensedJurisdictions,
          matterTitle: RESEARCH_MATTER_TITLE,
          webSearch,
        })
      : buildConsumerSystemPrompt({
          jurisdiction: resolveJurisdiction(matterContext, profile),
          preferredLanguage: profile.preferred_language,
          matterTitle: matterContext?.title ?? null,
          matterCategory: matterContext
            ? categoryLabel(matterContext.category)
            : null,
          documents: matterDocuments,
          webSearch,
        });

  // ---- Stream the model response -------------------------------------------
  try {
    const upstream = streamAiChat({
      system,
      messages: [...history, { role: "user", content: message }],
      webSearch,
    });
    // Surface pre-stream failures (bad key, quota) as a clean JSON error
    // instead of an empty 200 stream.
    const first = await upstream.next();

    const encoder = new TextEncoder();
    const persistMatterId = matterId;
    const userId = viewer.user.id;
    let assistantText = "";
    let meta: StreamMeta | null = null;
    let clientGone = false;

    const take = (event: (typeof first)["value"], send: (t: string) => void) => {
      if (typeof event !== "object" || event === null) return;
      if (event.type === "text") {
        assistantText += event.text;
        send(event.text);
      } else {
        meta = {
          sources: event.sources,
          searchSuggestionsHtml: event.searchSuggestionsHtml,
        };
      }
    };

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        // Leaving the screen mustn't lose the answer: keep reading so it can be
        // saved, and find it in the conversation on return.
        const send = (text: string) => {
          if (clientGone) return;
          try {
            controller.enqueue(encoder.encode(text));
          } catch {
            clientGone = true;
          }
        };

        let failed = false;
        try {
          if (!first.done) take(first.value, send);
          for await (const event of upstream) take(event, send);
        } catch (err) {
          // Mid-stream failure: end the stream with an error so the client
          // shows the calm retry state; the partial text stays visible.
          console.error("[chat] stream interrupted:", err);
          failed = true;
        }

        // Save before finishing the response: a serverless function can be
        // frozen the moment its response ends.
        if (persistMatterId && assistantText) {
          try {
            const refs =
              audience === "lawyer"
                ? parseCitationsForStorage(assistantText)
                : null;
            const citations =
              meta || refs ? { ...(meta ?? {}), ...(refs ? { refs } : {}) } : null;
            const admin = createAdminClient();
            await admin.from("chat_messages").insert({
              matter_id: persistMatterId,
              user_id: userId,
              role: "assistant",
              content: assistantText,
              citations: citations as unknown as Json,
            });
          } catch (err) {
            console.error("[chat] failed to persist assistant message:", err);
          }
        }

        if (clientGone) return;
        if (failed) {
          controller.error(new Error(AI_ERROR_RETRY));
          return;
        }
        if (meta) send(STREAM_META_SEPARATOR + JSON.stringify(meta));
        controller.close();
      },
      cancel() {
        clientGone = true;
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        ...(matterId ? { "x-lexa-matter-id": matterId } : {}),
      },
    });
  } catch (err) {
    if (err instanceof AiProviderError) {
      console.error("[chat] provider error:", err.status, err.detail);
    } else {
      console.error("[chat] unexpected error:", err);
    }
    return jsonError(AI_ERROR_RETRY, 502);
  }
}
