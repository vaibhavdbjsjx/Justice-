import type { DocumentAnalysis } from "./analysis-types";
import type { GeneratedAnnotations } from "@/lib/generation/types";
import type { DocumentListItem, DocumentDetail } from "./queries";

/**
 * Pre-analyzed sample document for demo/preview mode, attached to the demo
 * "Security deposit dispute" matter — lets the signature side-by-side view
 * (Part 5.5) be experienced locally without Supabase or an AI call.
 */

export const DEMO_DOCUMENT_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const DEMO_MATTER_ID = "11111111-1111-4111-8111-111111111111";
const DEMO_USER = "00000000-0000-0000-0000-000000000000";

const analysis: DocumentAnalysis = {
  document_type: "residential lease agreement",
  jurisdiction_relevant: true,
  jurisdiction_note:
    "California caps security deposits and sets a 21-day return window; a few of these clauses may not be enforceable as written.",
  detected_language: "English",
  plain_language_summary:
    "This is a one-year apartment lease starting September 1, 2025, at $2,400 per month. You put down a $3,600 security deposit, and the landlord must return it (or explain deductions in writing) within 21 days of move-out under California law. The lease renews automatically for another full year unless you give written notice 60 days before it ends — that long notice window combined with automatic renewal is the single most important thing to track. A few clauses, like the blanket carpet-cleaning deduction and the late-fee amount, may not hold up as written under California rules.",
  truncated: false,
  segments: [
    {
      id: 0,
      heading: "1. Parties and premises",
      text: "This Residential Lease Agreement is entered into between Northgate Properties LLC (“Landlord”) and the undersigned tenant (“Tenant”) for the premises at 214 Maple Street, Apt 3B, San Jose, California.",
    },
    {
      id: 1,
      heading: "2. Term",
      text: "The lease term begins on September 1, 2025 and continues for twelve (12) months, ending on August 31, 2026.",
    },
    {
      id: 2,
      heading: "3. Rent",
      text: "Tenant shall pay rent of $2,400.00 per month, due on the first (1st) day of each calendar month. Rent received after the third (3rd) day of the month shall incur a late fee of $150.00.",
    },
    {
      id: 3,
      heading: "4. Security deposit",
      text: "Tenant shall deposit $3,600.00 as security for the faithful performance of this Agreement. The deposit, less any lawful deductions itemized in writing, shall be returned within twenty-one (21) days after Tenant vacates the premises.",
    },
    {
      id: 4,
      heading: "5. Automatic renewal",
      text: "This Agreement shall automatically renew for successive twelve (12) month terms unless either party delivers written notice of non-renewal at least sixty (60) days prior to the end of the then-current term.",
    },
    {
      id: 5,
      heading: "6. Maintenance and cleaning",
      text: "Upon vacating, Tenant agrees that the cost of professional carpet cleaning shall be deducted from the security deposit regardless of the condition of the carpets.",
    },
    {
      id: 6,
      heading: "7. Entry",
      text: "Landlord may enter the premises for inspection, repairs, or showings upon twenty-four (24) hours' notice to Tenant, except in emergencies.",
    },
    {
      id: 7,
      heading: "8. Renters insurance",
      text: "Tenant shall maintain renters insurance with liability coverage of at least $100,000 for the duration of the tenancy and shall provide proof of coverage within fourteen (14) days of the start of the term.",
    },
  ],
  key_obligations: [
    {
      party: "tenant",
      obligation:
        "Pay $2,400 rent by the 1st of each month (a $150 late fee applies after the 3rd).",
      deadline_if_any: "1st of every month",
      segment_ids: [2],
    },
    {
      party: "tenant",
      obligation:
        "Carry renters insurance with at least $100,000 liability coverage and show proof.",
      deadline_if_any: "Within 14 days of September 1, 2025",
      segment_ids: [7],
    },
    {
      party: "landlord",
      obligation:
        "Return the $3,600 deposit, or a written itemized list of deductions, within 21 days of move-out.",
      deadline_if_any: "21 days after you vacate",
      segment_ids: [3],
    },
  ],
  risky_or_unusual_clauses: [
    {
      clause_excerpt_summary:
        "The lease renews itself for a full extra year unless you give written notice 60 days before the term ends.",
      why_flagged:
        "Automatic 12-month renewal with a long 60-day notice window is easy to miss and locks you in for another year. Calendar the notice date now.",
      section_reference: "Section 5",
      severity: "high",
      segment_ids: [4],
    },
    {
      clause_excerpt_summary:
        "Carpet cleaning is always deducted from your deposit, even if the carpets are clean.",
      why_flagged:
        "In California, deposit deductions generally must reflect actual damage beyond normal wear; a blanket mandatory deduction may not be enforceable as written.",
      section_reference: "Section 6",
      severity: "caution",
      segment_ids: [5],
    },
    {
      clause_excerpt_summary: "A flat $150 late fee applies after a 3-day grace period.",
      why_flagged:
        "Late fees must be a reasonable estimate of the landlord's actual costs; a high flat fee can be challenged. Worth knowing before you ever pay one.",
      section_reference: "Section 3",
      severity: "caution",
      segment_ids: [2],
    },
  ],
  important_dates: [
    {
      label: "Lease term begins",
      date_text: "September 1, 2025",
      iso_date: "2025-09-01",
      segment_ids: [1],
    },
    {
      label: "Deadline to give non-renewal notice (60 days before term end)",
      date_text: "sixty (60) days prior to August 31, 2026",
      iso_date: "2026-07-02",
      segment_ids: [4],
    },
    {
      label: "Lease term ends / auto-renews",
      date_text: "August 31, 2026",
      iso_date: "2026-08-31",
      segment_ids: [1, 4],
    },
  ],
};

const listItem: DocumentListItem = {
  id: DEMO_DOCUMENT_ID,
  matter_id: DEMO_MATTER_ID,
  uploaded_by: DEMO_USER,
  type: "uploaded",
  title: "Apartment lease — 214 Maple St",
  file_url: null,
  extracted_text: analysis.segments.map((s) => s.text).join("\n\n"),
  ai_annotations: analysis as unknown as DocumentListItem["ai_annotations"],
  created_at: new Date(Date.now() - 11 * 86_400_000).toISOString(),
  matterTitle: "Security deposit dispute — Maple St apartment",
  matterJurisdiction: { country: "United States", state: "California" },
};

// ---- Generated draft fixture (Phase 6) --------------------------------------

export const DEMO_GENERATED_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

const generatedBody = `[DATE]

Priya Sharma
[YOUR ADDRESS]

Northgate Properties LLC
[LANDLORD'S ADDRESS]

**Re: Demand for return of security deposit — 214 Maple Street, Apt 3B**

Dear Northgate Properties LLC,

I vacated the premises at 214 Maple Street, Apt 3B, San Jose, California on [MOVE-OUT DATE], leaving the unit in good condition. Under California Civil Code § 1950.5, you were required to return my $2,400.00 security deposit, or provide a written itemized statement of any lawful deductions, within 21 days of my departure. To date I have received neither.

I therefore demand payment of **$2,400.00** in full within **14 days** of the date of this letter.

If I do not receive the full amount or a lawful itemized statement by [RESPONSE DEADLINE], I intend to pursue recovery in small claims court, where a court may award up to twice the deposit in statutory damages for bad-faith retention, in addition to the deposit itself.

Please send payment to the address above.

Sincerely,

Priya Sharma`;

const demoGenerated: GeneratedAnnotations = {
  kind: "generated",
  template: "demand-letter",
  title: "Demand letter — security deposit",
  body_markdown: generatedBody,
  placeholders: [
    "[DATE]",
    "[YOUR ADDRESS]",
    "[LANDLORD'S ADDRESS]",
    "[MOVE-OUT DATE]",
    "[RESPONSE DEADLINE]",
  ],
  review_flags: [
    "The statutory citation (California Civil Code § 1950.5) and the 21-day window are California-specific — confirm they match your lease and timeline before sending.",
    "The doubled-deposit statutory damages claim applies only to bad-faith retention; a lawyer can advise whether to include it.",
  ],
  jurisdiction_caveat:
    "Deposit-return windows and penalty amounts vary by jurisdiction; this draft follows common California practice.",
};

const generatedListItem: DocumentListItem = {
  id: DEMO_GENERATED_ID,
  matter_id: DEMO_MATTER_ID,
  uploaded_by: DEMO_USER,
  type: "generated",
  title: demoGenerated.title,
  file_url: null,
  extracted_text: generatedBody,
  ai_annotations:
    demoGenerated as unknown as DocumentListItem["ai_annotations"],
  created_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  matterTitle: "Security deposit dispute — Maple St apartment",
  matterJurisdiction: { country: "United States", state: "California" },
};

export function demoDocumentList(): DocumentListItem[] {
  return [generatedListItem, listItem];
}

export function demoDocumentDetail(id: string): DocumentDetail | null {
  if (id === DEMO_DOCUMENT_ID) return { ...listItem, analysis };
  if (id === DEMO_GENERATED_ID) return { ...generatedListItem, analysis: null };
  return null;
}
