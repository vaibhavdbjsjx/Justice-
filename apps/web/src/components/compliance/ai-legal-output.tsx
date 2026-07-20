import { cn } from "@/lib/utils";
import type { Jurisdiction } from "@/lib/legal/jurisdiction";
import { RESEARCH_ACCELERATOR_NOTICE } from "@/lib/legal/disclaimers";
import { DisclaimerBanner } from "./disclaimer-banner";
import { JurisdictionIndicator } from "./jurisdiction-indicator";
import { ProfessionalHelpNudge } from "./professional-help-nudge";

/**
 * Structural guarantee that an AI legal output is never rendered without its
 * compliance context (Part 1 + Part 10 hard requirement). Wrap ANY surface that
 * displays AI-generated legal information/analysis in this component instead of
 * remembering to add a disclaimer each time.
 *
 * - consumer audience → "legal information, not legal advice" disclaimer
 * - lawyer audience   → research-accelerator / verify-citations notice
 * - highStakes        → adds an honest "consider a real lawyer" nudge
 */
export function AiLegalOutput({
  children,
  audience = "consumer",
  jurisdiction,
  highStakes = false,
  disclaimer = "compact",
  findLawyerAction,
  className,
}: {
  children: React.ReactNode;
  audience?: "consumer" | "lawyer";
  jurisdiction?: Jurisdiction | null;
  highStakes?: boolean;
  disclaimer?: "compact" | "full";
  findLawyerAction?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {jurisdiction !== undefined && (
        <div className="flex items-center justify-between gap-2">
          <JurisdictionIndicator jurisdiction={jurisdiction} />
        </div>
      )}

      <div className="legal-prose text-foreground">{children}</div>

      {highStakes && audience === "consumer" && (
        <ProfessionalHelpNudge action={findLawyerAction} />
      )}

      {audience === "consumer" ? (
        <DisclaimerBanner variant={disclaimer} />
      ) : (
        <p className="flex items-start gap-1.5 border-t border-border pt-2 text-[11px] leading-relaxed text-muted">
          {RESEARCH_ACCELERATOR_NOTICE}
        </p>
      )}
    </div>
  );
}
