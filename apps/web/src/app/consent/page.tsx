import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AiConsentForm } from "@/components/account/ai-consent-form";
import { DisclaimerBanner } from "@/components/compliance/disclaimer-banner";
import { Logo } from "@/components/site/logo";
import { Card } from "@/components/ui/card";
import { AI_PROVIDER, AI_PROVIDER_LABEL, AI_REVIEW_NOTICE, aiProviderMayReviewContent } from "@/lib/ai/env";
import { needsAiConsent } from "@/lib/ai/consent";
import { getViewer } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/auth/next-path";

export const metadata: Metadata = { title: "Your data and AI" };

/** Explicit permission before personal data reaches third-party AI. */
export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer.user) redirect("/sign-in");
  const next = safeNextPath((await searchParams).next) ?? "/dashboard";
  if (viewer.isDemo || !viewer.profile || !needsAiConsent(viewer.profile)) redirect(next);

  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-1 flex-col justify-center px-5 py-10">
      <div className="mb-6 flex justify-center">
        <Logo />
      </div>
      <Card raised className="p-6 sm:p-8">
        <h1 className="font-serif text-2xl font-medium tracking-tight text-foreground">
          Before Lexa answers
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-strong">
          Lexa&rsquo;s answers come from an AI service run by another company.
          To use the assistant and document tools, we need your permission to
          share your content with them.
        </p>
        <dl className="mt-5 space-y-3 text-sm">
          <div>
            <dt className="font-medium text-foreground">What is sent</dt>
            <dd className="mt-0.5 leading-relaxed text-muted">
              The questions you ask, the documents you upload, the details you
              enter for drafts, and your country or state.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Who receives it</dt>
            <dd className="mt-0.5 leading-relaxed text-muted">
              {AI_PROVIDER_LABEL[AI_PROVIDER]}, which processes it to produce
              your answer.{aiProviderMayReviewContent && ` ${AI_REVIEW_NOTICE}`}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Why</dt>
            <dd className="mt-0.5 leading-relaxed text-muted">
              Only to answer you. We don&rsquo;t sell your data. You can withdraw
              permission at any time from your account. Read the{" "}
              <a href="/privacy#ai-processing" className="text-accent underline underline-offset-4">
                Privacy Policy
              </a>
              .
            </dd>
          </div>
        </dl>
        <AiConsentForm next={next} />
      </Card>
      <div className="mt-6">
        <DisclaimerBanner variant="compact" className="justify-center" />
      </div>
    </main>
  );
}
