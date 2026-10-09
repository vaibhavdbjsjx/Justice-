import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-page";
import { COMPANY_NAME, SUPPORT_EMAIL } from "@/lib/legal/company";

export const metadata: Metadata = {
  title: "Security",
  description: `How ${COMPANY_NAME} protects your data.`,
};

export default function SecurityPage() {
  return (
    <LegalPage
      eyebrow="Trust"
      title="Security practices"
      lede={`Legal matters are sensitive. Here is how ${COMPANY_NAME} is built to keep your information private and protected.`}
    >
      <h2 id="isolation">Data isolation by design</h2>
      <p>
        Every table in our database enforces <strong>row-level security</strong>
        , so your data is isolated at the database layer — not just hidden in the
        interface. A consumer can only reach their own matters, documents, and
        conversations. A lawyer can only reach a client&rsquo;s matter when that
        client has explicitly shared it, and can never see another lawyer&rsquo;s
        clients. These rules are verified by an automated test suite that fails
        the build if isolation ever regresses.
      </p>

      <h2 id="encryption">Encryption</h2>
      <p>
        Data is encrypted in transit using TLS, and stored by infrastructure
        providers that encrypt data at rest. Secrets and API keys are kept in
        server-side environment configuration and are never exposed to the
        browser.
      </p>

      <h2 id="authentication">Authentication</h2>
      <p>
        Sign-in is handled by a dedicated identity provider with support for
        email, Google, and Apple. We never store plaintext passwords. Sessions
        are managed with secure, HTTP-only cookies and refreshed automatically.
      </p>

      <h2 id="payments">Payments</h2>
      <p>
        Payments are processed by Stripe, a PCI-DSS Level 1 certified provider.
        Your full card details are sent directly to Stripe and never touch our
        servers.
      </p>

      <h2 id="ai">AI data handling</h2>
      <p>
        We send only the content necessary for the feature you are using to our
        AI provider, and we do not use the private content of your matters to
        train third-party models. See our <a href="/privacy">Privacy Policy</a>{" "}
        for details.
      </p>

      <h2 id="report">Reporting a vulnerability</h2>
      <p>
        If you believe you have found a security issue, please email{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. We appreciate
        responsible disclosure and will respond promptly.
      </p>
    </LegalPage>
  );
}
