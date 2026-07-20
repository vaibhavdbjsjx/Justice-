-- ============================================================================
-- Phase 8 — Client Intake & Case Management, lawyer side (Part 4.3).
--
--   * intake_links      — a lawyer's branded intake URLs. The token is a
--                         high-entropy secret resolved SERVER-SIDE via the
--                         service role; there is deliberately NO anon/public
--                         policy, so the table can never be enumerated from
--                         the client.
--   * client_messages   — the human lawyer<->client communication log, one
--                         thread per matter. Immutable by design: the only
--                         policies are SELECT and INSERT — an organized
--                         record nobody can quietly rewrite.
--
-- The intake flow needs no new write paths beyond these: the CLIENT creates
-- the matter (matters_insert_own) and the share (lcl_insert_by_client_owner),
-- consenting with their own row — exactly the consent-based model the Phase 1
-- policies anticipated.
-- ============================================================================

create table if not exists public.intake_links (
  id         uuid primary key default gen_random_uuid(),
  lawyer_id  uuid not null references public.profiles(user_id) on delete cascade,
  -- Two UUIDs' worth of entropy, hex, URL-safe. Generated in-database so a
  -- link row can never exist without a strong token.
  token      text not null unique
             default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  -- The lawyer's own label ("Website footer", "Referral partners").
  label      text,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.intake_links is
  'Branded intake URLs (Part 4.3). Token resolution happens server-side via the service role — no anon read, ever.';

create index if not exists idx_intake_links_lawyer on public.intake_links (lawyer_id);

create table if not exists public.client_messages (
  id         uuid primary key default gen_random_uuid(),
  matter_id  uuid not null references public.matters(id) on delete cascade,
  sender_id  uuid not null references public.profiles(user_id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 8000),
  created_at timestamptz not null default now()
);
comment on table public.client_messages is
  'Human lawyer<->client thread per matter (communication log, Part 4.3). Append-only: no UPDATE/DELETE policies.';

create index if not exists idx_client_messages_matter
  on public.client_messages (matter_id, created_at);

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.intake_links    enable row level security;
alter table public.client_messages enable row level security;

-- intake_links: the owning lawyer manages their own links; nobody else sees
-- them (clients interact with tokens only through the server).
create policy "intake_links_select_own" on public.intake_links
  for select to authenticated using (lawyer_id = auth.uid());

create policy "intake_links_insert_own" on public.intake_links
  for insert to authenticated with check (
    lawyer_id = auth.uid()
    and exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role = 'lawyer')
  );

create policy "intake_links_update_own" on public.intake_links
  for update to authenticated
  using (lawyer_id = auth.uid()) with check (lawyer_id = auth.uid());

create policy "intake_links_delete_own" on public.intake_links
  for delete to authenticated using (lawyer_id = auth.uid());

-- client_messages: both matter participants read; each writes only as
-- themselves. No update/delete — the log is append-only for everyone.
create policy "client_messages_select" on public.client_messages
  for select to authenticated using (public.can_access_matter(matter_id));

create policy "client_messages_insert" on public.client_messages
  for insert to authenticated with check (
    sender_id = auth.uid() and public.can_access_matter(matter_id)
  );

-- ----------------------------------------------------------------------------
-- Grants. The initial migration's "all tables" grant predates these tables,
-- so grant explicitly (RLS then restricts rows). anon still gets nothing.
-- ----------------------------------------------------------------------------
grant select, insert, update, delete on public.intake_links to authenticated;
grant select, insert on public.client_messages to authenticated;
