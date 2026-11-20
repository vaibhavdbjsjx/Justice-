-- ============================================================================
-- App Store launch: Apple subscriptions, AI data-sharing consent, content
-- reports, and large-document uploads.
--
-- Everything here is additive and safe to re-run. The app keeps working before
-- this runs (features that need a column degrade instead of failing), so it can
-- be applied after the web deploy.
-- ============================================================================

-- ---- Apple In-App Purchase -------------------------------------------------
-- Writes remain service-role-only, like the Stripe columns: no authenticated
-- INSERT/UPDATE policy exists on subscriptions (proven in the RLS suite).
alter table public.subscriptions
  add column if not exists source text,
  add column if not exists apple_original_transaction_id text,
  add column if not exists apple_product_id text,
  add column if not exists apple_environment text;

create unique index if not exists idx_subscriptions_apple_original_transaction
  on public.subscriptions (apple_original_transaction_id)
  where apple_original_transaction_id is not null;

comment on column public.subscriptions.source is
  'Where the paid tier was bought: stripe or apple. Null means free.';
comment on column public.subscriptions.apple_original_transaction_id is
  'Stable id of an App Store subscription. Unique so one purchase backs one account.';

-- ---- AI data-sharing consent (App Store Guideline 5.1.2(i)) ----------------
alter table public.profiles
  add column if not exists ai_consent_at timestamptz,
  add column if not exists ai_consent_provider text;

comment on column public.profiles.ai_consent_at is
  'When the user explicitly agreed to share content with the named AI provider.';
comment on column public.profiles.ai_consent_provider is
  'The provider that consent covers. A provider change requires asking again.';

-- ---- Reports (App Store Guideline 1.2) -------------------------------------
create table if not exists public.content_reports (
  id              uuid primary key default gen_random_uuid(),
  reporter_id     uuid not null references auth.users (id) on delete cascade,
  kind            text not null check (kind in ('ai_answer', 'ai_document', 'lawyer_profile', 'other')),
  reason          text not null,
  details         text,
  reference_id    text,
  content_excerpt text,
  status          text not null default 'open' check (status in ('open', 'reviewing', 'resolved')),
  created_at      timestamptz not null default now()
);

create index if not exists idx_content_reports_status
  on public.content_reports (status, created_at desc);

alter table public.content_reports enable row level security;

drop policy if exists "content_reports_insert_own" on public.content_reports;
create policy "content_reports_insert_own" on public.content_reports
  for insert to authenticated
  with check (reporter_id = auth.uid());

drop policy if exists "content_reports_select_own" on public.content_reports;
create policy "content_reports_select_own" on public.content_reports
  for select to authenticated
  using (reporter_id = auth.uid());

grant select, insert on public.content_reports to authenticated;

-- ---- Blocking (App Store Guideline 1.2) ------------------------------------
create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.user_blocks enable row level security;

drop policy if exists "user_blocks_owner" on public.user_blocks;
create policy "user_blocks_owner" on public.user_blocks
  for all to authenticated
  using (blocker_id = auth.uid())
  with check (blocker_id = auth.uid());

grant select, insert, delete on public.user_blocks to authenticated;

-- ---- Large document uploads ------------------------------------------------
-- Hosted functions cap request bodies, so larger files upload straight to
-- storage into the user's own folder. The analyze route reads and then removes
-- them; only the extracted text and analysis are kept.
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit)
    values ('document-uploads', 'document-uploads', false, 20971520)
    on conflict (id) do nothing;

    drop policy if exists "document_uploads_insert_own" on storage.objects;
    create policy "document_uploads_insert_own" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'document-uploads' and (storage.foldername(name))[1] = auth.uid()::text);

    drop policy if exists "document_uploads_select_own" on storage.objects;
    create policy "document_uploads_select_own" on storage.objects
      for select to authenticated
      using (bucket_id = 'document-uploads' and (storage.foldername(name))[1] = auth.uid()::text);

    drop policy if exists "document_uploads_delete_own" on storage.objects;
    create policy "document_uploads_delete_own" on storage.objects
      for delete to authenticated
      using (bucket_id = 'document-uploads' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
end
$$;
