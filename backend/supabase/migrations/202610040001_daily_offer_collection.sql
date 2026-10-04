begin;

create table if not exists public.career_offer_sync_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('running','succeeded','partial','failed')),
  results jsonb not null default '[]'::jsonb
);
alter table public.career_offer_sync_runs enable row level security;
revoke all on public.career_offer_sync_runs from anon, authenticated;
grant all on public.career_offer_sync_runs to service_role;

create or replace function public.begin_career_offer_sync()
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform pg_advisory_xact_lock(20261004,1);
  if exists (select 1 from public.career_offer_sync_runs where status='running' and started_at>now()-interval '15 minutes') then return null; end if;
  update public.career_offer_sync_runs set status='failed',finished_at=now(),results='[{"error":"Collecte interrompue ou délai dépassé"}]' where status='running';
  insert into public.career_offer_sync_runs(status) values ('running') returning id into v_id;
  return v_id;
end; $$;

create or replace function public.save_career_offer_batch(p_source text,p_offers jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_offer jsonb; v_inserted integer:=0; v_updated integer:=0; v_existing uuid; v_company bigint;
begin
  if p_source not in ('jobsquare','joobaz','maremploi','jooble') or jsonb_typeof(p_offers)<>'array' or jsonb_array_length(p_offers)>150 then raise exception 'Invalid batch'; end if;
  for v_offer in select value from jsonb_array_elements(p_offers) loop
    if length(coalesce(v_offer->>'title',''))=0 or v_offer->>'source_name'<>p_source or
      v_offer->>'contract_type' not in ('internship','cdi','cdd','freelance','full_time') or
      coalesce(v_offer->>'location','') !~* 'marrak(ech|esh)' or
      coalesce(v_offer->>'source_url','') !~ '^https?://[^[:space:]]+$' or
      (p_source='jobsquare' and v_offer->>'source_url' !~ '^https://jobsquare\.ma/job/[0-9]+/') or
      (p_source='joobaz' and v_offer->>'source_url' !~ '^https://joobaz\.com/job/') or
      (p_source='maremploi' and v_offer->>'source_url' !~ '^https://maremploi\.com/emploi/') then raise exception 'Invalid offer'; end if;
    v_company:=null;
    select min(id) into v_company from public.entreprises
      where lower(trim(nom))=lower(trim(v_offer->>'employer_name')) and is_active=true
      having count(*)=1;
    select id into v_existing from public.job_offers where source_url=v_offer->>'source_url';
    insert into public.job_offers(title,entreprise_id,employer_name,contract_type,contract_label,location,description,requirements,skills,
      source_name,source_url,source_external_id,published_at,publication_date_estimated,expires_at,last_seen_at,status,offer_domain)
    values(left(v_offer->>'title',300),v_company,nullif(v_offer->>'employer_name',''),v_offer->>'contract_type',nullif(v_offer->>'contract_label',''),
      left(v_offer->>'location',400),left(v_offer->>'description',1500),coalesce(v_offer->>'requirements',''),
      array(select jsonb_array_elements_text(coalesce(v_offer->'skills','[]'::jsonb))),p_source,v_offer->>'source_url',v_offer->>'source_external_id',
      nullif(v_offer->>'published_at','')::timestamptz,false,nullif(v_offer->>'expires_at','')::timestamptz,now(),
      case when nullif(v_offer->>'expires_at','')::timestamptz<=now() then 'closed' else 'verified' end,nullif(v_offer->>'offer_domain',''))
    on conflict (source_url) where source_url is not null do update set
      title=excluded.title,entreprise_id=coalesce(public.job_offers.entreprise_id,excluded.entreprise_id),
      employer_name=coalesce(excluded.employer_name,public.job_offers.employer_name),contract_type=excluded.contract_type,contract_label=excluded.contract_label,
      location=excluded.location,
      -- Keep descriptions from the user's workbook; new indexed offers contain factual summaries.
      description=case when public.job_offers.import_metadata is not null then public.job_offers.description else excluded.description end,
      skills=case when cardinality(excluded.skills)>0 then excluded.skills else public.job_offers.skills end,
      published_at=coalesce(excluded.published_at,public.job_offers.published_at),
      publication_date_estimated=case when excluded.published_at is not null then false else public.job_offers.publication_date_estimated end,
      expires_at=coalesce(excluded.expires_at,public.job_offers.expires_at),last_seen_at=now(),
      status=case when coalesce(excluded.expires_at,public.job_offers.expires_at)<=now() then 'closed' else 'verified' end,
      source_external_id=excluded.source_external_id,offer_domain=coalesce(excluded.offer_domain,public.job_offers.offer_domain);
    if v_existing is null then v_inserted:=v_inserted+1; else v_updated:=v_updated+1; end if;
  end loop;
  return jsonb_build_object('inserted',v_inserted,'updated',v_updated);
end; $$;

create or replace function public.finish_career_offer_sync(p_run uuid,p_status text,p_results jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('succeeded','partial','failed') or jsonb_typeof(p_results)<>'array' then raise exception 'Invalid result'; end if;
  update public.career_offer_sync_runs set status=p_status,finished_at=now(),results=p_results where id=p_run and status='running';
end; $$;

revoke all on function public.begin_career_offer_sync() from public,anon,authenticated;
revoke all on function public.save_career_offer_batch(text,jsonb) from public,anon,authenticated;
revoke all on function public.finish_career_offer_sync(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.begin_career_offer_sync() to service_role;
grant execute on function public.save_career_offer_batch(text,jsonb) to service_role;
grant execute on function public.finish_career_offer_sync(uuid,text,jsonb) to service_role;

-- Reuse the existing server-to-server credential. Its value never appears in SQL or client code.
do $$ begin
  if not exists(select 1 from vault.secrets where name='jooble_sync_cron_secret') then raise exception 'Existing sync secret missing'; end if;
end $$;
do $$
declare v_command text;
begin
  -- Copy the existing authenticated HTTP template without reading credentials into the client.
  select command into v_command from cron.job where jobname='sync-job-opportunities-daily';
  if v_command is null or position('jooble_sync_cron_secret' in v_command)=0 or position('/functions/v1/sync-job-opportunities' in v_command)=0 then raise exception 'Authenticated cron template missing'; end if;
  v_command:=replace(v_command,'/functions/v1/sync-job-opportunities','/functions/v1/sync-career-offers');
  -- pg_net waits for the collector response rather than marking a five-second timeout as success.
  if position('timeout_milliseconds' in v_command)>0 then
    v_command:=regexp_replace(v_command,'timeout_milliseconds\s*(:=|=>)\s*[0-9]+','timeout_milliseconds := 120000','gi');
  else
    v_command:=regexp_replace(v_command,'\)\s*;?\s*$',', timeout_milliseconds := 120000);');
  end if;
  perform cron.schedule('sync-career-offers-daily','0 6 * * *',v_command);
end $$;
commit;
