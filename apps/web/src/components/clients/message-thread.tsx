"use client";

import { useRef, useState } from "react";
import { ArrowUp, MessagesSquare } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { sendClientMessage } from "@/lib/clients/actions";
import type { ClientMessage } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

/**
 * The lawyer<->client communication log (Phase 8, Part 4.3), rendered on
 * both sides of the relationship. Append-only by design — the database
 * has no update/delete path, so what was said stays said.
 */

const MAX_MESSAGE_CHARS = 8_000;

export function MessageThread({
  matterId,
  messages,
  viewerId,
  counterpartName,
  isDemo,
}: {
  matterId: string;
  messages: ClientMessage[];
  /** Which side is looking — their messages align right. */
  viewerId: string;
  counterpartName: string;
  isDemo: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Optimistic tail so the sent message shows before revalidation lands.
  const [optimistic, setOptimistic] = useState<ClientMessage[]>([]);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Once revalidation delivers the persisted row (new id, same content),
  // drop the optimistic copy.
  const all = [
    ...messages,
    ...optimistic.filter(
      (o) =>
        !messages.some(
          (m) => m.sender_id === o.sender_id && m.body === o.body,
        ),
    ),
  ];

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || pending) return;
    setError(null);
    setPending(true);

    if (isDemo) {
      setOptimistic((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          matter_id: matterId,
          sender_id: viewerId,
          body,
          created_at: new Date().toISOString(),
        },
      ]);
      setDraft("");
      setPending(false);
      return;
    }

    const result = await sendClientMessage(matterId, body);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setOptimistic((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        matter_id: matterId,
        sender_id: viewerId,
        body,
        created_at: new Date().toISOString(),
      },
    ]);
    setDraft("");
    requestAnimationFrame(() => {
      const el = listRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  };

  return (
    <Card className="flex flex-col p-0">
      <div className="border-b border-border px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <MessagesSquare className="h-4 w-4 text-accent" aria-hidden="true" />
          Messages with {counterpartName}
        </h3>
        <p className="mt-0.5 text-[11px] text-muted">
          A permanent record — messages can&rsquo;t be edited or deleted.
        </p>
      </div>

      <div
        ref={listRef}
        role="log"
        aria-label={`Messages with ${counterpartName}`}
        className="max-h-80 space-y-3 overflow-y-auto px-4 py-4"
      >
        {all.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted">
            No messages yet. Start the thread below.
          </p>
        ) : (
          all.map((m) => {
            const mine = m.sender_id === viewerId;
            return (
              <div key={m.id} className={cn("flex", mine && "justify-end")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
                    mine
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm border border-border bg-surface-sunken text-foreground",
                  )}
                >
                  <span className="sr-only">
                    {mine ? "You" : counterpartName} said:{" "}
                  </span>
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  <p
                    className={cn(
                      "mt-1 text-[10px]",
                      mine ? "text-primary-foreground/70" : "text-muted",
                    )}
                  >
                    {new Date(m.created_at).toLocaleString(undefined, {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={send} className="border-t border-border p-3">
        {error && (
          <Alert tone="error" className="mb-2">
            {error}
          </Alert>
        )}
        <div className="relative">
          <label htmlFor={`thread-${matterId}`} className="sr-only">
            Write a message to {counterpartName}
          </label>
          <textarea
            id={`thread-${matterId}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_MESSAGE_CHARS))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(e);
              }
            }}
            rows={2}
            placeholder={`Message ${counterpartName}…`}
            className="block w-full resize-none rounded-lg border border-border-strong bg-surface px-3.5 py-2.5 pr-12 text-sm leading-relaxed text-foreground placeholder:text-muted transition-colors duration-150 focus-visible:border-accent focus-visible:outline-none"
          />
          <button
            type="submit"
            disabled={!draft.trim() || pending}
            aria-label="Send message"
            className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-foreground shadow-[var(--shadow-sm)] transition-opacity hover:bg-accent-hover disabled:opacity-40"
          >
            <ArrowUp className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        {isDemo && (
          <p className="mt-1.5 text-[11px] text-muted">
            Local preview — messages aren&rsquo;t saved.
          </p>
        )}
      </form>
    </Card>
  );
}
