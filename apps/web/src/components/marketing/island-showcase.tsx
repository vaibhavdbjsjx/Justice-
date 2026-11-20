"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { useInView } from "./reveal";
import { cn } from "@/lib/utils";

/** The balance mark, sized for the island. */
function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 3v17M7 21h10M4.5 6.5h15" />
      <path d="M4.5 6.5 2 13c0 1.4 1.1 2.5 2.5 2.5S7 14.4 7 13L4.5 6.5ZM19.5 6.5 17 13c0 1.4 1.1 2.5 2.5 2.5S22 14.4 22 13l-2.5-6.5Z" />
    </svg>
  );
}

const STATES = ["idle", "compact", "expanded", "ready", "settled"] as const;
type IslandState = (typeof STATES)[number];
const DURATIONS: Record<IslandState, number> = {
  idle: 1100,
  compact: 2400,
  expanded: 3400,
  ready: 3000,
  settled: 2200,
};

/**
 * What it looks like when Lexa reads a document on iPhone. This is an illustration
 * of the app's real Live Activity, redrawn for the web. It only runs while on
 * screen, and reduced motion holds it on the informative state.
 */
export function IslandShowcase() {
  const { ref, inView } = useInView<HTMLDivElement>();
  const [state, setState] = useState<IslandState>("idle");
  const stateRef = useRef(state);

  useEffect(() => {
    if (!inView) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const id = setTimeout(() => setState("expanded"), 0);
      return () => clearTimeout(id);
    }
    let timer: ReturnType<typeof setTimeout>;
    const advance = () => {
      const next = STATES[(STATES.indexOf(stateRef.current) + 1) % STATES.length];
      stateRef.current = next;
      setState(next);
      timer = setTimeout(advance, DURATIONS[next]);
    };
    timer = setTimeout(advance, DURATIONS.idle);
    return () => clearTimeout(timer);
  }, [inView]);

  const big = state === "expanded" || state === "ready";

  return (
    <section className="border-y border-border bg-surface">
      <div ref={ref} className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-2">
        <div>
          <p className="text-sm font-medium tracking-wide text-accent">On iPhone</p>
          <h2 className="font-display mt-3 text-4xl text-foreground sm:text-5xl">
            Leave the app. Lexa keeps reading.
          </h2>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-muted">
            Long documents take a moment. Progress lives in the Dynamic Island and on your
            Lock Screen, and it opens up to tell you the moment your answer is ready.
          </p>
          <ul className="mt-6 space-y-2.5 text-[15px] text-muted-strong">
            {[
              "Live progress while a document is read",
              "A live countdown on the day a deadline is due",
              "Reminders a week before, the day before, and that morning",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <Check className="mt-1 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div
          role="img"
          aria-label="An iPhone Dynamic Island showing Lexa reading a lease, then opening to say two clauses are worth a closer look."
          className="relative mx-auto h-[420px] w-[290px] sm:h-[480px] sm:w-[320px]"
        >
          <div className="absolute inset-0 rounded-[52px] border-[10px] border-[#191816] bg-[#f4f2ec] shadow-[var(--shadow-lg)] dark:bg-[#26241f]">
            <div className="absolute inset-x-0 top-[74px] px-5 opacity-60" aria-hidden="true">
              <div className="h-8 w-40 rounded-lg bg-black/5 dark:bg-white/5" />
              <div className="mt-5 h-24 rounded-2xl bg-black/5 dark:bg-white/5" />
              <div className="mt-3 h-24 rounded-2xl bg-black/5 dark:bg-white/5" />
              <div className="mt-3 h-24 rounded-2xl bg-black/5 dark:bg-white/5" />
            </div>
            <div
              className={cn(
                "absolute left-1/2 top-3 -translate-x-1/2 overflow-hidden bg-black text-white",
                "transition-[width,height,border-radius] duration-[650ms] ease-[cubic-bezier(0.32,1.32,0.5,1)]",
                big ? "h-[158px] w-[91%] rounded-[34px]" : "h-[34px] rounded-[20px]",
                !big && (state === "idle" || state === "settled") && "w-[112px]",
                !big && state === "compact" && "w-[188px]",
              )}
            >
              <div
                className={cn(
                  "absolute inset-x-3 top-1/2 flex -translate-y-1/2 items-center justify-between transition-opacity duration-200",
                  state === "compact" ? "opacity-100 delay-200" : "opacity-0",
                )}
              >
                <Mark className="h-[18px] w-[18px] text-[#e08e70]" />
                <span
                  className="h-[17px] w-[17px] rounded-full"
                  style={{
                    background:
                      "conic-gradient(#e08e70 var(--ring, 40%), rgba(255,255,255,.2) 0)",
                    WebkitMask: "radial-gradient(circle, transparent 5px, black 5.5px)",
                    mask: "radial-gradient(circle, transparent 5px, black 5.5px)",
                  }}
                />
              </div>
              <div
                className={cn(
                  "absolute inset-0 flex flex-col justify-center gap-1.5 px-5 transition-opacity duration-300",
                  big ? "opacity-100 delay-200" : "opacity-0",
                )}
              >
                <div className="flex items-center justify-between text-[11px] font-semibold text-[#e08e70]">
                  <span className="flex items-center gap-1.5">
                    <Mark className="h-4 w-4" />
                    Document
                  </span>
                  {state === "ready" && (
                    <span className="flex items-center gap-1 text-[#8fae83]">
                      <Check className="h-3.5 w-3.5" />
                      Ready
                    </span>
                  )}
                </div>
                <p className="text-[15px] font-semibold">Lease agreement</p>
                <p className="text-[13px] leading-snug text-white/70">
                  {state === "ready" ? "2 clauses worth a closer look." : "Checking for risky clauses."}
                </p>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/20">
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] ease-linear",
                      state === "ready" ? "w-full bg-[#8fae83] duration-300" : "w-[62%] bg-[#e08e70] duration-[3400ms]",
                    )}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
