import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FolderKanban, Users } from "lucide-react";
import { getViewer } from "@/lib/auth/session";
import { getViewerTier } from "@/lib/billing/gate";
import { LockedPanel } from "@/components/billing/locked-panel";
import { listClientMatters, listIntakeLinks } from "@/lib/clients/queries";
import { categoryLabel } from "@/lib/matters/categories";
import { formatJurisdiction } from "@/lib/legal/jurisdiction";
import { IntakeLinkManager } from "@/components/clients/intake-link-manager";
import { MatterStatusBadge } from "@/components/matters/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Clients" };

/**
 * Lawyer client/matter dashboard (Phase 8, Part 4.3). Shared matters arrive
 * via intake links (or client-initiated shares); RLS scopes everything to
 * this lawyer's own links.
 */
export default async function ClientsPage() {
  const viewer = await getViewer();
  if (!viewer.user) return null; // (app) layout redirects
  if (viewer.profile?.role !== "lawyer" && !viewer.isDemo) {
    redirect("/dashboard");
  }
  if ((await getViewerTier(viewer)) !== "professional") {
    return (
      <LockedPanel
        title="Client intake & case management"
        body="Branded intake links that turn a client's situation into a structured case brief, with matters, deadlines, and a permanent communication log."
        tier="professional"
      />
    );
  }

  const [links, clientMatters] = await Promise.all([
    listIntakeLinks(),
    listClientMatters(),
  ]);

  return (
    <div className="space-y-8">
      <header className="animate-fade-in-up">
        <p className="text-sm text-muted">Client intake &amp; case management</p>
        <h1 className="mt-1 font-serif text-3xl font-medium tracking-tight text-foreground">
          Clients
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          Share your intake link anywhere clients find you. Every submission
          arrives as a structured case brief — facts, timeline, urgency — with
          a message thread attached.
        </p>
      </header>

      <section aria-label="Intake links">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Your intake links
        </h2>
        <IntakeLinkManager links={links} />
      </section>

      <section aria-label="Client matters">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Client matters
        </h2>
        {clientMatters.length === 0 ? (
          <Card className="p-6 text-center">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft">
              <Users className="h-5 w-5 text-accent" aria-hidden="true" />
            </span>
            <p className="mt-3 font-medium text-foreground">No clients yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-muted">
              When someone submits your intake link, their matter appears here
              with a case brief ready to review.
            </p>
          </Card>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {clientMatters.map(({ matter, clientName, sharedAt, linkStatus }) => (
              <li key={matter.id}>
                <Link href={`/clients/${matter.id}`} className="group block h-full">
                  <Card className="flex h-full flex-col p-5 transition-colors duration-150 hover:border-accent">
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft">
                        <FolderKanban className="h-5 w-5 text-accent" aria-hidden="true" />
                      </span>
                      <span className="flex items-center gap-1.5">
                        {linkStatus === "invited" && (
                          <Badge tone="accent">New request</Badge>
                        )}
                        <MatterStatusBadge status={matter.status} />
                      </span>
                    </div>
                    <h3 className="mt-3 font-serif text-lg font-medium leading-snug tracking-tight text-foreground">
                      {matter.title}
                    </h3>
                    <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted">
                      {clientName} · {categoryLabel(matter.category)}
                    </p>
                    <div className="mt-auto flex items-center justify-between gap-3 pt-4 text-xs text-muted">
                      <span className="truncate">
                        {formatJurisdiction({
                          country: matter.jurisdiction_country,
                          state: matter.jurisdiction_state,
                        })}
                      </span>
                      <span className="shrink-0">
                        Since{" "}
                        {new Date(sharedAt).toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
