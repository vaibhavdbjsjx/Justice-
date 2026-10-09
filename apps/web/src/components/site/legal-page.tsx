import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";

/**
 * Shared shell for marketing / legal / support pages: site chrome + a centered,
 * readable document column with a title, optional "last updated" line, and a
 * lede. Keeps every long-form page visually consistent and premium.
 */
export function LegalPage({
  eyebrow,
  title,
  updated,
  lede,
  children,
  footer,
}: {
  eyebrow?: string;
  title: string;
  updated?: string;
  lede?: string;
  children: React.ReactNode;
  /** Rendered outside the prose column (e.g. a CTA button that must keep its own styling). */
  footer?: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-20">
          <header className="animate-fade-in-up">
            {eyebrow && (
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">
                {eyebrow}
              </p>
            )}
            <h1 className="mt-2 font-serif text-4xl font-medium tracking-tight text-foreground">
              {title}
            </h1>
            {updated && (
              <p className="mt-3 text-sm text-muted">Last updated {updated}</p>
            )}
            {lede && (
              <p className="mt-5 text-lg leading-relaxed text-muted">{lede}</p>
            )}
          </header>

          <div className="doc-prose mt-10">{children}</div>
          {footer && <div className="mt-10">{footer}</div>}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
