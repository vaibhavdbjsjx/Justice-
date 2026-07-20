/**
 * Lawyer drafting document types (Phase 7, Part 4.3). Unlike the consumer
 * template library (lib/generation/templates.ts — guided intake for
 * non-lawyers), these are free-form: the lawyer writes instructions and the
 * type contributes structural conventions to the prompt. Client-safe.
 */

export type LawyerDocType = {
  slug: string;
  name: string;
  description: string;
  /** Structural conventions fed to the model for this instrument. */
  guidance: string;
  /** Placeholder copy for the instructions textarea. */
  inputHint: string;
};

export const LAWYER_DOC_TYPES: LawyerDocType[] = [
  {
    slug: "contract",
    name: "Contract / agreement",
    description: "A full agreement with recitals, defined terms, and numbered clauses.",
    guidance:
      "Full agreement: parties and recitals, definitions where warranted, numbered operative clauses with headings, then boilerplate appropriate to the deal (term and termination, governing law, notices, assignment, entire agreement). No signature lines — the product appends the signature block.",
    inputHint:
      "Parties, deal shape, key commercial terms, governing law, risk positions to take (e.g. mutual indemnities, liability capped at fees paid)…",
  },
  {
    slug: "clause",
    name: "Single clause",
    description: "One drop-in clause or article, drafted to slot into an existing agreement.",
    guidance:
      "A single clause or article, drop-in ready: follow common drafting conventions, keep internal numbering relative, and flag any defined terms it assumes exist in review_flags.",
    inputHint:
      "The clause you need, the agreement it goes into, and the position to take (e.g. one-way confidentiality, 3-year tail)…",
  },
  {
    slug: "motion",
    name: "Motion / application",
    description: "A court filing: caption, grounds, argument, and prayer for relief.",
    guidance:
      "Court filing: caption block built from [PLACEHOLDERS] (court, case number, parties), introduction, numbered grounds or argument sections citing authority only when confident (marked \"[verify]\"), prayer for relief, and a service/signature placeholder. Local formatting and page rules vary — flag them in review_flags.",
    inputHint:
      "Relief sought, procedural posture, the key facts and authorities you want relied on…",
  },
  {
    slug: "memo",
    name: "Legal memorandum",
    description: "Internal research memo: question presented, brief answer, discussion.",
    guidance:
      "Internal legal memorandum: Question Presented, Brief Answer, Facts (only the provided facts), Discussion organized by issue with authority marked \"[verify]\", Conclusion. Separate settled law from open questions inside the Discussion.",
    inputHint:
      "The question, the client's facts, the jurisdiction, and any authorities you already have…",
  },
  {
    slug: "letter",
    name: "Professional letter",
    description: "Demand, advice, or engagement letter over the firm's letterhead.",
    guidance:
      "Professional letter: [LETTERHEAD] placeholder, date line, recipient block, re line, body in firm but measured tone, and the lawyer's sign-off block. For demand letters, state basis, demand, deadline, and consequences that are lawful and proportionate.",
    inputHint:
      "Who it's to, what it must achieve, the facts relied on, tone (firm demand vs. without-prejudice)…",
  },
  {
    slug: "affidavit",
    name: "Affidavit / declaration",
    description: "A sworn statement in numbered first-person paragraphs.",
    guidance:
      "Sworn statement: title/caption placeholders, deponent introduction, numbered first-person paragraphs stating one fact each, jurat/attestation placeholder. Facts not provided are [PLACEHOLDERS] — never invented; note in review_flags where exhibits are likely needed.",
    inputHint:
      "Who is swearing it, the proceeding, and the facts to be attested — in their words where possible…",
  },
  {
    slug: "notice",
    name: "Legal notice",
    description: "A formal statutory or contractual notice with clear demand and deadline.",
    guidance:
      "Formal notice: statutory or contractual basis ([PLACEHOLDER] if not provided), the triggering facts, the precise demand or effect, the deadline, and the service method. Flag any jurisdiction-specific notice-period rules in review_flags.",
    inputHint:
      "What the notice is under (statute/contract clause), who it goes to, what it demands, and by when…",
  },
  {
    slug: "custom",
    name: "Something else",
    description: "Describe any instrument — structure follows your instructions.",
    guidance:
      "Follow the lawyer's instructions for structure; where they are silent, use the closest conventional format for the instrument described.",
    inputHint:
      "Describe the document you need — its purpose, audience, structure, and the terms it must carry…",
  },
];

export function getLawyerDocType(slug: string): LawyerDocType | undefined {
  return LAWYER_DOC_TYPES.find((t) => t.slug === slug);
}
