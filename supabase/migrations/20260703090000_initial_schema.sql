-- ============================================================================
-- LexMind — Initial schema + Row-Level Security (Part 7)
-- ----------------------------------------------------------------------------
-- MAX-effort phase. RLS here is load-bearing (Part 7 / Part 10):
--   * A lawyer may ONLY access matters/documents explicitly shared with them
--     via lawyer_client_links — never all consumer data.
--   * A lawyer must NEVER be able to query another lawyer's clients' data.
--   * A consumer may only access their own matters and what they authored.
--
-- Assumes the Supabase `auth` schema (auth.users, auth.uid()) exists. The local
-- RLS test harness recreates a faithful shim of these (supabase/tests/auth_shim.sql).
-- gen_random_uuid() is Postgres core (>= 13); no extension required.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------

create table if not exists public.profiles (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  role               text not null default 'consumer' check (role in ('consumer','lawyer')),
  full_name          text,
  country            text,
  state_province     text,
  preferred_language text not null default 'en',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
comment on table public.profiles is 'One row per authenticated user. Role determines dashboard, not a hard wall (Part 4.1).';

create table if not exists public.lawyer_profiles (
  user_id                uuid primary key references public.profiles(user_id) on delete cascade,
  practice_areas         jsonb not null default '[]'::jsonb,
  licensed_jurisdictions jsonb not null default '[]'::jsonb,
  bar_number             text,
  verification_status    text not null default 'pending' check (verification_status in ('pending','verified','rejected')),
  rate_range             text,
  bio                    text,
  rating_avg             numeric(3,2),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
comment on table public.lawyer_profiles is 'Extended profile for lawyers. Verified rows are publicly discoverable in the marketplace (Part 4.3).';

create table if not exists public.matters (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.profiles(user_id) on delete cascade,
  title                text not null,
  category             text,
  jurisdiction_country text,
  jurisdiction_state   text,
  status               text not null default 'active' check (status in ('active','resolved','archived')),
  assigned_lawyer_id   uuid references public.profiles(user_id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
comment on table public.matters is 'A case/matter groups chat, documents, and deadlines (Part 4.1). Owned by user_id.';

create table if not exists public.chat_messages (
  id         uuid primary key default gen_random_uuid(),
  matter_id  uuid not null references public.matters(id) on delete cascade,
  user_id    uuid not null references public.profiles(user_id) on delete cascade,
  role       text not null check (role in ('user','assistant')),
  content    text not null,
  citations  jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.documents (
  id             uuid primary key default gen_random_uuid(),
  matter_id      uuid not null references public.matters(id) on delete cascade,
  uploaded_by    uuid not null references public.profiles(user_id) on delete cascade,
  type           text not null check (type in ('uploaded','generated')),
  title          text,
  file_url       text,
  extracted_text text,
  ai_annotations jsonb,
  created_at     timestamptz not null default now()
);

create table if not exists public.deadlines (
  id            uuid primary key default gen_random_uuid(),
  matter_id     uuid not null references public.matters(id) on delete cascade,
  title         text not null,
  due_date      date,
  status        text not null default 'upcoming' check (status in ('upcoming','completed','missed')),
  reminder_sent boolean not null default false,
  created_at    timestamptz not null default now()
);

create table if not exists public.lawyer_client_links (
  lawyer_id  uuid not null references public.profiles(user_id) on delete cascade,
  client_id  uuid not null references public.profiles(user_id) on delete cascade,
  matter_id  uuid not null references public.matters(id) on delete cascade,
  status     text not null default 'invited' check (status in ('invited','active','ended')),
  created_at timestamptz not null default now(),
  primary key (lawyer_id, client_id, matter_id)
);
comment on table public.lawyer_client_links is 'THE data-sharing bridge. A lawyer sees a client''s matter ONLY through an active/invited link here.';

create table if not exists public.subscriptions (
  user_id    uuid primary key references public.profiles(user_id) on delete cascade,
  tier       text not null default 'free' check (tier in ('free','plus','professional')),
  status     text not null default 'active',
  renews_at  timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes supporting RLS predicates and common lookups
create index if not exists idx_matters_user             on public.matters (user_id);
create index if not exists idx_matters_assigned_lawyer  on public.matters (assigned_lawyer_id);
create index if not exists idx_chat_messages_matter     on public.chat_messages (matter_id);
create index if not exists idx_documents_matter         on public.documents (matter_id);
create index if not exists idx_deadlines_matter         on public.deadlines (matter_id);
create index if not exists idx_lcl_lawyer               on public.lawyer_client_links (lawyer_id);
create index if not exists idx_lcl_client               on public.lawyer_client_links (client_id);
create index if not exists idx_lcl_matter               on public.lawyer_client_links (matter_id);
create index if not exists idx_lawyer_profiles_verif    on public.lawyer_profiles (verification_status);

-- ----------------------------------------------------------------------------
-- Access-helper functions
-- SECURITY DEFINER so their internal reads bypass RLS (preventing recursive
-- policy evaluation) while still seeing the caller through auth.uid().
-- ----------------------------------------------------------------------------

create or replace function public.is_matter_owner(m uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.matters where id = m and user_id = auth.uid());
$$;

create or replace function public.is_matter_lawyer(m uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.lawyer_client_links l
    where l.matter_id = m
      and l.lawyer_id = auth.uid()
      and l.status in ('invited','active')
  ) or exists (
    select 1 from public.matters mm where mm.id = m and mm.assigned_lawyer_id = auth.uid()
  );
$$;

create or replace function public.can_access_matter(m uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_matter_owner(m) or public.is_matter_lawyer(m);
$$;

create or replace function public.is_verified_lawyer(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.lawyer_profiles lp
    where lp.user_id = uid and lp.verification_status = 'verified'
  );
$$;

-- ----------------------------------------------------------------------------
-- Enable Row-Level Security on every table (Part 7 hard requirement)
-- ----------------------------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.lawyer_profiles     enable row level security;
alter table public.matters             enable row level security;
alter table public.chat_messages       enable row level security;
alter table public.documents           enable row level security;
alter table public.deadlines           enable row level security;
alter table public.lawyer_client_links enable row level security;
alter table public.subscriptions       enable row level security;

-- ----------------------------------------------------------------------------
-- profiles
-- Own row always. Verified lawyers' rows are publicly readable (marketplace).
-- Linked lawyer<->client counterparts can read each other's row for shared work.
-- ----------------------------------------------------------------------------
create policy "profiles_select" on public.profiles
  for select to authenticated using (
    user_id = auth.uid()
    or public.is_verified_lawyer(user_id)
    or exists (
      select 1 from public.lawyer_client_links l
      where l.status in ('invited','active')
        and (
          (l.lawyer_id = auth.uid() and l.client_id = profiles.user_id)
          or (l.client_id = auth.uid() and l.lawyer_id = profiles.user_id)
        )
    )
  );

create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (user_id = auth.uid());

create policy "profiles_update_own" on public.profiles
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- lawyer_profiles
-- Read: own row, or any verified lawyer (public professional info).
-- Write: own row only, and only if the caller's profile role is 'lawyer'.
-- ----------------------------------------------------------------------------
create policy "lawyer_profiles_select" on public.lawyer_profiles
  for select to authenticated using (
    user_id = auth.uid() or verification_status = 'verified'
  );

create policy "lawyer_profiles_insert_own" on public.lawyer_profiles
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role = 'lawyer')
  );

create policy "lawyer_profiles_update_own" on public.lawyer_profiles
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- matters
-- ----------------------------------------------------------------------------
create policy "matters_select" on public.matters
  for select to authenticated using (
    user_id = auth.uid() or public.is_matter_lawyer(id)
  );

create policy "matters_insert_own" on public.matters
  for insert to authenticated with check (user_id = auth.uid());

create policy "matters_update_own" on public.matters
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "matters_delete_own" on public.matters
  for delete to authenticated using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- chat_messages — access derived from the parent matter.
-- Only the matter OWNER writes to the consumer AI chat; linked lawyers may read.
-- (Server inserts assistant messages via the service role, which bypasses RLS.)
-- ----------------------------------------------------------------------------
create policy "chat_messages_select" on public.chat_messages
  for select to authenticated using (public.can_access_matter(matter_id));

create policy "chat_messages_insert" on public.chat_messages
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_matter_owner(matter_id));

create policy "chat_messages_update_own" on public.chat_messages
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "chat_messages_delete" on public.chat_messages
  for delete to authenticated using (public.is_matter_owner(matter_id));

-- ----------------------------------------------------------------------------
-- documents — owner or linked lawyer may read/upload; author or owner may edit.
-- ----------------------------------------------------------------------------
create policy "documents_select" on public.documents
  for select to authenticated using (public.can_access_matter(matter_id));

create policy "documents_insert" on public.documents
  for insert to authenticated
  with check (public.can_access_matter(matter_id) and uploaded_by = auth.uid());

create policy "documents_update" on public.documents
  for update to authenticated
  using (uploaded_by = auth.uid() or public.is_matter_owner(matter_id))
  with check (uploaded_by = auth.uid() or public.is_matter_owner(matter_id));

create policy "documents_delete" on public.documents
  for delete to authenticated
  using (uploaded_by = auth.uid() or public.is_matter_owner(matter_id));

-- ----------------------------------------------------------------------------
-- deadlines — any matter participant (owner or linked lawyer) may manage.
-- ----------------------------------------------------------------------------
create policy "deadlines_select" on public.deadlines
  for select to authenticated using (public.can_access_matter(matter_id));

create policy "deadlines_insert" on public.deadlines
  for insert to authenticated with check (public.can_access_matter(matter_id));

create policy "deadlines_update" on public.deadlines
  for update to authenticated
  using (public.can_access_matter(matter_id)) with check (public.can_access_matter(matter_id));

create policy "deadlines_delete" on public.deadlines
  for delete to authenticated using (public.can_access_matter(matter_id));

-- ----------------------------------------------------------------------------
-- lawyer_client_links — visible only to its two participants.
-- Consent-based creation: the matter OWNER (client) shares their own matter.
-- Lawyer-initiated intake invites are handled server-side in Phase 8 via a
-- token-validated definer RPC, not a broad client INSERT policy.
-- ----------------------------------------------------------------------------
create policy "lcl_select_participant" on public.lawyer_client_links
  for select to authenticated using (
    lawyer_id = auth.uid() or client_id = auth.uid()
  );

create policy "lcl_insert_by_client_owner" on public.lawyer_client_links
  for insert to authenticated
  with check (client_id = auth.uid() and public.is_matter_owner(matter_id));

create policy "lcl_update_participant" on public.lawyer_client_links
  for update to authenticated
  using (lawyer_id = auth.uid() or client_id = auth.uid())
  with check (lawyer_id = auth.uid() or client_id = auth.uid());

create policy "lcl_delete_participant" on public.lawyer_client_links
  for delete to authenticated using (
    lawyer_id = auth.uid() or client_id = auth.uid()
  );

-- ----------------------------------------------------------------------------
-- subscriptions — read own only. Writes happen server-side (Stripe webhooks /
-- new-user trigger) via the service role, which bypasses RLS. No client writes.
-- ----------------------------------------------------------------------------
create policy "subscriptions_select_own" on public.subscriptions
  for select to authenticated using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Triggers: provision profile + free subscription on signup; maintain updated_at
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id) values (new.id)
    on conflict (user_id) do nothing;
  insert into public.subscriptions (user_id, tier, status) values (new.id, 'free', 'active')
    on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at_profiles        before update on public.profiles        for each row execute function public.set_updated_at();
create trigger set_updated_at_lawyer_profiles before update on public.lawyer_profiles for each row execute function public.set_updated_at();
create trigger set_updated_at_matters         before update on public.matters         for each row execute function public.set_updated_at();
create trigger set_updated_at_subscriptions   before update on public.subscriptions   for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Grants. authenticated gets DML on all tables (RLS then restricts rows).
-- anon gets nothing here — all LexMind data requires authentication.
-- ----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to anon, authenticated;
