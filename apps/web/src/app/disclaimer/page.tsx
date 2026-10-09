import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-page";
import {
  COMPANY_NAME,
  LEGAL_EMAIL,
  POLICIES_EFFECTIVE_DATE,
} from "@/lib/legal/company";
import { ATTORNEY_CLIENT_NOTICE } from "@/lib/legal/disclaimers";

export const metadata: Metadata = {
  title: "Legal Disclaimer",
  description: `${COMPANY_NAME} provides legal information, not legal advice.`,
};

export default function DisclaimerPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Legal Disclaimer"
      updated={POLICIES_EFFECTIVE_DATE}
      lede={`This is the most important thing to understand about ${COMPANY_NAME}, so we say it plainly.`}
    >
      <h2 id="information-not-advice">Legal information, not legal advice</h2>
      <p>
        {COMPANY_NAME} is a legal <strong>information</strong> and document tool.
        It helps you understand your situation, your options, and your rights,
        and it can draft documents to get you started. It is{" "}
        <strong>not legal advice</strong> and is not a substitute for a licensed
        lawyer&rsquo;s judgment on your actual case. {ATTORNEY_CLIENT_NOTICE}
      </p>

      <h2 id="ai-limitations">AI has limitations</h2>
      <p>
        Answers and documents are generated with the help of artificial
        intelligence. AI can be confidently wrong, can miss facts specific to
        your matter, and may not reflect the most recent changes in the law.
        Laws vary by jurisdiction and change over time. Treat everything here as
        a well-informed starting point, not a final answer.
      </p>

      <h2 id="when-to-get-a-lawyer">When to get a lawyer</h2>
      <p>
        Some situations carry serious consequences — criminal matters, anything
        involving significant money, family and custody disputes, and
        immigration status among them. For these, and before you sign, send, or
        file anything important, have a licensed lawyer in your jurisdiction
        review it. {COMPANY_NAME} will tell you when a situation looks like it
        needs professional help, and can connect you with verified lawyers.
      </p>

      <h2 id="no-reliance">No reliance</h2>
      <p>
        Your use of and reliance on information from {COMPANY_NAME} is at your
        own risk. {COMPANY_NAME} is not responsible for decisions made based on
        its output. See our <a href="/terms">Terms of Service</a> for the full
        legal terms.
      </p>

      <h2 id="contact">Questions</h2>
      <p>
        Email <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>.
      </p>
    </LegalPage>
  );
}
