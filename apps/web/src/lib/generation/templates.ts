import {
  Ban,
  FileSignature,
  Handshake,
  Home,
  Mail,
  MessageSquareWarning,
  type LucideIcon,
} from "lucide-react";

/**
 * Document Generation template library (Part 4.1). Templates are *guides for
 * the drafting model*, not fill-in-the-blank boilerplate: each defines the
 * intake fields and drafting notes; the AI drafts jurisdiction-aware text and
 * leaves [BRACKETED PLACEHOLDERS] for anything the user didn't provide.
 * Client-safe module (icons + metadata only).
 */

export type IntakeField = {
  name: string;
  label: string;
  /** Rendered control. */
  kind: "text" | "textarea" | "date";
  placeholder?: string;
  required?: boolean;
  hint?: string;
};

export type DocTemplate = {
  slug: string;
  name: string;
  description: string;
  icon: LucideIcon;
  /** Extra drafting guidance passed to the model for this type. */
  draftingNotes: string;
  fields: IntakeField[];
  /** "lawyer" templates are role-gated and drafted with the professional
   * prompt (Phase 7). Default: consumer. */
  audience?: "consumer" | "lawyer";
};

const partyFields: IntakeField[] = [
  {
    name: "sender",
    label: "Your full name (sender)",
    kind: "text",
    required: true,
    placeholder: "e.g. Priya Sharma",
  },
  {
    name: "recipient",
    label: "Recipient's name",
    kind: "text",
    required: true,
    placeholder: "Person or company this is addressed to",
  },
];

const situationField: IntakeField = {
  name: "situation",
  label: "Describe the situation",
  kind: "textarea",
  required: true,
  placeholder:
    "What happened, when, and what you want to happen. Plain language is fine — dates and amounts help.",
  hint: "The draft only uses facts you provide; anything missing becomes a [placeholder].",
};

export const DOC_TEMPLATES: DocTemplate[] = [
  {
    slug: "demand-letter",
    name: "Demand letter",
    description:
      "Formally ask for money owed or action required before you escalate — often all it takes.",
    icon: Mail,
    draftingNotes:
      "Firm but professional. State the facts, the exact demand (amount/action), a clear response deadline, and the consequence of ignoring it (e.g. small-claims filing) without empty threats.",
    fields: [
      ...partyFields,
      situationField,
      {
        name: "amount",
        label: "Amount or action demanded",
        kind: "text",
        placeholder: "e.g. $2,400 security deposit returned",
      },
      {
        name: "deadline",
        label: "Response deadline",
        kind: "date",
        hint: "Commonly 10–14 days out.",
      },
    ],
  },
  {
    slug: "complaint-letter",
    name: "Complaint letter",
    description:
      "Raise a formal complaint with a business, employer, or agency and create a paper trail.",
    icon: MessageSquareWarning,
    draftingNotes:
      "Factual and chronological. Reference any order/case/employee numbers provided, state the resolution sought, and ask for a written response.",
    fields: [...partyFields, situationField],
  },
  {
    slug: "cease-and-desist",
    name: "Cease and desist",
    description:
      "Demand that someone stop harassment, defamation, or unauthorized use of your property or work.",
    icon: Ban,
    draftingNotes:
      "Identify the conduct precisely, demand it stop immediately, reserve all rights and remedies. Do not overstate legal conclusions — describe the conduct and its impact factually.",
    fields: [...partyFields, situationField],
  },
  {
    slug: "tenant-notice",
    name: "Notice to landlord",
    description:
      "Give formal notice — repairs needed, moving out, or disputing a deduction.",
    icon: Home,
    draftingNotes:
      "Identify the tenancy (address, lease date if given). State the notice type and any statutory window the jurisdiction commonly requires, flagging it as jurisdiction-dependent when unsure.",
    fields: [
      ...partyFields,
      {
        name: "property",
        label: "Rental property address",
        kind: "text",
        required: true,
      },
      situationField,
    ],
  },
  {
    slug: "nda",
    name: "Non-disclosure agreement",
    description:
      "A simple mutual or one-way NDA for conversations, freelancing, or a small deal.",
    icon: FileSignature,
    draftingNotes:
      "Draft a clean, balanced NDA: definition of confidential information, exclusions, obligations, term, return/destruction, no license granted, governing law placeholder if not derivable from jurisdiction. Note that enforceability details vary by jurisdiction.",
    fields: [
      {
        name: "party_a",
        label: "First party",
        kind: "text",
        required: true,
        placeholder: "Name / company",
      },
      {
        name: "party_b",
        label: "Second party",
        kind: "text",
        required: true,
        placeholder: "Name / company",
      },
      {
        name: "purpose",
        label: "Purpose of sharing information",
        kind: "textarea",
        required: true,
        placeholder: "e.g. Discussing a potential app development contract",
      },
      {
        name: "term",
        label: "Confidentiality term",
        kind: "text",
        placeholder: "e.g. 2 years",
      },
    ],
  },
  {
    slug: "service-agreement",
    name: "Basic service agreement",
    description:
      "A simple contract for freelance or small-business work — scope, payment, and timelines in writing.",
    icon: Handshake,
    draftingNotes:
      "Cover scope, deliverables, fees and payment schedule, revisions, IP ownership on payment, termination, and liability limitation — in plain, readable clauses. Keep it balanced between the parties.",
    fields: [
      {
        name: "provider",
        label: "Service provider",
        kind: "text",
        required: true,
      },
      { name: "client", label: "Client", kind: "text", required: true },
      {
        name: "scope",
        label: "Scope of work",
        kind: "textarea",
        required: true,
        placeholder: "What will be delivered, by when",
      },
      {
        name: "payment",
        label: "Payment terms",
        kind: "text",
        placeholder: "e.g. ₹80,000 — half upfront, half on delivery",
      },
    ],
  },
];

/** Lawyer-side drafting templates (Phase 7, Part 4.3). */
export const LAWYER_TEMPLATES: DocTemplate[] = [
  {
    slug: "engagement-letter",
    name: "Engagement letter",
    description:
      "Scope of representation, fees, and client responsibilities for a new matter.",
    icon: Handshake,
    audience: "lawyer",
    draftingNotes:
      "Formal engagement letter: scope of representation (and what is excluded), fee structure and billing terms, retainer handling, client responsibilities, termination, file retention. Flag trust-accounting and fee-agreement formalities that vary by bar rules.",
    fields: [
      { name: "lawyer", label: "Lawyer / firm name", kind: "text", required: true },
      { name: "client", label: "Client name", kind: "text", required: true },
      {
        name: "scope",
        label: "Scope of representation",
        kind: "textarea",
        required: true,
        placeholder: "The matter and what representation covers/excludes",
      },
      {
        name: "fees",
        label: "Fee structure",
        kind: "text",
        placeholder: "e.g. $350/hr, $5,000 retainer; or flat / contingency",
      },
    ],
  },
  {
    slug: "legal-memo",
    name: "Legal memorandum",
    description:
      "Objective IRAC memo on a legal question — authorities marked [verify].",
    icon: FileSignature,
    audience: "lawyer",
    draftingNotes:
      "Objective internal memorandum in IRAC form: Question Presented, Brief Answer, Facts, Discussion (settled law vs. open questions, opposing arguments), Conclusion. Cite authority only when confident it exists, in proper form, each marked [verify]; never invent citations.",
    fields: [
      {
        name: "question",
        label: "Question presented",
        kind: "textarea",
        required: true,
        placeholder: "The legal question to analyze",
      },
      {
        name: "facts",
        label: "Key facts",
        kind: "textarea",
        required: true,
      },
    ],
  },
  {
    slug: "motion-outline",
    name: "Motion outline",
    description:
      "Structured skeleton for a motion: issues, standard, argument headings, relief.",
    icon: Mail,
    audience: "lawyer",
    draftingNotes:
      "An outline, not a filing: caption placeholder, introduction, legal standard for this motion type, argument headings with the strongest points and supporting authority types ([verify] any named authority), anticipated counterarguments, relief requested. Flag local-rule dependencies (page limits, meet-and-confer).",
    fields: [
      {
        name: "motion_type",
        label: "Motion type",
        kind: "text",
        required: true,
        placeholder: "e.g. Motion to dismiss (failure to state a claim)",
      },
      { name: "court", label: "Court", kind: "text", placeholder: "e.g. Santa Clara County Superior Court" },
      {
        name: "facts",
        label: "Key facts and posture",
        kind: "textarea",
        required: true,
      },
      {
        name: "relief",
        label: "Relief sought",
        kind: "text",
      },
    ],
  },
  {
    slug: "settlement-demand",
    name: "Settlement demand",
    description:
      "Attorney demand letter: liability theory, damages, and settlement terms.",
    icon: Ban,
    audience: "lawyer",
    draftingNotes:
      "Attorney-authored demand: representation statement, factual summary, liability theory, damages itemization, demand amount and deadline, litigation alternative — professional and firm, no bluster. Flag evidentiary assumptions and privilege considerations.",
    fields: [
      { name: "client", label: "Client (represented party)", kind: "text", required: true },
      { name: "opposing", label: "Opposing party", kind: "text", required: true },
      {
        name: "claim",
        label: "Claim summary and damages",
        kind: "textarea",
        required: true,
      },
      { name: "demand", label: "Demand amount / terms", kind: "text" },
      { name: "deadline", label: "Response deadline", kind: "date" },
    ],
  },
];

export function getTemplate(slug: string): DocTemplate | undefined {
  return (
    DOC_TEMPLATES.find((t) => t.slug === slug) ??
    LAWYER_TEMPLATES.find((t) => t.slug === slug)
  );
}
