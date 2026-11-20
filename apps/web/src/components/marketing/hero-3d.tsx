"use client";

import { useEffect, useRef } from "react";
import { Scale, Sparkles, Clock, FileText, Check, MapPin } from "lucide-react";

/**
 * Hero3D — the landing's signature depth moment (Part 5: premium, composed).
 *
 * A perspective stage holds layered cards at different translateZ. Rotating the
 * scene by a few degrees toward the pointer is enough to produce *real* parallax
 * — closer layers travel further than distant ones — so we never animate each
 * card's position by hand. Everything is transform-only (compositor, 60fps).
 *
 * Inputs by device:
 *  - pointer (desktop): cursor offset from centre drives rotation.
 *  - idle drift (all, and the only motion on touch): a slow sway keeps the scene
 *    alive. Browsers on iOS put device tilt behind a permission prompt, which is
 *    too much to ask of a landing page.
 *  - scroll (all): the stage eases back + lifts as the hero leaves the viewport.
 * Reduced motion: the rAF loop never starts; the scene renders in its resting
 * pose, fully legible. The loop also pauses while the hero is off screen.
 */
export function Hero3D() {
  const sceneRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scene = sceneRef.current;
    const section = sectionRef.current;
    if (!scene || !section) return;

    const reduce =
      typeof matchMedia !== "undefined" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    // target (t*) vs rendered (c*) — we lerp toward the target every frame.
    let tRx = 0,
      tRy = 0,
      cRx = 0,
      cRy = 0,
      tLift = 0,
      cLift = 0;

    const onPointer = (e: PointerEvent) => {
      const r = section.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      tRy = px * 16; // horizontal swing (deg)
      tRx = -py * 11; // vertical swing (deg)
    };
    const onLeave = () => {
      tRx = 0;
      tRy = 0;
    };
    const onScroll = () => {
      const r = section.getBoundingClientRect();
      // progress 0 (hero centred) → 1 (scrolled a viewport up)
      const p = Math.min(Math.max(-r.top / (r.height || 1), 0), 1);
      tLift = p; // drives lift + slight recline on the way out
    };

    let raf = 0;
    let visible = true;
    const tick = (now: number) => {
      cRx += (tRx - cRx) * 0.07;
      cRy += (tRy - cRy) * 0.07;
      cLift += (tLift - cLift) * 0.08;
      const seconds = now / 1000;
      const swayX = Math.sin(seconds * 0.5) * 2.2;
      const swayY = Math.cos(seconds * 0.4) * 3.4;
      const extraRx = cLift * 8; // reclines as it leaves
      const y = cLift * -46;
      const s = 1 - cLift * 0.06;
      scene.style.transform = `translateY(${y.toFixed(2)}px) scale(${s.toFixed(
        3,
      )}) rotateX(${(cRx + swayX + extraRx).toFixed(2)}deg) rotateY(${(cRy + swayY - 8).toFixed(2)}deg)`;
      scene.style.opacity = String(1 - cLift * 0.5);
      if (visible) raf = requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(tick);
      }
    });
    observer.observe(section);

    section.addEventListener("pointermove", onPointer);
    section.addEventListener("pointerleave", onLeave);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      section.removeEventListener("pointermove", onPointer);
      section.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <div
      ref={sectionRef}
      aria-hidden="true"
      className="relative mx-auto flex h-[440px] w-full max-w-[460px] items-center justify-center select-none sm:h-[500px]"
      style={{ perspective: "1400px" }}
    >
      {/* warm depth glow behind the stage */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[380px] w-[380px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70 blur-2xl"
        style={{
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--brand-orange-bright) 26%, transparent), transparent 66%)",
        }}
      />

      <div
        ref={sceneRef}
        className="scene-3d relative h-full w-full"
        style={{ transition: "none" }}
      >
        {/* back: faint document page (deepest) */}
        <div
          className="absolute left-[6%] top-[20%] w-[52%]"
          style={{ transform: "translateZ(-90px)" }}
        >
          <div className="animate-float rounded-xl border border-border bg-surface-raised p-4 shadow-[var(--shadow-lg)]" style={{ animationDelay: "0.9s" }}>
            <div className="flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
              <div className="h-1.5 w-16 rounded-full bg-border-strong" />
            </div>
            <div className="mt-3 space-y-2">
              <div className="h-1.5 w-full rounded-full bg-border" />
              <div className="h-1.5 w-[86%] rounded-full bg-border" />
              <div className="h-1.5 w-[64%] rounded-full bg-[var(--accent-soft)]" />
              <div className="h-1.5 w-[78%] rounded-full bg-border" />
            </div>
          </div>
        </div>

        {/* jurisdiction pill (mid-near, top) */}
        <div
          className="absolute left-[2%] top-[6%]"
          style={{ transform: "translateZ(60px)" }}
        >
          <div className="animate-float flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-2 shadow-[var(--shadow-md)]" style={{ animationDelay: "0.3s" }}>
            <MapPin className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
            <span className="text-xs font-medium text-foreground">
              California, US
            </span>
          </div>
        </div>

        {/* main answer card (centre plane) */}
        <div
          className="absolute left-[14%] top-[30%] w-[78%]"
          style={{ transform: "translateZ(30px)" }}
        >
          <div className="animate-float relative overflow-hidden rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-lg)]" style={{ animationDelay: "0.1s" }}>
            {/* moving sheen */}
            <div
              className="animate-sheen pointer-events-none absolute inset-y-0 left-0 w-1/3"
              style={{
                background:
                  "linear-gradient(90deg, transparent, color-mix(in srgb, var(--brand-orange-bright) 22%, transparent), transparent)",
              }}
            />
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent-soft)]">
                <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
              </span>
              <span className="text-xs font-semibold text-foreground">Lexa</span>
            </div>
            <p className="mt-2.5 text-[13px] leading-relaxed text-muted-strong">
              In California your landlord generally has{" "}
              <span className="font-medium text-foreground">21 days</span> to
              return your deposit or itemize deductions.
            </p>
            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-success">
              <Check className="h-3 w-3" aria-hidden="true" />
              Civil Code § 1950.5
            </div>
          </div>
        </div>

        {/* deadline chip (nearest — pops toward the viewer) */}
        <div
          className="absolute left-[56%] top-[66%]"
          style={{ transform: "translateZ(130px)" }}
        >
          <div
            className="animate-float rounded-xl px-4 py-3 text-primary-foreground shadow-[0_28px_50px_-12px_color-mix(in_srgb,var(--brand-orange)_55%,transparent)]"
            style={{ animationDelay: "0.55s", background: "var(--primary)" }}
          >
            <div className="flex items-center gap-1.5 text-[10px] opacity-80">
              <Clock className="h-3 w-3" aria-hidden="true" />
              Deadline
            </div>
            <div className="mt-0.5 text-xl font-semibold leading-none">
              21 days
            </div>
            <div className="mt-1 text-[10px] opacity-80">after move-out</div>
          </div>
        </div>

        {/* small scale glyph (near, left) */}
        <div
          className="absolute left-[4%] top-[70%]"
          style={{ transform: "translateZ(100px)" }}
        >
          <div className="animate-float flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface shadow-[var(--shadow-md)]" style={{ animationDelay: "0.75s" }}>
            <Scale className="h-5 w-5 text-accent" aria-hidden="true" />
          </div>
        </div>
      </div>
    </div>
  );
}
