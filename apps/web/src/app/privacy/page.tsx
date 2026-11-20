import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-page";
import {
  COMPANY_NAME,
  PRIVACY_EMAIL,
  POLICIES_EFFECTIVE_DATE,
  SUBPROCESSORS,
} from "@/lib/legal/company";
import { AI_PROVIDER, AI_PROVIDER_LABEL, AI_REVIEW_NOTICE, aiProviderMayReviewContent } from "@/lib/ai/env";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${COMPANY_NAME} collects, uses, and protects your information.`,
};

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy Policy"
      updated={POLICIES_EFFECTIVE_DATE}
      lede={`This policy explains what information ${COMPANY_NAME} collects, how we use and protect it, and the choices and rights you have. We collect only what we need to provide the service, and we never sell your personal information.`}
    >
      <h2 id="information-we-collect">Information we collect</h2>
      <p>We collect the following categories of information:</p>
      <ul>
        <li>
          <strong>Account information</strong> — your email address, name, and
          authentication credentials (handled by our identity provider; we never
          store plaintext passwords).
        </li>
        <li>
          <strong>Profile &amp; jurisdiction</strong> — your role (consumer or
          legal professional), country, state/province, and preferred language,
          so guidance can be scoped to your jurisdiction.
        </li>
        <li>
          <strong>Content you provide</strong> — the questions you ask, the
          matters you create, and any documents you upload for analysis or
          generation.
        </li>
        <li>
          <strong>Payment information</strong> — if you subscribe, your payment
          is processed by Stripe on the web and by Apple in the iOS app. We receive your subscription status and tier,
          but <strong>never</strong> your full card number.
        </li>
        <li>
          <strong>Technical data</strong> — basic log and device information
          needed to operate, secure, and debug the service.
        </li>
      </ul>

      <h2 id="how-we-use">How we use your information</h2>
      <p>We use your information to:</p>
      <ul>
        <li>Provide jurisdiction-aware legal information, document analysis, and drafting;</li>
        <li>Maintain your account, matters, and subscription;</li>
        <li>Keep the service secure and prevent abuse;</li>
        <li>Communicate with you about your account and support requests.</li>
      </ul>
      <p>
        We do <strong>not</strong> sell your personal information, and {COMPANY_NAME}{" "}
        does not train AI models on your content.
        {aiProviderMayReviewContent &&
          " Our AI provider's terms are different on the plan we currently use: see AI processing below."}
      </p>

      <h2 id="ai-processing">AI processing and your permission</h2>
      <p>
        {COMPANY_NAME} uses artificial intelligence to generate legal
        information and analyze documents. Before any of your content is shared
        with our AI provider, we ask for your explicit permission, and you can
        withdraw it at any time from your account.
      </p>
      <p>
        With your permission, we send the questions you ask, the documents you
        upload, the details you enter for drafts, and your jurisdiction to{" "}
        {AI_PROVIDER_LABEL[AI_PROVIDER]} so it can produce your answer. To
        ground answers in current sources, the AI may also run web searches
        based on your question. We send only what is necessary for the feature
        you are using.
      </p>
      {aiProviderMayReviewContent && (
        <p>
          <strong>Please note:</strong> {AI_REVIEW_NOTICE} Because of these
          terms, the AI features are not offered in the European Economic Area,
          the United Kingdom, or Switzerland.
        </p>
      )}
      <p>
        AI output is legal information, not legal advice, and may be incomplete
        or inaccurate. Always confirm important matters with a licensed lawyer.
        If an answer looks wrong or harmful, use Report on that answer and we
        will review it.
      </p>

      <h2 id="service-providers">Service providers</h2>
      <p>
        We share information with a small set of vetted providers who process it
        only on our behalf and under contract:
      </p>
      <ul>
        {SUBPROCESSORS.map((s) => (
          <li key={s.name}>
            <strong>{s.name}</strong> — {s.purpose} ({s.region}).
          </li>
        ))}
      </ul>

      <h2 id="retention">Data retention</h2>
      <p>
        We keep your information for as long as your account is active. You can
        delete individual matters and documents at any time, and you can delete
        your entire account yourself from Account in the app or on the web, after
        which we remove your personal data except where we are required to retain
        limited records (for example, for tax or legal-compliance purposes).
        Original files you upload are deleted right after they are analyzed; we
        keep the extracted text and the analysis until you delete them.
      </p>

      <h2 id="your-rights">Your rights &amp; choices</h2>
      <p>
        Depending on where you live, you may have the right to access, correct,
        export, or delete your personal information, and to object to or restrict
        certain processing. To exercise any of these rights, email us at{" "}
        <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>. We will respond
        within the time required by applicable law.
      </p>

      <h2 id="security">Security</h2>
      <p>
        Access to your data is protected by database row-level security, so one
        user&rsquo;s data is isolated from another&rsquo;s. Data is encrypted in
        transit. No system is perfectly secure, but we work continuously to
        protect your information. See our{" "}
        <a href="/security">Security practices</a> for more detail.
      </p>

      <h2 id="children">Children</h2>
      <p>
        {COMPANY_NAME} is not directed to children under 16, and we do not
        knowingly collect their personal information. If you believe a child has
        provided us information, contact us and we will delete it.
      </p>

      <h2 id="international">International transfers</h2>
      <p>
        Your information may be processed in the United States and other
        countries where we or our providers operate. Where required, we rely on
        appropriate safeguards for international transfers.
      </p>

      <h2 id="changes">Changes to this policy</h2>
      <p>
        We may update this policy from time to time. When we make material
        changes, we will update the &ldquo;Last updated&rdquo; date above and,
        where appropriate, notify you.
      </p>

      <h2 id="contact">Contact us</h2>
      <p>
        Questions about your privacy? Email{" "}
        <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a> or visit our{" "}
        <a href="/contact">Support page</a>.
      </p>
    </LegalPage>
  );
}
