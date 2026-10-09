import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { LegalPage } from "@/components/site/legal-page";
import { COMPANY_NAME } from "@/lib/legal/company";

export const metadata: Metadata = {
  title: "About",
  description: `Why ${COMPANY_NAME} exists and who it's for.`,
};

export default function AboutPage() {
  return (
    <LegalPage
      eyebrow="About"
      title="Legal clarity, for everyone"
      lede={`${COMPANY_NAME} exists because understanding your legal situation shouldn't require a law degree — or an expensive first consultation just to know where you stand.`}
      footer={
        <Link
          href="/get-started"
          className={buttonVariants({ variant: "primary", size: "lg" })}
        >
          Get started free
        </Link>
      }
    >
      <h2 id="mission">The problem</h2>
      <p>
        Legal documents are written to be precise, not readable. Most people
        meet the law at a stressful moment — an eviction notice, a contract to
        sign, a dispute at work — with no fast, affordable way to understand what
        it means or what to do next. {COMPANY_NAME} turns that dense language
        into plain answers, scoped to your jurisdiction, in minutes.
      </p>

      <h2 id="approach">Our approach</h2>
      <p>
        We built {COMPANY_NAME} around one principle: it informs, it does not
        pretend to be your lawyer. Every answer is framed as legal information,
        flags when a situation genuinely needs a professional, and can connect
        you with verified lawyers when it does. For legal professionals, the same
        engine becomes a research and drafting accelerator — with citation
        discipline built in.
      </p>

      <h2 id="who">Who it&rsquo;s for</h2>
      <p>
        Two audiences, one platform. People who need to understand their rights
        and documents, and the lawyers who help them work faster. The same
        jurisdiction-aware foundation serves both.
      </p>
    </LegalPage>
  );
}
