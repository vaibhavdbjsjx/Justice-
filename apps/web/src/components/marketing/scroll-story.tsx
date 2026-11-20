"use client";

import { useEffect, useRef, useState } from "react";
import { BellRing, Check, Flag, FileText, MessageSquare, Scale } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    Icon: FileText,
    eyebrow: "01  Read",
    title: "Hand Lexa the paper in front of you",
    body: "A lease, a notice, a contract. Lexa goes through it clause by clause and rewrites it in plain language.",
  },
  {
    Icon: Flag,
    eyebrow: "02  Flag",
    title: "See what actually matters",
    body: "One-sided terms, waivers, and hidden fees rise to the top, each one tied to the exact words behind it.",
  },
  {
    Icon: BellRing,
    eyebrow: "03  Act",
    title: "Know what to do, and by when",
    body: "Deadlines go on your calendar of reminders. Ask follow-ups, draft a reply, or find a lawyer when it needs one.",
  },
];

/**
 * A pinned story told through a 3D document. Native scrolling drives it: a single
 * CSS variable (--p, 0 to 1) moves everything by transform and opacity, so it stays
 * smooth, never hijacks the scroll, and works the same on touch. With reduced
 * motion, the steps simply stack.
 */
export function ScrollStory() {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [animated, setAnimated] = useState(true);

  useEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches) {
      const id = setTimeout(() => setAnimated(false), 0);
      return () => clearTimeout(id);
    }

    let frame = 0;
    const update = () => {
      frame = 0;
      const el = section.current;
      const target = stage.current;
      if (!el || !target) return;
      const rect = el.getBoundingClientRect();
      const travel = rect.height - window.innerHeight;
      const p = travel > 0 ? Math.min(Math.max(-rect.top / travel, 0), 1) : 0;
      target.style.setProperty("--p", p.toFixed(4));
      setStep(p < 0.34 ? 0 : p < 0.68 ? 1 : 2);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <section
      ref={section}
      aria-label="How Lexa works"
      className={cn("relative", animated ? "h-[300vh]" : "h-auto")}
    >
      <div
        className={cn(
          "flex items-center overflow-hidden",
          animated ? "sticky top-0 h-[100svh]" : "py-20",
        )}
      >
        <div className="mx-auto grid w-full max-w-6xl items-center gap-4 px-5 sm:px-8 lg:grid-cols-2 lg:gap-12">
          <div className="relative min-h-[210px] lg:min-h-[320px]">
            {STEPS.map(({ eyebrow, title, body }, i) => (
              <div
                key={title}
                className={cn(
                  "transition-[opacity,transform] duration-500 ease-[var(--ease-refined)]",
                  animated && "absolute inset-x-0 top-0",
                  // The outgoing step clears quickly and the next one follows, so the
                  // two headlines never sit on top of each other mid-change.
                  animated && step === i && "delay-150",
                  animated && step !== i && "pointer-events-none opacity-0 duration-200",
                  animated && step < i && "translate-y-6",
                  animated && step > i && "-translate-y-6",
                  !animated && "mb-10",
                )}
              >
                <p className="text-sm font-medium tracking-wide text-accent">{eyebrow}</p>
                <h2 className="font-display mt-3 text-4xl text-foreground sm:text-5xl">{title}</h2>
                <p className="mt-4 max-w-md text-lg leading-relaxed text-muted">{body}</p>
              </div>
            ))}
            {animated && (
              <div className="absolute inset-x-0 -bottom-2 hidden gap-2 lg:flex" aria-hidden="true">
                {STEPS.map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-1 w-10 rounded-full transition-colors duration-300",
                      i <= step ? "bg-accent" : "bg-border-strong",
                    )}
                  />
                ))}
              </div>
            )}
          </div>

          <div
            aria-hidden="true"
            className="relative mx-auto h-[300px] w-full max-w-[440px] scale-[0.78] sm:h-[480px] sm:scale-100"
            style={{ perspective: "1300px" }}
          >
            <div
              ref={stage}
              className="absolute inset-0"
              style={
                {
                  "--p": animated ? 0 : 1,
                  transformStyle: "preserve-3d",
                  transform:
                    "rotateX(calc(20deg - var(--p) * 14deg)) rotateY(calc(-26deg + var(--p) * 42deg)) translateZ(calc(var(--p) * 30px))",
                } as React.CSSProperties
              }
            >
              <div
                className="absolute left-[14%] top-[6%] h-[82%] w-[66%] rounded-2xl border border-border bg-surface-raised shadow-[var(--shadow-lg)]"
                style={{ transform: "translateZ(-70px) translate(-16px,-14px)" }}
              />
              <div
                className="absolute left-[14%] top-[6%] h-[82%] w-[66%] rounded-2xl border border-border bg-surface-raised shadow-[var(--shadow-lg)]"
                style={{ transform: "translateZ(-35px) translate(-8px,-7px)" }}
              />

              {/* The page, with a sweep of light reading it. */}
              <div className="absolute left-[14%] top-[6%] h-[82%] w-[66%] overflow-hidden rounded-2xl border border-border bg-surface p-[7%] shadow-[var(--shadow-lg)]">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-accent" />
                  <span className="text-xs font-semibold text-foreground">Lease agreement</span>
                </div>
                <div className="mt-4 space-y-3">
                  {[100, 92, 84, 96, 70, 100, 88, 62, 94, 80].map((w, i) => (
                    <div
                      key={i}
                      className="relative h-[7px] overflow-hidden rounded-full bg-surface-sunken"
                      style={{ width: `${w}%` }}
                    >
                      {(i === 3 || i === 7) && (
                        <div
                          className="absolute inset-0 rounded-full bg-[var(--brand-orange-bright)]"
                          style={{ opacity: "clamp(0, calc((var(--p) - 0.26) * 6), 0.85)" }}
                        />
                      )}
                    </div>
                  ))}
                </div>
                <div
                  className="absolute inset-x-0 h-20"
                  style={{
                    top: "calc(-20% + var(--p) * 300%)",
                    opacity: "clamp(0, calc((0.42 - var(--p)) * 8), 1)",
                    background:
                      "linear-gradient(180deg, transparent, color-mix(in srgb, var(--brand-orange-bright) 30%, transparent), transparent)",
                  }}
                />
              </div>

              {/* Flagged clause, lifting off the page. */}
              <div
                className="absolute left-[46%] top-[24%] w-[56%] rounded-xl border border-border bg-surface p-3 shadow-[var(--shadow-lg)]"
                style={{
                  opacity: "clamp(0, calc((var(--p) - 0.3) * 7), 1)",
                  transform:
                    "translateZ(calc(40px + clamp(0, (var(--p) - 0.3) * 3, 1) * 80px)) translateY(calc((1 - clamp(0, (var(--p) - 0.3) * 4, 1)) * 26px))",
                }}
              >
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-alert">
                  <Flag className="h-3 w-3" />
                  High concern
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-strong">
                  A &ldquo;non-refundable&rdquo; deposit may not be enforceable in California.
                </p>
              </div>

              {/* Plain-language answer. */}
              <div
                className="absolute left-[-3%] top-[52%] w-[60%] rounded-xl border border-border bg-surface p-3 shadow-[var(--shadow-lg)]"
                style={{
                  opacity: "clamp(0, calc((var(--p) - 0.46) * 7), 1)",
                  transform:
                    "translateZ(calc(30px + clamp(0, (var(--p) - 0.46) * 3, 1) * 70px)) translateY(calc((1 - clamp(0, (var(--p) - 0.46) * 4, 1)) * 26px))",
                }}
              >
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
                  <Scale className="h-3 w-3 text-accent" />
                  Lexa
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-strong">
                  You can ask for the full deposit back. Here&rsquo;s how to put that in writing.
                </p>
              </div>

              {/* Deadline. */}
              <div
                className="absolute left-[52%] top-[70%] w-[50%] rounded-xl p-3 text-primary-foreground shadow-[0_28px_50px_-12px_color-mix(in_srgb,var(--brand-orange)_55%,transparent)]"
                style={{
                  background: "var(--primary)",
                  opacity: "clamp(0, calc((var(--p) - 0.66) * 7), 1)",
                  transform:
                    "translateZ(calc(50px + clamp(0, (var(--p) - 0.66) * 3, 1) * 110px)) translateY(calc((1 - clamp(0, (var(--p) - 0.66) * 4, 1)) * 26px))",
                }}
              >
                <div className="flex items-center gap-1.5 text-[11px] opacity-85">
                  <BellRing className="h-3 w-3" />
                  Reminder set
                </div>
                <p className="mt-1 text-sm font-semibold leading-snug">Send notice by Nov 1</p>
              </div>

              <div
                className="absolute left-[8%] top-[84%] flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 shadow-[var(--shadow-md)]"
                style={{
                  opacity: "clamp(0, calc((var(--p) - 0.74) * 7), 1)",
                  transform: "translateZ(90px)",
                }}
              >
                <MessageSquare className="h-3.5 w-3.5 text-accent" />
                <span className="text-[11px] font-medium text-foreground">Ask a follow-up</span>
                <Check className="h-3.5 w-3.5 text-success" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
