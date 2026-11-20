<div align="center">

# ⚖️ Lexa

### Understand your legal situation in minutes — built for people, and the lawyers who help them.

A premium, dual-audience **legal information & workflow platform**. Plain-language
guidance and document intelligence for consumers; a research + drafting accelerator
for lawyers. Jurisdiction-aware, compliance-first, across **web · desktop · mobile**.

`Next.js 16` · `Tailwind v4` · `Supabase (Postgres + RLS)` · `Flutter` · `Gemini` · `StoreKit 2`

> **Lexa provides legal _information_, not legal advice, and does not create an
> attorney–client relationship.** This framing is built into the product logic, not
> bolted on — every AI legal output carries its disclaimer by construction.

</div>

---

## Why it's interesting

- **Two audiences, one platform.** Consumers get plain-language answers, document
  understanding, generation, and a lawyer marketplace. Lawyers get jurisdiction-scoped
  research with verifiable citations, a drafting/redlining assistant, client intake
  automation, and case management.
- **Compliance is architecture, not decoration.** A single canonical source of legal
  copy feeds an `<AiLegalOutput>` wrapper that *structurally guarantees* every AI legal
  response ships with its disclaimer, jurisdiction context, and — when stakes are high —
  an honest "you should talk to a real lawyer" nudge.
- **Security you can prove.** Row-Level Security on every table, with lawyer↔client data
  isolation verified by an **executable test suite (60 assertions)** that boots a real
  Postgres and impersonates users exactly the way Supabase evaluates RLS. A lawyer can
  *never* read another lawyer's clients' data — and there's a test that fails if that
  ever changes.
- **Provider-agnostic AI.** The entire app talks to one `streamAiChat()` / `completeStructured()`
  interface; the model vendor lives behind a single file and is swappable.

## Signature feature — Document Intelligence

Upload a contract or notice → a strict-schema multimodal model call extracts obligations,
deadlines, and risky clauses → the UI shows the **original document beside plain-language
annotations with two-way highlight-linking** (hover a clause, its explanation lights up).
This is the product's "wow" moment and gets extra design care.

## Feature map

| Consumer | Lawyer | Shared |
|---|---|---|
| Situation triage & rights explainer | Research accelerator w/ citations | Streaming AI chat (jurisdiction-scoped) |
| "Do I need a lawyer?" assessment | Drafting & redline assistant | Document Intelligence |
| Find a lawyer (marketplace) | Client intake → structured brief | Document generation (PDF/DOCX) |
| Cost estimator | Case management + comms log | Matters, timelines & deadlines |

## Tech stack

- **Web / Desktop** — Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS v4,
  self-hosted variable fonts (Inter + Fraunces), packaged for desktop with **Tauri v2**.
- **iOS, iPadOS, and Mac** — Flutter with native Swift for Live Activities and the
  Dynamic Island, StoreKit 2 subscriptions, document scanning, and Sign in with
  Apple. One build runs on iPhone, iPad, and Apple silicon Macs. Design tokens are
  generated from one `tokens.json`, so web and app stay in step.
- **Backend** — Supabase (Postgres, Auth, Storage) with RLS on every table.
- **AI** — Google Gemini by default, with Google Search grounding so answers cite their
  sources. OpenAI works as an alternative. Covers chat, document analysis (PDFs and
  photos), and strict-schema structured output.
- **Payments** — App Store In-App Purchase in the app, verified on the server. Stripe
  on the web.

## Monorepo layout

```
.
├── apps/
│   ├── web/          # Next.js app (primary) — also wrapped by Tauri
│   ├── desktop/      # Tauri v2 shell
│   └── mobile/       # Flutter app
├── packages/
│   └── design-tokens/  # canonical tokens.json (shared web + mobile)
├── supabase/
│   ├── migrations/   # schema + RLS policies
│   └── tests/        # embedded-Postgres RLS isolation suite (60 assertions)
├── ARCHITECTURE.md   # structure & data flow
└── BUILD_LOG.md      # phase-by-phase decision log
```

## Getting started

```bash
# 1. Install web dependencies
cd apps/web && npm install

# 2. Configure environment (see the table below)
cp .env.example .env.local   # then fill in your keys

# 3. Run the dev server
npm run dev                  # http://localhost:3000
```

> Without Supabase or AI keys the app runs in a **safe preview mode** with demo data,
> so you can click through the entire authenticated UI locally.

### The whole stack, locally

`supabase/tests/local-backend.mjs` runs real Postgres with the real migrations and
RLS, plus the parts of Supabase Auth, PostgREST, and Storage the apps use, and a
scripted stand-in for Gemini. No Docker, cloud account, or AI spend is needed.

```bash
node supabase/tests/local-backend.mjs        # API on :54321, test accounts seeded
node supabase/tests/run-web-local.mjs        # web on :3100, wired to it
node apps/mobile/tool/write_local_config.mjs # app config for the local stack
cd apps/mobile && flutter test test_e2e/walkthrough_test.dart \
  --dart-define-from-file=config/local.json  # every screen, every device size
```

### Environment variables

| Variable | Required for | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Auth, data | From your Supabase project |
| `SUPABASE_SERVICE_ROLE_KEY` | Webhooks, trusted writes | **Server-only. Never expose.** |
| `GEMINI_API_KEY` | AI features | Free or paid. On a free key the app discloses Google's data use |
| `GEMINI_PAID_TIER` | Optional | `true` on a paid key, to drop the free-tier notice |
| `GEMINI_MODEL` | Optional | Pin a model; otherwise current Flash models are tried in order |
| `OPENAI_API_KEY` | Optional | Used only when no Gemini key is set |
| `APPLE_APP_ID` | App Store purchases | The numeric Apple ID of the app |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Billing | Phase 10 |
| `NEXT_PUBLIC_APP_URL` | Redirects | e.g. `http://localhost:3000` |

Secrets live only in `.env.local` (git-ignored). See `apps/web/.env.example`.

## Verify Row-Level Security

```bash
cd supabase/tests && npm install && npm run test:rls
# → 60 passed, 0 failed
```

Boots a real embedded Postgres under a faithful Supabase `auth` shim, applies every
migration, and asserts the full isolation matrix — including that an **unlinked lawyer
sees nothing** of another lawyer's clients and cannot self-grant matter access.

## Deployment

See **[DEPLOYMENT.md](DEPLOYMENT.md)**. Vercel is zero-config for the web app (set the
project **Root Directory** to `apps/web`); a `netlify.toml` is included for Netlify.

## Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)** — how the system is structured and how data flows.
- **[BUILD_LOG.md](BUILD_LOG.md)** — the running, phase-by-phase decision log.
- **[Lexa_MasterSpec.md](Lexa_MasterSpec.md)** — the product specification.

---

<div align="center">
<sub>Legal information, not legal advice · Not a substitute for a licensed lawyer.</sub>
</div>
