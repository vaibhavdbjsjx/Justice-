import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, MapPin } from "lucide-react";
import { getViewer } from "@/lib/auth/session";
import { resolveIntakeToken } from "@/lib/intake/queries";
import { INTAKE_NOTICE } from "@/lib/legal/disclaimers";
import { IntakeForm } from "@/components/intake/intake-form";
import { Logo } from "@/components/site/logo";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Tell us about your situation" };

/**
 * Public intake landing (Phase 8, Part 4.3) — the lawyer's branded link.
 * Anyone can view it; submitting requires an account (the form stashes and
 * routes through sign-up, then restores). Unknown/revoked tokens 404 without
 * hinting why.
 */
export default async function IntakePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const [{ token }, viewer] = await Promise.all([params, getViewer()]);
  const branding = await resolveIntakeToken(token);
  if (!branding) notFound();

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="Justice home">
            <Logo />
          </Link>
          <span className="text-xs text-muted">Secure client intake</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
        {/* Lawyer branding */}
        <Card raised className="p-6 animate-fade-in-up">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted">You&rsquo;ve been invited to share your situation with</p>
              <h1 className="mt-1 flex items-center gap-2 font-serif text-2xl font-medium tracking-tight text-foreground">
                {branding.name}
                {branding.verified && (
                  <Badge tone="success">
                    <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    Verified
                  </Badge>
                )}
              </h1>
            </div>
            {branding.licensedJurisdictions.length > 0 && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
                <MapPin className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                Licensed in {branding.licensedJurisdictions.join(" · ")}
              </p>
            )}
          </div>
          {branding.practiceAreas.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {branding.practiceAreas.map((area) => (
                <Badge key={area} tone="neutral">
                  {area}
                </Badge>
              ))}
            </div>
          )}
          {branding.bio && (
            <p className="mt-3 text-sm leading-relaxed text-muted">{branding.bio}</p>
          )}
        </Card>

        <p className="text-xs leading-relaxed text-muted">{INTAKE_NOTICE}</p>

        <IntakeForm
          token={token}
          lawyerName={branding.name}
          authed={Boolean(viewer.user)}
          isDemo={viewer.isDemo}
        />
      </main>
    </div>
  );
}
