"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Scale } from "lucide-react";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { JurisdictionIndicator } from "@/components/compliance/jurisdiction-indicator";
import { ProfessionalHelpNudge } from "@/components/compliance/professional-help-nudge";
import { DisclaimerBanner } from "@/components/compliance/disclaimer-banner";
import { useInView } from "./reveal";

const QUESTION = "My landlord wants me out in 7 days. Is that legal?";
const ANSWER =
  "In California, a landlord usually can’t force you out in 7 days. Most no-fault situations require a 30- or 60-day written notice — and only a court can order an eviction, never the landlord directly.";

type Stage = "idle" | "thinking" | "streaming";

/**
 * Product proof for the hero: replays a real assistant exchange with a streaming
 * typewriter effect, then reveals the compliance layer (jurisdiction scope,
 * high-stakes nudge, disclaimer) exactly as the live product renders it.
 *
 * All state transitions happen inside timer/observer callbacks, and "done" is
 * derived from `typed` rather than stored, so there is no redundant state.
 */
export function LiveChatDemo() {
  const { ref, inView } = useInView<HTMLDivElement>();
  const [stage, setStage] = useState<Stage>("idle");
  const [typed, setTyped] = useState(0);

  const done = stage === "streaming" && typed >= ANSWER.length;

  // Kick off the sequence once the card scrolls into view.
  useEffect(() => {
    if (!inView || stage !== "idle") return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      const id = setTimeout(() => {
        setTyped(ANSWER.length);
        setStage("streaming");
      }, 0);
      return () => clearTimeout(id);
    }

    const toThinking = setTimeout(() => setStage("thinking"), 0);
    const toStreaming = setTimeout(() => setStage("streaming"), 850);
    return () => {
      clearTimeout(toThinking);
      clearTimeout(toStreaming);
    };
  }, [inView, stage]);

  // Advance the typewriter.
  useEffect(() => {
    if (stage !== "streaming" || done) return;
    const id = setTimeout(() => {
      setTyped((n) => Math.min(ANSWER.length, n + 2));
    }, 16);
    return () => clearTimeout(id);
  }, [stage, typed, done]);

  return (
    <div ref={ref} className="w-full">
      <Card raised className="w-full overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border bg-surface-sunken px-5 py-3">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary">
            <Scale className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
          </span>
          <span className="text-sm font-medium text-foreground">LexMind advisor</span>
          <span className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
            Live
          </span>
        </div>

        <div className="space-y-4 p-5">
          <div className="ml-auto w-fit max-w-[85%] rounded-lg rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
            {QUESTION}
          </div>

          {stage === "thinking" && (
            <div className="flex items-center gap-1.5 py-2" aria-label="Assistant is thinking">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-muted"
                  style={{ animationDelay: `${i * 180}ms` }}
                />
              ))}
            </div>
          )}

          {stage === "streaming" && (
            <div className="space-y-3">
              <JurisdictionIndicator
                jurisdiction={{ country: "United States", state: "California" }}
              />
              <p className="legal-prose text-sm text-foreground" aria-live="polite">
                {ANSWER.slice(0, typed)}
                {!done && (
                  <span
                    className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-caret bg-accent align-middle"
                    aria-hidden="true"
                  />
                )}
              </p>

              {done && (
                <div className="animate-fade-in-up space-y-3">
                  <ProfessionalHelpNudge
                    action={
                      <Link
                        href="/find-a-lawyer"
                        className={buttonVariants({ variant: "accent", size: "sm" })}
                      >
                        Find a lawyer
                      </Link>
                    }
                  />
                  <DisclaimerBanner variant="compact" />
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
