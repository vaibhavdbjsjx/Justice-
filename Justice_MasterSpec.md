# Justice — AI Legal Assistant Platform
## Master Build Specification for Claude Code

> Read this entire document before writing any code.
> (Markdown copy of `Justice MasterSpec.pdf`, saved per Part 12.)

---

## PART 0 — HOW YOU (CLAUDE CODE) SHOULD OPERATE ON THIS PROJECT

1. Work in phases (Part 9), not one giant leap. Complete a phase fully before moving to the next.
2. Do not stop for permission between phases. Only stop for genuine architectural ambiguity.
3. Maintain **BUILD_LOG.md** (decisions, shortcuts, what's next) and **ARCHITECTURE.md** (structure, data flow) — update after every phase.
4. Never silently cut scope. If something is deferred, log it explicitly under "Deferred" with a reason.
5. After each phase: run it, click through it, check dark mode, check empty/error states, fix before advancing.
6. Effort management: see Part 11 — this is inserted into your working instructions, not just a note for later.

---

## PART 1 — PRODUCT VISION & CRITICAL FRAMING

**One-line pitch:** "Understand your legal situation in minutes. Built for people — and the lawyers who help them."

**What this app IS:**
- A legal information, document, and workflow assistant
- A research and drafting accelerator for lawyers
- A plain-language translator for legal complexity

**What this app IS NOT — this framing is load-bearing, build it in everywhere:**
- Not a substitute for a licensed lawyer's advice on an actual case
- Not making final legal determinations — it informs, drafts, and organizes; humans decide
- Every consumer-facing legal output must carry a clear, visible disclaimer: **this is legal information, not legal advice, and does not create an attorney-client relationship**

This isn't just a legal cover statement — build the product logic around it. E.g., the AI can explain what a "notice of eviction" typically means and draft one, but should encourage the user to have a licensed lawyer (in their jurisdiction) review anything before sending/filing, and should flag when a situation looks complex enough that it needs one.

**Global from day one:** Jurisdiction is a first-class data field everywhere — not India-only, not US-only. The AI's context always includes "user's country/state" and responses are scoped accordingly, with a clear caveat when the AI is uncertain about a specific jurisdiction's rules.

**Two audiences, one platform:**
1. **Consumers** — plain-language help, document generation, understanding rights
2. **Lawyers** — research acceleration, drafting assistant, case organization, client intake helper

---

## PART 2 — COMPETITIVE POSITIONING

| Existing player | Gap | Our edge |
|---|---|---|
| ChatGPT/Gemini (general AI) | No legal-specific workflow, no document generation, no jurisdiction awareness, no case memory | Purpose-built legal workflows + persistent case context |
| LegalZoom / Rocket Lawyer | Template-heavy, form-filling feel, not conversational, US-centric | AI-conversational, globally scoped, feels like a smart advisor not a form wizard |
| Lawyer-side tools (Clio, Harvey AI) | Either practice management OR AI research, rarely both, expensive, firm-only | Combined research + drafting + client-facing tool, accessible to solo/small practitioners too |

Moat if a general AI added "legal mode": jurisdiction-aware structured workflows, persistent case/document memory, and the dual-sided lawyer+consumer network — not the raw AI capability.

---

## PART 3 — PLATFORM STRATEGY (Web + Desktop + Mobile from One Codebase)

| Platform | Approach |
|---|---|
| Web app | Next.js (React) — primary platform, responsive, this is the core build |
| Desktop app | Wrap the same Next.js app with **Tauri** (lighter than Electron) for Mac/Windows/Linux |
| Mobile app | **Flutter** app consuming the same backend/API — separate codebase from web, shares backend entirely |

Sharing the backend and design system tokens across Next.js (web/desktop) and Flutter (mobile) gets consistency without compromising native feel. Backend is platform-agnostic — one API layer serves all three identically.

---

## PART 4 — FULL FEATURE SET

### 4.1 — Shared Foundation (Both User Types)

**Onboarding**
- Sign up: Email, Google, Apple (Supabase Auth)
- Choose role: "I need legal help" (Consumer) or "I'm a legal professional" (Lawyer) — role determines dashboard, not a hard wall; a consumer can later connect with a real lawyer through the platform
- Jurisdiction setup: country, state/province — structured data, re-askable per case
- Language preference (multi-language from the start)

**AI Legal Assistant Core (Chat)**
- Conversational interface, streaming responses
- Full context: user's jurisdiction, active case/matter, uploaded documents
- Every response scoped with jurisdiction caveats when relevant
- Suggested question chips based on common situations (tenant rights, employment disputes, contract questions, small claims, family law basics, etc.)
- Clear, persistent disclaimer banner in every legal chat

**Document Intelligence**
- Upload any legal document (PDF/image/scan) → AI extracts and explains in plain language
- Highlights: key obligations, deadlines, risky clauses, unusual terms
- Side-by-side view: original document + plain-language annotations
- Works for contracts, notices, court documents, agreements — jurisdiction-aware

**Document Generation**
- Generate common documents from conversation: demand letters, notices, basic contracts, complaint letters, cease-and-desist, NDAs, etc.
- Template library scoped by jurisdiction and document type
- Every generated doc includes a "Review before use" flag and space for lawyer review/signature
- Export as PDF/DOCX

**Case/Matter Organization**
- Create a "Matter" that groups: chat history, uploaded documents, generated documents, timeline/deadlines
- Timeline view with deadline tracking and reminders

### 4.2 — Consumer-Specific Features
- **Situation triage:** guided intake flow, AI categorizes and suggests next steps
- **Rights explainer:** plain-language breakdown of rights relevant to situation + jurisdiction
- **"Do I need a lawyer?" assessment:** honest read on complexity/stakes
- **Find a lawyer:** directory/marketplace of verified lawyers (monetization bridge)
- **Cost estimator:** rough, jurisdiction-aware costs, clearly labeled as estimates

### 4.3 — Lawyer-Specific Features
- **Research accelerator:** AI-assisted case law/statute research, jurisdiction-scoped, with verifiable source citations
- **Drafting assistant:** AI drafts/redlines contracts, motions, letters — lawyer stays in control
- **Client intake automation:** branded intake link; consumer's triage becomes a structured case brief
- **Case management lite:** matter list, document storage per client, deadline tracking, notes
- **Client communication log:** organized thread per client/matter
- **Marketplace presence:** lawyer profile discoverable by consumers

### 4.4 — Monetization

| Tier | Audience | Price | Includes |
|---|---|---|---|
| Free | Consumer | $0 | Limited chat messages/month, 1 active matter, basic document generation |
| Plus | Consumer | $14.99/mo | Unlimited chat, unlimited matters, full document generation, document intelligence |
| Professional | Lawyer | $49.99/mo | Full research + drafting, client intake automation, case management lite, marketplace profile |
| Marketplace commission | Both | ~15% | Platform cut when a consumer hires a lawyer found through the platform |

---

## PART 5 — DESIGN SYSTEM (Premium, Luxury Feel — Non-Negotiable)

### 5.1 Direction
Feel like a **private legal advisor**, not a form-filling government website and not a generic SaaS dashboard. The calm authority of a high-end law firm's office, translated into digital. Reference: Stripe's polish + a private bank's trust signaling + none of the coldness of typical legal-tech.

### 5.2 Color Palette
- `ink-navy` **#0B1D2E** — primary, deep authoritative navy (not black)
- `gold-accent` **#B08D57** — muted brass/gold, sparingly, CTAs/active states
- `paper-cream` **#FAF7F2** — light mode background (quality paper/parchment)
- `charcoal-deep` **#12181F** — dark mode background
- `text-primary` **#1A1A1A** (light) / **#F2F0EC** (dark)
- `text-muted` **#6B6B6B** (light) / **#9A9A94** (dark)
- `success-sage` **#7A9471** — muted, not neon
- `alert-terracotta` **#C1654A** — muted warm red for warnings/deadlines
- Full light and dark mode from day one

### 5.3 Typography
- **Headings:** refined serif (Fraunces or Source Serif 4) — signals "legal/premium", used deliberately on key headers and document screens
- **Body/UI:** clean sans-serif (Inter)
- Clear type scale, generous line-height for legal reading

### 5.4 Layout & Motion
- Generous whitespace, structured grid
- Border radius: 8–12px (sharper, serious), not 24px
- Subtle, restrained motion — fades and gentle slides, not bouncy springs
- Document-related screens get extra visual care

### 5.5 Signature Element
The **Document Intelligence** view (original doc + plain-language annotations side by side) is the signature, most-polished screen. Invest extra design/animation care: smooth highlight-linking between original text and its explanation on hover/tap.

### 5.6 Trust & Compliance UI Patterns
- **Disclaimer banner component:** persistent but not obnoxious, on every AI legal output
- **Jurisdiction indicator:** always visible in chat/document context
- **Source citation component:** for lawyer-side research, every claim can show its source

---

## PART 6 — TECH STACK

| Layer | Choice | Notes |
|---|---|---|
| Web/Desktop | Next.js (React) + Tauri | Shared codebase web + desktop |
| Mobile | Flutter | Separate codebase, shared backend |
| AI | Claude API (Sonnet, vision-capable) | Core reasoning engine |
| Backend | Supabase (Postgres, Auth, Storage, Edge Functions) | Shared across all platforms |
| Auth | Supabase Auth | Email, Google, Apple |
| Payments | Stripe (web/desktop) + RevenueCat (mobile) | Marketplace via Stripe Connect |
| Document processing | Claude API for extraction; pdf-lib for generation | |
| Search/citations | Web search API + curated legal DB API per jurisdiction | Provider selection deferred to a phase |
| State management | Zustand or Redux Toolkit (web), Riverpod (Flutter) | |

---

## PART 7 — DATABASE SCHEMA (Core Tables)

- `profiles(user_id PK → auth.users, role 'consumer'|'lawyer', full_name, country, state_province, preferred_language, created_at)`
- `lawyer_profiles(user_id PK → profiles, practice_areas jsonb, licensed_jurisdictions jsonb, bar_number, verification_status 'pending'|'verified'|'rejected', rate_range, bio, rating_avg)`
- `matters(id PK, user_id → profiles, title, category, jurisdiction_country, jurisdiction_state, status 'active'|'resolved'|'archived', assigned_lawyer_id → profiles, created_at)`
- `chat_messages(id PK, matter_id → matters, user_id → profiles, role 'user'|'assistant', content, citations jsonb, created_at)`
- `documents(id PK, matter_id → matters, uploaded_by → profiles, type 'uploaded'|'generated', file_url, extracted_text, ai_annotations jsonb, created_at)`
- `deadlines(id PK, matter_id → matters, title, due_date, status 'upcoming'|'completed'|'missed', reminder_sent bool)`
- `lawyer_client_links(lawyer_id → profiles, client_id → profiles, matter_id → matters, status 'invited'|'active'|'ended', PK(lawyer_id, client_id, matter_id))`
- `subscriptions(user_id PK → profiles, tier 'free'|'plus'|'professional', status, renews_at)`

**Apply row-level security on every table.** Lawyer-client data isolation is critical — a lawyer should only see matters/documents explicitly shared with them via `lawyer_client_links`, never all consumer data.

---

## PART 8 — CLAUDE API INTEGRATION

**Consumer Chat System Prompt (Base):** legal information assistant, NOT a lawyer, NOT legal advice. Context: jurisdiction, active matter, matter history. Guidelines: plain language; always scope to jurisdiction and flag uncertainty; recommend professional representation for high-stakes (criminal, significant money, custody, immigration); never state jurisdiction-varying rules as certain; end complex responses with a natural next-step.

**Lawyer Research System Prompt (Base):** research assistant for verified lawyers; technical language OK but citation discipline matters more; cite statutes/cases/regulations; distinguish settled law from uncertainty/circuit split; when drafting, produce editable first draft and flag judgment calls; research accelerator, not final authority.

**Document Analysis — Structured Output:**
```json
{
  "document_type": "residential lease agreement",
  "jurisdiction_relevant": true,
  "key_obligations": [
    {"party": "tenant", "obligation": "...", "deadline_if_any": "..."}
  ],
  "risky_or_unusual_clauses": [
    {"clause_excerpt_summary": "...", "why_flagged": "...", "section_reference": "..."}
  ],
  "important_dates": ["..."],
  "plain_language_summary": "..."
}
```

**Error Handling:** Never expose raw API errors. On failure, show a calm, professional retry message consistent with the app's tone — never casual/playful.

---

## PART 9 — BUILD ORDER (Phased, Sequential)

1. **Foundation & Compliance Framework** — Next.js scaffold, design tokens (Part 5), Supabase setup, schema (Part 7) with RLS, disclaimer/trust UI components (built once, reused).
2. **Auth & Onboarding** — Auth flow, role selection, jurisdiction setup, language preference, profile creation both roles.
3. **Core Chat (Consumer)** — Chat UI, streaming, Claude API + consumer prompt, jurisdiction injection, suggested chips, disclaimer component.
4. **Matters & Case Organization** — Matter CRUD, timeline/deadline UI, linking chat history to matters.
5. **Document Intelligence (Signature — Extra Polish)** — Upload, Claude Vision extraction, structured annotations, side-by-side highlight-linking UI (Part 5.5).
6. **Document Generation** — Template library, conversation-to-document flow, PDF/DOCX export, "review before use" flagging.
7. **Lawyer Research & Drafting Tools** — Lawyer chat mode + research prompt, citation display, drafting assistant flow.
8. **Client Intake & Case Management (Lawyer Side)** — Intake link generation, triage-to-brief, lawyer client/matter dashboard, communication log.
9. **Lawyer Marketplace** — Lawyer profile/verification, consumer "Find a lawyer" directory + search, lawyer-client linking.
10. **Monetization** — Stripe (web/desktop), RevenueCat (mobile), tier gating across features, Stripe Connect commission.
11. **Desktop Wrapper** — Tauri packaging Mac/Windows/Linux, native menu/window polish.
12. **Mobile App (Flutter)** — Separate Flutter build on same backend: chat, matters, document intelligence, generation, same tokens.
13. **Polish Loop (Repeat Until Clean)** — Full click-through web/desktop/mobile, dark mode, empty/error states, animation smoothness.

---

## PART 10 — QUALITY BARS
- 60fps on all web/desktop animations, no jank
- Document analysis returns in under 5–6 seconds incl. API round trip, with an engaging progress state
- Full **WCAG AA** accessibility — matters more here than average
- Every AI legal output carries the disclaimer — hard requirement
- Row-level security tested explicitly — a lawyer must never query another lawyer's clients' data
- 100% dark/light mode parity across all three platforms

---

## PART 11 — EFFORT MANAGEMENT

| Phase | Effort | Why |
|---|---|---|
| 1 Foundation & Compliance | **MAX** | RLS + compliance UI are foundational, mistakes propagate |
| 2 Auth & Onboarding | HIGH | Standard patterns |
| 3 Core Chat | HIGH | Standard chat UI, prompt specified |
| 4 Matters | HIGH | Standard CRUD |
| 5 Document Intelligence | **MAX** | Signature feature, extraction accuracy |
| 6 Document Generation | **MAX** | Legal document accuracy/formatting has consequences |
| 7 Lawyer Research | **MAX** | Citation discipline + reasoning = core value for paying lawyers |
| 8 Client Intake | HIGH | Standard workflow |
| 9 Marketplace | HIGH | Standard directory/matching |
| 10 Monetization | **MAX** | Payment/commission bugs costly later |
| 11 Desktop Wrapper | HIGH | Mostly packaging |
| 12 Mobile | HIGH | Porting established patterns to Flutter |
| 13 Polish Loop | HIGH | Iterative fixing |

---

## PART 12 — NOTES
- Bigger build than typical: two user types, three platforms, real compliance.
- Lawyer verification (Phase 9) is a real-world process; build UI/data structure, verification rigor is a judgment call at launch.
- "Globally scoped architecture, launch focused" — data model supports global; start with one jurisdiction well.
- Legal-tech compliance (unauthorized practice of law) varies by country; stay in "information + drafting assistance"; TOS needs a real lawyer's review before public launch.
