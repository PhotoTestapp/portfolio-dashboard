-- Portfolio Dashboard Supabase minimum backend schema
-- Apply in Supabase SQL editor.
-- Security model:
-- - auth.uid() owns each row.
-- - anon key is safe only with RLS enabled.
-- - service_role key must never be used in GitHub Pages.

create extension if not exists pgcrypto;

create table if not exists public.portfolio_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  revision bigint not null default 1,
  state jsonb not null,
  state_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  revision bigint,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.decision_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  decision text not null,
  rule_version text,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_portfolio_state_updated_at on public.portfolio_state;
create trigger trg_portfolio_state_updated_at
before update on public.portfolio_state
for each row execute function public.set_updated_at();

alter table public.portfolio_state enable row level security;
alter table public.audit_log enable row level security;
alter table public.decision_history enable row level security;

create policy "portfolio_state_select_own"
on public.portfolio_state for select
using (auth.uid() = user_id);

create policy "portfolio_state_insert_own"
on public.portfolio_state for insert
with check (auth.uid() = user_id);

create policy "portfolio_state_update_own"
on public.portfolio_state for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "audit_log_select_own"
on public.audit_log for select
using (auth.uid() = user_id);

create policy "audit_log_insert_own"
on public.audit_log for insert
with check (auth.uid() = user_id);

create policy "decision_history_select_own"
on public.decision_history for select
using (auth.uid() = user_id);

create policy "decision_history_insert_own"
on public.decision_history for insert
with check (auth.uid() = user_id);
