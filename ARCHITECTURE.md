# Justice — Architecture

How the system is structured and how data flows. Updated after every phase.
See `Justice_MasterSpec.md` for product requirements and `BUILD_LOG.md` for the
running decision log.

## 1. Platform strategy (Part 3/6)

One platform-agnostic backend (**Supabase**) serves three frontends:

- **Web** — Next.js (App Router). Primary build. `apps/web`.
- **Desktop** — **Tauri v2 thin shell** (`apps/desktop`, Phase 11): a native
  window pointed at the deployed web app (compile-time `JUSTICE_APP_URL`).
  SSR auth + secrets stay server-side; navigation is origin-pinned and
  external links open in the system browser. No duplicated UI.
- **Mobile** — a separate **Flutter** app (`apps/mobile`, Phase 12) on the
  same Supabase backend + generated design tokens. Reads hit Supabase
  directly (same RLS); AI/secret calls go through the web API routes with a
  bearer token. Consumer-shaped features (chat, matters, documents,
  generation); lawyer tools stay web/desktop.

The AI reasoning engine is called only from backend route handlers through the
provider-agnostic layer in `apps/web/src/lib/ai/` (Phase 3+). **Current
provider: OpenAI** (owner decision 2026-07-03, superseding the spec's Claude
choice); swapping vendors is contained to `lib/ai/provider.ts`.

**API auth has two transports** (Phase 12): web sends the Supabase session as
cookies (`@supabase/ssr`, refreshed by `proxy.ts`); mobile sends
`Authorization: Bearer <jwt>`. `lib/supabase/server.ts` picks the transport
per request and forwards the bearer to PostgREST so **RLS is identical either
way**; `getViewer()` validates a bearer token via `auth.getUser(jwt)`.

## 2. Repository layout

```
/
├── Justice_MasterSpec.md        # product spec (source of truth)
├── BUILD_LOG.md                 # decision log, per phase
├── ARCHITECTURE.md              # this file
├── packages/
│   └── design-tokens/
│       └── tokens.json          # canonical design tokens (web + Flutter)
├── supabase/
│   ├── config.toml              # Supabase CLI config
│   ├── migrations/              # versioned SQL (schema + RLS)
│   ├── tests/                   # RLS verification harness (embedded Postgres)
│   └── README.md
└── apps/
    ├── desktop/                 # Tauri v2 shell (Phase 11): native window
    │   └── src-tauri/           #   over the deployed web app; thin by design
    ├── mobile/                  # Flutter app (Phase 12): same backend,
    │   └── lib/                 #   generated tokens, bearer-auth API calls
    └── web/
        └── src/
            ├── app/             # routes, layout, globals.css (design tokens)
            ├── components/
            │   ├── ui/          # primitives: Button, Card, Badge, ThemeToggle
            │   ├── compliance/  # DisclaimerBanner, AiLegalOutput, ... (Part 5.6)
            │   └── site/        # Logo, SiteHeader, SiteFooter
            ├── lib/
            │   ├── ai/          # provider-agnostic AI layer: provider (OpenAI),
            │   │                #   prompts, document analysis/generation,
            │   │                #   lawyer drafting/redlining, intake triage,
            │   │                #   error copy, env
            │   ├── billing/     # Stripe fetch client, tiers/limits, usage
            │   │                #   metering, effective-tier gate
            │   ├── clients/     # lawyer-side reads/actions (client matters,
            │   │                #   intake links, thread), demo fixtures
            │   ├── documents/   # document queries/actions, analysis types,
            │   │                #   demo fixture
            │   ├── drafting/    # lawyer doc-type registry, draft/redline types,
            │   │                #   research→drafting prefill hand-off
            │   ├── intake/      # intake types + brief guard, token resolution
            │   ├── lawyers/     # lawyer-profile reads (licensed jurisdictions)
            │   ├── legal/       # canonical disclaimer copy, jurisdiction helpers,
            │   │                #   citations parser ("## Sources" → typed refs)
            │   ├── matters/     # matter/deadline queries + server actions,
            │   │                #   categories, default matters, demo fixtures
            │   ├── supabase/    # typed clients (browser/server/admin) + env
            │   └── utils.ts     # cn()
            └── proxy.ts         # Next 16 request proxy (session refresh)
```

## 3. Design system (Part 5)

- **Single source of truth:** `packages/design-tokens/tokens.json` (brand palette,
  light/dark semantic tokens, type scale, radius, motion). Web mirrors it in
  `apps/web/src/app/globals.css`; Flutter consumes it via **codegen** (Phase 12):
  `generate-flutter.mjs` → `apps/mobile/lib/theme/tokens.g.dart`. A sweep found
  **zero** raw colors in either app, so light/dark parity can't silently drift.
- **Theming:** semantic CSS variables declared in `:root` (light) and overridden
  in `.dark`; exposed to Tailwind via `@theme inline` so utilities like
  `bg-background` / `text-foreground` follow the active theme. `next-themes`
  toggles the `.dark` class (`class` strategy). 100% light/dark parity (Part 10).
- **Type:** Fraunces (serif) reserved for gravitas moments (display, document,
  card titles); Inter for all functional UI. `.legal-prose` gives dense legal text
  generous line-height.
- **Motion:** restrained fade/slide tokens (`--ease-refined`, durations);
  `prefers-reduced-motion` respected globally.

## 4. Compliance architecture (Part 1 — load-bearing)

The "legal information, not legal advice" framing is product logic, not a footer:

1. **Canonical copy** lives in `src/lib/legal/disclaimers.ts` (disclaimers,
   attorney–client notice, "review before use", research-accelerator notice,
   high-stakes categories/keywords + `looksHighStakes()`). Nothing hard-codes
   legal text elsewhere.
2. **`<AiLegalOutput>`** is the enforcement point: any surface rendering AI legal
   output wraps its content in it, which *always* appends the correct disclaimer
   (consumer) or verify-citations notice (lawyer), optional jurisdiction indicator,
   and a high-stakes "consider a real lawyer" nudge. This makes the Part 10 hard
   requirement structurally hard to violate.
3. **Trust components** (`DisclaimerBanner`, `JurisdictionIndicator`,
   `SourceCitation`, `ReviewBeforeUse`) are reused across chat, documents, and
   research. Jurisdiction is a first-class field surfaced wherever legal framework
   matters.

## 5. Data model & RLS (Part 7 / Part 10)

Tables (all with RLS enabled): `profiles`, `lawyer_profiles`, `matters`,
`chat_messages`, `documents`, `deadlines`, `lawyer_client_links`,
`subscriptions`, and (Phase 8) `intake_links`, `client_messages`.

**Ownership & sharing model:**
- A **matter** is owned by `user_id` (a consumer). Chat, documents, and deadlines
  belong to a matter and inherit its access.
- A **lawyer** gains access to a matter *only* through an `active`/`invited` row in
  `lawyer_client_links` (the sharing bridge), created consent-first by the matter
  owner. There is no path for a lawyer to see un-shared data, and no path to see
  another lawyer's clients.
- **Verified lawyers'** `profiles`/`lawyer_profiles` are publicly readable (the
  marketplace); everything else is private to owner + explicitly-linked counterpart.
- **Verification is not self-serviceable** (Phase 9): column-level grants on
  `lawyer_profiles` let lawyers edit their marketplace presence while
  `verification_status`/`rating_avg` are writable only by the service role.
- **`intake_links`** (Phase 8) are lawyer-private with NO anon policy — the token
  is a secret resolved server-side (service role) into a safe branding subset.
- **`client_messages`** (Phase 8) is the human lawyer↔client thread per matter:
  participants read, each writes as themselves, and it is **append-only at the
  grant level** (no UPDATE/DELETE grant exists at all).

**How RLS avoids recursion:** matter-derived policies call `SECURITY DEFINER`
helpers (`can_access_matter`, `is_matter_owner`, `is_matter_lawyer`,
`is_verified_lawyer`). These run as the definer so their internal reads bypass RLS
(no policy recursion) while still identifying the caller via `auth.uid()`.

**Writes:** owners write their own matters/messages; participants manage
deadlines/documents on shared matters; `subscriptions` is read-only to users and
written only by the service role (Stripe webhooks, Phase 10) + the signup trigger.

**Verification:** `supabase/tests/rls.test.mjs` boots real Postgres under a
Supabase `auth` shim, applies every migration in order, and asserts the full
isolation matrix (60 checks). This is the executable form of the Part 10
requirement and must stay green.

## 6. Supabase client architecture

- `lib/supabase/client.ts` — browser client (anon key; RLS enforces).
- `lib/supabase/server.ts` — per-request server client bound to Next's async
  cookie store (Server Components / Actions / Route Handlers).
- `lib/supabase/admin.ts` — **server-only** service-role client; bypasses RLS.
  Used only for trusted work (webhooks, assistant message inserts). Key is secret.
- `proxy.ts` → `lib/supabase/middleware.ts` — refreshes the session cookie on each
  request. All of these are inert until `NEXT_PUBLIC_SUPABASE_URL` /
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set.

## 7. Request/data flow (live for chat since Phase 3)

```
Client (web/desktop/mobile)
   │  authenticated request (Supabase session cookie / token)
   ▼
Next.js route handler / Server Action   ──►  Supabase (Postgres + RLS)
   │                                            ▲
   │  builds jurisdiction + matter context      │ service role for trusted writes
   ▼                                            │
lib/ai provider (OpenAI today) ─────────────────┘
   │  streamed response + structured output (citations, annotations)
   ▼
AiLegalOutput wrapper  ──►  disclaimer + jurisdiction + (high-stakes nudge)
```

### 7.1 Consumer chat (Phase 3)

`(app)/chat` (SSR history) + `components/chat/ChatScreen` (client) →
`POST /api/chat`:

1. `getViewer()` resolves user + profile (demo viewer when Supabase is
   unconfigured → chat works unpersisted).
2. Input validated (8k chars; history sanitized to user/assistant roles,
   capped at 30 turns — the client sends its visible transcript).
3. Persistence (real mode): the viewer's default **"General consultation"
   matter** (`category='general'`) is created lazily — `chat_messages` requires
   a matter and RLS derives access from it. User turn inserted with the
   user-scoped client; assistant turn inserted by the **service role** after
   the stream finishes (assistant authorship is server-reserved).
4. `buildConsumerSystemPrompt()` injects jurisdiction, preferred language, and
   the Part 8 guidelines; `streamAiChat()` streams deltas (SSE upstream, plain
   text downstream). Storage failures never block an answer; every error
   surfaces as calm copy from `lib/ai/copy.ts`, raw detail only in server logs.
5. Client renders assistant turns inside `<AiLegalOutput>` (markdown via
   react-markdown, no raw HTML); `looksHighStakes()` on the user's messages
   raises the professional-help nudge on the latest reply.

### 7.2 Matters & timeline (Phase 4)

A **matter** is the organizing unit (Part 4.1): one legal situation's chat,
documents (Phase 5), and deadlines. `lib/matters/` holds the whole feature:

- **Reads** (`queries.ts`): list with PostgREST embedded counts + open
  deadlines; detail = matter + deadlines + transcript. Demo fixtures
  (`demo.ts`) serve both when Supabase is unconfigured, keeping the UI
  previewable; mutations are disabled in preview.
- **Writes** (`actions.ts`, server actions): matter create/update/status/
  delete (two-step confirmed; cascade), deadline add/toggle/delete. All via
  the user-scoped client → RLS is the enforcement layer.
- **Chat linking:** `/api/chat` with `matterId` verifies ownership, persists
  to that matter, and injects the matter's title/category and its **own
  jurisdiction** (re-askable per case — overrides the profile) into the
  system prompt. `/chat` without `matterId` uses the lazily created
  "General consultation" matter (`category='general'`).
- Routes: `/matters` (status tabs), `/matters/new`, `/matters/[id]`
  (workspace: chat + timeline + documents), `/matters/[id]/edit`.

### 7.3 Document Intelligence (Phase 5 — signature feature)

`POST /api/documents/analyze` (multipart: file + optional title/matterId):

1. Validate (PDF/PNG/JPG/WEBP ≤ 10 MB — Next's body cap matches), resolve the
   matter (ownership-checked; its jurisdiction feeds the analysis) or fall
   back to the shared General-consultation matter
   (`lib/matters/default-matter.ts`).
2. One multimodal structured call (`completeStructured()` — images as
   `image_url`, PDFs as `file` parts, strict JSON schema). The model returns
   Part 8's analysis shape **plus verbatim clause segments**; every finding
   (obligation / risky clause / date) references segment ids. Ids are clamped
   server-side (`sanitizeAnalysis`).
3. Persist to `documents` (`extracted_text` + `ai_annotations` = full
   analysis; `file_url` stays null until cloud Storage exists). Demo mode
   returns the analysis without persisting.
4. `AnalysisView` renders the signature side-by-side (Part 5.5): verbatim
   segments beside sticky findings, two-way hover/focus/tap highlight-linking
   via the segment-id index, "Add to matter timeline" on dates (Phase 4
   action), all inside `<AiLegalOutput>`.
5. Matter-scoped chat prompts embed the latest 3 analyzed-document summaries
   (Part 4.1 full context).

### 7.4 Document Generation (Phase 6)

`/documents/generate` wizard → `POST /api/documents/generate`:

1. `lib/generation/templates.ts` defines the template registry (intake fields
   + drafting notes). Answers are sanitized server-side (known fields only,
   required enforced).
2. `generateDocument()` (`lib/ai/document-generation.ts`) makes a text-only
   strict-schema call: the draft comes back as `body_markdown` with
   **[PLACEHOLDERS] instead of invented facts**, plus `placeholders[]`,
   `review_flags[]` (judgment calls), and a `jurisdiction_caveat`. Matter
   scoping feeds jurisdiction + analyzed-document summaries into the prompt.
3. Drafts persist as `documents.type='generated'` with `GeneratedAnnotations`
   in `ai_annotations` (`lib/generation/types.ts` guards the shape at render).
4. `GeneratedDocView` renders ReviewBeforeUse + the draft + a before-you-send
   checklist; `POST /api/documents/export` (content in request) produces PDF
   (pdf-lib) or DOCX (docx) — both append the lawyer review/signature block
   and a DRAFT footer on every page (export logic shared via `useDocExport`).

### 7.5 Lawyer Research & Drafting (Phase 7)

Lawyer-gated surfaces (`role='lawyer'`, demo previews them): `/research` and
`/drafting`, both persisting into the lawyer's lazily-created **"Research
workspace"** matter (`RESEARCH_CATEGORY`).

**Research** reuses `ChatScreen` with `audience="lawyer"` → `/api/chat` swaps
in `buildLawyerResearchPrompt` (citation discipline: settled vs. uncertain
law, "## Sources" list, everything "[verify]" — no live citator is wired).
`lib/legal/citations.ts` is the ONE "## Sources" parser, isomorphic on
purpose:

- client: `splitSources()` lifts the section out of the prose (holding back
  unterminated lines mid-stream) and `toCitation()` yields typed cards
  (case/statute/regulation/secondary) rendered as `<CitationList>` with
  "Verify source" search links (Scholar case-law for cases, web otherwise);
- server: `parseCitationsForStorage()` persists `{ref, type}[]` (verbatim)
  into `chat_messages.citations` — display and storage cannot drift.

**Drafting** (`/drafting`, `DraftingWorkspace`) has two modes:

1. **New draft** — doc-type registry (`lib/drafting/doc-types.ts`, 8 types,
   each contributing structure guidance) + free-form instructions →
   `POST /api/drafting/draft` → `draftForLawyer()` reuses the Phase 6
   GeneratedDocument strict schema (`GENERATED_DOCUMENT_SCHEMA`) under a
   professional-discipline prompt; result renders in `GeneratedDocView`.
2. **Redline** — original text + optional instructions →
   `POST /api/drafting/redline` → `redlineForLawyer()` returns the complete
   revised markdown plus an accounted-for change log (kind: substantive /
   risk / clarity, before/after excerpts, rationale); rendered by
   `RedlineDocView` with the same export pipeline.

Both persist as `documents.type='generated'` with `ai_annotations.kind`
(`lawyer_draft` | `redline` — guards in `lib/drafting/types.ts`; the type
check constraint predates redlines, kind disambiguates). Research answers
carry a **"Use in drafting"** action → one-shot sessionStorage hand-off
(`lib/drafting/prefill.ts`, consumed via callback ref post-hydration) into
the drafting instructions.

### 7.6 Client Intake & Case Management (Phase 8)

The dual-sided loop: a lawyer publishes a branded link; a consumer's
plain-language intake becomes the lawyer's structured case brief.

1. **Links.** `/clients` (lawyer-gated) manages `intake_links` rows
   (`IntakeLinkManager`). The URL is `/intake/[token]` — a public page.
2. **Resolution.** `resolveIntakeToken()` (lib/intake/queries.ts, service
   role) turns the secret token into a safe branding subset (name, verified,
   practice areas, licensed jurisdictions). Unknown/revoked → 404.
3. **Submission.** The guided form (`IntakeForm`) requires auth to submit;
   unauthenticated visitors stash answers in sessionStorage and round-trip
   through `/sign-up?next=/intake/[token]` (`safeNextPath` validates `next`
   everywhere: sign-in/up pages, OAuth `redirectTo`, magic-link, callback).
   `POST /api/intake/submit` → `triageToBrief()` (strict schema: facts,
   as-stated timeline, honest urgency, questions for the client, first moves
   for the lawyer) → persists AS THE CLIENT under their own RLS identity:
   matter → `lawyer_client_links` (status `active`) → brief document
   (`kind='intake_brief'`, raw answers stored alongside).
4. **Working the case.** `/clients` lists shared matters (client names via
   the linked-counterpart profiles policy); `/clients/[matterId]` is
   brief-first (`IntakeBriefView`) with documents, deadlines (shared
   `DeadlineTimeline` — RLS `can_access_matter` lets the lawyer manage
   them), and the thread. No AI chat on the lawyer view — the assistant
   thread belongs to the client.
5. **Communication log.** `MessageThread` renders `client_messages` on both
   sides (consumer sees it on the matter workspace once shared, via
   `getMatterShare`). Sends go through the `sendClientMessage` server action;
   the table is append-only by design.

### 7.8 Monetization (Phase 10)

- **One rule:** effective tier = subscription tier while status ∈ {active,
  past_due} (`lib/billing/gate.ts`); demo mode previews everything ungated.
  Free-consumer limits live as constants in `lib/billing/tiers.ts` — the
  copy that names a limit imports the constant that enforces it.
- **Stripe** via a 3-endpoint fetch client (`lib/billing/stripe.ts`,
  `STRIPE_API_BASE` mockable): checkout, portal, webhook-signature verify.
  `POST /api/billing/webhook` is the ONLY writer of subscription state
  (service role; the table has no authenticated write policy).
- **Enforcement is server-side** at the API/action layer: chat cap +
  professional research, drafting + intake links (professional), analysis
  (any paid tier), generation monthly cap (kind='generated' only — intake
  briefs and the intake matter path stay ungated so the marketplace funnel
  keeps working). Gate errors: 402 + `upgrade: true` → clients link
  /billing. Usage metering derives live from existing tables
  (`lib/billing/usage.ts`).
- **UI:** `/billing` (plan, meters, pricing, checkout/portal) and
  `LockedPanel` on gated pages for under-tier accounts.

### 7.7 Lawyer Marketplace (Phase 9)

- **Lawyer presence:** `/marketplace` edits the lawyer-editable columns of
  `lawyer_profiles` (column grants keep verification/rating out of reach) and
  previews the exact `LawyerCard` consumers see. Status copy per
  `verification_status`; unverified profiles are invisible in the directory
  (RLS: `verified` only).
- **Directory:** `/find-a-lawyer` filters `listVerifiedLawyers()` server-side
  from a GET form (text / practice area / jurisdiction). `/find-a-lawyer/[id]`
  is the profile + request flow.
- **Linking:** `requestLawyer()` — the client shares their own matter
  (`lawyer_client_links` status `invited`) with an optional intro message;
  the lawyer's case view offers Accept (`active`) / Decline (`ended` — access
  drops immediately). Marketplace requests start `invited`; intake-link
  submissions start `active` (the link is the lawyer's standing invitation).
- The chat high-stakes nudge links to the directory — the Part 1 "Justice can
  help you find one" promise is now a real path.

## 8. Auth, onboarding & routing (Phase 2)

- **Entry:** `/(auth)/sign-in` + `/sign-up` (shared `(auth)` shell). Auth runs on
  the `@supabase/ssr` **browser** client (password, magic link, Google/Apple OAuth
  via PKCE). OAuth/magic/confirm land on `/auth/callback` which exchanges the code
  for a session (server-side) and forwards on.
- **Onboarding:** `/onboarding` (own minimal shell) runs a multi-step wizard →
  `completeOnboarding` server action updates `profiles` (role, jurisdiction,
  language, `onboarding_completed=true`) and seeds `lawyer_profiles` for lawyers.
- **Gating:** `getViewer()` (`lib/auth/session.ts`) resolves the current user +
  profile. `(app)/layout.tsx` redirects: no user → `/sign-in`; user not onboarded →
  `/onboarding`; otherwise renders `AppShell` (role-aware nav, jurisdiction, theme,
  sign out). When Supabase is unconfigured, `getViewer()` yields a demo consumer so
  the authed UI is previewable locally (never in production).
- **Reference data:** `lib/legal/countries.ts`, `lib/i18n/languages.ts`,
  `lib/legal/practice-areas.ts`.

## 9. Conventions

- Path alias `@/*` → `apps/web/src/*`.
- Compliance copy: import from `lib/legal`, never inline.
- Any AI legal output must render inside `<AiLegalOutput>` (or otherwise include
  `DisclaimerBanner`).
- Keep `tokens.json`, `globals.css`, and the Flutter theme in sync.
- Re-run `supabase/tests` after any schema/RLS change.
- Prefer semantic color utilities (`bg-surface`, `text-muted`) over raw hues.
