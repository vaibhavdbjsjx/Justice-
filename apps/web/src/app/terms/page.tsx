import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-page";
import {
  COMPANY_NAME,
  LEGAL_EMAIL,
  POLICIES_EFFECTIVE_DATE,
} from "@/lib/legal/company";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `The terms that govern your use of ${COMPANY_NAME}.`,
};

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of Service"
      updated={POLICIES_EFFECTIVE_DATE}
      lede={`These terms govern your use of ${COMPANY_NAME}. By creating an account or using the service, you agree to them. Please read them carefully — especially the section on what ${COMPANY_NAME} is and is not.`}
    >
      <h2 id="not-legal-advice">1. Legal information, not legal advice</h2>
      <p>
        {COMPANY_NAME} provides <strong>legal information</strong> to help you
        understand your situation and options. It is{" "}
        <strong>not legal advice</strong>, and using {COMPANY_NAME} does{" "}
        <strong>not create an attorney–client relationship</strong>. We are not
        a law firm and do not practice law. AI-generated answers and documents
        are starting points that may be incomplete or inaccurate. For advice
        about your specific situation, and before you sign, send, or file
        anything, consult a licensed lawyer in your jurisdiction.
      </p>

      <h2 id="eligibility">2. Eligibility &amp; accounts</h2>
      <p>
        You must be at least 16 years old to use {COMPANY_NAME}. You are
        responsible for your account and for keeping your credentials secure.
        You agree to provide accurate information and to keep it up to date.
      </p>

      <h2 id="acceptable-use">3. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the service for any unlawful purpose or to facilitate one;</li>
        <li>Upload content you do not have the right to share;</li>
        <li>Attempt to reverse engineer, disrupt, or gain unauthorized access to the service or other users&rsquo; data;</li>
        <li>Present {COMPANY_NAME} output as the advice of a licensed attorney.</li>
      </ul>

      <h2 id="lawyers">4. Legal professionals</h2>
      <p>
        If you register as a legal professional, you represent that you are
        licensed and in good standing where you practice. Marketplace
        verification is a review process, not a guarantee, and you remain
        responsible for your own professional and ethical obligations, including
        competent review of any AI-assisted work product.
      </p>

      <h2 id="your-content">5. Your content</h2>
      <p>
        You retain ownership of the documents and information you provide. You
        grant {COMPANY_NAME} a limited license to process that content solely to
        provide the service to you (for example, to analyze a document you
        upload). See our <a href="/privacy">Privacy Policy</a> for how we handle
        it.
      </p>

      <h2 id="subscriptions">6. Subscriptions &amp; payments</h2>
      <p>
        Paid plans renew automatically until cancelled. You can cancel at any
        time from your billing settings; access continues until the end of the
        current billing period. Fees are non-refundable except where required by
        law. For marketplace transactions, a platform commission may apply as
        disclosed at the time.
      </p>

      <h2 id="disclaimer">7. Disclaimers</h2>
      <p>
        The service is provided &ldquo;as is&rdquo; without warranties of any
        kind. We do not warrant that AI output is accurate, complete, current,
        or suitable for your situation. Your reliance on any information from the
        service is at your own risk. See our full{" "}
        <a href="/disclaimer">Legal Disclaimer</a>.
      </p>

      <h2 id="liability">8. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, {COMPANY_NAME} will not be
        liable for any indirect, incidental, or consequential damages, or for
        any decision you make based on information from the service. Nothing in
        these terms limits liability that cannot be limited by law.
      </p>

      <h2 id="termination">9. Termination</h2>
      <p>
        You may stop using {COMPANY_NAME} at any time. We may suspend or
        terminate access if you violate these terms or to protect the service or
        other users.
      </p>

      <h2 id="changes">10. Changes</h2>
      <p>
        We may update these terms. If we make material changes, we will update
        the &ldquo;Last updated&rdquo; date and, where appropriate, notify you.
        Continued use after changes means you accept the updated terms.
      </p>

      <h2 id="contact">11. Contact</h2>
      <p>
        Questions about these terms? Email{" "}
        <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>.
      </p>
    </LegalPage>
  );
}
