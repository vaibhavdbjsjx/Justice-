import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatJurisdiction,
  hasJurisdiction,
  type Jurisdiction,
} from "@/lib/legal/jurisdiction";

/**
 * Always-visible indicator of the legal framework currently being applied
 * (Part 5.6). Renders as a button when `onClick` is provided (change/set
 * jurisdiction), otherwise a static pill.
 */
export function JurisdictionIndicator({
  jurisdiction,
  onClick,
  className,
}: {
  jurisdiction: Jurisdiction | null | undefined;
  onClick?: () => void;
  className?: string;
}) {
  const set = hasJurisdiction(jurisdiction);
  const label = formatJurisdiction(jurisdiction);

  const content = (
    <>
      <MapPin
        className={cn("h-3.5 w-3.5 shrink-0", set ? "text-accent" : "text-muted")}
        aria-hidden="true"
      />
      <span className="truncate">
        <span className="sr-only">Jurisdiction: </span>
        {label}
      </span>
    </>
  );

  const shared =
    "inline-flex max-w-full items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium";

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={`Jurisdiction: ${label}. Change jurisdiction.`}
        className={cn(
          shared,
          "border-border bg-surface text-foreground transition-colors duration-150 hover:border-border-strong hover:bg-surface-sunken",
          !set && "border-dashed text-muted",
          className,
        )}
      >
        {content}
      </button>
    );
  }

  return (
    <span
      className={cn(
        shared,
        "border-border bg-surface text-foreground",
        !set && "border-dashed text-muted",
        className,
      )}
    >
      {content}
    </span>
  );
}
