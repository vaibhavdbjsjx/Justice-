import Link from "next/link";
import { Check, Lock } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TIER_FEATURES, TIER_PRICING } from "@/lib/billing/tiers";

/**
 * Premium locked state (Phase 10) for gated surfaces. Server-renderable;
 * shows what the tier unlocks and one calm path forward.
 */
export function LockedPanel({
  title,
  body,
  tier,
}: {
  title: string;
  body: string;
  tier: "plus" | "professional";
}) {
  const pricing = TIER_PRICING[tier];
  return (
    <Card raised className="mx-auto max-w-xl p-8 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-accent-soft">
        <Lock className="h-6 w-6 text-accent" aria-hidden="true" />
      </span>
      <h2 className="mt-5 font-serif text-2xl font-medium tracking-tight text-foreground">
        {title}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-muted">
        {body}
      </p>

      <ul className="mx-auto mt-6 max-w-sm space-y-2 text-left">
        {TIER_FEATURES[tier].map((feature) => (
          <li key={feature} className="flex gap-2.5 text-sm leading-relaxed text-foreground">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
            {feature}
          </li>
        ))}
      </ul>

      <div className="mt-7 flex flex-col items-center gap-2">
        <Link href="/billing" className={buttonVariants({ size: "lg" })}>
          Upgrade to {pricing.label} — {pricing.price}
          {pricing.cadence}
        </Link>
        <p className="text-xs text-muted">Cancel anytime from your billing page.</p>
      </div>
    </Card>
  );
}
