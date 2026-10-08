-- Run after 202609170001_gmail_connections and 202609290001_n8n_application_delivery.
-- OAuth credentials and dispatch capabilities are never accessible to browser roles.
create table if not exists private.gmail_oauth_states (
  state_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  origin text not null,
  expires_at timestamptz not null default now() + interval '10 minutes'
);
create table if not exists private.gmail_application_jobs (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null,
  sender_email text not null,
  payload jsonb not null,
  results jsonb not null default '[]'::jsonb,
  status text not null default 'queued' check (status in ('queued','sending','done','failed','unknown')),
  error text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes',
  started_at timestamptz
);
alter table private.gmail_oauth_states enable row level security;
alter table private.gmail_application_jobs enable row level security;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gmail-application-cvs','gmail-application-cvs',false,10485760,array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;
alter table public.candidatures drop constraint if exists candidatures_delivery_status_check;
alter table public.candidatures add constraint candidatures_delivery_status_check
  check (delivery_status in ('draft','queued','sent','failed','unknown'));

create or replace function public.mc_get_gmail_connection(p_user_id uuid) returns jsonb
language sql security definer set search_path = '' as $$
  select to_jsonb(c) from private.gmail_connections c where c.user_id = p_user_id;
$$;
create or replace function public.mc_store_gmail_connection(p_user_id uuid, p_email text, p_token text, p_scopes text[]) returns void
language sql security definer set search_path = '' as $$
  insert into private.gmail_connections (user_id,email,encrypted_refresh_token,scopes)
  values (p_user_id,p_email,p_token,p_scopes)
  on conflict (user_id) do update set email=excluded.email, encrypted_refresh_token=excluded.encrypted_refresh_token,
    scopes=excluded.scopes, updated_at=now();
$$;
create or replace function public.mc_disconnect_gmail(p_user_id uuid) returns void
language sql security definer set search_path = '' as $$
  delete from private.gmail_connections where user_id=p_user_id;
$$;
create or replace function public.mc_start_gmail_oauth(p_user_id uuid, p_hash text, p_origin text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from private.gmail_oauth_states where user_id=p_user_id or expires_at<now();
  insert into private.gmail_oauth_states (state_hash,user_id,origin) values(p_hash,p_user_id,p_origin);
end;
$$;
create or replace function public.mc_consume_gmail_oauth(p_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  delete from private.gmail_oauth_states where state_hash=p_hash and expires_at>now() returning to_jsonb(gmail_oauth_states.*) into result;
  return result;
end;
$$;
create or replace function public.mc_create_gmail_job(p_job jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into private.gmail_application_jobs(id,user_id,token_hash,sender_email,payload)
  values ((p_job->>'id')::uuid,(p_job->>'user_id')::uuid,p_job->>'token_hash',p_job->>'sender_email',p_job->'payload');
$$;
create or replace function public.mc_claim_gmail_job(p_id uuid, p_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  update private.gmail_application_jobs set status='sending', started_at=now()
  where id=p_id and token_hash=p_hash and status='queued' and expires_at>now()
  returning to_jsonb(gmail_application_jobs.*) into result;
  return result;
end;
$$;
create or replace function public.mc_get_gmail_job(p_id uuid, p_user_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  update private.gmail_application_jobs set status=case when status='queued' then 'failed' else 'unknown' end,
    error=case when status='queued' then 'Le workflow n8n n’a pas exécuté cet envoi.' else 'Confirmation interrompue. Vérifiez Messages envoyés avant de réessayer.' end
  where id=p_id and user_id=p_user_id and ((status='queued' and expires_at<now()) or (status='sending' and started_at<now()-interval '3 minutes'));
  select to_jsonb(j) into result from private.gmail_application_jobs j where j.id=p_id and j.user_id=p_user_id;
  return result;
end;
$$;
create or replace function public.mc_finish_gmail_job(p_id uuid, p_results jsonb, p_status text, p_error text) returns void
language sql security definer set search_path = '' as $$
  update private.gmail_application_jobs set results=p_results, status=p_status, error=p_error
  where id=p_id and status in ('sending','queued','unknown');
$$;
-- Service-role only; even the owner cannot obtain tokens/capabilities through RPC.
revoke all on function public.mc_get_gmail_connection(uuid), public.mc_store_gmail_connection(uuid,text,text,text[]),
  public.mc_disconnect_gmail(uuid), public.mc_start_gmail_oauth(uuid,text,text), public.mc_consume_gmail_oauth(text),
  public.mc_create_gmail_job(jsonb), public.mc_claim_gmail_job(uuid,text), public.mc_get_gmail_job(uuid,uuid),
  public.mc_finish_gmail_job(uuid,jsonb,text,text) from public, anon, authenticated;
grant execute on function public.mc_get_gmail_connection(uuid), public.mc_store_gmail_connection(uuid,text,text,text[]),
  public.mc_disconnect_gmail(uuid), public.mc_start_gmail_oauth(uuid,text,text), public.mc_consume_gmail_oauth(text),
  public.mc_create_gmail_job(jsonb), public.mc_claim_gmail_job(uuid,text), public.mc_get_gmail_job(uuid,uuid),
  public.mc_finish_gmail_job(uuid,jsonb,text,text) to service_role;
