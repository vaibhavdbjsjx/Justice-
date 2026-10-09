import Link from "next/link";
import { Logo } from "./logo";
import { DISCLAIMER_FULL } from "@/lib/legal/disclaimers";

const columns = [
  {
    title: "Product",
    links: [
      { href: "/#for-people", label: "For people" },
      { href: "/#for-lawyers", label: "For lawyers" },
      { href: "/#pricing", label: "Pricing" },
      { href: "/find-a-lawyer", label: "Find a lawyer" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/security", label: "Security" },
      { href: "/contact", label: "Support" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms of service" },
      { href: "/privacy", label: "Privacy policy" },
      { href: "/disclaimer", label: "Legal disclaimer" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-surface-sunken">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div className="space-y-3">
            <Logo />
            <p className="max-w-xs text-sm leading-relaxed text-muted">
              Understand your legal situation in minutes. Built for people — and
              the lawyers who help them.
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
                {col.title}
              </h4>
              <ul className="mt-3 space-y-2">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-strong transition-colors duration-150 hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 border-t border-border pt-6">
          <p className="max-w-3xl text-xs leading-relaxed text-muted">
            {DISCLAIMER_FULL}
          </p>
          <p className="mt-4 text-xs text-muted">
            © {new Date().getFullYear()} Justice. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
