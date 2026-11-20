// ============================================================================
// Answer accuracy check. Asks the assistant real questions whose answers are
// well established, each scoped to a jurisdiction through a matter, and checks
// that the answer states the known rule, names its source, cites where it looked,
// and ends with a next step. Run it after changing the AI key, model, or prompts.
//
// It spends real AI usage, so it never runs on its own. Against production:
//
//   LEXA_API=https://lexa-main.netlify.app \
//   SUPABASE_URL=https://<project>.supabase.co SUPABASE_ANON_KEY=<public anon key> \
//   EVAL_EMAIL=<a test account> EVAL_PASSWORD=<its password> \
//   node supabase/tests/answer-eval.mjs
//
// With no settings it runs against the local stack, whose scripted stand-in
// only proves the plumbing. Its answers say nothing about real accuracy.
// The test account needs AI permission given and a plan with room for matters.
// ============================================================================
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const localCredentials = join(here, "local-backend.credentials.json");
const local = existsSync(localCredentials) ? JSON.parse(readFileSync(localCredentials, "utf8")) : null;

const API = process.env.LEXA_API ?? "http://127.0.0.1:3100";
const SUPABASE = process.env.SUPABASE_URL ?? local?.url;
const ANON = process.env.SUPABASE_ANON_KEY ?? local?.anonKey;
const EMAIL = process.env.EVAL_EMAIL ?? local?.accounts?.demo?.email;
const PASSWORD = process.env.EVAL_PASSWORD ?? local?.accounts?.demo?.password;
if (!SUPABASE || !ANON || !EMAIL || !PASSWORD) {
  console.error("Set SUPABASE_URL, SUPABASE_ANON_KEY, EVAL_EMAIL, and EVAL_PASSWORD.");
  process.exit(2);
}

/** Each case: where the question applies, the question, and what a correct answer contains. */
const CASES = [
  {
    name: "California deposit deadline",
    country: "United States",
    state: "California",
    category: "tenant-housing",
    question: "I moved out three weeks ago and my landlord hasn't returned my security deposit. How long do they have?",
    expect: [/21 days/i, /1950\.5/],
  },
  {
    name: "Texas final paycheck after firing",
    country: "United States",
    state: "Texas",
    category: "employment",
    question: "I was fired on Monday. When does my employer have to give me my final paycheck?",
    expect: [/\b(6|six) (calendar )?days\b/i, /Texas (Payday Law|Labor Code)|Payday Law/i],
  },
  {
    name: "New York late rent fee",
    country: "United States",
    state: "New York",
    category: "tenant-housing",
    question: "My rent was two days late. Can my landlord charge me a late fee?",
    expect: [/\b(5|five) days\b/i, /\$50|5 ?%|five percent/i],
  },
  {
    name: "England deposit protection",
    country: "United Kingdom",
    state: "England",
    category: "tenant-housing",
    question: "My landlord took a deposit when I moved in. Do they have to do anything with it?",
    expect: [/\b30 days\b/i, /(tenancy )?deposit (protection )?scheme/i],
  },
  {
    name: "India consumer complaint limit",
    country: "India",
    state: "Maharashtra",
    category: "consumer",
    question: "The phone I bought is defective and the shop refuses to help. How long do I have to file a consumer complaint?",
    expect: [/\b(2|two) years\b/i, /Consumer Protection Act,? 2019/i],
  },
  {
    name: "Ontario landlord's own use notice",
    country: "Canada",
    state: "Ontario",
    category: "tenant-housing",
    question: "My landlord gave me an N12 saying his son is moving in. How much notice does he have to give me?",
    expect: [/\b60 days\b/i, /(one month'?s rent|compensation)/i],
  },
  {
    name: "New South Wales bond limit",
    country: "Australia",
    state: "New South Wales",
    category: "tenant-housing",
    question: "How much can a landlord ask for as a rental bond?",
    expect: [/\b(4|four) weeks\b/i],
  },
  {
    name: "EU online purchase withdrawal",
    country: "Germany",
    state: null,
    category: "consumer",
    question: "I bought a jacket online from a German shop and changed my mind. Can I return it?",
    expect: [/\b14 days\b/i],
  },
  {
    name: "Safety first when someone is in danger",
    country: "United States",
    state: "California",
    category: "family",
    question: "My ex keeps showing up at my house and threatened to hurt me last night. What can I do?",
    expect: [/911|emergency/i, /restraining order|protective order/i],
  },
];

async function json(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function signIn() {
  const response = await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const body = await json(response);
  if (!response.ok || !body.access_token) throw new Error(`Sign-in failed (${response.status}).`);
  return body.access_token;
}

async function createMatter(token, c) {
  const response = await fetch(`${API}/api/matters`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      title: `Answer check: ${c.name}`,
      category: c.category,
      jurisdictionCountry: c.country,
      jurisdictionState: c.state ?? undefined,
    }),
  });
  const body = await json(response);
  if (!response.ok) throw new Error(`Couldn't create a matter (${response.status}): ${body.error ?? ""}`);
  return body.matter.id;
}

async function deleteMatter(token, id) {
  await fetch(`${SUPABASE}/rest/v1/matters?id=eq.${id}`, {
    method: "DELETE",
    headers: { apikey: ANON, Authorization: `Bearer ${token}` },
  }).catch(() => {});
}

async function ask(token, matterId, question) {
  const started = Date.now();
  const response = await fetch(`${API}/api/chat`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: question, history: [], matterId, audience: "consumer" }),
  });
  if (!response.ok) {
    const body = await json(response);
    throw new Error(`Chat failed (${response.status}): ${body.error ?? body.raw ?? ""}`);
  }
  const raw = await response.text();
  const split = raw.indexOf("\u001e");
  const text = split === -1 ? raw : raw.slice(0, split);
  let sources = [];
  if (split !== -1) {
    try {
      sources = JSON.parse(raw.slice(split + 1)).sources ?? [];
    } catch {
      // The answer arrived; only the source list is unreadable.
    }
  }
  return { text, sources, ms: Date.now() - started };
}

const token = await signIn();
console.log(`Answer check against ${API}\n`);
let failures = 0;

for (const c of CASES) {
  let matterId;
  try {
    matterId = await createMatter(token, c);
    const { text, sources, ms } = await ask(token, matterId, c.question);
    const missing = c.expect.filter((re) => !re.test(text)).map(String);
    const checks = {
      facts: missing.length === 0,
      sources: sources.length > 0,
      nextStep: /next step|tell me|what date|which state|do you have/i.test(text.slice(-400)),
      length: text.length > 300 && text.length < 6000,
    };
    const ok = Object.values(checks).every(Boolean);
    if (!ok) failures++;
    const marks = Object.entries(checks).map(([k, v]) => `${v ? "✓" : "✗"} ${k}`).join("  ");
    console.log(`${ok ? "PASS" : "FAIL"}  ${c.name}  (${(ms / 1000).toFixed(1)}s, ${sources.length} sources)`);
    console.log(`      ${marks}${missing.length ? `\n      missing: ${missing.join(", ")}` : ""}`);
    if (!ok) console.log(`      answer starts: ${text.slice(0, 220).replace(/\s+/g, " ")}…`);
  } catch (error) {
    failures++;
    console.log(`FAIL  ${c.name}: ${error.message}`);
  } finally {
    if (matterId) await deleteMatter(token, matterId);
  }
}

console.log(`\n${CASES.length - failures} of ${CASES.length} passed.`);
process.exit(failures ? 1 : 0);
