import { FileCheck2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  REVIEW_BEFORE_USE_BODY,
  REVIEW_BEFORE_USE_TITLE,
} from "@/lib/legal/disclaimers";

/**
 * "Review before use" flag for every generated document (Part 4.1 / Phase 6).
 * Terracotta-toned so it reads as a considered caution, not an alarm.
 */
export function ReviewBeforeUse({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      role="note"
      aria-label={REVIEW_BEFORE_USE_TITLE}
      className={cn(
        "flex items-start gap-3 rounded-lg border border-l-2 border-alert/40 border-l-alert bg-alert-soft px-4 py-3",
        className,
      )}
    >
      <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-alert" aria-hidden="true" />
      <div className="space-y-0.5">
        <p className="text-sm font-medium text-foreground">
          {REVIEW_BEFORE_USE_TITLE}
        </p>
        {!compact && (
          <p className="text-xs leading-relaxed text-muted-strong">
            {REVIEW_BEFORE_USE_BODY}
          </p>
        )}
      </div>
    </div>
  );
}
