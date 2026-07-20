import { Scale } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DISCLAIMER_FULL,
  DISCLAIMER_SHORT,
  ATTORNEY_CLIENT_NOTICE,
} from "@/lib/legal/disclaimers";

/**
 * Persistent-but-not-obnoxious legal disclaimer (Part 5.6 / Part 10 hard req).
 * Present on every AI legal surface. Not dismissible by design — the framing is
 * load-bearing (Part 1). Use `compact` for tight contexts (message footers).
 */
export function DisclaimerBanner({
  variant = "full",
  className,
}: {
  variant?: "full" | "compact";
  className?: string;
}) {
  if (variant === "compact") {
    return (
      <p
        role="note"
        aria-label="Legal disclaimer"
        className={cn(
          "flex items-center gap-1.5 text-xs text-muted",
          className,
        )}
      >
        <Scale className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
        <span>{DISCLAIMER_SHORT}</span>
      </p>
    );
  }

  return (
    <div
      role="note"
      aria-label="Legal disclaimer"
      className={cn(
        "flex items-start gap-3 rounded-lg border border-border border-l-2 border-l-accent bg-surface px-4 py-3",
        className,
      )}
    >
      <Scale className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
      <div className="space-y-0.5">
        <p className="text-sm font-medium text-foreground">
          Legal information, not legal advice
        </p>
        <p className="text-xs leading-relaxed text-muted">
          {DISCLAIMER_FULL}
        </p>
        <p className="sr-only">{ATTORNEY_CLIENT_NOTICE}</p>
      </div>
    </div>
  );
}
