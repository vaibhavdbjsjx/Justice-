// Seed data for the local backend: a populated demo account for walking through
// and screenshotting the app, a free account for testing plan limits, and a few
// marketplace entries. Local test data only, regenerated on every start.
import { randomBytes } from "node:crypto";

const addDays = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const makePassword = () => `Local-${randomBytes(9).toString("base64url")}`;

async function createUser(pool, hashPassword, email, password, profile) {
  const { rows } = await pool.query(
    "insert into auth.users (email, encrypted_password) values ($1, $2) returning id",
    [email, hashPassword(password)],
  );
  const id = rows[0].id;
  await pool.query(
    `update public.profiles
        set full_name = $2, country = $3, state_province = $4, role = $5, preferred_language = 'en',
            onboarding_completed = $6, ai_consent_at = $7, ai_consent_provider = $8
      where user_id = $1`,
    [
      id,
      profile.fullName,
      profile.country,
      profile.state,
      profile.role ?? "consumer",
      profile.onboarded ?? true,
      profile.consented === false ? null : new Date().toISOString(),
      profile.consented === false ? null : "gemini",
    ],
  );
  return id;
}

const LEASE_ANALYSIS = {
  document_type: "Residential lease agreement",
  jurisdiction_relevant: true,
  jurisdiction_note:
    "California limits several of these terms, so the flagged clauses may not be enforceable as written.",
  detected_language: "English",
  plain_language_summary:
    "This is a one-year lease that renews automatically unless you give 60 days' written notice. Rent is $2,400 a month. Two clauses deserve attention: a $500 'non-refundable' fee taken from your deposit, and a right for the landlord to enter without notice.",
  truncated: false,
  segments: [
    { id: 0, heading: "1. Term", text: "This Lease begins on January 1, 2027 and ends on December 31, 2027. It renews automatically for successive one-year terms unless either party gives written notice at least sixty (60) days before the end of the then-current term." },
    { id: 1, heading: "2. Rent", text: "Tenant shall pay rent of $2,400 per month, due on the first day of each month." },
    { id: 2, heading: "3. Security Deposit", text: "Tenant shall pay a security deposit of $2,400. Of this amount, $500 is a non-refundable cleaning fee retained by Landlord upon move-out." },
    { id: 3, heading: "4. Entry", text: "Landlord may enter the Premises at any time and without notice for inspection, maintenance, or showing the Premises to prospective tenants." },
  ],
  key_obligations: [
    { party: "You", obligation: "Pay $2,400 rent by the 1st of each month.", deadline_if_any: "Monthly, by the 1st", segment_ids: [1] },
    { party: "You", obligation: "Give written notice at least 60 days before the term ends if you don't want to renew.", deadline_if_any: "By November 1, 2027", segment_ids: [0] },
  ],
  risky_or_unusual_clauses: [
    { clause_excerpt_summary: "$500 of the deposit is labeled a non-refundable cleaning fee.", why_flagged: "California doesn't allow a deposit to be made non-refundable (Civil Code § 1950.5).", section_reference: "Section 3", severity: "high", segment_ids: [2] },
    { clause_excerpt_summary: "The landlord can enter at any time without notice.", why_flagged: "California generally requires reasonable advance notice, normally 24 hours in writing, except in emergencies (Civil Code § 1954).", section_reference: "Section 4", severity: "high", segment_ids: [3] },
  ],
  important_dates: [
    { label: "Lease begins", date_text: "January 1, 2027", iso_date: "2027-01-01", segment_ids: [0] },
    { label: "Last day to give non-renewal notice", date_text: "60 days before December 31, 2027", iso_date: "2027-11-01", segment_ids: [0] },
  ],
};

export async function buildSeed(pool, hashPassword) {
  const demoPassword = makePassword();
  const freePassword = makePassword();
  const reviewPassword = makePassword();

  const demoId = await createUser(pool, hashPassword, "demo@lexa.test", demoPassword, {
    fullName: "Alex Morgan",
    country: "United States",
    state: "California",
  });
  await pool.query(
    "update public.subscriptions set tier = 'plus', status = 'active', source = 'stripe', renews_at = now() + interval '20 days' where user_id = $1",
    [demoId],
  );

  await createUser(pool, hashPassword, "free@lexa.test", freePassword, {
    fullName: "Sam Rivera",
    country: "United States",
    state: "New York",
  });

  // Fresh account that still has onboarding and consent ahead of it.
  await createUser(pool, hashPassword, "new@lexa.test", reviewPassword, {
    fullName: null,
    country: null,
    state: null,
    onboarded: false,
    consented: false,
  });

  const insertMatter = async (title, category) =>
    (
      await pool.query(
        "insert into public.matters (user_id, title, category, jurisdiction_country, jurisdiction_state) values ($1, $2, $3, 'United States', 'California') returning id",
        [demoId, title, category],
      )
    ).rows[0].id;

  const general = await insertMatter("General consultation", "general");
  const deposit = await insertMatter("Security deposit dispute", "tenant-housing");
  const job = await insertMatter("Unpaid final paycheck", "employment");

  await pool.query(
    `insert into public.deadlines (matter_id, title, due_date, status) values
       ($1, 'Send written demand to landlord', $2, 'upcoming'),
       ($1, 'File in small claims if no response', $3, 'upcoming'),
       ($1, 'Collect move-out photos and lease', $4, 'completed'),
       ($5, 'File wage claim with the Labor Commissioner', $6, 'upcoming')`,
    [deposit, addDays(0), addDays(21), addDays(-3), job, addDays(9)],
  );

  await pool.query(
    `insert into public.documents (matter_id, uploaded_by, type, title, extracted_text, ai_annotations)
     values ($1, $2, 'uploaded', 'Lease agreement', $3, $4::jsonb)`,
    [deposit, demoId, LEASE_ANALYSIS.segments.map((s) => s.text).join("\n\n"), JSON.stringify(LEASE_ANALYSIS)],
  );

  await pool.query(
    "insert into public.chat_messages (matter_id, user_id, role, content, created_at) values ($1, $2, 'user', $3, now() - interval '2 days')",
    [general, demoId, "Can my landlord keep my whole security deposit for normal wear and tear?"],
  );
  await pool.query(
    "insert into public.chat_messages (matter_id, user_id, role, content, citations, created_at) values ($1, $2, 'assistant', $3, $4::jsonb, now() - interval '2 days' + interval '20 seconds')",
    [
      general,
      demoId,
      "**Generally, no. In California a landlord can't deduct for normal wear and tear.** Deductions are limited to unpaid rent, cleaning to restore the unit to its move-in condition, and damage beyond normal wear and tear.\n\n**Next step:** If you've received an itemized statement, send me what it lists and we can go through it.",
      JSON.stringify({
        sources: [
          {
            url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1950.5",
            title: "California Civil Code § 1950.5",
          },
        ],
        searchSuggestionsHtml: null,
      }),
    ],
  );

  // Marketplace test entries. Clearly local: these never exist in production.
  for (const lawyer of [
    { email: "lawyer1@lexa.test", name: "Test Lawyer One", state: "California", areas: ["Tenant & Housing", "Small Claims"], rate: "$150 to $250 per hour", bio: "Local test profile for the lawyer directory." },
    { email: "lawyer2@lexa.test", name: "Test Lawyer Two", state: "New York", areas: ["Employment", "Contracts"], rate: "$200 to $300 per hour", bio: "Local test profile for the lawyer directory." },
  ]) {
    const id = await createUser(pool, hashPassword, lawyer.email, makePassword(), {
      fullName: lawyer.name,
      country: "United States",
      state: lawyer.state,
      role: "lawyer",
    });
    await pool.query(
      `insert into public.lawyer_profiles (user_id, practice_areas, licensed_jurisdictions, bar_number, verification_status, rate_range, bio)
       values ($1, $2::jsonb, $3::jsonb, 'LOCAL-TEST', 'verified', $4, $5)`,
      [
        id,
        JSON.stringify(lawyer.areas),
        JSON.stringify([{ country: "United States", state: lawyer.state }]),
        lawyer.rate,
        lawyer.bio,
      ],
    );
  }

  return {
    accounts: {
      demo: { email: "demo@lexa.test", password: demoPassword, note: "Plus plan, populated" },
      free: { email: "free@lexa.test", password: freePassword, note: "Free plan, for limits" },
      fresh: { email: "new@lexa.test", password: reviewPassword, note: "Not onboarded, no consent" },
    },
  };
}
