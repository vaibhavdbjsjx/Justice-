-- ============================================================================
-- Phase 10 — Monetization (Part 4.4). Stripe identifiers on subscriptions.
--
-- Writes to subscriptions remain service-role-only (no authenticated
-- INSERT/UPDATE policy exists — proven in the RLS suite): rows are created by
-- the signup trigger and mutated exclusively by the Stripe webhook handler.
-- ============================================================================

alter table public.subscriptions
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;

create index if not exists idx_subscriptions_stripe_customer
  on public.subscriptions (stripe_customer_id);

comment on column public.subscriptions.stripe_customer_id is
  'Set by the Stripe webhook (service role). Maps customer.* events to the user.';
comment on column public.subscriptions.stripe_subscription_id is
  'Set by the Stripe webhook (service role). Current Stripe subscription, if any.';
