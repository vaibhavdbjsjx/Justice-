# Justice — Supabase

Backend for all platforms (Part 6): Postgres, Auth, Storage, Edge Functions.

## Structure

- `migrations/` — versioned SQL. `20260703090000_initial_schema.sql` creates the
  Part 7 schema and **all RLS policies**.
- `tests/` — RLS verification harness (real embedded Postgres, no Docker).
- `config.toml` — Supabase CLI config.

## Apply to a cloud project

```bash
npm i -g supabase           # or use npx supabase
supabase link --project-ref <your-project-ref>
supabase db push            # applies migrations/
```

Then copy the project URL + anon key + service-role key into
`apps/web/.env.local` (see `apps/web/.env.example`).

## Verify RLS (Part 10 hard requirement)

Proves cross-user isolation — a consumer cannot read another consumer's data, a
lawyer only sees matters shared via `lawyer_client_links`, and an unlinked lawyer
sees nothing of another lawyer's clients.

```bash
cd supabase/tests
npm install
npm run test:rls
```

The harness boots a real Postgres, applies `tests/auth_shim.sql` (a faithful
local stand-in for the Supabase `auth` schema / `auth.uid()` / roles) followed by
the production migration, then impersonates users via `SET LOCAL ROLE` +
`request.jwt.claims` — exactly how Supabase evaluates RLS. Re-run after any policy
change. **34 assertions must pass.**

## RLS model (summary)

Access to matter-scoped data (chat, documents, deadlines) is derived from the
parent matter via `SECURITY DEFINER` helpers (`can_access_matter`,
`is_matter_owner`, `is_matter_lawyer`) that avoid recursive policy evaluation. A
lawyer gains access to a matter **only** through an `active`/`invited` row in
`lawyer_client_links`, which is created consent-first by the matter owner.
