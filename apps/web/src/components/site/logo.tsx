import Link from "next/link";
import { Scale } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Justice wordmark — a burnt-orange mark carrying the scales, paired with the
 * serif wordmark for gravitas. The icon sits on the brand fill in the
 * on-primary colour so it stays legible in both themes.
 */
export function Logo({
  className,
  href = "/",
}: {
  className?: string;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-2.5 font-serif text-lg font-semibold tracking-tight text-foreground",
        className,
      )}
      aria-label="Justice home"
    >
      <span
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-[10px] bg-primary",
          "shadow-[var(--shadow-sm)] ring-1 ring-inset ring-white/15",
          "transition-transform duration-200 ease-[var(--ease-refined)] group-hover:scale-[1.04]",
        )}
      >
        <Scale className="h-[18px] w-[18px] text-primary-foreground" aria-hidden="true" />
      </span>
      Justice
    </Link>
  );
}
