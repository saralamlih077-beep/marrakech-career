-- Activity collection starts here; existing visits are not reconstructed.
create table if not exists public.analytics_tracking_settings (
  key text primary key,
  started_at timestamptz not null default now()
);
insert into public.analytics_tracking_settings (key) values ('activity'), ('application_status') on conflict do nothing;
alter table public.analytics_tracking_settings enable row level security;
revoke all on public.analytics_tracking_settings from anon, authenticated;
grant all on public.analytics_tracking_settings to service_role;

create table if not exists public.user_activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('session_start', 'cv_view', 'offer_view')),
  occurred_at timestamptz not null default now()
);
create index if not exists user_activity_events_time on public.user_activity_events (occurred_at, user_id);
alter table public.user_activity_events enable row level security;
revoke all on public.user_activity_events from anon, authenticated;
grant insert (id, event_type) on public.user_activity_events to authenticated;
grant all on public.user_activity_events to service_role;
create policy "users record their own activity" on public.user_activity_events
  for insert to authenticated with check (user_id = auth.uid());

create table if not exists public.candidature_status_events (
  id uuid primary key default gen_random_uuid(),
  candidature_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  statut text not null,
  occurred_at timestamptz not null default now()
);
create index if not exists candidature_status_events_time on public.candidature_status_events (occurred_at);
alter table public.candidature_status_events enable row level security;
revoke all on public.candidature_status_events from anon, authenticated;
grant all on public.candidature_status_events to service_role;

create or replace function public.record_candidature_status()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or old.statut is distinct from new.statut then
    insert into public.candidature_status_events (candidature_id, user_id, statut)
    values (new.id::text, new.user_id, coalesce(new.statut, 'saved'));
  end if;
  return new;
end;
$$;
revoke all on function public.record_candidature_status() from public, anon, authenticated;
create trigger record_candidature_status
  after insert or update of statut on public.candidatures
  for each row execute function public.record_candidature_status();
