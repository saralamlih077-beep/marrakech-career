-- Suivi détaillé de chaque candidature et prévention des alertes dupliquées.
alter table public.candidatures
  add column if not exists follow_up_at timestamptz,
  add column if not exists company_reply text,
  add column if not exists replied_at timestamptz,
  add column if not exists cover_letter text;

create table if not exists public.job_alert_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  offer_id uuid not null references public.job_offers(id) on delete cascade,
  score integer not null check (score between 0 and 100),
  sent_at timestamptz not null default now(),
  unique (user_id, offer_id)
);

alter table public.job_alert_deliveries enable row level security;
create policy "users read their own alert history" on public.job_alert_deliveries
  for select using (auth.uid() = user_id);
