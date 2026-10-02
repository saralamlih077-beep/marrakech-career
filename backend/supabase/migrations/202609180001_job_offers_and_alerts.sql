create table if not exists public.job_offers (
  id uuid primary key default gen_random_uuid(),
  entreprise_id integer references public.entreprises(id) on delete set null,
  title text not null,
  contract_type text not null check (contract_type in ('internship', 'cdi', 'cdd', 'freelance')),
  location text not null default 'Marrakech',
  description text not null,
  requirements text not null default '',
  source_url text,
  status text not null default 'pending' check (status in ('pending', 'verified', 'closed')),
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create table if not exists public.job_alert_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  min_match integer not null default 60 check (min_match between 0 and 100),
  updated_at timestamptz not null default now()
);

alter table public.job_offers enable row level security;
alter table public.job_alert_preferences enable row level security;
create policy "verified offers are readable" on public.job_offers for select using (status = 'verified');
create policy "users manage their job alert preferences" on public.job_alert_preferences for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
