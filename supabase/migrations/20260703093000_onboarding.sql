-- ============================================================================
-- Phase 2 — Onboarding. Track whether a user has finished the onboarding wizard
-- (role + jurisdiction + language). The handle_new_user trigger already creates
-- the profile row with this defaulting to false.
-- ============================================================================

alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false;

comment on column public.profiles.onboarding_completed is
  'True once the user completes onboarding (role, jurisdiction, language). Gates access to the app shell.';
