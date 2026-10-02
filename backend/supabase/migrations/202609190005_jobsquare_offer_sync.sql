-- JobSquare imports: retain the source identity and hide offers that have expired.
alter table public.job_offers
  add column if not exists source_name text not null default 'manual',
  add column if not exists source_external_id text,
  add column if not exists published_at timestamptz,
  add column if not exists last_seen_at timestamptz,
  add column if not exists expires_at timestamptz;

update public.job_offers
set source_name = 'jobsquare',
    last_seen_at = coalesce(last_seen_at, created_at)
where source_url ilike '%jobsquare.ma%';

create unique index if not exists job_offers_source_url_unique_idx
  on public.job_offers (source_url)
  where source_url is not null;

create index if not exists job_offers_active_expiration_idx
  on public.job_offers (status, expires_at, last_seen_at desc);

-- An offer is visible only while it is active. The importer also changes stale records to closed.
drop policy if exists "verified offers are readable" on public.job_offers;
create policy "active verified offers are readable"
  on public.job_offers for select
  using (status = 'verified' and (expires_at is null or expires_at > now()));
