import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, MapPin, Star } from "lucide-react";
import { getViewer } from "@/lib/auth/session";
import { getLawyerPublicProfile } from "@/lib/lawyers/queries";
import { listMatters } from "@/lib/matters/queries";
import { GENERAL_CATEGORY } from "@/lib/matters/categories";
import { RESEARCH_CATEGORY } from "@/lib/matters/default-matter";
import {
  RequestLawyerPanel,
  type RequestableMatter,
} from "@/components/marketplace/request-lawyer-panel";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Lawyer profile" };

/** Public (verified-only) lawyer profile + the request flow (Phase 9). */
export default async function LawyerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, viewer] = await Promise.all([params, getViewer()]);
  if (!viewer.user) return null; // (app) layout redirects

  const lawyer = await getLawyerPublicProfile(id);
  if (!lawyer) notFound();

  const matters = await listMatters(viewer.user.id);
  const requestable: RequestableMatter[] = matters
    .filter(
      (m) =>
        m.category !== GENERAL_CATEGORY && m.category !== RESEARCH_CATEGORY,
    )
    .map((m) => ({ id: m.id, title: m.title }));

  const initials = lawyer.name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="space-y-6">
      <header className="animate-fade-in-up">
        <Link
          href="/find-a-lawyer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors duration-150 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Find a lawyer
        </Link>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          <div className="flex items-start gap-4">
            <span
              aria-hidden="true"
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary font-serif text-2xl font-medium text-primary-foreground"
            >
              {initials || "L"}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-serif text-3xl font-medium tracking-tight text-foreground">
                  {lawyer.name}
                </h1>
                {lawyer.verified && (
                  <Badge tone="success">
                    <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    Verified
                  </Badge>
                )}
              </div>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                <span className="inline-flex items-center gap-1">
                  <Star
                    className={
                      lawyer.ratingAvg
                        ? "h-4 w-4 fill-accent text-accent"
                        : "h-4 w-4 text-muted"
                    }
                    aria-hidden="true"
                  />
                  {lawyer.ratingAvg
                    ? `${lawyer.ratingAvg.toFixed(1)} rating`
                    : "New to LexMind"}
                </span>
                {lawyer.rateRange && <span>{lawyer.rateRange}</span>}
              </p>
              {lawyer.licensedJurisdictions.length > 0 && (
                <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-muted-strong">
                  <MapPin className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                  Licensed in {lawyer.licensedJurisdictions.join(" · ")}
                </p>
              )}
            </div>
          </div>

          {lawyer.practiceAreas.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {lawyer.practiceAreas.map((area) => (
                <Badge key={area} tone="neutral">
                  {area}
                </Badge>
              ))}
            </div>
          )}

          {lawyer.bio && (
            <Card className="p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                About
              </h2>
              <p className="legal-prose mt-2 text-[15px] text-foreground">
                {lawyer.bio}
              </p>
            </Card>
          )}

          <Card className="p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              How working together starts
            </h2>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-foreground marker:font-medium marker:text-accent">
              <li className="pl-1">
                You share a matter — its brief, documents, and message thread.
              </li>
              <li className="pl-1">
                {lawyer.name} reviews it and replies in the thread.
              </li>
              <li className="pl-1">
                If it&rsquo;s a fit, they accept — engagement terms are agreed
                between you directly.
              </li>
            </ol>
          </Card>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <RequestLawyerPanel
            lawyerId={lawyer.userId}
            lawyerName={lawyer.name}
            matters={requestable}
            isDemo={viewer.isDemo}
          />
        </aside>
      </div>
    </div>
  );
}
