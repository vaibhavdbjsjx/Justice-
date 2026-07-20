import Link from "next/link";
import {
  ArrowRight,
  Check,
  FileText,
  Gavel,
  MessagesSquare,
  Scale,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { AiLegalOutput } from "@/components/compliance/ai-legal-output";
import { DisclaimerBanner } from "@/components/compliance/disclaimer-banner";

const peopleFeatures = [
  { Icon: MessagesSquare, title: "Plain-language answers", body: "Ask about your situation and get clear, jurisdiction-aware guidance — not legalese." },
  { Icon: FileText, title: "Understand any document", body: "Upload a contract or notice and see the obligations, deadlines, and risky clauses explained." },
  { Icon: Scale, title: "Know when you need a lawyer", body: "An honest read on complexity and stakes — and a way to find verified help when it matters." },
];

const lawyerFeatures = [
  { Icon: Search, title: "Research accelerator", body: "Jurisdiction-scoped case law and statute research with sources you can verify." },
  { Icon: Gavel, title: "Drafting assistant", body: "First drafts and redlines for contracts, motions, and letters — you stay in control." },
  { Icon: Users, title: "Client intake, automated", body: "A branded intake link turns a client's situation into a structured case brief." },
];

const tiers = [
  {
    name: "Free",
    audience: "For people",
    price: "$0",
    cadence: "forever",
    features: ["Limited chats each month", "1 active matter", "Basic document generation"],
    cta: "Get started",
    href: "/get-started",
    featured: false,
  },
  {
    name: "Plus",
    audience: "For people",
    price: "$14.99",
    cadence: "per month",
    features: ["Unlimited chat & matters", "Full document generation", "Document Intelligence", "Priority support"],
    cta: "Start Plus",
    href: "/get-started?plan=plus",
    featured: true,
  },
  {
    name: "Professional",
    audience: "For lawyers",
    price: "$49.99",
    cadence: "per month",
    features: ["Research + drafting tools", "Client intake automation", "Case management lite", "Marketplace profile"],
    cta: "Start Professional",
    href: "/get-started?plan=professional",
    featured: false,
  },
];

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_80%_-10%,var(--accent-soft),transparent)]"
          />
          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
            <div className="flex flex-col justify-center animate-fade-in-up">
              <Badge tone="accent" className="w-fit">
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                Legal clarity, for everyone
              </Badge>
              <h1 className="mt-5 font-serif text-4xl font-medium leading-[1.08] tracking-tight text-foreground sm:text-5xl lg:text-[3.4rem]">
                Understand your legal situation in minutes.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
                LexMind is a private legal advisor in your pocket — plain-language
                answers, document intelligence, and drafting help. Built for
                people, and the lawyers who help them.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/get-started" className={buttonVariants({ variant: "primary", size: "lg" })}>
                  Get started free
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link href="/#for-lawyers" className={buttonVariants({ variant: "secondary", size: "lg" })}>
                  For legal professionals
                </Link>
              </div>
              <div className="mt-8">
                <DisclaimerBanner variant="compact" />
              </div>
            </div>

            {/* Advisor card mock — product proof, uses real compliance components */}
            <div className="flex items-center animate-fade-in">
              <Card raised className="w-full overflow-hidden">
                <div className="flex items-center gap-2 border-b border-border bg-surface-sunken px-5 py-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
                    <Scale className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                  </span>
                  <span className="text-sm font-medium text-foreground">LexMind advisor</span>
                </div>
                <div className="space-y-4 p-5">
                  <div className="ml-auto w-fit max-w-[85%] rounded-lg rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                    My landlord wants me out in 7 days. Is that legal?
                  </div>
                  <AiLegalOutput
                    jurisdiction={{ country: "United States", state: "California" }}
                    highStakes
                    findLawyerAction={
                      <Link
                        href="/find-a-lawyer"
                        className={buttonVariants({ variant: "accent", size: "sm" })}
                      >
                        Find a lawyer
                      </Link>
                    }
                  >
                    <p className="text-sm">
                      In California, a landlord usually can&apos;t force you out in 7 days.
                      Most no-fault situations require a <strong>30- or 60-day written
                      notice</strong>, and only a court can order an eviction — not the
                      landlord directly.
                    </p>
                  </AiLegalOutput>
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* For people */}
        <AudienceSection
          id="for-people"
          eyebrow="For people"
          title="Legal help that speaks plainly"
          description="Get oriented fast, understand what you're signing, and know when a situation genuinely needs a professional."
          features={peopleFeatures}
          cta={{ href: "/get-started", label: "Get legal clarity" }}
        />

        {/* For lawyers */}
        <AudienceSection
          id="for-lawyers"
          eyebrow="For lawyers"
          title="Research and draft, accelerated"
          description="A research accelerator and drafting assistant that respects citation discipline — you stay in control, always."
          features={lawyerFeatures}
          cta={{ href: "/get-started?plan=professional", label: "Explore professional tools" }}
          reversed
        />

        {/* Pricing */}
        <section id="pricing" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <Badge tone="neutral" className="mx-auto">Pricing</Badge>
            <h2 className="mt-4 font-serif text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
              Simple plans for both sides
            </h2>
            <p className="mt-3 text-muted">
              Start free. Upgrade when LexMind is doing real work for you.
            </p>
          </div>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {tiers.map((tier) => (
              <Card
                key={tier.name}
                raised={tier.featured}
                className={
                  tier.featured
                    ? "relative border-accent/50 ring-1 ring-accent/30"
                    : undefined
                }
              >
                <div className="p-6">
                  {tier.featured && (
                    <Badge tone="accent" className="absolute right-6 top-6">
                      Most popular
                    </Badge>
                  )}
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">
                    {tier.audience}
                  </p>
                  <h3 className="mt-1 font-serif text-2xl font-medium text-foreground">
                    {tier.name}
                  </h3>
                  <div className="mt-3 flex items-baseline gap-1.5">
                    <span className="text-3xl font-semibold text-foreground">{tier.price}</span>
                    <span className="text-sm text-muted">{tier.cadence}</span>
                  </div>
                  <ul className="mt-6 space-y-3">
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-muted-strong">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={tier.href}
                    className={buttonVariants({
                      variant: tier.featured ? "accent" : "secondary",
                      size: "md",
                      className: "mt-7 w-full",
                    })}
                  >
                    {tier.cta}
                  </Link>
                </div>
              </Card>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-muted">
            Plus a ~15% marketplace commission when a consumer hires a lawyer found through LexMind.
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function AudienceSection({
  id,
  eyebrow,
  title,
  description,
  features,
  cta,
  reversed,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  features: { Icon: typeof Scale; title: string; body: string }[];
  cta: { href: string; label: string };
  reversed?: boolean;
}) {
  return (
    <section id={id} className="border-t border-border bg-surface">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <div className={`grid gap-10 lg:grid-cols-2 lg:items-center ${reversed ? "lg:[&>*:first-child]:order-2" : ""}`}>
          <div>
            <Badge tone={reversed ? "navy" : "accent"}>{eyebrow}</Badge>
            <h2 className="mt-4 max-w-md font-serif text-3xl font-medium leading-tight tracking-tight text-foreground sm:text-4xl">
              {title}
            </h2>
            <p className="mt-4 max-w-md text-muted">{description}</p>
            <Link
              href={cta.href}
              className={buttonVariants({ variant: "primary", size: "md", className: "mt-7" })}
            >
              {cta.label}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="space-y-4">
            {features.map(({ Icon, title: t, body }) => (
              <div
                key={t}
                className="flex gap-4 rounded-xl border border-border bg-background p-5 transition-colors duration-150 hover:border-border-strong"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft">
                  <Icon className="h-5 w-5 text-accent" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="font-medium text-foreground">{t}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
