import type { Metadata } from "next";
import Link from "next/link";
import { HelpCircle, Mail, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import {
  COMPANY_NAME,
  SUPPORT_EMAIL,
  PRIVACY_EMAIL,
} from "@/lib/legal/company";

export const metadata: Metadata = {
  title: "Support & Contact",
  description: `Get help with ${COMPANY_NAME}. We're here to answer questions about your account, billing, and the product.`,
};

const topics = [
  {
    Icon: HelpCircle,
    title: "Help & account",
    body: "Questions about using Justice, your account, or a technical issue.",
    email: SUPPORT_EMAIL,
  },
  {
    Icon: ShieldCheck,
    title: "Privacy & data",
    body: "Requests to access, export, or delete your personal information.",
    email: PRIVACY_EMAIL,
  },
];

export default function ContactPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-20">
          <header className="animate-fade-in-up text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">
              Support
            </p>
            <h1 className="mt-2 font-serif text-4xl font-medium tracking-tight text-foreground">
              We&rsquo;re here to help
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-muted">
              Reach a real person. We aim to reply to every message within one to
              two business days.
            </p>
            <div className="mt-8">
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className={buttonVariants({ variant: "primary", size: "lg" })}
              >
                <Mail className="h-4 w-4" aria-hidden="true" />
                Email support
              </a>
            </div>
          </header>

          <div className="mt-14 grid gap-4 sm:grid-cols-2">
            {topics.map(({ Icon, title, body, email }) => (
              <Card key={title} className="p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent-soft">
                  <Icon className="h-5 w-5 text-accent" aria-hidden="true" />
                </span>
                <h2 className="mt-4 font-serif text-lg font-medium text-foreground">
                  {title}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
                <a
                  href={`mailto:${email}`}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent underline-offset-4 hover:underline"
                >
                  <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                  {email}
                </a>
              </Card>
            ))}
          </div>

          <div className="mt-10 rounded-xl border border-border bg-surface-sunken p-6 text-center">
            <p className="text-sm text-muted">
              Looking for something specific? See our{" "}
              <Link href="/privacy" className="font-medium text-accent underline-offset-4 hover:underline">
                Privacy Policy
              </Link>
              ,{" "}
              <Link href="/terms" className="font-medium text-accent underline-offset-4 hover:underline">
                Terms of Service
              </Link>
              , or{" "}
              <Link href="/security" className="font-medium text-accent underline-offset-4 hover:underline">
                Security practices
              </Link>
              .
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
