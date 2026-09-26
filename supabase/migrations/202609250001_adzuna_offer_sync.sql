-- Keep a stable identity for offers imported from an external API.
create unique index if not exists job_offers_source_identity_unique_idx
  on public.job_offers (source_name, source_external_id);
