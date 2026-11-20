import {
  BellRing,
  FileSearch,
  Gavel,
  Link2,
  Lock,
  MapPin,
  PenLine,
} from "lucide-react";
import { Reveal } from "./reveal";
import { Tilt3D } from "./tilt";

function Card({
  Icon,
  title,
  body,
  children,
  className = "",
  delay = 0,
}: {
  Icon: typeof Link2;
  title: string;
  body: string;
  children?: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <Reveal delay={delay} className={className}>
      <Tilt3D max={4} className="rounded-2xl">
        <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-sm)]">
          <Icon className="h-5 w-5 text-accent" aria-hidden="true" />
          <h3 className="mt-4 text-lg font-semibold tracking-tight text-foreground">{title}</h3>
          <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{body}</p>
          {children && <div className="mt-5 flex-1">{children}</div>}
        </div>
      </Tilt3D>
    </Reveal>
  );
}

/** The product at a glance, with small truthful previews of each feature. */
export function FeatureBento() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
      <Reveal>
        <div className="max-w-2xl">
          <p className="text-sm font-medium tracking-wide text-accent">Everything in one place</p>
          <h2 className="font-display mt-3 text-4xl text-foreground sm:text-5xl">
            From &ldquo;what does this mean?&rdquo; to a clear next step
          </h2>
        </div>
      </Reveal>

      <div className="mt-12 grid gap-4 md:grid-cols-6">
        <Card
          className="md:col-span-3"
          Icon={Link2}
          title="Answers that show their sources"
          body="Lexa checks current sources, favors statutes and official pages, and links to what it used. If it isn't sure, it says so."
        >
          <ul className="space-y-2 text-[13px]" aria-hidden="true">
            {["California Civil Code § 1950.5", "California Courts Self-Help"].map((source) => (
              <li key={source} className="flex items-center gap-2 rounded-lg bg-surface-sunken px-3 py-2 text-muted-strong">
                <Link2 className="h-3.5 w-3.5 shrink-0 text-accent" />
                {source}
              </li>
            ))}
          </ul>
        </Card>

        <Card
          className="md:col-span-3"
          delay={70}
          Icon={FileSearch}
          title="Document Intelligence"
          body="Upload a contract or snap a notice. See obligations, deadlines, and risky clauses, tied to the exact words behind them."
        >
          <div className="space-y-2 text-[13px]" aria-hidden="true">
            <div className="rounded-lg border border-alert/30 bg-alert-soft px-3 py-2 text-muted-strong">
              <span className="font-medium text-alert">High concern</span> Entry at any time without notice
            </div>
            <div className="rounded-lg bg-surface-sunken px-3 py-2 text-muted-strong">
              <span className="font-medium text-foreground">Key date</span> Give notice by November 1
            </div>
          </div>
        </Card>

        <Card
          className="md:col-span-2"
          delay={40}
          Icon={MapPin}
          title="Scoped to where you live"
          body="249 countries and territories, with full state or province detail for the US, Canada, UK, Australia, and India."
        />
        <Card
          className="md:col-span-2"
          delay={90}
          Icon={PenLine}
          title="Drafts with the judgment calls flagged"
          body="Demand letters, notices, and agreements. Missing facts become placeholders, and you can export to PDF or Word."
        />
        <Card
          className="md:col-span-2"
          delay={140}
          Icon={BellRing}
          title="Deadlines you won't miss"
          body="Keep every date with its matter, get reminders, and watch the countdown live on the day it's due."
        />

        <Card
          className="md:col-span-3"
          delay={40}
          Icon={Gavel}
          title="An honest read on when you need a lawyer"
          body="When stakes are high, Lexa says so plainly, and you can share a matter with a verified lawyer from the directory."
        />
        <Card
          className="md:col-span-3"
          delay={90}
          Icon={Lock}
          title="Private by design"
          body="Row-level security isolates every account in the database. Lexa asks before sharing anything with an AI provider, and you can delete everything at any time."
        />
      </div>
    </section>
  );
}
