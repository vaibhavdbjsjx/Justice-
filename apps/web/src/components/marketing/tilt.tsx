"use client";

import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Tilt3D — a restrained pointer-reactive 3D tilt for cards. The card leans a few
 * degrees toward the cursor with a soft spotlight following it, then eases back
 * on leave. Transform/opacity only (compositor), and it simply does nothing when
 * the OS asks for reduced motion or there's no fine pointer (touch), so it never
 * fights a scroll.
 */
export function Tilt3D({
  children,
  className,
  max = 7,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const raf = useRef(0);

  const allow = () =>
    typeof matchMedia !== "undefined" &&
    matchMedia("(hover: hover) and (pointer: fine)").matches &&
    !matchMedia("(prefers-reduced-motion: reduce)").matches;

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || !allow()) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      el.style.transform = `perspective(900px) rotateX(${(-py * max).toFixed(
        2,
      )}deg) rotateY(${(px * max).toFixed(2)}deg) translateZ(6px)`;
      el.style.setProperty("--mx", `${(px * 100 + 50).toFixed(1)}%`);
      el.style.setProperty("--my", `${(py * 100 + 50).toFixed(1)}%`);
    });
  };

  const reset = () => {
    const el = ref.current;
    if (!el) return;
    cancelAnimationFrame(raf.current);
    el.style.transform =
      "perspective(900px) rotateX(0deg) rotateY(0deg) translateZ(0)";
  };

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={reset}
      className={cn(
        "group/tilt relative h-full transition-transform duration-500 ease-[var(--ease-refined)] motion-reduce:!transform-none",
        className,
      )}
    >
      {children}
      {/* A soft light that follows the cursor, above the card's own background. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover/tilt:opacity-100"
        style={{
          backgroundImage:
            "radial-gradient(260px circle at var(--mx,50%) var(--my,50%), var(--accent-soft), transparent 65%)",
        }}
      />
    </div>
  );
}
