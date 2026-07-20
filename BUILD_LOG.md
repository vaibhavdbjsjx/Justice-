# LexMind — Build Log

Running log of decisions, shortcuts, deferrals, and "what's next", updated after
every phase (Part 0.3). Newest phase on top. Effort per phase follows Part 11.

Legend: ✅ done · ⏳ in progress · ⏭️ deferred (with reason)

---

## Phase 13 — Polish Loop — ✅ (HIGH effort)

**Goal (Part 9/10):** Full click-through web/desktop/mobile, dark mode,
empty/error states, animation smoothness — repeat until clean.

### Audit results (what the sweep proved)
- **Dark-mode parity is structural, not spot-checked.** A scan of the entire
  web app found **zero** raw Tailwind palette colors (`text-gray-500` etc.)
  and zero raw hex in classNames — every surface reads semantic tokens, so
  light/dark parity can't silently drift. Same on mobile: **zero** hardcoded
  `Colors.*` / `Color(0x…)` in screens/widgets — all via ColorScheme + the
  generated tokens.
- **Every route serves** (16 web routes 200 in demo); invalid dynamic routes
  (`/matters/<bad>`, `/documents/<bad>`, `/find-a-lawyer/<bad>`,
  `/clients/<bad>`) correctly `notFound()`.
- **Accessibility:** no interactive `<div onClick>` without a role/aria;
  focus rings + WCAG-AA tokens were built in from Phase 1.

### Fixes applied
- **Demo-preview regression (from Phase 10) — fixed.** Tier gating made the
  demo consumer resolve to `plus`, so the lawyer pages
  (research/drafting/clients/marketplace) showed the upgrade *LockedPanel*
  instead of previewing the feature. Demo is a full-product preview (it
  renders both roles' surfaces), so `getViewerTier` now returns
  `professional` in demo — all four pages preview their real UI again;
  `/billing` still shows its `free` demo state separately.
- **Branded 404** (`app/not-found.tsx`) and **branded runtime error boundary**
  (`app/error.tsx`, client component with `reset`) — replaced Next's unstyled
  defaults, keeping the calm premium tone (Part 5/8) when a page is missing or
  throws.
- **Mobile error states**: the documents-list and matter-deadlines
  `FutureBuilder`s were swallowing load failures into an empty state; they now
  surface a calm "couldn't load, retry" message.
- (Earlier in Phase 12's drive-through, also fixed: the generation form's
  field-`kind` mismatch, and the missing INTERNET permission in the release
  Android manifest.)

### Final verification
- Web: `npm run build` + `npm run lint` clean; RLS suite **60/60**.
- Mobile: `flutter analyze` clean; `flutter test` **10/10**.
- Desktop: Tauri debug bundle still builds (Phase 11).
- Android APK: see the Phase 12 note — built via the SHA-verified local Gradle
  + self-healing artifact cache workaround for this box's TLS corruption.

### Ship-readiness — owner actions before public launch
These are environment/credential items, not code (all logged across phases):
1. **Cloud Supabase project** — link it, `supabase db push` (5 migrations),
   set `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` / `SERVICE_ROLE_KEY`.
2. **OpenAI billing** — the key authenticates but has no quota; add billing
   and **rotate** it (it was pasted in chat). All AI is verified against a
   mock; the first funded call is the outstanding live check.
3. **Stripe** — create the two recurring prices, set
   `STRIPE_SECRET_KEY`/`WEBHOOK_SECRET`/`PRICE_*`, register the webhook.
4. **Git remote** — `origin` still points at the wrong repo
   (Portfolio-website); set the correct one before any push.
5. **Desktop/mobile signing** — Apple Developer identity (notarization),
   Play/App Store accounts (+ RevenueCat when IAP is wanted).
6. **TOS/compliance review** — a licensed lawyer reviews the terms and the
   "information, not advice" framing (Part 12).
7. **Lawyer verification process** — decide who confirms bar enrollment
   (the data path is service-role-ready).

### Result
All 13 phases complete. The platform is a working dual-audience legal
information + workflow product across web, desktop, and mobile on one
Supabase backend, with compliance framing enforced structurally, RLS proven
by 60 isolation tests, and tier-gated monetization — pending the owner
environment/credential steps above to go live.

---

## Phase 12 — Mobile App (Flutter) — ✅ (HIGH effort)

**Goal (Part 9):** Separate Flutter build on the same backend — chat, matters,
document intelligence, generation, same design tokens.

### What was built (`apps/mobile/`, Flutter 3.44)
- **Design tokens finally get their second consumer** — the Phase 1 deferral
  lands. `packages/design-tokens/generate-flutter.mjs` compiles the canonical
  `tokens.json` → `lib/theme/tokens.g.dart` (brand + light/dark semantic
  palettes, type scale as px doubles, radii, motion). `theme/theme.dart`
  builds ThemeData light+dark from it, so mobile has **structural** Part 5
  parity with web (same hexes, same Fraunces/Inter split) rather than a
  hand-copied theme. Regenerate with `node …/generate-flutter.mjs`.
- **Same backend, not a reimplementation.** Reads (matters, deadlines,
  documents) go straight to Supabase from Flutter — the *same RLS policies*
  scope them. Every AI/secret-bearing operation (chat, analyze, generate)
  calls the deployed Next.js route handlers via `lib/api/client.dart`, so
  keys never touch the device and there's one prompt/gate implementation.
- **Bearer-token transport (the enabling change).** Mobile can't send SSR
  cookies, so `apps/web` now accepts `Authorization: Bearer <supabase jwt>`:
  `lib/supabase/server.ts` forwards the token to PostgREST (RLS unchanged)
  and `getViewer()` validates it via `auth.getUser(jwt)`. Web cookie path is
  untouched. New `/api/documents/templates` route serves the generation
  registry (Flutter can't import the TS module — one registry, two readers).
- **Compliance carried across (Part 1/10).** Dart mirrors of canonical copy
  (`legal/disclaimers.dart`) + an `AiLegalOutput` widget that structurally
  appends the disclaimer under every AI message and the high-stakes nudge —
  the mobile twin of the web wrapper.
- **Screens:** email/password auth (magic-link/OAuth deferred — needs
  deep-link setup); bottom-nav shell (Assistant/Matters/Documents/Profile);
  streaming chat with suggested chips + matter-scoped variant; matters
  list/create/detail with deadline toggle; Document Intelligence upload
  (file_picker → multipart) + analysis detail (summary/obligations/risky
  clauses/dates); generation template picker → intake → draft view with the
  "before you send" checklist + ReviewBeforeUse. Calm gate-error handling
  (402 upgrade → "manage your plan from the web app"). A small on-token
  `MarkdownLite` renderer instead of a markdown package (tiny dependency
  surface; model output is constrained prose).

### Verification (Part 0.5 / Part 10)
- `flutter analyze`: **no issues**.
- `flutter test`: **10/10** — token parity vs. canonical hexes, the Part 10
  disclaimer-always-present guarantee, high-stakes nudge, `looksHighStakes`,
  MarkdownLite rendering, loose-JSON model parsing.
- Web regression after bearer changes: `npm run build` + `npm run lint` clean
  (35 routes incl. `/api/documents/templates`).
- **Android debug APK build:** ⏳ blocked by intermittent TLS corruption on
  this box's network (`SSLException: bad_record_mac / Tag mismatch`) — the
  Gradle *wrapper* can't finish downloading the ~150 MB gradle-9.1.0 dist in
  one shot (no resume; JVM restarts from scratch each flaky attempt). Working
  around it by pre-fetching the dist with `curl -C - --retry` (resumes across
  corruption). Not a code issue — analyze + tests are green; the APK is a
  tooling/network gate, not a correctness one.

### ⏭️ Deferred (explicit, with reasons)
- **RevenueCat / mobile IAP** — the spec pairs it with mobile, but tier gates
  are already enforced server-side (Phase 10), so the app is fully functional
  read/write; purchases need App Store / Play accounts + RevenueCat setup
  (owner). Until then the app points users to the web billing page.
- **iOS build** — no full Xcode on this box (CLT only); Android is the
  verification target. The Flutter/Dart code is platform-agnostic; iOS
  packaging is a per-machine step.
- **Magic-link / OAuth on mobile** — needs deep-link (app-links/universal
  links) configuration; password auth is the working core path.
- **Lawyer-side mobile surfaces** (research/drafting/clients/marketplace) —
  Part 9's mobile line scopes to the consumer-shaped features; lawyer tools
  remain web/desktop, a deliberate cut.

### Next: Phase 13 — Polish Loop (recommended effort: HIGH)
Full click-through web/desktop/mobile, dark mode, empty/error states,
animation smoothness — repeat until clean.

---

## Phase 11 — Desktop Wrapper (Tauri) — ✅ (HIGH effort)

**Goal (Part 9):** Tauri packaging Mac/Windows/Linux, native menu/window polish.

### What was built
- **`apps/desktop/` — Tauri v2 app**, hand-written (no interactive
  template): `src-tauri/tauri.conf.json` (LexMind branding, bundle
  metadata, identifier `com.lexmind.desktop`), `src/main.rs`, `Cargo.toml`
  (size-optimized release profile), icon pipeline (`icons/source.svg` —
  ink-navy field, gold scale motif per Part 5 → `tauri icon` generates all
  sizes incl. .icns/.ico and Android/iOS sets for Phase 12), README.
- **Architecture: deliberately thin remote shell.** The window points at the
  deployed web app (compile-time `LEXMIND_APP_URL`; debug builds default to
  localhost:3000; release placeholder MUST be overridden before shipping).
  Rationale: Supabase SSR auth and every secret-bearing call live on the
  server — a static export is impossible and shipping keys in a binary
  unacceptable. Zero duplicated UI; web/desktop stay in lockstep.
  `on_navigation` pins the webview to the app origin and sends external
  links (verify-source citations etc.) to the system browser via
  tauri-plugin-opener. macOS gets Tauri v2's default menus (native
  copy/paste). Window: 1280×840, min 980×640, centered.

### Environment saga (for the record)
- First attempt failed: the disk was 100% full (~130 MB free of 228 GB) and
  rustup died ENOSPC; partial install + its shell-profile stubs were cleaned
  up and the blocker surfaced. Owner freed ~44 GB (2026-07-05); rustup
  (stable 1.96.1, minimal profile) then installed cleanly — no brew needed,
  Xcode CLT already present.

### Verification
- `tauri build --debug` succeeds end-to-end on this box: **LexMind.app +
  LexMind_0.1.0_aarch64.dmg** produced (dmg ≈ 6.3 MB — thin shell as
  intended). Info.plist verified: CFBundleName "LexMind", identifier
  `com.lexmind.desktop` (renamed after Tauri warned that `.app`-suffixed
  identifiers clash with the macOS bundle extension), icon.icns wired.
- Not verified here: Windows/Linux bundles (Tauri doesn't cross-compile —
  CI or per-OS builds when shipping) and a click-through against the
  deployed URL (no cloud deployment yet; debug build points at localhost).

### ⏭️ Deferred (explicit, with reasons)
- **Code signing/notarization** — needs the owner's Apple Developer
  identity; unsigned debug bundles are fine for local verification.
- **Auto-update** — Tauri updater makes sense once release artifacts have a
  hosting story.

### Next: Phase 12 — Mobile App (Flutter, HIGH). Disk now has ~44 GB free —
Flutter SDK (~3 GB) is feasible. Same backend; tokens.json finally gets its
second consumer (the Phase 1 codegen deferral becomes relevant).

---

## Phase 10 — Monetization — ✅ (XHIGH effort)

**Goal (Part 4.4 / Part 9):** Stripe (web), tier gating across features,
Stripe Connect commission. RevenueCat explicitly lands with Phase 12 mobile.

### What was built
- **Stripe integration without the SDK** (`lib/billing/stripe.ts`): fetch +
  form-encoding in the house provider style (like `lib/ai/provider.ts`),
  `STRIPE_API_BASE` override for mocks. Three calls only: checkout session,
  billing portal, webhook signature verification (v1 HMAC-SHA256,
  constant-time compare, replay tolerance). Price→tier and Stripe→LexMind
  status mapping are pure exported functions.
- **Data:** `20260704150000_billing.sql` adds `stripe_customer_id` /
  `stripe_subscription_id` to `subscriptions` — which remains
  **service-role-write-only** (no authenticated write policy exists; proven
  in the suite), so the webhook is the single writer of tier state.
- **Routes:** `POST /api/billing/checkout` (role decides tier; metadata
  carries user_id+tier; reuses known Stripe customer, else prefills email),
  `POST /api/billing/portal`, `POST /api/billing/webhook`
  (checkout.session.completed → upsert; customer.subscription.updated →
  status/tier/renews_at by customer id; …deleted → back to free; non-2xx on
  handler failure so Stripe retries).
- **Tier model** (`lib/billing/tiers.ts`, client-safe single source):
  Free consumer = **25 assistant messages/mo, 1 active self-created matter,
  3 template drafts/mo, no Document Intelligence** (product call — spec
  says "limited", numbers are ours to tune). Plus $14.99 = unlimited + doc
  intelligence. Professional $49.99 = research/drafting/intake/clients/
  marketplace. Effective tier = paid tier while status ∈ {active, past_due}
  (grace while Stripe retries).
- **Enforcement is server-side only** (`gate.ts` + `usage.ts`, metering
  derived live from existing tables — no counters to drift): chat monthly
  cap + professional check in /api/chat; drafting draft/redline + intake
  link creation require professional; analysis requires any paid tier;
  generation counts only `kind='generated'` docs (lawyer drafts gated
  elsewhere; **intake briefs exempt — the marketplace funnel stays open**,
  and intake-created matters bypass the matter cap for the same reason).
  Gate errors are 402 + `upgrade: true`; the chat client renders a calm
  "Plan limit reached" info alert with a View-plans link.
- **UI:** `/billing` (current plan, renewal date, past-due warning, live
  usage meters for free consumers, role-appropriate pricing card,
  checkout/portal buttons, success/cancel banners, honest "billing isn't
  connected" state). Nav gets Billing for both roles; the dashboard plan
  badge now reads the real subscription and links to /billing. Gated
  surfaces render a premium `LockedPanel` (feature list + one CTA) for
  under-tier real accounts; **demo mode previews everything ungated**
  (same rule as role gates).

### Key decisions
- **Fetch client over stripe-sdk** — 3 endpoints, zero deps, mockable
  offline; swap-in point is one file if the SDK is ever wanted.
- **Webhook = only writer**; the page only reads. Tier state can't drift
  from the client side even by bug, because no write privilege exists.
- **Free-tier numbers are constants, not scattered strings** — copy that
  names the limit imports the same constant that enforces it.
- **Connect commission deferred** (below) — there is no engagement-payment
  object to take 15% of yet; building Connect onboarding now would be
  scope theater.

### Verification (Part 0.5 / Part 10)
- Build clean (33 routes incl. /billing + 3 billing APIs); lint clean; RLS
  suite: 5 migrations applied, **60/60**.
- **12/12 billing unit tests** (compiled lib + local mock Stripe): signature
  valid/tampered/wrong-secret/stale-replay/missing/multi-candidate;
  price→tier; status normalization; checkout wire format (form-encoded,
  mode=subscription, metadata, client_reference_id, customer-reuse-over-
  email); portal session.
- Dev-server drive (demo): /billing SSR (plan card, three usage meters,
  Plus pricing card, not-connected banner, success/cancel banners);
  checkout/webhook correctly 503 unconfigured; demo remains ungated
  (research + documents uploader render); dashboard badge → /billing; all
  13 pages 200; zero dev-log errors.

### ⏭️ Deferred (explicit, with reasons)
- **Stripe Connect ~15% commission** — requires an engagement-payment flow
  between consumer and lawyer that doesn't exist yet (payments today are
  platform subscriptions only). When engagements get a payment object,
  Connect destination charges + application_fee_amount slot into
  lib/billing/stripe.ts naturally.
- **RevenueCat** — Phase 12 (mobile), per the spec's own note.
- **Live Stripe round-trip** (real checkout → webhook → tier flip) — needs
  the cloud deployment + Stripe keys; the full wire format and signature
  path are verified against the mock.
- **Marketplace listing ↔ tier coupling** (lapsed Professional still listed
  if verified) — needs a policy/service-role read change; verification
  remains the primary trust gate meanwhile.

### Next: Phase 11 — Desktop Wrapper, Tauri (recommended effort: HIGH)
Package the web app for Mac/Windows/Linux with native menu/window polish.
Note: no Rust toolchain confirmed on this box yet — Phase 11 may need
`rustup` (owner attention if network installs are gated).

---

## Phase 9 — Lawyer Marketplace — ✅ (HIGH effort)

**Goal (Part 4.2/4.3 / Part 9):** Lawyer profile/verification, consumer
"Find a lawyer" directory + search, lawyer–client linking.

### What was built
- **Verification hardening** (`20260704120000_marketplace.sql`). The
  marketplace makes "verified" a trust signal, so it stopped being
  self-serviceable: broad INSERT/UPDATE on `lawyer_profiles` replaced with
  **column-level grants** — lawyers edit practice areas, jurisdictions, bar
  number, rate, bio; `verification_status` and `rating_avg` are
  service-role-only (verification is a real-world review, Part 12; ratings
  come with the review system). RLS suite → **60/60** (self-verify blocked at
  update AND insert, rating tamper blocked, onboarding upsert still works,
  unverified profiles invisible to consumers).
- **`/marketplace`** (lawyer): status card per verification state
  (pending/verified/rejected copy), profile editor (bio, practice-area chip
  toggles, licensed-jurisdiction list, bar number [private], rate range)
  with a **live preview of the exact consumer-facing card** (`LawyerCard`,
  shared with the directory).
- **`/find-a-lawyer`** (consumer): verified-only directory with server-side
  search via a plain GET form (text / practice area / jurisdiction — no
  client JS to search; in-memory filter is fine at this scale, move to SQL
  when the directory grows). Cards show verified badge, honest rating
  ("New to LexMind" until reviews exist), rates, jurisdictions.
  **`/find-a-lawyer/[id]`**: full profile + "How working together starts" +
  the request panel.
- **Linking.** `requestLawyer(lawyerId, matterId, intro)`: the client shares
  their own matter (Phase 1 consent path, status **`invited`**), optional
  intro lands as the thread's first message; duplicate request → friendly
  copy (PK conflict). Lawyer sees a **"New request"** badge on /clients and
  an Accept / Decline bar on the case view (`respondToClientRequest` →
  `active` / `ended`; `ended` drops the lawyer's access entirely via
  `is_matter_lawyer`, so decline confirms once). Consumer's matter page
  shows the pending state.
- **The compliance loop closes:** the high-stakes nudge in chat now carries
  "Browse verified lawyers →" to the directory; consumer + lawyer nav and
  dashboard cards all unlocked (`find-a-lawyer`, `marketplace`).

### Key decisions
- **Column grants over triggers** for verification — consistent with the
  Phase 8 append-only pattern: what must not happen has no privilege to
  happen.
- **Requests start `invited`, intake links start `active`** — a marketplace
  request is unsolicited (lawyer explicitly accepts); an intake submission
  answers the lawyer's own published invitation.
- **Ratings displayed, never collected yet** — `rating_avg` renders honestly
  as "New to LexMind" when null; the review system is future work, and
  nobody can fake a number in the meantime.

### Verification (Part 0.5 / Part 10)
- Build clean (29 routes), lint clean (zero disables), RLS **60/60**.
- Driven on the dev server (demo fixtures): directory SSR with all three
  fixture lawyers; area filter isolates Priya (Family), jurisdiction filter
  "york" isolates Daniel; profile page shows request panel with matter
  select + attorney–client notice; /marketplace shows pending-state card,
  editor, live preview; dashboard/nav links present; Phases 3–8 pages all
  200; zero dev-log errors.

### ⏭️ Deferred (explicit, with reasons)
- **Actual verification operations** (who reviews bar enrollment, how) —
  Part 12 calls the rigor a launch judgment call; the data path is ready
  (service role sets the status).
- **Reviews/ratings collection** — needs completed engagements to be
  meaningful; `rating_avg` is protected and displayed in the meantime.
- **SQL-side directory search** — in-memory filtering is correct at current
  scale; revisit with pagination when the directory grows.

### Next: Phase 10 — Monetization (recommended effort: MAX)
Stripe (web/desktop), RevenueCat (mobile, lands with Phase 12), tier gating
across features, Stripe Connect commission (~15%) on marketplace
engagements. `subscriptions` table + service-role-only writes are in place.

---

## Phase 8 — Client Intake & Case Management, Lawyer Side — ✅ (HIGH effort)

**Goal (Part 4.3 / Part 9):** Intake link generation, triage-to-brief, lawyer
client/matter dashboard, communication log.

### What was built
- **Schema** (`20260704090000_intake_and_messages.sql`): `intake_links`
  (lawyer-managed, in-database 64-hex-char token, revocable; RLS is
  lawyer-own-rows only — **no anon policy ever**, tokens resolve server-side
  via the service role) and `client_messages` (the human lawyer↔client thread
  per matter; SELECT/INSERT via `can_access_matter` + sender check, and
  **append-only at the grant level** — no UPDATE/DELETE grant exists, so the
  log can't be rewritten by anyone). RLS harness now applies **all**
  migrations in order; suite extended to **52/52** (link privacy both
  directions, consumer-role gate on link creation, thread isolation for
  outsiders and unlinked lawyers, sender spoof blocked, append-only proven).
- **Intake flow.** Lawyer creates labeled links at `/clients`
  (`IntakeLinkManager`: create/copy/revoke). Public `/intake/[token]` shows
  the lawyer's branding (name, verified badge, practice areas, licensed
  jurisdictions — safe subset via `resolveIntakeToken`, admin client) above a
  guided plain-language form (situation, category, jurisdiction, urgency,
  dates, desired outcome) with `INTAKE_NOTICE` (new canonical copy: no
  attorney–client relationship from submitting). Unauthenticated visitors
  keep their answers: form stashes to sessionStorage → sign-up (`?next=`
  now threaded through sign-in/sign-up/OAuth/magic-link via `safeNextPath`,
  and hardened in /auth/callback) → returns → restores (callback-ref
  one-shot, same pattern as Phase 7).
- **Triage-to-brief** (`lib/ai/intake.ts`, strict schema): summary, key
  facts, timeline (dates kept exactly as the client gave them), honest
  urgency + reason, complexity note, questions for the client, suggested
  first moves for the LAWYER, jurisdiction note. Discipline: only what the
  client stated — gaps become questions. `POST /api/intake/submit` validates
  the token, runs triage, then persists **as the client under their own
  RLS identity**: matter → `lawyer_client_links` (status `active` — the
  lawyer published the link, the client used it; exactly the consent path
  Phase 1's `lcl_insert_by_client_owner` anticipated, no privileged writes)
  → brief as `documents.type='generated'` (`kind='intake_brief'`, raw intake
  answers stored alongside so nothing the client said is lost).
- **Lawyer dashboard `/clients`** (role-gated, demo previews with fixtures):
  intake links + client matters via `lawyer_client_links` (client names come
  through the Phase 1 profiles policy for linked counterparts).
  **Case view `/clients/[matterId]`**: brief-first (`IntakeBriefView` —
  urgency badge, facts, as-stated timeline, ask-the-client cards, first
  moves, and the client's own words one `<details>` away), plus documents,
  deadlines (reuses `DeadlineTimeline` — deadline actions already relied on
  RLS `can_access_matter`, they now also revalidate `/clients/…`), and the
  thread. Deliberately **no AI chat** on the lawyer's view — the assistant
  thread belongs to the client.
- **Communication log** (`MessageThread`, shared component): rendered on the
  lawyer case view AND the consumer's matter workspace (panel appears when
  the matter is shared, via `getMatterShare`). Optimistic send over the
  `sendClientMessage` server action; UI states the record is permanent.
- Documents library/detail/matter cards recognize `intake_brief` (Case brief
  badge, ClipboardList icon, `/documents/[id]` renders `IntakeBriefView`).

### Key decisions
- **Client-initiated writes over privileged RPCs** — the token's only
  privileged use is *resolving* the lawyer; everything persisted goes through
  the client's own RLS identity, keeping the consent model auditable.
- **Append-only thread by omission of grants**, not just policies — verified
  as `permission denied` in the suite, a stronger guarantee than a 0-row
  no-op.
- **Brief organizes, never replaces** — raw intake answers ship inside the
  annotations and render behind a disclosure.
- **Link = `active` immediately** (not `invited`): publishing the link is the
  lawyer's standing invitation; a separate accept step would add friction
  with no isolation benefit (`is_matter_lawyer` treats both the same).

### Verification (Part 0.5 / Part 10)
- Build clean (27 routes: `/intake/[token]`, `/clients`, `/clients/[matterId]`,
  `/api/intake/submit`); lint clean (still zero disables); RLS **52/52**.
- Driven on the dev server (demo + mock): intake SSR (branding, verified
  badge, notice, form), submit → brief (title/urgency correct; triage prompt
  mock-inspected: discipline lines, jurisdiction, client's words verbatim);
  validation copy for missing situation and dead token; `/clients` +
  case-view SSR (brief, thread, deadlines, own-words disclosure);
  `?next=` threading verified in sign-in SSR; Phase 3–7 pages regress green;
  zero dev-log errors.

### ⏭️ Deferred (explicit, with reasons)
- **Private lawyer notes** (Part 4.3 "case management lite" mentions notes;
  the Part 9 phase line doesn't). Needs its own table + RLS to be truly
  private — small, clean addition when calendar/notes UX is designed.
- **Notifications** (email/push when a brief or message arrives) — no
  transport exists yet; Phase 10+ concern.
- **Live-flow checks needing cloud Supabase**: token resolution against real
  rows, the full sign-up round-trip restore, revalidation across the two
  matter views. Logic is covered by RLS tests + demo drive; first cloud
  deploy should click through the intake → brief → thread loop end-to-end.

### Next: Phase 9 — Lawyer Marketplace (recommended effort: HIGH)
Lawyer profile/verification UI, consumer "Find a lawyer" directory + search,
lawyer–client linking. `lawyer_profiles` (verification_status, practice
areas, rate range) and the verified-lawyer read policies are already in place.

---

## Phase 7 — Lawyer Research & Drafting Tools — ✅ (MAX effort)

**Goal (Part 4.3 / Part 9):** Lawyer chat mode + research prompt, citation
display, drafting assistant flow. "Citation discipline + reasoning = core
value for paying lawyers" (Part 11).

### What was built
Research mode itself (prompt, `/research` page, role gating, workspace
matter) was pre-wired in Phases 3–4; this phase completed the deliverables:

- **Citation display** (`lib/legal/citations.ts` — the ONE parser, isomorphic).
  The research prompt ends answers with "## Sources"; the parser splits it out
  of the prose, classifies each authority (case / statute / regulation /
  secondary — heuristics cover "v." styles, US reporters, reporter-first
  citations like "AIR 1973 SC 1461" / "[2019] UKSC 41", §/Code/Act,
  C.F.R., Restatements), strips "[verify]", and splits "authority — proposition"
  into title + snippet. Research answers now render a `<CitationList>` of
  typed cards, each with a **"Verify source" link** (Google Scholar case-law
  search for cases, web search otherwise — honest links, since no legal DB is
  wired; provider selection stays deferred per Part 6). While streaming, an
  unterminated trailing line is held back so half-written cites never flash.
  The same parser feeds `chat_messages.citations` (`{ref, type}[]`, ref kept
  verbatim) in `/api/chat` — storage and display can't drift apart.
- **Drafting assistant** (`/drafting`, lawyer-gated like `/research`):
  - **New draft:** 8 professional doc types (`lib/drafting/doc-types.ts` —
    contract, clause, motion, memo, letter, affidavit, notice, custom), each
    contributing structure conventions to the prompt; free-form instructions
    (no consumer-style intake). `draftForLawyer()` reuses Phase 6's
    GeneratedDocument schema (exported as `GENERATED_DOCUMENT_SCHEMA`) with a
    professional-discipline system prompt: nothing invented → [PLACEHOLDERS],
    authority only when confident and marked "[verify]", every judgment call
    in review_flags.
  - **Redline:** paste original (≤24k chars) + instructions (optional → general
    pass). `redlineForLawyer()` returns the COMPLETE revised markdown plus an
    accounted-for change log — heading, kind (substantive/risk/clarity),
    shortest before/after excerpts, rationale — plus review_flags for knock-on
    effects (broken cross-references, defined terms). `RedlineDocView` renders
    revised draft beside the change log (kind badges; original struck through,
    revision highlighted) with PDF/DOCX export.
  - Both persist under the research workspace matter as
    `documents.type='generated'` with `ai_annotations.kind` = `lawyer_draft` |
    `redline` (schema's type check constraint predates redlines; kind
    disambiguates — no migration). Library/matter/detail views branch on the
    kind guards; persisted results route to `/documents/[id]`, demo renders
    inline.
- **Research → drafting bridge:** research answers get quiet Copy /
  **"Use in drafting"** actions; the answer travels via a one-shot
  sessionStorage hand-off (`lib/drafting/prefill.ts`) and lands in the
  drafting instructions with the cursor placed after "Draft: ".
- **Wiring:** lawyer nav unlocks Research + Drafting and gains **Documents**
  (drafts must be findable); dashboard lawyer cards link to both. Export logic
  extracted to `use-doc-export.ts` (shared by generated + redline views);
  licensed-jurisdictions lookup extracted to `lib/lawyers/queries.ts` (shared
  by chat + drafting routes).

### Key decisions
- **Same GeneratedDocument schema for consumer generation and lawyer drafts** —
  one shape, one viewer, one export pipeline; audience changes the system
  prompt, not the contract.
- **Redline = full revised text + change log**, not a diff format — the model
  accounts for every change with rationale; the UI shows before/after excerpts
  without fragile text-diffing.
- **Verify links point at searches, honestly labeled** — no pretense of a
  citator; "[verify]" discipline stays end-to-end (prompt → body → cards).
- **Prefill consumed via callback ref, not an effect** — one-shot apply of
  navigation state after hydration; keeps the codebase at zero lint disables
  (the new react-hooks/set-state-in-effect rule flags effect-based seeding).

### Verification (Part 0.5 / Part 10)
- Build clean (23 routes incl. `/drafting`, 2 drafting APIs); lint clean
  (no disables); RLS suite still **34/34**.
- Citation parser: **9/9 node unit tests** (tsc-compiled) — split, streaming
  hold-back, bullets, later-heading stop, all four classifications incl.
  reporter-first Indian/UK styles, [verify] stripping, URL choice, storage
  parse verbatim.
- Driven on the dev server (demo + mock `OPENAI_BASE_URL`): research stream
  carries citation-discipline prompt with jurisdiction "California, United
  States"; draft/redline prompts carry structure guidance + instructions
  (mock-inspected); all four validation errors return the calm copy; PDF
  export decoded (hex) → DRAFT stamp + signature block present; DOCX footer
  carries the full draft notice. Consumer chat + Phase 6 generate regressions
  green. Zero errors/warnings in the dev-server log.
- Dark/light parity: all new UI uses design tokens only (no raw colors).

### ⏭️ Deferred (explicit, with reasons)
- **Live legal database / citator** (Part 6 defers provider selection).
  Until wired, every citation is "[verify]" and verify-links go to searches.
- **Browser click-through of client-only flows** (mode toggle, prefill
  bridge, citation cards post-stream): no browser automation in this
  environment — parser logic unit-tested, SSR + APIs driven; same standard
  as prior phases. First funded live-model call also still outstanding
  (OpenAI key has no quota).
- **Lawyer-role dashboard/nav SSR check**: demo viewer is consumer-role, so
  lawyer variants were verified by code read; revisit when a real lawyer
  account exists on cloud Supabase.

### Next: Phase 8 — Client Intake & Case Management, Lawyer Side (recommended effort: HIGH)
Intake link generation, triage-to-brief, lawyer client/matter dashboard,
communication log. Builds on `lawyer_client_links` + RLS already proven.

---

## Phase 6 — Document Generation — ✅ (MAX effort)

**Goal (Part 4.1):** Generate common documents from structured intake +
conversation/matter context; template library scoped by jurisdiction; every
generated doc carries "Review before use" + space for lawyer review/signature;
export as PDF/DOCX.

### What was built
- **Template library** (`lib/generation/templates.ts`): demand letter,
  complaint letter, cease-and-desist, notice to landlord, NDA, basic service
  agreement — each a set of intake fields + drafting notes for the model (the
  templates guide the AI; they are not fill-in-the-blank boilerplate, so
  jurisdiction shaping happens at draft time).
- **Drafting call** (`lib/ai/document-generation.ts`; `completeStructured`
  gained text-only mode). Strict-schema output: `title`, `body_markdown`,
  `placeholders[]`, `review_flags[]`, `jurisdiction_caveat`. Discipline in the
  system prompt: **never invent facts — unknowns become [BRACKETED
  PLACEHOLDERS]**; judgment calls and jurisdiction-dependent choices must be
  listed in `review_flags`; no disclaimer text inside the body (the product
  stamps it).
- **`POST /api/documents/generate`**: template + sanitized intake (unknown
  fields dropped, required enforced with specific copy) + optional matter —
  matter's jurisdiction + its analyzed-document summaries inform the draft;
  persists as `documents.type='generated'`
  (`ai_annotations = GeneratedAnnotations`), ephemeral in demo mode.
- **`POST /api/documents/export`** + `lib/documents/export.ts`: markdown →
  **PDF** (pdf-lib: US Letter, Times, wrapped/paginated, gold rules) and
  **DOCX** (docx pkg: Georgia, headings, bold runs). Both append the
  **lawyer review/signature block** and stamp every page/footer with
  `DRAFT — Legal information, not legal advice…` (Part 4.1's flag travels
  with the file). Content comes in the request so demo drafts export too.
- **UI.** `/documents/generate` wizard (template cards → intake with matter
  select → staged drafting progress). `GeneratedDocView`: ReviewBeforeUse
  leads; the draft renders beside a **"Before you send this" checklist**
  (placeholders to fill, review flags, jurisdiction caveat) with PDF/DOCX
  download. `/documents/[id]` branches on `type='generated'` (Draft badge);
  library and matter-panel cards render drafts safely (annotations-shape
  guard) with Draft styling. Entry points: Documents header, matter workspace
  ("Analyze" / "Generate"), demo fixture demand letter for offline preview.

### Key decisions
- **Templates as model guidance, not boilerplate** — jurisdiction-aware
  drafting beats static fill-ins, and review_flags keep it honest.
- **Export takes content in the request** (auth-gated): one path for
  persisted + preview drafts; no blob storage dependency.
- **PDF inline formatting**: `**bold**` stripped to plain text in PDF (layout
  simplicity), honored as bold runs in DOCX.

### Verification (Part 0.5)
- Build (20 routes) + lint clean. Driven on the dev server (demo + mock):
  wizard/library/generated-view SSR all correct; generate API → prompt carries
  jurisdiction, matter title, template guidance (mock-inspected); probes —
  unknown template & missing required fields → 400 with specific calm copy.
  **Export bytes inspected**: PDF loads in pdf-lib (1 page, correct title,
  proper filename/content-type), hex-decoded content stream contains the
  letter text, signature block, DRAFT footer, page number; DOCX zip contains
  body text, signature block, and footer draft notice. Empty body / bad
  format → 400.
- Live drafting still gated on OpenAI billing (Phase 3 note).

### ⏭️ Deferred (with reasons)
- **In-app draft editing** — export → edit in Word/Docs covers v1; a rich
  editor is heavy. Revisit with Phase 13 polish or user demand.
- **Matter document summaries as demo generation context** — real mode only;
  demo passes title/jurisdiction (fixture parity not worth the plumbing).
- **More templates / per-jurisdiction template variants** — content pass after
  real usage; the registry makes additions one-object cheap.

### Next: Phase 7 — Lawyer Research & Drafting Tools (recommended effort: **MAX**)
Lawyer chat mode + research system prompt (Part 8), citation display
(SourceCitation exists), drafting assistant flow. Research citations need care:
no fabricated authority.

---

## Phase 5 — Document Intelligence (Signature Feature) — ✅ (MAX effort)

**Goal (Part 4.1 / 5.5 / 8):** Upload any legal document (PDF/image/scan) →
plain-language explanation with obligations, deadlines, risky clauses — in a
side-by-side view where every finding links to the exact clause it came from.

### What was built
- **AI extraction** (`lib/ai/document-analysis.ts` + `completeStructured()` in
  `lib/ai/provider.ts`). One multimodal call: images as `image_url` parts,
  PDFs as `file` parts, reply constrained by a **strict JSON schema** —
  Part 8's shape (document_type, jurisdiction_relevant, key_obligations,
  risky_or_unusual_clauses, important_dates, plain_language_summary) extended
  with **verbatim clause segments**; findings reference segment ids, which is
  what makes reliable two-way highlight-linking possible (no fuzzy quote
  matching). Severity levels (high/caution), jurisdiction_note, truncation
  flag, `[illegible]` convention for bad scans; segment-id references are
  clamped server-side so a stray model id can't break the UI.
- **Endpoint** (`POST /api/documents/analyze`). Multipart; PDF/PNG/JPG/WEBP up
  to 10 MB; matter scoping with ownership check (matter jurisdiction feeds the
  analysis) or the shared General-consultation fallback
  (`lib/matters/default-matter.ts`, now also used by chat); persists
  `extracted_text` + full analysis to `documents.ai_annotations`; demo mode
  returns an ephemeral result. Calm copy on every failure path.
- **Signature UI** (`components/documents/analysis-view.tsx`). Summary card
  (type/language badges, jurisdiction note, truncation notice) above a
  two-pane layout: verbatim document (serif clause headings — Fraunces is for
  document surfaces) beside sticky findings (risky clauses with terracotta
  "High risk" / gold "Caution", obligations with party + deadline, important
  dates). **Hover/focus/tap a finding → its source clauses glow and scroll
  into view; hover a clause → the findings built on it light up.** Dates offer
  one-tap **"Add to matter timeline"** (creates a deadline via the Phase 4
  action). Reduced-motion respected; findings lead on mobile; whole view sits
  inside `<AiLegalOutput>` (full disclaimer; high-risk clauses raise the
  professional-help nudge).
- **Upload flow** (`upload-analyze.tsx`): drag-drop/picker, title + matter
  select, staged progress copy while the model reads (Part 10's engaging
  progress state), inline result rendering in demo mode.
- **Library + integration.** `/documents` (upload + analyzed-document cards
  with flagged-clause counts), `/documents/[id]` (persisted signature view,
  two-step delete), matter workspace's documents panel now lists real
  documents + "Analyze a document" (matter preselected), Documents enabled in
  nav, dashboard card linked. **Matter chat now receives analyzed-document
  summaries** in its system prompt (Part 4.1 "full context … uploaded
  documents"; latest 3, summaries only). Demo fixture: a pre-analyzed lease on
  the demo matter so the signature screen is fully explorable offline.

### Key decisions
- **Binary storage deferred.** No cloud Supabase/storage bucket exists yet;
  the product's value lives in the verbatim segments + analysis (the
  side-by-side renders text, not the file), so `file_url` stays null and blob
  archival lands with the cloud project. Explicit deferral, not a scope cut.
- **Segments over quote-matching** for highlight anchors (reliability of the
  signature interaction beats prompt brevity).
- Next.js itself caps request bodies at 10 MB — matches the product limit;
  oversized uploads surface the same calm copy (400 rather than 413).

### Verification (Part 0.5 / Part 10)
- Build (17 routes) + lint clean. Driven on the dev server (demo mode + mock
  provider): `/documents` (upload zone + library card), signature view SSR
  (summary, segments, High risk/Caution badges, obligations, dates,
  disclaimer, jurisdiction), matter panel lists the lease, unknown doc → 404.
  API: PNG → `image_url` part and PDF → `file` part with correct data-URIs
  (mock-inspected); strict schema name/strict flags sent; **bogus segment id
  from the model clamped**; demo response has `documentId: null`. Probes:
  no file/oversized/wrong type/non-multipart → 400/415 calm copy, GET → 405;
  matter chat prompt now carries "Documents already analyzed on this matter"
  with the lease summary.
- **Live vision extraction still blocked by OpenAI quota** (Phase 3 note) —
  the wire format is verified against the mock; first funded call is the
  remaining live check.

### ⏭️ Deferred (with reasons)
- **Original-file archival + preview** — needs cloud Supabase Storage (above).
- **Browser click-through of hover-linking** — no browser automation in this
  environment; interaction logic is straightforward React state, SSR verified.
- **OCR fallback for huge/scanned PDFs beyond model limits** — revisit with
  real usage; `truncated` flag + notice already handle the edge honestly.

### Next: Phase 6 — Document Generation (recommended effort: **MAX**)
Template library, conversation-to-document flow, PDF/DOCX export,
"review before use" flagging (component exists from Phase 1).

---

## Phase 4 — Matters & Case Organization — ✅ (HIGH effort)

**Goal:** Matter CRUD, timeline/deadline UI, linking chat history to matters.

### What was built
- **Data layer** (`src/lib/matters/`). `categories.ts` (consumer category slugs
  aligned with `HIGH_STAKES_CATEGORIES`; "general" reserved for the Phase 3
  /chat matter), `queries.ts` (list with message/document counts + open
  deadlines via PostgREST embeds; detail = matter + deadlines + transcript),
  `actions.ts` (matter create/update/status/delete + deadline add/toggle/delete
  — user-scoped client so RLS enforces ownership, calm error copy, path
  revalidation), `demo.ts` (fixtures so the whole matters UI previews without
  Supabase; mutations return "preview" copy there).
- **Pages.** `/matters` (status filter tabs with counts, premium cards: serif
  title, category, status badge, per-matter jurisdiction, counts, next/overdue
  deadline), `/matters/new` + `/matters/[id]/edit` (shared `MatterForm`;
  jurisdiction **re-askable per case** — defaults from profile, stored as
  display names; edit adds status + a two-step irreversible-delete danger
  zone), `/matters/[id]` (workspace: matter-scoped chat beside the timeline,
  documents placeholder for Phase 5; unknown/foreign ids → 404).
- **Timeline** (`DeadlineTimeline`): add (title + optional date), complete/
  reopen, delete; sorted by due date; overdue rows in muted terracotta with an
  "Overdue" badge; relative labels (today / in N days / N days ago).
- **Chat ↔ matters link.** `ChatScreen` takes `matterId`/`matterTitle` (matter
  empty-state copy, no generic chips) and `/api/chat` accepts `matterId`:
  ownership verified (owner filter + RLS), messages persist to that matter, and
  the prompt gains `Active matter: "…" (category: …)` plus the **matter's own
  jurisdiction overriding the profile's**. `/chat` keeps using the lazily
  created General consultation matter.
- Matters enabled in nav; dashboard "Start a matter" links to `/matters/new`.

### Key decisions
- **Two-step confirm for matter delete** (cascade wipes chat/documents/
  deadlines); archive is the reversible path via status.
- **`reminder_sent` untouched**: reminder *delivery* needs email/notification
  infra — deferred, schema already supports it.
- Embedded aggregates need a `row as unknown as …` cast: `types.ts` declares
  `Relationships: []`, so supabase-js can't infer embeds (runtime is FK-driven
  and fine).

### Verification (Part 0.5)
- `npm run build` (14 routes) + lint clean. Driven against the running dev
  server (demo mode): list shows fixtures with counts and "Next:" deadline;
  status filter isolates correctly; detail renders timeline (relative dates),
  transcript, documents placeholder, disclaimer; unknown matter → 404;
  create form renders categories + countries. Via the mock provider
  (`OPENAI_BASE_URL`): matter-scoped `/api/chat` request carries
  `Active matter: "Security deposit dispute — Maple St apartment"
  (category: Tenant & Housing)` and the matter's jurisdiction; probes — bogus
  and non-string `matterId` degrade safely to an unscoped answer (demo) and
  ownership is enforced by owner-filter + RLS in real mode.

### ⏭️ Deferred (with reasons)
- **Deadline reminders (delivery)** — needs email/notification infrastructure;
  flag exists on the schema. Revisit alongside Phase 10+ infra.
- **Live-mode persistence click-through** — still no linked Supabase project.
- **Matter search/pagination** — premature before real usage volumes.

### Next: Phase 5 — Document Intelligence (recommended effort: **MAX** — signature feature)
Upload, vision extraction, structured annotations, side-by-side
highlight-linking UI (Part 5.5). Needs the OpenAI account funded (vision
calls) — see Phase 3's owner-attention note.

---

## Phase 3 — Core Chat (Consumer) — ✅ (HIGH effort)

**Goal:** Chat UI + streaming, AI with the consumer system prompt (Part 8),
jurisdiction context injection, suggested question chips, persistent disclaimer.

### What was built
- **AI provider layer** (`src/lib/ai/`). **Owner decision (2026-07-03): chat runs
  on the OpenAI API instead of the spec's Claude API** — the owner supplied an
  OpenAI key and directed its use. Everything vendor-specific is contained in
  `provider.ts` (`streamAiChat()` — fetch + SSE, no SDK), so switching back to
  Claude is a one-file change. `env.ts` (key, `OPENAI_MODEL` default `gpt-4o`,
  `OPENAI_BASE_URL` override for proxies/mocks), `copy.ts` (calm Part 8 error
  copy), `prompts.ts` (consumer system prompt: information-not-advice framing,
  jurisdiction scoping + uncertainty discipline, high-stakes lawyer nudges,
  no per-message disclaimer boilerplate since the UI carries it, reply in the
  user's preferred language, never fabricate citations).
- **Streaming chat API** (`app/api/chat/route.ts`). Validates input (8k char
  cap, sanitized 30-message history), builds the jurisdiction-injected prompt
  from the viewer's profile, streams plain text. Persistence: lazily creates the
  viewer's default **"General consultation" matter** (category `general` —
  `chat_messages.matter_id` is NOT NULL; Phase 4 builds real matter CRUD on
  top), inserts the user turn via the user-scoped client (RLS-checked) and the
  assistant turn via the service role after the stream completes. In demo mode
  (Supabase unconfigured) chat works without persistence. All errors map to
  calm copy — raw provider errors only reach the server log (Part 8).
- **Chat UI** (`(app)/chat` + `src/components/chat/`). Premium composed screen:
  persistent compact disclaimer above the log, empty state with serif greeting +
  six suggested-situation chips (Part 4.1, `lib/legal/suggested-questions.ts`),
  streaming markdown rendering (react-markdown + GFM, design-system mapped,
  raw HTML never rendered), thinking indicator + streaming caret (motion-safe),
  scroll-following that respects the reader scrolling up, Stop button
  (AbortController), auto-growing composer (Enter sends, Shift+Enter newline),
  calm error alerts that preserve partial answers. Every assistant message
  renders inside `<AiLegalOutput>`; `looksHighStakes()` over the user's messages
  raises the "consider a real lawyer" nudge on the latest reply. WCAG:
  `role="log"` + polite live region, sr-only speaker labels, labelled controls.
- **Nav/dashboard.** Assistant enabled in the sidebar; dashboard "Ask the
  assistant" card is now a real link (others stay "Soon").

### Key decisions
- **OpenAI over Claude** — owner-directed (see above); logged, not a silent cut.
  The spec's Part 8 prompts/structure are provider-neutral and unchanged.
- **Default matter, not schema change.** Keeping `matter_id NOT NULL` preserves
  the RLS isolation model; a lazily created "General consultation" matter gives
  Phase 3 a home for history and Phase 4 a migration-free starting point.
- **Client sends visible history** (server sanitizes + caps) rather than
  re-reading it from DB per turn — one code path for demo and real modes.
- **Storage failures don't block answers**: if persistence errors, the
  assistant still responds (logged server-side).
- Fixed a `react-hooks/set-state-in-effect` lint error in `theme-toggle.tsx`
  (surfaced by the dep refresh) with `useSyncExternalStore`.

### Verification (Part 0.5)
- `npm run build` clean (12 routes, `/chat` + `/api/chat` added); `npm run lint`
  clean.
- **Live OpenAI call blocked by the account, not the code**: the provided key
  authenticates but returns `429 insufficient_quota` (no billing/credits). The
  full pipeline was therefore verified end-to-end against a local mock speaking
  the exact OpenAI SSE protocol (`OPENAI_BASE_URL` override): progressive
  streaming (first byte 0.26s), markdown intact, history + system prompt +
  **"The user's jurisdiction is: California, United States"** confirmed in the
  upstream request; probes — empty/oversized/malformed input → 400 calm copy,
  forged `system` role in history stripped, GET → 405, upstream 429 → 502 calm
  copy, mid-stream drop → partial answer preserved + retryable error.

### ⏭️ Deferred (with reasons)
- **Live model verification + browser click-through of streaming.** Blocked on
  OpenAI billing (below). SSR of /chat (chips, disclaimer, jurisdiction,
  greeting) verified; API surface verified as above.
- **Live persistence end-to-end** — still no linked Supabase project (Phase 1
  deferral); code paths in place and RLS-compatible.
- **Suggested chips beyond six / per-jurisdiction chips** — content pass later.

### ⚠️ Needs owner attention
- **OpenAI account has no quota** — add billing/credits at
  platform.openai.com, or the assistant shows the calm retry message. Also:
  the key was pasted in chat, so **rotate it** after adding billing; it lives
  only in gitignored `apps/web/.env.local`.
- Stale git remote (unchanged from Phase 1) — fix before any push.

### Next: Phase 4 — Matters & Case Organization (recommended effort: HIGH)
Matter CRUD, timeline/deadline UI, linking chat history to matters (the default
"General consultation" matter is the bridge).

---

## Phase 2 — Auth & Onboarding — ✅ (HIGH effort)

**Goal:** Auth (email + Google/Apple), role selection, jurisdiction + language
setup, profile creation for both roles.

### What was built
- **Auth flow.** `/(auth)/sign-in` + `/sign-up` with a shared premium auth shell.
  Email/password + passwordless magic link + Google/Apple OAuth via the browser
  client (PKCE → `/auth/callback` route handler that exchanges the code and routes
  onward). Calm, professional error copy mapped in `lib/auth/errors.ts` (Part 8).
  `signOut` server action.
- **Onboarding wizard.** Multi-step (`role → jurisdiction → profile → [lawyer
  professional details]`), gold progress, restrained transitions. Writes via
  `completeOnboarding` server action → updates `profiles` and seeds
  `lawyer_profiles` (verification stays `pending` — real verification is Phase 9).
  Reference data: `lib/legal/countries.ts` (full subdivisions for US/CA/GB/AU/IN +
  ~40 countries), `lib/i18n/languages.ts`, `lib/legal/practice-areas.ts`.
- **Protected app shell + dashboard.** `(app)/layout.tsx` gates auth + onboarding
  and renders `AppShell` (role-aware sidebar/mobile drawer, jurisdiction indicator,
  theme toggle, user card + sign out). `(app)/dashboard` is role-aware (consumer vs
  lawyer quick actions, account summary, persistent disclaimer / research notice).
- **Form primitives.** `Input`, `Textarea`, `Label`, `Field`, `Select`,
  `RadioCard`, `Alert` — on the design system, WCAG-AA labelled.
- **Schema.** `20260703093000_onboarding.sql` adds `profiles.onboarding_completed`.

### Key decisions
- **Client-side auth via `@supabase/ssr` browser client** (password/magic/OAuth),
  with the proxy refreshing sessions server-side. Uniform and testable; avoids
  server-action cookie edge cases.
- **Demo/preview mode.** `getViewer()` returns a demo consumer when Supabase is
  unconfigured, so the authed UI (onboarding, dashboard, shell) is fully previewable
  locally. Strictly inert once env is set (never active in production).
- **Jurisdiction stored as display names** (country + region) for trivial display
  and AI context; wizard drives subdivisions off ISO codes then resolves to names.
- **`get-started` → `sign-up`** redirect preserves the pricing `?plan` param.

### Verification (Part 0.5)
- `npm run build`: clean (10 routes). Verified in browser, light + dark:
  sign-up (OAuth + email + magic link), onboarding wizard (role selection toggles,
  Continue enables correctly), dashboard + app-shell drawer (role-aware nav, user
  card, sign out). No console errors.

### ⏭️ Deferred (with reasons)
- **Live auth end-to-end.** Needs a linked Supabase project (no cloud creds / no
  Docker this session). Flow is complete and correct; verified via UI + build.
  OAuth requires Google/Apple provider secrets in Supabase (config scaffolded,
  disabled).
- **UI string translation.** Language *preference* is captured + stored now; full
  i18n of the interface is a later polish pass (Phase 13). Not a scope cut.
- **Future routes** linked from nav/footer (`/chat`, `/matters`, `/find-a-lawyer`,
  `/terms`, …) are tagged "Soon" or resolve in later phases.

### Next: Phase 3 — Core Chat (Consumer) (recommended effort: HIGH)
Chat UI + streaming, Claude API with the consumer system prompt (Part 8),
jurisdiction context injection, suggested question chips, persistent disclaimer.
Requires `ANTHROPIC_API_KEY`.

---

## Phase 1 — Foundation & Compliance Framework — ✅ (MAX effort)

**Goal:** Next.js scaffold, design system as theme tokens, Supabase setup + full
schema with RLS, and the reusable disclaimer/trust UI — built once, reused
everywhere. Verify RLS actually works before completing.

### What was built
- **Monorepo scaffold.** `apps/web` = Next.js 16.2 (App Router, TS, Turbopack) +
  Tailwind **v4**. `supabase/` = migrations, config, RLS test harness.
  `packages/design-tokens/` = canonical token JSON.
- **Design system (Part 5).** Full palette + semantic tokens in
  `apps/web/src/app/globals.css` via Tailwind v4 `@theme inline` + CSS vars;
  light/dark parity through a single `.dark` class (next-themes). Fraunces (serif,
  gravitas) + Inter (UI) via `next/font`. Radius 6–12px, restrained motion tokens,
  warm elevation. Canonical values also in `packages/design-tokens/tokens.json`
  (shared source of truth for Flutter in Phase 12).
- **Compliance layer (Part 1 + 5.6) — load-bearing.** Canonical legal copy in
  `src/lib/legal/disclaimers.ts` (single source of truth). Components in
  `src/components/compliance/`: `DisclaimerBanner`, `JurisdictionIndicator`,
  `ReviewBeforeUse`, `SourceCitation`/`CitationList`, `ProfessionalHelpNudge`, and
  `AiLegalOutput` — a wrapper that *structurally* guarantees any AI legal output
  carries its disclaimer + jurisdiction context (so it can never be forgotten).
- **UI primitives.** `Button` (+`buttonVariants`), `Card`, `Badge`, `ThemeToggle`,
  site `Logo`/`SiteHeader`/`SiteFooter`. Premium landing page at `/` exercising all
  of the above (hero, dual-audience, pricing, real compliance components).
- **Database (Part 7).** `supabase/migrations/20260703090000_initial_schema.sql`:
  all 8 tables with `CHECK` constraints, indexes, `updated_at` triggers, a
  `handle_new_user` trigger (auto-creates profile + free subscription), and **RLS
  on every table**. Access to matter-scoped rows is derived via `SECURITY DEFINER`
  helpers (`can_access_matter`, `is_matter_owner`, `is_matter_lawyer`,
  `is_verified_lawyer`) to avoid recursive policies.
- **Supabase client wiring.** Typed `Database` (`src/lib/supabase/types.ts`),
  browser/server clients (`@supabase/ssr`), service-role admin client, and a
  session-refresh **proxy** (Next 16's renamed middleware), all inert until env is
  set so early phases run without credentials.

### Key decisions
- **Tailwind v4 (not v3).** create-next-app ships v4; tokens live in `@theme`/CSS
  vars, no `tailwind.config.js`. Fits "design system as tokens" cleanly.
- **`text` + `CHECK` over Postgres enums.** Matches Part 7's column types while
  adding integrity; easier to evolve than enum types ("launch focused").
- **Consent-first sharing.** A lawyer reaches a client's matter *only* via an
  `active`/`invited` `lawyer_client_links` row created by the matter owner.
  Lawyer-initiated intake invites are deferred to a Phase 8 token-validated RPC
  (a broad lawyer INSERT policy would be an escalation risk).
- **RLS verification without Docker.** Environment has no Docker/brew/psql, so
  `supabase start` is unavailable. Instead the RLS suite boots a **real embedded
  Postgres** (`embedded-postgres`) under a faithful Supabase `auth` shim and
  impersonates users via `SET LOCAL ROLE` + `request.jwt.claims` — the same
  mechanism Supabase uses. **34/34 assertions pass.**
- **Middleware → proxy.** Next 16 deprecates `middleware.ts`; migrated to
  `src/proxy.ts` / `export function proxy` per bundled docs.

### Verification (Part 0.5 / Part 10)
- `npm run build` (apps/web): clean — TS + lint pass, no warnings.
- Design system verified in browser, **light and dark** (premium parchment/navy in
  light, charcoal/gold in dark). Responsive.
- **RLS proven:** `cd supabase/tests && npm run test:rls` → 34 passed, 0 failed.
  Confirms a consumer can't read another's data, a lawyer only sees shared matters,
  an **unlinked lawyer sees nothing of another lawyer's clients**, and no
  self-granting of access.

### ⏭️ Deferred (explicit, with reasons)
- **Token → Flutter codegen.** `tokens.json` is the canonical reference; web CSS
  currently *mirrors* it by hand (no build-time codegen). Reason: codegen is
  over-engineering before a second consumer exists. Wire up when Flutter lands
  (Phase 12).
- **Live Supabase project.** No cloud project linked (needs owner credentials).
  Migration is ready for `supabase db push`; `.env.example` lists required vars.
- **Social auth (Google/Apple).** Providers are scaffolded but disabled in
  `config.toml`; OAuth app setup + callback route is Phase 2.
- **`sharp` image optimization.** Its postinstall was skipped by the sandbox's
  npm allow-scripts policy. No optimized images are used yet; run
  `npm rebuild sharp` (or approve scripts) before relying on `next/image` in prod.

### ⚠️ Needs owner attention
- **Stale git remote.** `origin` points at `github.com/vaibhavdbjsjx/Portfolio-website.git`
  — not this project. Nothing has been pushed. Set the correct remote before any push.
- **TOS/compliance review.** Per Part 12, have a lawyer review terms of service and
  the "information, not advice" framing before public launch.

### Next: Phase 2 — Auth & Onboarding (recommended effort: HIGH)
Auth flow (email + Google/Apple), role selection (consumer/lawyer), jurisdiction
setup, language preference, profile creation for both roles. Uses the Supabase
clients + `profiles`/`lawyer_profiles` tables already in place.

---

## Environment notes (for future turns)
- macOS (darwin, arm64). Node 24, npm 11. **No Docker, no brew, no psql.**
- Preview dev server config: `.claude/launch.json` → `web` (`npm --prefix apps/web run dev`, port 3000).
- Today's date at Phase 1: 2026-07-03.
