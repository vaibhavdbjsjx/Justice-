# Deploying Lexa

The web app lives in `apps/web` (a monorepo). Below are the two supported paths.
**Vercel is recommended** — Next.js 16 deploys there with zero extra config.

---

## Prerequisites (both platforms)

1. **Supabase project** — create one, then apply the schema + RLS:
   ```bash
   npm i -g supabase
   supabase link --project-ref <your-ref>
   supabase db push          # applies supabase/migrations/*
   ```
   In Supabase → Authentication → URL Configuration, add your production URL and
   `<your-domain>/auth/callback` to the redirect allow-list.
2. **Gemini** — a free or paid API key. On a free key the app tells users that
   Google may use what's sent, and the AI features can't serve the EEA, UK, or
   Switzerland. Set `GEMINI_PAID_TIER=true` once on a paid key.
3. **Stripe** (optional, for billing) — create products/prices, a webhook endpoint
   at `<your-domain>/api/billing/webhook`, and copy the signing secret.

### Environment variables to set in the host dashboard

| Variable | Required | Scope |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | public |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | **server-only secret** |
| `GEMINI_API_KEY` | ✅ (AI) | server-only secret |
| `GEMINI_MODEL` | optional | pins a model |
| `APPLE_APP_ID` | App Store purchases | numeric Apple ID of the app |
| `NEXT_PUBLIC_APP_URL` | ✅ | public (your prod URL) |
| `STRIPE_SECRET_KEY` | billing | server-only secret |
| `STRIPE_WEBHOOK_SECRET` | billing | server-only secret |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | billing | public |

Never commit these — they belong only in the host's env settings and local `.env.local`.

---

## Option A — Vercel (recommended)

1. **New Project → Import** `github.com/vaibhavdbjsjx/Lexa-`.
2. **Root Directory:** set to **`apps/web`** (this is the only non-default step).
3. Framework preset auto-detects **Next.js**. Leave build/output commands as default.
4. Add the environment variables above.
5. **Deploy.** Subsequent pushes to `main` auto-deploy.

## Option B — Netlify

A [`netlify.toml`](netlify.toml) is included (`base = "apps/web"` +
`@netlify/plugin-nextjs`).

1. **Add new site → Import from Git** → select the repo.
2. Netlify reads `netlify.toml` (base dir + Next runtime plugin) automatically.
3. Add the environment variables above.
4. **Deploy site.**

---

## Post-deploy checklist

- [ ] Site loads at the production URL with no console errors.
- [ ] `NEXT_PUBLIC_APP_URL` matches the deployed domain (auth redirects depend on it).
- [ ] Supabase redirect URLs include `<domain>/auth/callback`.
- [ ] Sign up / sign in / onboarding round-trips work.
- [ ] AI chat streams a response with sources (requires the Gemini key).
- [ ] Stripe webhook shows `200`s in the Stripe dashboard (if billing enabled).

## iPhone, iPad, and Mac

The app in `apps/mobile` reads its backend from `config/production.json` (public
values only). See `APPLE_LAUNCH.md` for the App Store steps:

```bash
cd apps/mobile
flutter build ipa --release --dart-define-from-file=config/production.json
```

The same build runs on Apple silicon Macs through the App Store. `apps/desktop`
(a Tauri shell over the website) is optional and not needed for the App Store.
