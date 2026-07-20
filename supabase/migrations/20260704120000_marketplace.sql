-- ============================================================================
-- Phase 9 — Lawyer Marketplace (Part 4.2/4.3).
--
-- The marketplace makes "verified" a trust signal consumers rely on, so the
-- verification columns stop being self-serviceable: column-level grants
-- replace the broad INSERT/UPDATE on lawyer_profiles. A lawyer edits their
-- own marketplace presence (practice areas, jurisdictions, bar number, rate,
-- bio) — verification_status and rating_avg are written ONLY by the service
-- role (verification is a real-world review process, Part 12; ratings come
-- with the review system later). Same philosophy as client_messages'
-- append-only grants: what must not happen has no privilege to happen.
-- ============================================================================

revoke insert, update on public.lawyer_profiles from authenticated;

grant insert (user_id, practice_areas, licensed_jurisdictions, bar_number, rate_range, bio)
  on public.lawyer_profiles to authenticated;

grant update (practice_areas, licensed_jurisdictions, bar_number, rate_range, bio)
  on public.lawyer_profiles to authenticated;

comment on column public.lawyer_profiles.verification_status is
  'Service-role-only (column grant): set by the LexMind verification process, never by the lawyer.';
comment on column public.lawyer_profiles.rating_avg is
  'Service-role-only (column grant): maintained by the review system, never by the lawyer.';
