"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUp, Check, Copy, PenLine, Scale, Square } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { DisclaimerBanner } from "@/components/compliance/disclaimer-banner";
import { AiLegalOutput } from "@/components/compliance/ai-legal-output";
import { CitationList } from "@/components/compliance/source-citation";
import { splitSources, toCitation } from "@/lib/legal/citations";
import { saveDraftingPrefill } from "@/lib/drafting/prefill";
import { ChatMarkdown } from "./chat-markdown";
import {
  RESEARCH_SUGGESTIONS,
  SUGGESTED_QUESTIONS,
} from "@/lib/legal/suggested-questions";
import { looksHighStakes } from "@/lib/legal/disclaimers";
import { AI_ERROR_RETRY } from "@/lib/ai/copy";
import { formatJurisdiction, type Jurisdiction } from "@/lib/legal/jurisdiction";
import { cn } from "@/lib/utils";

export type UiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const MAX_MESSAGE_CHARS = 8_000;

/**
 * Consumer AI assistant (Phase 3). Streams from /api/chat; persistence happens
 * server-side. Empty state carries the suggested-situation chips (Part 4.1);
 * every assistant message renders inside <AiLegalOutput> (Part 10 hard req).
 */
export function ChatScreen({
  initialMessages,
  jurisdiction,
  firstName,
  matterId,
  matterTitle,
  audience = "consumer",
  className,
}: {
  initialMessages: UiMessage[];
  jurisdiction: Jurisdiction | null;
  firstName: string | null;
  /** Scope the conversation to a matter (Phase 4); omit for /chat. */
  matterId?: string;
  matterTitle?: string;
  /** "lawyer" = research mode (Phase 7): research prompt, chips, notices. */
  audience?: "consumer" | "lawyer";
  /** Override the root sizing (e.g. when embedded in the matter view). */
  className?: string;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<UiMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Tier-gate errors (Phase 10) carry upgrade:true → link to /billing.
  const [upgradeHint, setUpgradeHint] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const pinnedToBottom = useRef(true);

  // Follow the stream only while the reader hasn't scrolled up.
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    pinnedToBottom.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && pinnedToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Abandoning the page mid-stream should cancel the request.
  useEffect(() => () => abortRef.current?.abort(), []);

  const highStakes = useMemo(
    () =>
      messages.some((m) => m.role === "user" && looksHighStakes(m.content)),
    [messages],
  );

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || streaming) return;

      setError(null);
      setUpgradeHint(false);
      setInput("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      pinnedToBottom.current = true;

      const history = messages.map(({ role, content }) => ({ role, content }));
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "user", content: text },
      ]);
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;
      const assistantId = crypto.randomUUID();

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, history, matterId, audience }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          let message = AI_ERROR_RETRY;
          try {
            const data = (await res.json()) as {
              error?: string;
              upgrade?: boolean;
            };
            if (data.error) message = data.error;
            if (data.upgrade) setUpgradeHint(true);
          } catch {
            // fall through to the calm default
          }
          setError(message);
          return;
        }

        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: "assistant", content: "" },
        ]);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          if (!chunk) continue;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + chunk } : m,
            ),
          );
        }
      } catch (err) {
        const aborted =
          err instanceof DOMException && err.name === "AbortError";
        if (!aborted) setError(AI_ERROR_RETRY);
      } finally {
        setStreaming(false);
        abortRef.current = null;
        // Drop an assistant turn that never received a token.
        setMessages((prev) =>
          prev.filter((m) => m.id !== assistantId || m.content.length > 0),
        );
      }
    },
    [messages, streaming, matterId, audience],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  // Research → drafting bridge (Phase 7): carry the answer into /drafting.
  const useInDrafting = useCallback(
    (body: string) => {
      saveDraftingPrefill({ context: body });
      router.push("/drafting");
    },
    [router],
  );

  const empty = messages.length === 0;
  const lastAssistantId = [...messages]
    .reverse()
    .find((m) => m.role === "assistant")?.id;
  const awaitingFirstToken =
    streaming && messages[messages.length - 1]?.role === "user";

  return (
    <div
      className={cn(
        "flex h-[calc(100dvh-8rem)] min-h-[420px] flex-col",
        className,
      )}
    >
      {/* Persistent disclaimer — every legal chat carries it (Part 4.1). */}
      <DisclaimerBanner variant="compact" className="pb-3" />

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        role="log"
        aria-label="Conversation with the Justice assistant"
        aria-live="polite"
        className="min-h-0 flex-1 overflow-y-auto pr-1"
      >
        {empty ? (
          <EmptyState
            firstName={firstName}
            jurisdiction={jurisdiction}
            matterTitle={matterTitle}
            audience={audience}
            onPick={send}
            disabled={streaming}
          />
        ) : (
          <div className="mx-auto max-w-3xl space-y-6 pb-6 pt-2">
            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-xl rounded-br-sm bg-primary px-4 py-3 text-[15px] leading-relaxed text-primary-foreground shadow-[var(--shadow-sm)]">
                    <span className="sr-only">You said: </span>
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  </div>
                </div>
              ) : (
                <div key={m.id} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft"
                  >
                    <Scale className="h-3.5 w-3.5 text-accent" />
                  </span>
                  <div className="min-w-0 flex-1 rounded-xl rounded-tl-sm border border-border bg-surface px-4 py-3.5 shadow-[var(--shadow-sm)]">
                    <span className="sr-only">Justice replied: </span>
                    <AssistantMessage
                      content={m.content}
                      audience={audience}
                      highStakes={highStakes && m.id === lastAssistantId}
                      streamingThis={
                        streaming && m.id === messages[messages.length - 1]?.id
                      }
                      onUseInDrafting={useInDrafting}
                    />
                  </div>
                </div>
              ),
            )}

            {awaitingFirstToken && <ThinkingIndicator />}

            {error && (
              <Alert
                tone={upgradeHint ? "info" : "error"}
                title={upgradeHint ? "Plan limit reached" : "Something went wrong"}
              >
                {error}
                {upgradeHint && (
                  <>
                    {" "}
                    <Link
                      href="/billing"
                      className="font-medium text-accent underline underline-offset-4"
                    >
                      View plans →
                    </Link>
                  </>
                )}
              </Alert>
            )}
          </div>
        )}
        {empty && error && (
          <div className="mx-auto max-w-3xl pt-4">
            <Alert
              tone={upgradeHint ? "info" : "error"}
              title={upgradeHint ? "Plan limit reached" : "Something went wrong"}
            >
              {error}
              {upgradeHint && (
                <>
                  {" "}
                  <Link
                    href="/billing"
                    className="font-medium text-accent underline underline-offset-4"
                  >
                    View plans →
                  </Link>
                </>
              )}
            </Alert>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="mx-auto w-full max-w-3xl pt-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="relative rounded-xl border border-border-strong bg-surface shadow-[var(--shadow-sm)] transition-colors duration-150 focus-within:border-accent"
        >
          <label htmlFor="chat-input" className="sr-only">
            Describe your legal situation or ask a question
          </label>
          <textarea
            id="chat-input"
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value.slice(0, MAX_MESSAGE_CHARS));
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            rows={1}
            placeholder="Describe your situation or ask a question…"
            className="block w-full resize-none bg-transparent px-4 py-3.5 pr-14 text-[15px] leading-relaxed text-foreground placeholder:text-muted focus:outline-none"
          />
          {streaming ? (
            <button
              type="button"
              onClick={stop}
              aria-label="Stop generating"
              className="absolute bottom-2.5 right-2.5 flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              aria-label="Send message"
              className="absolute bottom-2.5 right-2.5 flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground shadow-[var(--shadow-sm)] transition-opacity hover:bg-accent-hover disabled:opacity-40"
            >
              <ArrowUp className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </form>
        <p className="mt-2 text-center text-[11px] text-muted">
          {audience === "lawyer"
            ? "Research accelerator — verify every citation before relying on it."
            : `Justice provides legal information scoped to ${formatJurisdiction(jurisdiction)} — not legal advice.`}
        </p>
      </div>
    </div>
  );
}

function EmptyState({
  firstName,
  jurisdiction,
  matterTitle,
  audience,
  onPick,
  disabled,
}: {
  firstName: string | null;
  jurisdiction: Jurisdiction | null;
  matterTitle?: string;
  audience: "consumer" | "lawyer";
  onPick: (question: string) => void;
  disabled: boolean;
}) {
  // Lawyer research mode: professional copy + research starters.
  if (audience === "lawyer") {
    return (
      <div className="mx-auto flex h-full max-w-3xl flex-col items-center justify-center py-8 text-center animate-fade-in-up">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-soft">
          <Scale className="h-6 w-6 text-accent" aria-hidden="true" />
        </span>
        <h1 className="mt-5 font-serif text-3xl font-medium tracking-tight text-foreground">
          Research accelerator
        </h1>
        <p className="mt-2 max-w-md text-[15px] leading-relaxed text-muted">
          Jurisdiction-scoped research with citation discipline: settled law
          separated from open questions, every authority flagged{" "}
          <span className="font-medium text-foreground">[verify]</span> until
          you confirm it. Default scope:{" "}
          <span className="font-medium text-foreground">
            {formatJurisdiction(jurisdiction)}
          </span>
          .
        </p>

        <div className="mt-8 grid w-full gap-2.5 sm:grid-cols-2">
          {RESEARCH_SUGGESTIONS.map(({ label, question, icon: Icon }) => (
            <button
              key={label}
              type="button"
              disabled={disabled}
              onClick={() => onPick(question)}
              className={cn(
                "group flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-left",
                "transition-colors duration-150 hover:border-accent hover:bg-accent-soft",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50",
              )}
            >
              <Icon className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
              <span className="text-sm font-medium text-foreground">
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }
  // Matter-scoped chat: matter-aware copy, no generic situation chips.
  if (matterTitle) {
    return (
      <div className="mx-auto flex h-full max-w-3xl flex-col items-center justify-center py-8 text-center animate-fade-in-up">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft">
          <Scale className="h-5 w-5 text-accent" aria-hidden="true" />
        </span>
        <h2 className="mt-4 font-serif text-2xl font-medium tracking-tight text-foreground">
          Let&apos;s work on this matter
        </h2>
        <p className="mt-2 max-w-md text-[15px] leading-relaxed text-muted">
          Everything you discuss here stays with{" "}
          <span className="font-medium text-foreground">{matterTitle}</span>,
          scoped to{" "}
          <span className="font-medium text-foreground">
            {formatJurisdiction(jurisdiction)}
          </span>
          . Start with what&apos;s happened so far.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col items-center justify-center py-8 text-center animate-fade-in-up">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-soft">
        <Scale className="h-6 w-6 text-accent" aria-hidden="true" />
      </span>
      <h1 className="mt-5 font-serif text-3xl font-medium tracking-tight text-foreground">
        {firstName ? `How can we help, ${firstName}?` : "How can we help?"}
      </h1>
      <p className="mt-2 max-w-md text-[15px] leading-relaxed text-muted">
        Describe your situation in plain language. Answers are scoped to{" "}
        <span className="font-medium text-foreground">
          {formatJurisdiction(jurisdiction)}
        </span>{" "}
        and explained without the jargon.
      </p>

      <div className="mt-8 grid w-full gap-2.5 sm:grid-cols-2">
        {SUGGESTED_QUESTIONS.map(({ label, question, icon: Icon }) => (
          <button
            key={label}
            type="button"
            disabled={disabled}
            onClick={() => onPick(question)}
            className={cn(
              "group flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-left",
              "transition-colors duration-150 hover:border-accent hover:bg-accent-soft",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50",
            )}
          >
            <Icon
              className="h-4 w-4 shrink-0 text-accent"
              aria-hidden="true"
            />
            <span className="text-sm font-medium text-foreground">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * One assistant turn. In research mode (Phase 7) the trailing "## Sources"
 * section is lifted out of the prose and rendered as structured citation
 * cards — type, proposition, and a "Verify source" link — with quiet
 * copy / use-in-drafting actions once the turn has finished streaming.
 */
function AssistantMessage({
  content,
  audience,
  highStakes,
  streamingThis,
  onUseInDrafting,
}: {
  content: string;
  audience: "consumer" | "lawyer";
  highStakes: boolean;
  streamingThis: boolean;
  onUseInDrafting: (body: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  const { body, refs } =
    audience === "lawyer"
      ? splitSources(content, { streaming: streamingThis })
      : { body: content, refs: [] as string[] };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard unavailable — quietly do nothing.
    }
  };

  return (
    <>
      <AiLegalOutput
        audience={audience}
        highStakes={highStakes}
        disclaimer="compact"
        findLawyerAction={
          <Link
            href="/find-a-lawyer"
            className="inline-flex items-center text-sm font-medium text-accent underline-offset-4 hover:underline"
          >
            Browse verified lawyers →
          </Link>
        }
      >
        <ChatMarkdown content={body} />
        {streamingThis && <StreamingCaret />}
        {refs.length > 0 && (
          <CitationList
            citations={refs.map(toCitation)}
            showVerifyNotice={false}
            className="pt-2"
          />
        )}
      </AiLegalOutput>

      {audience === "lawyer" && !streamingThis && body && (
        <div className="mt-2.5 flex items-center gap-1">
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted transition-colors duration-150 hover:bg-surface-sunken hover:text-foreground"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
            ) : (
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            onClick={() => onUseInDrafting(body)}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted transition-colors duration-150 hover:bg-surface-sunken hover:text-foreground"
          >
            <PenLine className="h-3.5 w-3.5" aria-hidden="true" />
            Use in drafting
          </button>
        </div>
      )}
    </>
  );
}

/** Quiet three-dot indicator while the first token is on its way. */
function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft">
        <Scale className="h-3.5 w-3.5 text-accent" />
      </span>
      <span className="flex items-center gap-1 rounded-xl border border-border bg-surface px-4 py-3.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-muted motion-safe:animate-pulse"
            style={{ animationDelay: `${i * 180}ms` }}
          />
        ))}
      </span>
    </div>
  );
}

/** Subtle caret shown at the end of the message while it streams. */
function StreamingCaret() {
  return (
    <span
      aria-hidden="true"
      className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 bg-accent motion-safe:animate-pulse"
    />
  );
}
