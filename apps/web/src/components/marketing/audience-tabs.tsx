"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FileText,
  Gavel,
  MessagesSquare,
  Scale,
  Search,
  Users,
  type LucideIcon,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Audience = "people" | "lawyers";

const CONTENT: Record<
  Audience,
  {
    label: string;
    headline: string;
    body: string;
    cta: { href: string; label: string };
    features: { Icon: LucideIcon; title: string; body: string }[];
  }
> = {
  people: {
    label: "For people",
    headline: "Legal help that speaks plainly",
    body: "Get oriented fast, understand what you’re signing, and know when a situation genuinely needs a professional.",
    cta: { href: "/get-started", label: "Get legal clarity" },
    features: [
      { Icon: MessagesSquare, title: "Plain-language answers", body: "Ask about your situation and get clear, jurisdiction-aware guidance — never legalese." },
      { Icon: FileText, title: "Understand any document", body: "Upload a contract or notice and see obligations, deadlines, and risky clauses explained." },
      { Icon: Scale, title: "Know when you need a lawyer", body: "An honest read on complexity and stakes — and verified help when it actually matters." },
    ],
  },
  lawyers: {
    label: "For lawyers",
    headline: "Research and draft, accelerated",
    body: "A research accelerator and drafting assistant with citation discipline built in — you stay in control, always.",
    cta: { href: "/get-started?plan=professional", label: "Explore professional tools" },
    features: [
      { Icon: Search, title: "Research accelerator", body: "Jurisdiction-scoped case law and statute research with sources you can verify." },
      { Icon: Gavel, title: "Drafting assistant", body: "First drafts and redlines for contracts, motions, and letters — flagged where judgment is needed." },
      { Icon: Users, title: "Client intake, automated", body: "A branded intake link turns a client’s situation into a structured case brief." },
    ],
  },
};

const ORDER: Audience[] = ["people", "lawyers"];

/** Segmented dual-audience showcase — one platform, two very different jobs. */
export function AudienceTabs() {
  const [active, setActive] = useState<Audience>("people");
  const data = CONTENT[active];

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const i = ORDER.indexOf(active);
    const next = e.key === "ArrowRight" ? (i + 1) % ORDER.length : (i - 1 + ORDER.length) % ORDER.length;
    setActive(ORDER[next]);
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="Choose an audience"
        onKeyDown={onKeyDown}
        className="mx-auto flex w-fit items-center gap-1 rounded-xl border border-border bg-surface p-1"
      >
        {ORDER.map((key) => (
          <button
            key={key}
            role="tab"
            aria-selected={active === key}
            tabIndex={active === key ? 0 : -1}
            onClick={() => setActive(key)}
            className={cn(
              "rounded-lg px-5 py-2 text-sm font-medium transition-colors duration-200",
              active === key
                ? "bg-primary text-primary-foreground shadow-[var(--shadow-sm)]"
                : "text-muted hover:text-foreground",
            )}
          >
            {CONTENT[key].label}
          </button>
        ))}
      </div>

      <div key={active} className="mt-10 grid animate-fade-in-up gap-10 lg:grid-cols-2 lg:items-center">
        <div>
          <h3 className="max-w-md font-serif text-3xl font-medium leading-tight tracking-tight text-foreground sm:text-4xl">
            {data.headline}
          </h3>
          <p className="mt-4 max-w-md text-muted">{data.body}</p>
          <Link
            href={data.cta.href}
            className={buttonVariants({ variant: "primary", size: "md", className: "mt-7" })}
          >
            {data.cta.label}
          </Link>
        </div>

        <div className="space-y-4">
          {data.features.map(({ Icon, title, body }) => (
            <div
              key={title}
              className="flex gap-4 rounded-xl border border-border bg-background p-5 transition-colors duration-200 hover:border-accent"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft">
                <Icon className="h-5 w-5 text-accent" aria-hidden="true" />
              </span>
              <div>
                <h4 className="font-medium text-foreground">{title}</h4>
                <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
