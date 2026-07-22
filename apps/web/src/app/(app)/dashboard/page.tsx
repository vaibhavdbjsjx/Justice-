import type { Metadata } from "next";
import Link from "next/link";
import {
  FileText,
  FolderKanban,
  MessagesSquare,
  PenLine,
  Search,
  Store,
  Users,
  type LucideIcon,
} from "lucide-react";
import { getViewer } from "@/lib/auth/session";
import { effectiveTier, getSubscription } from "@/lib/billing/gate";
import { tierLabel } from "@/lib/billing/tiers";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DisclaimerBanner } from "@/components/compliance/disclaimer-banner";
import { RESEARCH_ACCELERATOR_NOTICE } from "@/lib/legal/disclaimers";
import { languageName } from "@/lib/i18n/languages";
import { formatJurisdiction } from "@/lib/legal/jurisdiction";
import type { UserRole } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Dashboard" };

type Action = { icon: LucideIcon; title: string; body: string; href?: string };

const consumerActions: Action[] = [
  { icon: MessagesSquare, title: "Ask the assistant", body: "Describe your situation in plain language for clear, jurisdiction-aware guidance.", href: "/chat" },
  { icon: FolderKanban, title: "Start a matter", body: "Organize a case — chat, documents, and deadlines together in one place.", href: "/matters/new" },
  { icon: FileText, title: "Understand a document", body: "Upload a contract or notice and see obligations, deadlines, and risky clauses.", href: "/documents" },
  { icon: Users, title: "Find a lawyer", body: "Connect with verified lawyers when your situation genuinely needs one.", href: "/find-a-lawyer" },
];

const lawyerActions: Action[] = [
  { icon: Search, title: "Research a question", body: "Jurisdiction-scoped case law and statute research with sources you can verify.", href: "/research" },
  { icon: PenLine, title: "Draft a document", body: "Generate first drafts and redlines for contracts, motions, and letters.", href: "/drafting" },
  { icon: Users, title: "Client intake", body: "Share a branded link that turns a client's situation into a structured brief.", href: "/clients" },
  { icon: Store, title: "Marketplace profile", body: "Be discoverable by consumers who need your practice areas and jurisdiction.", href: "/marketplace" },
];

export default async function DashboardPage() {
  const viewer = await getViewer();
  const p = viewer.profile;
  const role: UserRole = p?.role ?? "consumer";
  const firstName = (p?.full_name ?? "").trim().split(" ")[0] || "there";
  const actions = role === "lawyer" ? lawyerActions : consumerActions;
  const tier = viewer.isDemo ? "free" : effectiveTier(await getSubscription());

  return (
    <div className="space-y-8">
      <header className="animate-fade-in-up">
        <p className="text-sm text-muted">
          {role === "lawyer" ? "Professional workspace" : "Your workspace"}
        </p>
        <h1 className="mt-1 font-serif text-3xl font-medium tracking-tight text-foreground">
          Good to see you, {firstName}.
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          {role === "lawyer"
            ? "Accelerate research and drafting, and manage your matters — with citation discipline built in."
            : "Start by asking a question or organizing a matter. Justice keeps everything scoped to your jurisdiction."}
        </p>
      </header>

      {/* Account summary */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          <SummaryItem label="Role" value={role === "lawyer" ? "Legal professional" : "Consumer"} />
          <SummaryItem label="Jurisdiction" value={formatJurisdiction({ country: p?.country ?? null, state: p?.state_province ?? null })} />
          <SummaryItem label="Language" value={languageName(p?.preferred_language)} />
          <div className="ml-auto">
            <Link href="/billing" aria-label="View plan and billing">
              <Badge tone={tier === "free" ? "neutral" : "accent"}>
                {tierLabel(tier)} plan
              </Badge>
            </Link>
          </div>
        </div>
      </Card>

      {/* Quick actions */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
          Quick actions
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {actions.map(({ icon: Icon, title, body, href }) => {
            const inner = (
              <>
                {!href && (
                  <Badge tone="neutral" className="absolute right-4 top-4">
                    Soon
                  </Badge>
                )}
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent-soft">
                  <Icon className="h-5 w-5 text-accent" aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-medium text-foreground">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
              </>
            );
            return href ? (
              <Link key={title} href={href} className="group">
                <Card className="relative h-full p-5 transition-colors duration-150 hover:border-accent">
                  {inner}
                </Card>
              </Link>
            ) : (
              <Card
                key={title}
                className="group relative p-5 transition-colors duration-150 hover:border-border-strong"
              >
                {inner}
              </Card>
            );
          })}
        </div>
      </section>

      {role === "lawyer" ? (
        <p className="border-t border-border pt-4 text-xs leading-relaxed text-muted">
          {RESEARCH_ACCELERATOR_NOTICE}
        </p>
      ) : (
        <DisclaimerBanner />
      )}
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
