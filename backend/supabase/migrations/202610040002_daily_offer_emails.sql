-- Explicit opt-in, atomic daily reservations, and an audit trail for Brevo acceptance.
begin;
alter table public.job_alert_preferences alter column enabled set default false;
alter table public.job_alert_preferences add column if not exists enabled_since timestamptz;
update public.job_alert_preferences set enabled_since=updated_at where enabled and enabled_since is null;
create or replace function public.track_job_alert_opt_in() returns trigger
language plpgsql set search_path = '' as $$
begin
  if TG_OP='INSERT' then
    NEW.enabled_since:=case when NEW.enabled then now() else null end;
  elsif NEW.enabled and not OLD.enabled then NEW.enabled_since:=now();
  else NEW.enabled_since:=OLD.enabled_since;
  end if;
  NEW.updated_at:=now();
  return NEW;
end; $$;
drop trigger if exists track_job_alert_opt_in on public.job_alert_preferences;
create trigger track_job_alert_opt_in before insert or update on public.job_alert_preferences
for each row execute function public.track_job_alert_opt_in();

-- A pending offer becoming verified is also new; changing an existing offer is not.
alter table public.job_offers add column if not exists first_verified_at timestamptz;
update public.job_offers set first_verified_at=created_at where status='verified' and first_verified_at is null;
create or replace function public.track_first_verified_offer() returns trigger
language plpgsql set search_path = '' as $$
begin
  if TG_OP='INSERT' then NEW.first_verified_at:=case when NEW.status='verified' then now() else null end;
  else NEW.first_verified_at:=coalesce(OLD.first_verified_at,case when NEW.status='verified' then now() end);
  end if;
  return NEW;
end; $$;
drop trigger if exists track_first_verified_offer on public.job_offers;
create trigger track_first_verified_offer before insert or update on public.job_offers
for each row execute function public.track_first_verified_offer();

create table if not exists public.job_alert_digests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  digest_day date not null default (now() at time zone 'Africa/Casablanca')::date,
  status text not null default 'reserved' check(status in ('reserved','sent','failed','unknown','cancelled')),
  offers jsonb not null check(jsonb_typeof(offers)='array'),
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  provider_message_id text,
  error_code text,
  unique(user_id,digest_day)
);
alter table public.job_alert_digests enable row level security;
revoke all on public.job_alert_digests from public,anon,authenticated;
grant all on public.job_alert_digests to service_role;
create index if not exists job_alert_digests_user_status on public.job_alert_digests(user_id,status);

create or replace function public.preview_job_alert_digest(p_user_id uuid) returns jsonb
language sql security definer set search_path = '' as $$
  select coalesce(jsonb_agg(item order by available_at,id),'[]'::jsonb)
  from (
    select j.first_verified_at available_at,j.id,
      jsonb_build_object('id',j.id,'title',j.title,'location',j.location,
        'contract',coalesce(j.contract_label,j.contract_type),
        'employer',coalesce(nullif(j.employer_name,''),e.nom,'Entreprise non précisée'),
        'source',coalesce(j.source_name,'Autre source'),'source_url',j.source_url) item
    from public.job_offers j left join public.entreprises e on e.id=j.entreprise_id
    join public.job_alert_preferences p on p.user_id=p_user_id and p.enabled and p.enabled_since is not null
    join auth.users u on u.id=p.user_id and u.email_confirmed_at is not null and u.email is not null
    where j.status='verified' and (j.expires_at is null or j.expires_at>now())
      and j.first_verified_at>=p.enabled_since and j.first_verified_at<=now()
      and not exists(select 1 from public.job_alert_deliveries d where d.user_id=p_user_id and d.offer_id=j.id)
      and not exists(select 1 from public.job_alert_digests d,
        jsonb_array_elements(d.offers) o
        where d.user_id=p_user_id and d.status in ('reserved','sent','unknown') and o->>'id'=j.id::text)
      and not exists(select 1 from public.job_alert_digests d where d.user_id=p_user_id
        and d.digest_day=(now() at time zone 'Africa/Casablanca')::date)
  ) fresh;
$$;
create or replace function public.claim_job_alert_digest(p_user_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_offers jsonb; v_id uuid;
begin
  -- Serializes concurrent workers for this subscriber and observes opt-out.
  perform 1 from public.job_alert_preferences where user_id=p_user_id and enabled for update;
  if not found then return null; end if;
  v_offers:=public.preview_job_alert_digest(p_user_id);
  if jsonb_array_length(v_offers)=0 then return null; end if;
  insert into public.job_alert_digests(user_id,offers) values(p_user_id,v_offers)
  on conflict(user_id,digest_day) do nothing returning id into v_id;
  if v_id is null then return null; end if;
  return jsonb_build_object('id',v_id,'offers',v_offers);
end; $$;
create or replace function public.finish_job_alert_digest(p_digest uuid,p_status text,p_message_id text default null,p_error_code text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_row public.job_alert_digests;
begin
  if p_status not in ('sent','failed','unknown','cancelled') then raise exception 'Invalid digest status'; end if;
  select * into v_row from public.job_alert_digests where id=p_digest for update;
  if not found or v_row.status<>'reserved' then return; end if;
  if p_status='sent' and coalesce(p_message_id,'')='' then raise exception 'Provider message ID missing'; end if;
  update public.job_alert_digests set status=p_status,finished_at=now(),provider_message_id=p_message_id,error_code=left(p_error_code,100) where id=p_digest;
  if p_status='sent' then
    insert into public.job_alert_deliveries(user_id,offer_id,score)
    select v_row.user_id,(o->>'id')::uuid,0 from jsonb_array_elements(v_row.offers) o
    join public.job_offers j on j.id=(o->>'id')::uuid
    on conflict(user_id,offer_id) do nothing;
  end if;
end; $$;
revoke all on function public.preview_job_alert_digest(uuid) from public,anon,authenticated;
revoke all on function public.claim_job_alert_digest(uuid) from public,anon,authenticated;
revoke all on function public.finish_job_alert_digest(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.preview_job_alert_digest(uuid) to service_role;
grant execute on function public.claim_job_alert_digest(uuid) to service_role;
grant execute on function public.finish_job_alert_digest(uuid,text,text,text) to service_role;
commit;
