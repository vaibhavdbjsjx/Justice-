# Deploying LexMind

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
2. **OpenAI** — an API key with **billing/credit enabled** (a key with no quota
   authenticates but every call fails with `insufficient_quota`).
3. **Stripe** (optional, for billing) — create products/prices, a webhook endpoint
   at `<your-domain>/api/billing/webhook`, and copy the signing secret.

### Environment variables to set in the host dashboard

| Variable | Required | Scope |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | public |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | **server-only secret** |
| `OPENAI_API_KEY` | ✅ (AI) | server-only secret |
| `NEXT_PUBLIC_APP_URL` | ✅ | public (your prod URL) |
| `STRIPE_SECRET_KEY` | billing | server-only secret |
| `STRIPE_WEBHOOK_SECRET` | billing | server-only secret |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | billing | public |

Never commit these — they belong only in the host's env settings and local `.env.local`.

---

## Option A — Vercel (recommended)

1. **New Project → Import** `github.com/vaibhavdbjsjx/Justice-`.
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
- [ ] AI chat streams a response (requires OpenAI credit).
- [ ] Stripe webhook shows `200`s in the Stripe dashboard (if billing enabled).

## Desktop & mobile

- **Desktop (Tauri):** set `LEXMIND_APP_URL` to the deployed URL, then
  `cargo tauri build` in `apps/desktop`.
- **Mobile (Flutter):** point the app's API base at the deployed URL and build with
  `flutter build`.
