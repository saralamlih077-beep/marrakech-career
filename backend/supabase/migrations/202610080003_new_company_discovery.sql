begin;
create schema if not exists private;
create table private.company_discovery_runs (
  id uuid primary key default gen_random_uuid(), started_at timestamptz not null default now(), finished_at timestamptz,
  status text not null check(status in ('running','succeeded','partial','failed')), results jsonb not null default '{}'::jsonb
);
create table private.company_discovery_candidates (
  source_id text primary key check(source_id ~ '^(node|way|relation)/[0-9]+$'),
  discovered_name text not null, site_web text not null,
  source_url text not null, source_license text not null default 'OpenStreetMap contributors / ODbL',
  discovered_at timestamptz not null default now(), checked_at timestamptz, attempts integer not null default 0,
  status text not null default 'pending' check(status in ('pending','published','existing')),
  missing_fields text[] not null default array['nom','domaine','adresse','telephone','site_web','email'],
  verified_data jsonb, evidence_urls jsonb not null default '[]'::jsonb, reason text,
  company_id integer references public.entreprises(id)
);
alter table private.company_discovery_runs enable row level security;
alter table private.company_discovery_candidates enable row level security;
revoke all on private.company_discovery_runs, private.company_discovery_candidates from public, anon, authenticated;
grant select,insert,update on private.company_discovery_runs, private.company_discovery_candidates to service_role;

create function public.begin_new_company_sync() returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  perform pg_advisory_xact_lock(20261008,3);
  if exists(select 1 from private.company_discovery_runs where status='running' and started_at > now()-interval '10 minutes')
    or exists(select 1 from private.company_discovery_runs where status in ('succeeded','partial') and started_at::date=current_date) then return null; end if;
  update private.company_discovery_runs set status='failed',finished_at=now(),results='{"error":"interrupted"}' where status='running';
  insert into private.company_discovery_runs(status) values('running') returning id into v_id;
  return v_id;
end $$;

create function private.company_host(p_url text) returns text language sql immutable set search_path='' as $$
  select lower(regexp_replace(regexp_replace(trim(p_url),'^https?://(www\.)?','','i'),'[/:?#].*$',''))
$$;

create function public.enqueue_company_candidates(p_candidates jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare v jsonb; v_count integer:=0; v_rows integer;
begin
  if jsonb_typeof(p_candidates)<>'array' or jsonb_array_length(p_candidates)>500 then raise exception 'Invalid batch'; end if;
  for v in select value from jsonb_array_elements(p_candidates) loop
    if coalesce(v->>'source_id','') !~ '^(node|way|relation)/[0-9]+$' or length(coalesce(v->>'nom','')) not between 2 and 250 or
      coalesce(v->>'site_web','') !~ '^https://[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(/[^[:space:]]*)?$' then continue; end if;
    insert into private.company_discovery_candidates(source_id,discovered_name,site_web,source_url)
      values(v->>'source_id',v->>'nom',v->>'site_web','https://www.openstreetmap.org/'||(v->>'source_id')) on conflict(source_id) do nothing;
    get diagnostics v_rows=row_count; v_count:=v_count+v_rows;
  end loop;
  -- Mark known sites as already present. Never update the public company record.
  update private.company_discovery_candidates c set status='existing',company_id=e.id,checked_at=now(),reason='existing_website'
  from public.entreprises e where c.status='pending' and private.company_host(c.site_web)=private.company_host(e.site_web) and coalesce(e.site_web,'')<>'';
  return v_count;
end $$;

create function public.pending_company_candidates() returns jsonb language sql security definer set search_path='' as $$
  select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) from (
    select source_id,discovered_name,site_web from private.company_discovery_candidates where status='pending'
    and (checked_at is null or checked_at<now()-interval '7 days') order by attempts,checked_at nulls first,source_id limit 6
  ) c
$$;

create function public.save_new_company_candidate(p_source_id text,p_company jsonb,p_missing text[],p_evidence jsonb,p_reason text)
returns text language plpgsql security definer set search_path='' as $$
declare v_candidate private.company_discovery_candidates; v_id integer; v_field text;
begin
  perform pg_advisory_xact_lock(20261008,4);
  select * into v_candidate from private.company_discovery_candidates where source_id=p_source_id for update;
  if not found then raise exception 'Unknown candidate'; end if;
  if v_candidate.status<>'pending' then return v_candidate.status; end if;
  if cardinality(coalesce(p_missing,array['unverified']))>0 or p_company is null then
    update private.company_discovery_candidates set checked_at=now(),attempts=attempts+1,missing_fields=coalesce(p_missing,array['unverified']),
      verified_data=p_company,evidence_urls=coalesce(p_evidence,'[]'),reason=left(p_reason,100) where source_id=p_source_id;
    return 'pending';
  end if;
  foreach v_field in array array['nom','domaine','adresse','telephone','site_web','email'] loop
    if length(trim(coalesce(p_company->>v_field,'')))=0 or lower(trim(p_company->>v_field)) ~ '^(n/?a|non disponible|non classé|inconnu|unknown|none|null|-|0)$' then raise exception 'Incomplete company'; end if;
  end loop;
  if length(p_company->>'nom') not between 2 and 250 or
    p_company->>'domaine' not in ('IT & Digital','Services aux entreprises','Marketing & Communication','Immobilier & Construction','Tourisme & Hôtellerie','Commerce & Distribution','Santé','Éducation & Formation','Finance & Assurance','Industrie & Logistique') or
    coalesce(p_company->>'email','') !~* '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[a-z]{2,}$' or p_company->>'email' ~* '(example\.(com|org)|^test@)' or
    p_company->>'telephone' !~ '^\+?[0-9 ().-]+$' or length(regexp_replace(p_company->>'telephone','[^0-9]','','g')) not between 8 and 15 or regexp_replace(p_company->>'telephone','[^0-9]','','g') ~ '^([0-9])\1+$' or
    coalesce(p_company->>'adresse','') !~* 'marrak(ech|esh)' or length(p_company->>'adresse') not between 15 and 400 or
    coalesce(p_company->>'site_web','') !~ '^https://[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(/[^[:space:]]*)?$' or
    private.company_host(p_company->>'site_web')<>private.company_host(v_candidate.site_web) or
    coalesce(jsonb_typeof(p_evidence),'')<>'array' or jsonb_array_length(p_evidence)=0 then raise exception 'Unverified company'; end if;
  select min(id) into v_id from public.entreprises where
    private.company_host(site_web)=private.company_host(p_company->>'site_web') or
    lower(trim(nom))=lower(trim(p_company->>'nom')) or
    lower(trim(email))=lower(trim(p_company->>'email')) or
    regexp_replace(telephone,'[^0-9]','','g')=regexp_replace(p_company->>'telephone','[^0-9]','','g');
  if v_id is not null then
    update private.company_discovery_candidates set status='existing',company_id=v_id,checked_at=now(),attempts=attempts+1,reason='duplicate' where source_id=p_source_id;
    return 'existing';
  end if;
  -- INSERT ONLY: existing companies, including archived ones, are never changed.
  insert into public.entreprises(nom,domaine,adresse,telephone,site_web,email,is_active)
  values(trim(p_company->>'nom'),p_company->>'domaine',trim(p_company->>'adresse'),trim(p_company->>'telephone'),p_company->>'site_web',lower(trim(p_company->>'email')),true) returning id into v_id;
  update private.company_discovery_candidates set status='published',company_id=v_id,checked_at=now(),attempts=attempts+1,missing_fields='{}',verified_data=p_company,evidence_urls=p_evidence,reason=null where source_id=p_source_id;
  return 'published';
end $$;

create function public.finish_new_company_sync(p_run uuid,p_status text,p_results jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
  if p_status not in ('succeeded','partial','failed') or jsonb_typeof(p_results)<>'object' then raise exception 'Invalid result'; end if;
  update private.company_discovery_runs set status=p_status,finished_at=now(),results=p_results where id=p_run and status='running';
end $$;
revoke all on function public.begin_new_company_sync(), public.enqueue_company_candidates(jsonb), public.pending_company_candidates(), public.save_new_company_candidate(text,jsonb,text[],jsonb,text), public.finish_new_company_sync(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.begin_new_company_sync(), public.enqueue_company_candidates(jsonb), public.pending_company_candidates(), public.save_new_company_candidate(text,jsonb,text[],jsonb,text), public.finish_new_company_sync(uuid,text,jsonb) to service_role;
revoke all on function private.company_host(text) from public,anon,authenticated;
commit;
