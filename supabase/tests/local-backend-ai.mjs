// ============================================================================
// Scripted stand-in for the Gemini API, for local development and UI testing.
//
// Follows the documented shapes of the Interactions API and generateContent so
// the real client code in apps/web/src/lib/ai/gemini.ts runs against it. Answers
// are fixed text and say nothing about how accurate a real model is.
//
//   LOCAL_AI_DELAY_MS            pause before answering (default 1200)
//   LOCAL_AI_ANALYSIS_DELAY_MS   pause before an analysis (default 9000), long
//                                enough to watch the Dynamic Island while it runs
//   LOCAL_AI_FAIL=interactions   reject the Interactions API, to test fallback
//   LOCAL_AI_FAIL=search         reject the search tool, to test fallback
//   LOCAL_AI_FAIL=model          report the first model as retired
// ============================================================================

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const answerDelay = () => Number(process.env.LOCAL_AI_DELAY_MS ?? 1200);
const analysisDelay = () => Number(process.env.LOCAL_AI_ANALYSIS_DELAY_MS ?? 9000);

const SOURCES = {
  deposit: [
    {
      url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1950.5",
      title: "California Civil Code § 1950.5",
    },
    {
      url: "https://selfhelp.courts.ca.gov/guide-security-deposits",
      title: "California Courts Self-Help: Security deposits",
    },
  ],
  eviction: [
    {
      url: "https://selfhelp.courts.ca.gov/eviction-tenant",
      title: "California Courts Self-Help: Evictions for tenants",
    },
  ],
};

const ANSWERS = [
  {
    match: /deposit/i,
    sources: SOURCES.deposit,
    text: `**Yes. In California your landlord generally has 21 days after you move out to return your deposit or send an itemized list of deductions.**

**What the law says** (California Civil Code § 1950.5)
- The landlord can only deduct for unpaid rent, cleaning to restore the unit to its move-in condition, and damage beyond normal wear and tear.
- If deductions are over $125, they generally must include receipts or invoices.
- A deposit can't be labeled "non-refundable."

**If they miss the deadline or keep money in bad faith**
A court can award the amount wrongly kept, plus up to twice the deposit as a penalty. You can claim this in small claims court without a lawyer.

**Your options**
1. Send a short written demand with your forwarding address and a deadline.
2. Keep your move-in and move-out photos and your lease.
3. File in small claims if they don't respond.

**Next step:** What date did you move out? That tells us whether the 21 days have passed.`,
  },
  {
    match: /evict|move out|landlord wants|notice/i,
    sources: SOURCES.eviction,
    text: `**Your landlord generally can't make you leave without a valid written notice and, if you stay, a court order. Don't ignore any papers you receive.**

**What usually happens in California**
- **Notice first.** For unpaid rent this is commonly a 3-day notice to pay or leave, which doesn't count weekends or court holidays. Other reasons have different notice periods.
- **Then a court case.** If you stay past the notice, the landlord must file an unlawful detainer lawsuit. Only a sheriff, after a court order, can remove you.
- **A short deadline to respond.** Once you're served with court papers you generally have 10 court days to file a response. Missing it can mean losing automatically.

**What your landlord can't do**
Change the locks, shut off utilities, or remove your things to force you out.

**Next step:** Tell me exactly what the paper says and the date you received it, and we can work out your deadline.`,
  },
  {
    match: /work|job|fired|employer|unfair/i,
    sources: [],
    text: `**Most U.S. jobs are "at will," so being treated unfairly isn't automatically illegal. It becomes a legal problem when the reason is protected, such as discrimination, retaliation, or unpaid wages.**

**Start documenting now**
- Dates, what was said, and who was there
- Emails, messages, schedules, and pay records (keep your own copies)
- Your performance reviews and any complaints you've made

**Your options**
1. Raise it in writing with HR or a manager, which creates a record.
2. File with the state labor agency or the EEOC. These filings have deadlines, often counted in months.
3. Speak with an employment lawyer, many of whom offer a first consultation.

**Next step:** Which state are you in, and what do you think the treatment is based on?`,
  },
  {
    match: /contract|sign|agreement/i,
    sources: [],
    text: `**Before you sign, make sure you understand what you owe, what they owe, how it ends, and what happens if something goes wrong.**

**Check these first**
- **Money:** total cost, fees, late charges, and when each payment is due
- **Length and renewal:** automatic renewals and how much notice you must give to cancel
- **Getting out:** termination rights and any penalty for leaving early
- **Disputes:** arbitration clauses and waivers of your right to sue

**Warning signs**
Blank spaces, pressure to sign today, verbal promises that aren't written down, and one-sided penalties.

**Next step:** Upload the contract under Documents and Lexa will flag the clauses worth a closer look.`,
  },
  {
    match: /owes|small claims|money/i,
    sources: [],
    text: `**Small claims court is designed for people without lawyers, and it's often worth it if the amount is within your state's limit and the other side can actually pay.**

**How it usually works**
1. Send a written demand with a deadline. Many courts expect you to have tried this first.
2. File a claim in the right county and pay a modest filing fee.
3. Serve the other person properly, then bring your evidence to the hearing.

**Check before filing**
- Your state's dollar limit and deadline to sue
- Whether you can prove the debt with a contract, messages, or receipts
- Whether you could collect if you win

**Next step:** Which state are you in, and how much is owed?`,
  },
];

const FALLBACK_ANSWER = {
  sources: [],
  text: `**Here's how to think about this.** The answer depends on where you live and a few specific facts, so treat this as a starting point.

- Write down what happened, with dates.
- Keep any documents, messages, or notices.
- Check for deadlines, since they can be short.

**Next step:** Tell me your state or country and the most important date involved.`,
};

const ANALYSIS = {
  document_type: "Residential lease agreement",
  jurisdiction_relevant: true,
  jurisdiction_note:
    "California limits several of these terms, so the flagged clauses may not be enforceable as written. Confirm with a local lawyer or tenant organization.",
  detected_language: "English",
  plain_language_summary:
    "This is a one-year lease that renews automatically unless you give 60 days' written notice. You pay $2,400 a month, plus a deposit of $2,400. Three clauses deserve attention: a $500 'non-refundable' fee taken from your deposit, a right for the landlord to enter without notice, and a waiver of your right to a jury trial. The most important thing to know is the renewal date, because missing the notice window commits you to another term.",
  truncated: false,
  segments: [
    { id: 0, heading: "1. Term", text: "This Lease begins on January 1, 2027 and ends on December 31, 2027. It renews automatically for successive one-year terms unless either party gives written notice at least sixty (60) days before the end of the then-current term." },
    { id: 1, heading: "2. Rent", text: "Tenant shall pay rent of $2,400 per month, due on the first day of each month. Rent received after the fifth day of the month incurs a late fee of $150." },
    { id: 2, heading: "3. Security Deposit", text: "Tenant shall pay a security deposit of $2,400. Of this amount, $500 is a non-refundable cleaning fee retained by Landlord upon move-out." },
    { id: 3, heading: "4. Entry", text: "Landlord may enter the Premises at any time and without notice for inspection, maintenance, or showing the Premises to prospective tenants." },
    { id: 4, heading: "5. Disputes", text: "Tenant waives the right to a trial by jury in any action arising out of this Lease." },
    { id: 5, heading: "6. Maintenance", text: "Tenant shall keep the Premises clean and shall promptly notify Landlord in writing of any needed repairs." },
  ],
  key_obligations: [
    { party: "You", obligation: "Pay $2,400 rent by the 1st of each month. A $150 late fee applies after the 5th.", deadline_if_any: "Monthly, by the 1st", segment_ids: [1] },
    { party: "You", obligation: "Give written notice at least 60 days before the term ends if you don't want to renew.", deadline_if_any: "By November 1, 2027", segment_ids: [0] },
    { party: "You", obligation: "Keep the home clean and report needed repairs in writing.", deadline_if_any: null, segment_ids: [5] },
    { party: "Landlord", obligation: "Hold your $2,400 deposit and account for it when you move out.", deadline_if_any: null, segment_ids: [2] },
  ],
  risky_or_unusual_clauses: [
    { clause_excerpt_summary: "$500 of the deposit is labeled a non-refundable cleaning fee.", why_flagged: "California doesn't allow a deposit to be made non-refundable (Civil Code § 1950.5), so this term may not be enforceable.", section_reference: "Section 3", severity: "high", segment_ids: [2] },
    { clause_excerpt_summary: "The landlord can enter at any time without notice.", why_flagged: "California generally requires reasonable advance notice, normally 24 hours in writing, except in emergencies (Civil Code § 1954).", section_reference: "Section 4", severity: "high", segment_ids: [3] },
    { clause_excerpt_summary: "You give up the right to a jury trial.", why_flagged: "California courts generally don't enforce jury waivers signed before a dispute arises, but the clause could still be used to discourage you.", section_reference: "Section 5", severity: "caution", segment_ids: [4] },
    { clause_excerpt_summary: "The lease renews automatically for a full year.", why_flagged: "If you miss the 60-day notice window you could be committed to another year.", section_reference: "Section 1", severity: "caution", segment_ids: [0] },
  ],
  important_dates: [
    { label: "Lease begins", date_text: "January 1, 2027", iso_date: "2027-01-01", segment_ids: [0] },
    { label: "Last day to give non-renewal notice", date_text: "60 days before December 31, 2027", iso_date: "2027-11-01", segment_ids: [0] },
    { label: "Lease ends", date_text: "December 31, 2027", iso_date: "2027-12-31", segment_ids: [0] },
  ],
};

const GENERATED = {
  title: "Demand letter: security deposit",
  body_markdown: `[YOUR NAME]
[YOUR FORWARDING ADDRESS]

[DATE]

[LANDLORD NAME]
[LANDLORD ADDRESS]

**Re: Return of security deposit for [RENTAL ADDRESS]**

Dear [LANDLORD NAME],

I moved out of the above address on [MOVE-OUT DATE] and returned the keys that day. I paid a security deposit of [DEPOSIT AMOUNT].

California Civil Code § 1950.5 generally requires a landlord to return a deposit, or provide an itemized statement of deductions, within 21 days after a tenant moves out. As of today, I have not received my deposit or an itemized statement.

Please send the full amount to the address above within 14 days of the date of this letter. If I do not receive it, I intend to file a claim in small claims court, where the law allows a court to award up to twice the deposit in addition to the amount wrongly withheld.

I would prefer to resolve this without going to court, and I look forward to your prompt response.

Sincerely,

[YOUR NAME]`,
  placeholders: ["[YOUR NAME]", "[YOUR FORWARDING ADDRESS]", "[DATE]", "[LANDLORD NAME]", "[LANDLORD ADDRESS]", "[RENTAL ADDRESS]", "[MOVE-OUT DATE]", "[DEPOSIT AMOUNT]"],
  review_flags: [
    "Confirm that 21 days have passed since you moved out before sending.",
    "The 14-day response window is a choice, not a legal requirement. Adjust it if you prefer.",
    "Keep a copy and send it in a way that gives you proof of delivery.",
  ],
  jurisdiction_caveat: "This letter assumes California law. Other states have different deadlines and penalties.",
};

const BRIEF_REDLINE_FALLBACK = { title: "Draft", body_markdown: "A local test draft.", placeholders: [], review_flags: [], jurisdiction_caveat: null };

function lastUserText(body) {
  if (Array.isArray(body.contents)) {
    const last = [...body.contents].reverse().find((c) => c.role === "user");
    return (last?.parts ?? []).map((p) => p.text ?? "").join(" ");
  }
  if (typeof body.input === "string") return body.input;
  const steps = Array.isArray(body.input) ? body.input : [];
  const last = [...steps].reverse().find((s) => s.type === "user_input");
  return (last?.content ?? []).map((c) => c.text ?? "").join(" ");
}

function pickAnswer(body) {
  const text = lastUserText(body);
  return ANSWERS.find((a) => a.match.test(text)) ?? FALLBACK_ANSWER;
}

function structuredResult(schema) {
  const required = schema?.required ?? [];
  if (required.includes("segments")) return ANALYSIS;
  if (required.includes("body_markdown")) return GENERATED;
  return BRIEF_REDLINE_FALLBACK;
}

function chunks(text) {
  return text.match(/.{1,28}(\s|$)|\S+/gs) ?? [text];
}

function sse(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function apiError(res, status, message) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: { code: status, message, status: "ERROR" } }));
}

function checkFailures(res, model, usesSearch, api) {
  const mode = process.env.LOCAL_AI_FAIL;
  if (mode === "model" && model !== "gemini-3.8-flash" && model !== "gemini-3.6-flash") {
    apiError(res, 404, `models/${model} is not found`);
    return true;
  }
  if (mode === "interactions" && api === "interactions") {
    apiError(res, 400, "Interactions API rejected by test mode");
    return true;
  }
  if (mode === "search" && usesSearch) {
    apiError(res, 400, "Search tool rejected by test mode");
    return true;
  }
  return false;
}

async function streamInteraction(res, body) {
  const answer = pickAnswer(body);
  const searching = (body.tools ?? []).some((t) => t.type === "google_search");
  res.writeHead(200, { "Content-Type": "text/event-stream" });
  sse(res, { event_type: "interaction.created", interaction: { id: "int_local", status: "in_progress" } });
  await sleep(answerDelay());

  if (searching && answer.sources.length) {
    sse(res, { event_type: "step.start", index: 0, step: { type: "google_search_call" } });
    sse(res, { event_type: "step.delta", index: 0, delta: { type: "google_search_call", arguments: { queries: ["local test query"] } } });
    sse(res, { event_type: "step.stop", index: 0 });
    sse(res, { event_type: "step.start", index: 1, step: { type: "google_search_result" } });
    sse(res, { event_type: "step.delta", index: 1, delta: { type: "google_search_result", result: [], search_suggestions: process.env.LOCAL_AI_SUGGESTIONS === "on" ? '<div style="font:13px sans-serif;padding:8px;border:1px solid #ccc;border-radius:16px">Local test placeholder for search suggestions</div>' : "" } });
    sse(res, { event_type: "step.stop", index: 1 });
  }

  const textIndex = searching && answer.sources.length ? 2 : 0;
  sse(res, { event_type: "step.start", index: textIndex, step: { type: "model_output" } });
  for (const piece of chunks(answer.text)) {
    sse(res, { event_type: "step.delta", index: textIndex, delta: { type: "text", text: piece } });
    await sleep(22);
  }
  if (searching && answer.sources.length) {
    sse(res, {
      event_type: "step.delta",
      index: textIndex,
      delta: {
        type: "text_annotation_delta",
        annotations: answer.sources.map((s, i) => ({ type: "url_citation", url: s.url, title: s.title, start_index: i, end_index: i + 1 })),
      },
    });
  }
  sse(res, { event_type: "step.stop", index: textIndex });
  sse(res, { event_type: "interaction.completed", interaction: { id: "int_local", status: "completed", usage: { total_tokens: 1 } } });
  res.end();
}

async function streamGenerate(res, body) {
  const answer = pickAnswer(body);
  res.writeHead(200, { "Content-Type": "text/event-stream" });
  await sleep(answerDelay());
  for (const piece of chunks(answer.text)) {
    sse(res, { candidates: [{ content: { role: "model", parts: [{ text: piece }] } }] });
    await sleep(22);
  }
  sse(res, {
    candidates: [
      {
        finishReason: "STOP",
        content: { role: "model", parts: [] },
        ...(body.tools
          ? { groundingMetadata: { groundingChunks: answer.sources.map((s) => ({ web: { uri: s.url, title: s.title } })) } }
          : {}),
      },
    ],
  });
  res.end();
}

export async function handleGemini(req, res, url, body) {
  if (req.method !== "POST") return apiError(res, 405, "Method not allowed");
  const key = req.headers["x-goog-api-key"];
  if (!key) return apiError(res, 401, "API key missing");

  const generate = url.pathname.match(/\/models\/([^:]+):(generateContent|streamGenerateContent)$/);
  if (generate) {
    const [, model, method] = generate;
    if (checkFailures(res, decodeURIComponent(model), Boolean(body.tools), "generate")) return;
    if (method === "streamGenerateContent") return streamGenerate(res, body);
    await sleep(analysisDelay());
    const schema = body.generationConfig?.responseJsonSchema;
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(
      JSON.stringify({
        candidates: [{ finishReason: "STOP", content: { role: "model", parts: [{ text: JSON.stringify(structuredResult(schema)) }] } }],
      }),
    );
  }

  if (url.pathname.endsWith("/interactions")) {
    const searching = (body.tools ?? []).some((t) => t.type === "google_search");
    if (checkFailures(res, body.model, searching, "interactions")) return;
    if (body.stream) return streamInteraction(res, body);
    await sleep(analysisDelay());
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(
      JSON.stringify({
        id: "int_local",
        status: "completed",
        model: body.model,
        steps: [{ type: "model_output", content: [{ type: "text", text: JSON.stringify(structuredResult(body.response_format?.schema)) }] }],
      }),
    );
  }

  apiError(res, 404, "Unknown Gemini route");
}
