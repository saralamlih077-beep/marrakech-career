-- Skills belong to an offer, not to an entire company.
alter table public.job_offers
  add column if not exists skills text[] not null default '{}';

create index if not exists job_offers_verified_created_at_idx
  on public.job_offers (status, created_at desc);
