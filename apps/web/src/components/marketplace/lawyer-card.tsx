import Link from "next/link";
import { BadgeCheck, MapPin, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { MarketplaceLawyer } from "@/lib/lawyers/queries";
import { cn } from "@/lib/utils";

/**
 * One lawyer in the marketplace (Phase 9) — used by the consumer directory
 * and as the live preview in the lawyer's own profile editor. Trust signals
 * lead: verified badge, licensed jurisdictions, honest rating ("New" until
 * reviews exist).
 */
export function LawyerCard({
  lawyer,
  href,
  className,
}: {
  lawyer: MarketplaceLawyer;
  /** When set, the card links (directory); without, it's static (preview). */
  href?: string;
  className?: string;
}) {
  const initials = lawyer.name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const inner = (
    <Card
      className={cn(
        "flex h-full flex-col p-5",
        href && "transition-colors duration-150 group-hover:border-accent",
        className,
      )}
    >
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden="true"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary font-serif text-lg font-medium text-primary-foreground"
        >
          {initials || "L"}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="font-serif text-lg font-medium leading-snug tracking-tight text-foreground">
              {lawyer.name}
            </h3>
            {lawyer.verified && (
              <Badge tone="success">
                <BadgeCheck className="h-3 w-3" aria-hidden="true" />
                Verified
              </Badge>
            )}
          </div>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
            <Star
              className={cn(
                "h-3.5 w-3.5",
                lawyer.ratingAvg ? "fill-accent text-accent" : "text-muted",
              )}
              aria-hidden="true"
            />
            {lawyer.ratingAvg ? (
              <>
                {lawyer.ratingAvg.toFixed(1)}
                <span aria-hidden="true"> · </span>
                {lawyer.rateRange ?? "Rates on request"}
              </>
            ) : (
              <>
                New to Justice
                {lawyer.rateRange && (
                  <>
                    <span aria-hidden="true"> · </span>
                    {lawyer.rateRange}
                  </>
                )}
              </>
            )}
          </p>
        </div>
      </div>

      {lawyer.practiceAreas.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {lawyer.practiceAreas.slice(0, 4).map((area) => (
            <Badge key={area} tone="neutral">
              {area}
            </Badge>
          ))}
          {lawyer.practiceAreas.length > 4 && (
            <Badge tone="neutral">+{lawyer.practiceAreas.length - 4}</Badge>
          )}
        </div>
      )}

      {lawyer.bio && (
        <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted">
          {lawyer.bio}
        </p>
      )}

      {lawyer.licensedJurisdictions.length > 0 && (
        <p className="mt-auto flex items-center gap-1.5 pt-4 text-xs font-medium text-muted">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
          <span className="truncate">
            Licensed in {lawyer.licensedJurisdictions.join(" · ")}
          </span>
        </p>
      )}
    </Card>
  );

  return href ? (
    <Link href={href} className="group block h-full">
      {inner}
    </Link>
  ) : (
    inner
  );
}
