import { UserRoundCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { PROFESSIONAL_HELP_NUDGE } from "@/lib/legal/disclaimers";

/**
 * Honest "you may want a real lawyer" nudge for high-stakes situations
 * (Part 1 / Part 8). Never just answer and move on when stakes are high.
 */
export function ProfessionalHelpNudge({
  message = PROFESSIONAL_HELP_NUDGE,
  action,
  className,
}: {
  message?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="note"
      className={cn(
        "flex items-start gap-3 rounded-lg border border-alert/30 bg-alert-soft px-4 py-3",
        className,
      )}
    >
      <UserRoundCheck className="mt-0.5 h-4 w-4 shrink-0 text-alert" aria-hidden="true" />
      <div className="space-y-2">
        <p className="text-sm leading-relaxed text-foreground">{message}</p>
        {action}
      </div>
    </div>
  );
}
