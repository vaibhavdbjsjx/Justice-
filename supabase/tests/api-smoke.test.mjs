// End-to-end API checks against the REAL Next.js route handlers, using the local
// backend for Postgres/Auth/Storage and its scripted AI. Start both first:
//   node supabase/tests/local-backend.mjs
//   node supabase/tests/run-web-local.mjs
// Run: BASE_URL=http://localhost:3100 npm run test:api
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const creds = JSON.parse(readFileSync(join(here, "local-backend.credentials.json"), "utf8"));
const BASE = process.env.BASE_URL || "http://localhost:3100";
const SUPABASE = creds.url;

let passed = 0;
let failed = 0;
function ok(condition, message, detail) {
  if (condition) {
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${message}`);
  } else {
    failed++;
    console.log(`  \x1b[31m✗ ${message}\x1b[0m${detail ? ` — ${String(detail).slice(0, 300)}` : ""}`);
  }
}
const section = (title) => console.log(`\n\x1b[1m${title}\x1b[0m`);

const authHeaders = (token) => ({ apikey: creds.anonKey, Authorization: `Bearer ${token}` });

async function signUp(email, password) {
  const res = await fetch(`${SUPABASE}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: creds.anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return { status: res.status, body: await res.json() };
}

async function signIn(email, password) {
  const res = await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: creds.anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return { status: res.status, body: await res.json() };
}

const api = (path, token, init = {}) =>
  fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init.body && typeof init.body === "string" ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });

const rest = (path, token, init = {}) =>
  fetch(`${SUPABASE}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

// A 1x1 PNG is enough: the scripted AI doesn't read the image.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

const unique = `${Date.now()}`;

section("Public config");
{
  const res = await api("/api/app-config");
  const config = await res.json();
  ok(res.status === 200, "/api/app-config is public");
  ok(config.ai?.label === "Google (Gemini)", "names the AI provider for the consent screen", config.ai?.label);
  ok(config.products?.plus === "com.vaibhavsg.lexa.plus.monthly", "serves the App Store product ids", config.products?.plus);
  ok(config.products?.professionalYearly === "com.vaibhavsg.lexa.professional.yearly", "serves the yearly product ids", config.products?.professionalYearly);
  ok(!JSON.stringify(config).includes("local-test-key"), "exposes no secrets");
}

section("Auth");
const email = `smoke-${unique}@lexa.test`;
const password = `Smoke-${unique}`;
let token;
let userId;
{
  const created = await signUp(email, password);
  token = created.body.access_token;
  userId = created.body.user?.id;
  ok(Boolean(token), "sign-up returns a session");

  const duplicate = await signUp(email, password);
  ok(duplicate.status === 422, "duplicate sign-up is refused", duplicate.status);

  const wrong = await signIn(email, "wrong-password");
  ok(wrong.status === 400, "wrong password is refused", wrong.status);

  const right = await signIn(email, password);
  ok(Boolean(right.body.access_token), "correct password signs in");

  const anonymous = await api("/api/billing/status");
  ok(anonymous.status === 401, "API requires a session", anonymous.status);

  const recover = await fetch(`${SUPABASE}/auth/v1/recover`, {
    method: "POST",
    headers: { apikey: creds.anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  ok(recover.status === 200, "password reset request is accepted");
}

section("AI consent (App Store 5.1.2)");
{
  const blocked = await api("/api/chat", token, {
    method: "POST",
    body: JSON.stringify({ message: "Can my landlord keep my deposit?", history: [] }),
  });
  const body = await blocked.json();
  ok(blocked.status === 428 && body.consentRequired === true, "chat is refused before consent", blocked.status);

  const form = new FormData();
  form.set("file", new Blob([PNG], { type: "image/png" }), "notice.png");
  const upload = await api("/api/documents/analyze", token, { method: "POST", body: form });
  ok(upload.status === 428, "document upload is refused before consent", upload.status);

  const generate = await api("/api/documents/generate", token, {
    method: "POST",
    body: JSON.stringify({ template: "demand-letter", answers: {} }),
  });
  ok(generate.status === 428, "generation is refused before consent", generate.status);

  const grant = await api("/api/consent", token, { method: "POST" });
  ok(grant.status === 200, "consent can be granted");

  const rows = await (await rest(`profiles?user_id=eq.${userId}&select=ai_consent_at,ai_consent_provider`, token)).json();
  ok(Boolean(rows[0]?.ai_consent_at) && rows[0]?.ai_consent_provider === "gemini", "consent is recorded with its provider", JSON.stringify(rows[0]));
}

section("Onboarding and jurisdiction");
{
  const update = await rest(`profiles?user_id=eq.${userId}`, token, {
    method: "PATCH",
    body: JSON.stringify({
      full_name: "Smoke Test",
      country: "United States",
      state_province: "California",
      onboarding_completed: true,
    }),
  });
  ok(update.status === 204, "profile saves through RLS", update.status);
}

section("Chat");
let matterGeneral;
{
  const res = await api("/api/chat", token, {
    method: "POST",
    body: JSON.stringify({ message: "Can my landlord keep my security deposit?", history: [] }),
  });
  ok(res.status === 200, "chat streams", res.status);
  const raw = await res.text();
  const [text, meta] = raw.split("\u001e");
  ok(text.includes("21 days"), "answer text arrives", text.slice(0, 80));
  const parsed = meta ? JSON.parse(meta) : null;
  ok(parsed?.sources?.length > 0, "sources arrive after the answer", meta);
  ok(!text.includes("sources"), "source payload stays out of the visible text");
  matterGeneral = res.headers.get("x-lexa-matter-id");
  ok(Boolean(matterGeneral), "conversation is tied to a matter");

  const history = await (
    await rest(`chat_messages?matter_id=eq.${matterGeneral}&select=role,content,citations&order=created_at.asc`, token)
  ).json();
  ok(history.length === 2, "both turns are saved", history.length);
  ok(history[1]?.citations?.sources?.length > 0, "sources are saved with the answer");

  const empty = await api("/api/chat", token, { method: "POST", body: JSON.stringify({ message: "   " }) });
  ok(empty.status === 400, "blank messages are refused", empty.status);
}

section("Matters and plan limits");
let matterId;
{
  const first = await api("/api/matters", token, {
    method: "POST",
    body: JSON.stringify({ title: "Deposit dispute", category: "tenant-housing" }),
  });
  const body = await first.json();
  matterId = body.matter?.id;
  ok(first.status === 200 && Boolean(matterId), "a free account can open its first matter", first.status);
  ok(body.matter?.jurisdiction_state === "California", "a new matter inherits the person's jurisdiction", body.matter?.jurisdiction_state);

  const second = await api("/api/matters", token, {
    method: "POST",
    body: JSON.stringify({ title: "Second matter", category: "employment" }),
  });
  const secondBody = await second.json();
  ok(second.status === 402 && secondBody.upgrade === true, "the free limit is enforced with an upgrade signal", second.status);

  const invalid = await api("/api/matters", token, {
    method: "POST",
    body: JSON.stringify({ title: "", category: "tenant-housing" }),
  });
  ok(invalid.status === 400, "a matter without a title is refused", invalid.status);

  const status = await (await api("/api/billing/status", token)).json();
  ok(status.tier === "free", "billing status reports the free plan", status.tier);
  ok(status.usage.activeMatters === 1 && status.limits.activeMatters === 1, "usage counts are live", JSON.stringify(status.usage));

  const noJurisdiction = await rest("matters", token, {
    method: "POST",
    body: JSON.stringify({ user_id: userId, title: "No jurisdiction", category: "general" }),
    headers: { Prefer: "return=representation" },
  });
  ok(noJurisdiction.status === 201, "default matters still insert directly");
}

section("Document analysis");
{
  const form = new FormData();
  form.set("file", new Blob([PNG], { type: "image/png" }), "notice.png");
  const locked = await api("/api/documents/analyze", token, { method: "POST", body: form });
  ok(locked.status === 402, "Document Intelligence is a paid feature", locked.status);

  const plus = await signIn("demo@lexa.test", creds.accounts.demo.password);
  const demoToken = plus.body.access_token;

  const form2 = new FormData();
  form2.set("file", new Blob([PNG], { type: "image/png" }), "notice.png");
  form2.set("title", "Notice from landlord");
  const analyzed = await api("/api/documents/analyze", demoToken, { method: "POST", body: form2 });
  const result = await analyzed.json();
  ok(analyzed.status === 200, "a Plus account can analyze an image", analyzed.status);
  ok(result.analysis?.risky_or_unusual_clauses?.length > 0, "analysis returns flagged clauses");
  ok(Boolean(result.documentId), "analysis is saved");

  const demoUser = plus.body.user.id;
  const path = `${demoUser}/${unique}.png`;
  const uploaded = await fetch(`${SUPABASE}/storage/v1/object/document-uploads/${path}`, {
    method: "POST",
    headers: { ...authHeaders(demoToken), "Content-Type": "image/png" },
    body: PNG,
  });
  ok(uploaded.status === 200, "large files can upload to the person's own folder", uploaded.status);

  const foreign = await fetch(`${SUPABASE}/storage/v1/object/document-uploads/${userId}/x.png`, {
    method: "POST",
    headers: { ...authHeaders(demoToken), "Content-Type": "image/png" },
    body: PNG,
  });
  ok(foreign.status === 403, "uploads to someone else's folder are refused", foreign.status);

  const viaStorage = await api("/api/documents/analyze", demoToken, {
    method: "POST",
    body: JSON.stringify({ storagePath: path, filename: "lease.png", mimeType: "image/png", title: "Large lease" }),
  });
  ok(viaStorage.status === 200, "analysis works from a storage upload", viaStorage.status);

  const gone = await fetch(`${SUPABASE}/storage/v1/object/document-uploads/${path}`, { headers: authHeaders(demoToken) });
  ok(gone.status !== 200, "the uploaded file is removed after analysis", gone.status);

  const stolen = await api("/api/documents/analyze", demoToken, {
    method: "POST",
    body: JSON.stringify({ storagePath: `${userId}/x.png`, filename: "x.png", mimeType: "image/png" }),
  });
  ok(stolen.status === 400, "another person's file path is refused", stolen.status);

  const templates = await (await api("/api/documents/templates", demoToken)).json();
  ok(templates.templates?.length > 0, "templates are served to the app");

  // Fill every field the template itself asks for, the way the app's form does.
  const demand = templates.templates?.find((t) => t.slug === "demand-letter") ?? templates.templates?.[0];
  const answers = Object.fromEntries(
    (demand?.fields ?? []).map((f) => [f.name, f.kind === "date" ? "Nov 20, 2026" : `Local test answer for ${f.label ?? f.name}`]),
  );
  const generated = await api("/api/documents/generate", demoToken, {
    method: "POST",
    body: JSON.stringify({ template: demand?.slug, answers }),
  });
  const generatedBody = await generated.json();
  ok(generated.status === 200, "a draft is generated from the template's own fields", `${generated.status} ${generatedBody.error ?? ""}`);
  ok(generatedBody.generated?.placeholders?.length > 0, "drafts keep placeholders for missing facts");
  ok(typeof generatedBody.documentId === "string", "the draft is saved to the library", generatedBody.documentId);

  const missing = await api("/api/documents/generate", demoToken, {
    method: "POST",
    body: JSON.stringify({ template: demand?.slug, answers: {} }),
  });
  ok(missing.status === 400, "a draft without its required facts is refused", missing.status);

  const exported = await api("/api/documents/export", demoToken, {
    method: "POST",
    body: JSON.stringify({ title: "Demand letter", body_markdown: "Dear [NAME],\n\nHello.", format: "pdf" }),
  });
  ok(exported.status === 200 && exported.headers.get("content-type") === "application/pdf", "drafts export as PDF", exported.status);
}

section("Reports (App Store 1.2)");
{
  const report = await api("/api/reports", token, {
    method: "POST",
    body: JSON.stringify({ kind: "ai_answer", reason: "Inaccurate", details: "Wrong deadline", excerpt: "text" }),
  });
  ok(report.status === 200, "an AI answer can be reported", report.status);
  const invalid = await api("/api/reports", token, { method: "POST", body: JSON.stringify({ kind: "nope", reason: "x" }) });
  ok(invalid.status === 400, "an invalid report is refused", invalid.status);
  const rows = await (await rest("content_reports?select=kind,reason", token)).json();
  ok(rows.length === 1 && rows[0].reason === "Inaccurate", "the report is stored");
}

section("Row-level isolation through the API layer");
{
  // A paid account, so plan limits never answer before the ownership check does.
  const other = await signIn("demo@lexa.test", creds.accounts.demo.password);
  const rows = await (await rest(`matters?id=eq.${matterId}&select=id`, other.body.access_token)).json();
  ok(rows.length === 0, "another account can't read this matter");
  const res = await api("/api/chat", other.body.access_token, {
    method: "POST",
    body: JSON.stringify({ message: "hello", matterId }),
  });
  ok(res.status === 404, "another account can't chat in this matter", res.status);
  const sub = await rest(`subscriptions?user_id=eq.${userId}`, token, {
    method: "PATCH",
    body: JSON.stringify({ tier: "professional" }),
  });
  const after = await (await api("/api/billing/status", token)).json();
  ok(after.tier === "free", "a person can't upgrade themselves through the database", `${sub.status} ${after.tier}`);
}

section("App Store purchases");
{
  const none = await api("/api/billing/apple/sync", token, {
    method: "POST",
    body: JSON.stringify({ transactions: ["not-a-real-transaction"] }),
  });
  ok(none.status === 502, "an invalid transaction is refused", none.status);
  const after = await (await api("/api/billing/status", token)).json();
  ok(after.tier === "free", "a refused transaction grants nothing", after.tier);
  const notification = await api("/api/billing/apple/notifications", null, {
    method: "POST",
    body: JSON.stringify({ signedPayload: "forged.payload.value" }),
  });
  ok(notification.status === 400, "a forged server notification is refused", notification.status);
}

section("Account deletion (App Store 5.1.1(v))");
{
  const unauthenticated = await api("/api/account/delete", null, { method: "POST" });
  ok(unauthenticated.status === 401, "deletion requires a session", unauthenticated.status);

  const res = await api("/api/account/delete", token, { method: "POST" });
  const body = await res.json();
  ok(res.status === 200 && body.ok === true, "an account can delete itself", res.status);

  const signInAgain = await signIn(email, password);
  ok(signInAgain.status === 400, "a deleted account can't sign in", signInAgain.status);

  const leftovers = await fetch(`${SUPABASE}/__sql`, {
    method: "POST",
    headers: { Authorization: `Bearer ${creds.serviceRoleKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      sql: `select (select count(*) from public.profiles where user_id = $1)::int as profiles,
                   (select count(*) from public.matters where user_id = $1)::int as matters,
                   (select count(*) from public.chat_messages where user_id = $1)::int as messages,
                   (select count(*) from public.subscriptions where user_id = $1)::int as subscriptions,
                   (select count(*) from public.content_reports where reporter_id = $1)::int as reports`,
      params: [userId],
    }),
  });
  const [counts] = await leftovers.json();
  ok(Object.values(counts).every((n) => n === 0), "all of the person's data is gone", JSON.stringify(counts));
}

console.log(`\n${failed === 0 ? "\x1b[32m" : "\x1b[31m"}${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed === 0 ? 0 : 1);
