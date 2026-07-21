"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared one-shot intersection hook. State only transitions from observer
 * callbacks (or a deferred fallback), never synchronously inside the effect.
 */
function useRevealed<T extends HTMLElement>(threshold: number, rootMargin?: string) {
  const ref = useRef<T>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || revealed) return;

    // Vanishingly rare, but never leave content permanently hidden.
    if (typeof IntersectionObserver === "undefined") {
      const id = setTimeout(() => setRevealed(true), 0);
      return () => clearTimeout(id);
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          io.disconnect();
        }
      },
      { threshold, rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [revealed, threshold, rootMargin]);

  return { ref, revealed };
}

/**
 * Scroll-triggered entrance. Opacity + transform only (compositor-friendly) so
 * it stays at 60fps. Reduced motion is neutralised globally in globals.css.
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, revealed } = useRevealed<HTMLDivElement>(0.12, "0px 0px -64px 0px");

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn(
        "transition-[opacity,transform] duration-700 ease-[var(--ease-refined)] motion-reduce:transition-none",
        revealed ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** True once the element has been scrolled into view — for demos that autoplay. */
export function useInView<T extends HTMLElement>() {
  const { ref, revealed } = useRevealed<T>(0.35);
  return { ref, inView: revealed };
}
