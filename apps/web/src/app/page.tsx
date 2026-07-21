import Link from "next/link";
import {
  ArrowRight,
  Check,
  Globe2,
  Layers,
  MessageSquareQuote,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { DisclaimerBanner } from "@/components/compliance/disclaimer-banner";
import { Reveal } from "@/components/marketing/reveal";
import { LiveChatDemo } from "@/components/marketing/live-chat-demo";
import { DocIntelligenceDemo } from "@/components/marketing/doc-intelligence-demo";
import { AudienceTabs } from "@/components/marketing/audience-tabs";

const credibility = [
  {
    Icon: Globe2,
    title: "Jurisdiction-aware",
    body: "Every answer is scoped to your country and state — never generic advice.",
  },
  {
    Icon: ShieldCheck,
    title: "Provably isolated",
    body: "Row-level security on every table, verified by 60 automated tests.",
  },
  {
    Icon: Layers,
    title: "Three platforms",
    body: "One backend serving web, desktop, and mobile from a shared design system.",
  },
  {
    Icon: MessageSquareQuote,
    title: "Information, not advice",
    body: "The disclaimer is structural — no AI output can ship without it.",
  },
];

const steps = [
  {
    n: "01",
    title: "Describe your situation",
    body: "In plain words. No legal vocabulary required — just what happened.",
  },
  {
    n: "02",
    title: "Get scoped guidance",
    body: "Answers framed by your jurisdiction, with sources and honest uncertainty where it matters.",
  },
  {
    n: "03",
    title: "Act with confidence",
    body: "Generate the document, track the deadline, or connect with a verified lawyer.",
  },
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
    features: [
      "Unlimited chat & matters",
      "Full document generation",
      "Document Intelligence",
      "Priority support",
    ],
    cta: "Start Plus",
    href: "/get-started?plan=plus",
    featured: true,
  },
  {
    name: "Professional",
    audience: "For lawyers",
    price: "$49.99",
    cadence: "per month",
    features: [
      "Research + drafting tools",
      "Client intake automation",
      "Case management lite",
      "Marketplace profile",
    ],
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
        {/* ---------------------------------------------------------- Hero */}
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            <div
              className="lm-grid absolute inset-0 opacity-40"
              style={{
                maskImage: "radial-gradient(75% 60% at 50% 0%, black, transparent)",
                WebkitMaskImage: "radial-gradient(75% 60% at 50% 0%, black, transparent)",
              }}
            />
            <div className="absolute -right-32 -top-40 h-[540px] w-[540px] animate-drift rounded-full bg-[radial-gradient(circle,var(--accent-soft),transparent_70%)] blur-2xl" />
            <div className="absolute -left-24 -top-24 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--primary)_16%,transparent),transparent_70%)] blur-3xl" />
          </div>

          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
            <div className="flex flex-col justify-center">
              <div className="animate-fade-in-up">
                <Badge tone="accent" className="w-fit">
                  <Sparkles className="h-3 w-3" aria-hidden="true" />
                  Legal clarity, for everyone
                </Badge>
              </div>

              <h1
                className="mt-5 animate-fade-in-up font-serif text-4xl font-medium leading-[1.06] tracking-tight text-foreground sm:text-5xl lg:text-[3.5rem]"
                style={{ animationDelay: "80ms" }}
              >
                Understand your legal situation{" "}
                <span className="text-gold-gradient">in minutes</span>.
              </h1>

              <p
                className="mt-5 max-w-xl animate-fade-in-up text-lg leading-relaxed text-muted"
                style={{ animationDelay: "160ms" }}
              >
                LexMind turns dense legal language into plain answers, explains the
                documents you’re handed, and drafts what you need — all scoped to your
                jurisdiction. Built for people, and the lawyers who help them.
              </p>

              <div
                className="mt-8 flex animate-fade-in-up flex-wrap items-center gap-3"
                style={{ animationDelay: "240ms" }}
              >
                <Link
                  href="/get-started"
                  className={buttonVariants({ variant: "primary", size: "lg" })}
                >
                  Get started free
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  href="#document-intelligence"
                  className={buttonVariants({ variant: "secondary", size: "lg" })}
                >
                  See how it works
                </Link>
              </div>

              <div className="mt-8 animate-fade-in-up" style={{ animationDelay: "320ms" }}>
                <DisclaimerBanner variant="compact" />
              </div>
            </div>

            <div className="flex items-center animate-fade-in" style={{ animationDelay: "200ms" }}>
              <LiveChatDemo />
            </div>
          </div>
        </section>

        {/* -------------------------------------------------- Credibility */}
        <section className="border-y border-border bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {credibility.map(({ Icon, title, body }, i) => (
                <Reveal key={title} delay={i * 80}>
                  <div className="flex flex-col gap-2">
                    <Icon className="h-5 w-5 text-accent" aria-hidden="true" />
                    <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                    <p className="text-sm leading-relaxed text-muted">{body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
            <Reveal delay={280}>
              <p className="mt-10 border-t border-border pt-6 text-center text-xs tracking-wide text-muted">
                Engineered with Next.js · Supabase · PostgreSQL RLS · Tailwind · Tauri · Flutter
              </p>
            </Reveal>
          </div>
        </section>

        {/* ------------------------------ Signature: Doc Intelligence */}
        <section id="document-intelligence" className="scroll-mt-20">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
            <Reveal>
              <div className="mx-auto max-w-2xl text-center">
                <Badge tone="accent" className="mx-auto">
                  Signature feature
                </Badge>
                <h2 className="mt-4 font-serif text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
                  See what the fine print actually says
                </h2>
                <p className="mt-3 text-muted">
                  Upload a contract or notice and LexMind puts the original beside a
                  plain-language reading — obligations, deadlines, and the clauses worth
                  worrying about. Hover a highlighted clause to see why it was flagged.
                </p>
              </div>
            </Reveal>

            <Reveal delay={120} className="mt-12">
              <DocIntelligenceDemo />
            </Reveal>
          </div>
        </section>

        {/* --------------------------------------------- How it works */}
        <section className="border-y border-border bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
            <Reveal>
              <div className="max-w-xl">
                <Badge tone="neutral">How it works</Badge>
                <h2 className="mt-4 font-serif text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
                  From confusion to a clear next step
                </h2>
              </div>
            </Reveal>

            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {steps.map((s, i) => (
                <Reveal key={s.n} delay={i * 100}>
                  <div className="relative h-full rounded-xl border border-border bg-background p-6 transition-colors duration-200 hover:border-accent">
                    <span className="font-serif text-2xl font-medium text-accent">{s.n}</span>
                    <h3 className="mt-3 font-medium text-foreground">{s.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------ Dual audience */}
        <section id="for-people" className="scroll-mt-20">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
            <Reveal>
              <div className="mx-auto max-w-2xl text-center">
                <h2 className="font-serif text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
                  One platform, two very different jobs
                </h2>
                <p className="mt-3 text-muted">
                  The same jurisdiction-aware engine, shaped around who’s asking.
                </p>
              </div>
            </Reveal>
            <Reveal delay={120} className="mt-10">
              <div id="for-lawyers" className="scroll-mt-20">
                <AudienceTabs />
              </div>
            </Reveal>
          </div>
        </section>

        {/* ------------------------------------------------- Pricing */}
        <section id="pricing" className="scroll-mt-20 border-t border-border bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
            <Reveal>
              <div className="mx-auto max-w-2xl text-center">
                <Badge tone="neutral" className="mx-auto">
                  Pricing
                </Badge>
                <h2 className="mt-4 font-serif text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
                  Simple plans for both sides
                </h2>
                <p className="mt-3 text-muted">
                  Start free. Upgrade when LexMind is doing real work for you.
                </p>
              </div>
            </Reveal>

            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              {tiers.map((tier, i) => (
                <Reveal key={tier.name} delay={i * 90}>
                  <Card
                    raised={tier.featured}
                    className={
                      tier.featured
                        ? "relative h-full border-accent/50 ring-1 ring-accent/30"
                        : "h-full"
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
                        <span className="text-3xl font-semibold text-foreground">
                          {tier.price}
                        </span>
                        <span className="text-sm text-muted">{tier.cadence}</span>
                      </div>
                      <ul className="mt-6 space-y-3">
                        {tier.features.map((f) => (
                          <li
                            key={f}
                            className="flex items-start gap-2.5 text-sm text-muted-strong"
                          >
                            <Check
                              className="mt-0.5 h-4 w-4 shrink-0 text-success"
                              aria-hidden="true"
                            />
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
                </Reveal>
              ))}
            </div>

            <p className="mt-6 text-center text-xs text-muted">
              Plus a ~15% marketplace commission when a consumer hires a lawyer found
              through LexMind.
            </p>
          </div>
        </section>

        {/* ---------------------------------------------- Closing CTA */}
        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
            <Reveal>
              <div className="relative overflow-hidden rounded-2xl bg-primary px-6 py-14 text-center sm:px-12">
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-60"
                  style={{
                    backgroundImage:
                      "radial-gradient(60% 80% at 50% 0%, color-mix(in srgb, var(--gold-accent) 22%, transparent), transparent 70%)",
                  }}
                />
                <div className="relative">
                  <h2 className="mx-auto max-w-2xl font-serif text-3xl font-medium leading-tight tracking-tight text-primary-foreground sm:text-4xl">
                    Stop guessing what your legal documents mean.
                  </h2>
                  <p className="mx-auto mt-4 max-w-lg text-primary-foreground/70">
                    Ask a question, upload a document, or find a lawyer — free to start,
                    no card required.
                  </p>
                  <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                    <Link
                      href="/get-started"
                      className={buttonVariants({ variant: "accent", size: "lg" })}
                    >
                      Get started free
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                    <Link
                      href="/sign-in"
                      className="inline-flex h-12 items-center rounded-lg px-6 text-base font-medium text-primary-foreground/80 transition-colors duration-150 hover:text-primary-foreground"
                    >
                      Sign in
                    </Link>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
