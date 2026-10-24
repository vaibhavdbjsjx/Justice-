# Justice — App Store Launch Checklist

A law-based app draws extra Apple scrutiny. This is the honest, ordered list of
what will get you approved. ✅ = handled in code. 🧑 = your (human) step.

---

## 0. The #1 rejection risk — In-App Purchase (Guideline 3.1.1)

Apple **requires** digital subscriptions used inside an iOS/iPadOS/Mac app to go
through **In-App Purchase**. Selling Plus/Professional via **Stripe inside the
app = automatic rejection.** You've been rejected before — this is the kind of
thing that does it.

**Two compliant paths:**

- **A — Launch free (fastest, recommended for v1).** Ship the app with
  `NEXT_PUBLIC_PAYMENTS_ENABLED=false`. ✅ This is now wired: every account gets
  full access, Billing is hidden, and there are no Stripe upgrade walls. Sell
  subscriptions only on the **website** later, or add IAP in a future update.
- **B — Add In-App Purchase.** Create the subscription products in **App Store
  Connect**, integrate **StoreKit 2** (or RevenueCat) in the native app, and
  keep Stripe for web only. This is native work (not in this web repo).

👉 **Recommendation:** launch with Path A, add IAP in v1.1. Don't let billing
block your submission.

---

## 1. Sign in with Apple + email (Guideline 4.8) — ✅ in code

- Social login is **Apple only**, paired with email. ✅ (Google removed.)
- 🧑 In **Supabase → Auth → Providers → Apple**: add your Apple **Services ID**,
  **Team ID**, **Key ID**, and the **.p8 key** (from the Apple Developer portal).
- 🧑 In **Apple Developer → Certificates, IDs & Profiles**: enable "Sign in with
  Apple" on your App ID and configure the Services ID return URL to
  `https://<your-domain>/auth/callback`.

---

## 2. Account deletion (Guideline 5.1.1(v)) — ✅ in code

Apps with account creation **must** let users delete their account in-app. ✅
Added at **/account → Delete account** (type-to-confirm → removes the auth user;
all data cascades). 🧑 Requires `SUPABASE_SERVICE_ROLE_KEY` set in production.

---

## 3. Required URLs (App Store Connect) — ✅ pages exist

Paste these into App Store Connect (replace the domain with your hosted site):

| App Store field | URL |
|---|---|
| **Privacy Policy URL** (required) | `https://<domain>/privacy` |
| **Support URL** (required) | `https://<domain>/contact` |
| **Marketing URL** (optional) | `https://<domain>` |

🧑 Host the web app (Vercel/Netlify — config already in repo) and set
`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPPORT_EMAIL`, etc. 🧑 **Create real
mailboxes** for support@, privacy@, legal@ — reviewers sometimes email them.

---

## 4. Legal-app softness (Guidelines 5.0 / 1.4 / unauthorized practice)

This is where legal apps die. Justice is already built to pass:

- Every AI output is framed as **"legal information, not legal advice"** and the
  disclaimer is structural (can't be removed). ✅
- The app **recommends a licensed lawyer** for high-stakes situations. ✅
- 🧑 **In the App Review notes, say it plainly:** "Justice provides general legal
  *information* and document tools. It does not provide legal advice, is not a
  law firm, and does not create an attorney–client relationship. Disclaimers are
  shown on every AI output."
- 🧑 Provide a **demo account** (email + password) in App Review notes so the
  reviewer can see the full app without Apple sign-in friction.
- 🧑 Age rating: set honestly (17+ is safest for legal/"unrestricted web" style
  content; at minimum reflect that it discusses legal matters).

---

## 5. Regional availability (your app is jurisdiction-limited)

- The app now supports **249 countries/territories** for jurisdiction selection,
  so it's *usable* almost everywhere. ✅
- 🧑 But **availability** is an App Store Connect setting. For a careful launch,
  select only the regions whose legal framework you're confident about. A sane
  starting set: **United States, Canada, United Kingdom, Australia, India** (the
  five with full state/province support) — expand later.
- The product is "globally scoped, launch focused": you can widen availability
  anytime without a code change.

---

## 6. App Privacy "nutrition label" (App Store Connect)

🧑 Declare truthfully. Based on the current build:

- **Data collected:** email, name, user content (documents/chat), jurisdiction,
  purchase/subscription status.
- **Used for:** app functionality (not tracking, not advertising).
- **Linked to identity:** yes (account-based). **Tracking:** none.
- Name third parties in your privacy nutrition answers consistent with
  `/privacy`: Supabase, OpenAI, Stripe, hosting.

---

## 7. Minimum functionality / not-a-website (Guideline 4.2)

- 🧑 The **iOS/iPad app is the Flutter app** (`apps/mobile`) — native screens, not
  a webview wrapper. Make sure it has genuine native UI (it does) before
  submitting; a thin webview of the site risks 4.2 rejection.
- 🧑 The **Mac app** (Tauri shell over the web app) is more 4.2-sensitive. Either
  submit Mac via Mac Catalyst from the real app, or distribute the Mac build
  outside the Mac App Store (notarized DMG) to avoid 4.2 friction.

---

## 8. Pre-submission smoke test (do this once hosted)

- [ ] Sign in with Apple completes and lands on the dashboard.
- [ ] Email sign-up + magic link works; onboarding saves jurisdiction.
- [ ] Ask the assistant → streamed answer with disclaimer (needs OpenAI credit).
- [ ] Upload a document → analysis returns (needs OpenAI credit).
- [ ] **Delete account** removes the account and signs you out.
- [ ] Privacy / Terms / Support pages load.
- [ ] No console errors on any screen.

---

### What's left that only you can do
1. Host the website + set env vars (incl. `SUPABASE_SERVICE_ROLE_KEY`, support emails).
2. Add OpenAI credit; connect Supabase; configure Apple Sign-In keys.
3. Decide IAP path (A: launch free / B: StoreKit) and set `NEXT_PUBLIC_PAYMENTS_ENABLED`.
4. Build + submit the native apps (Flutter iOS/iPad, Mac) with the review notes above.
