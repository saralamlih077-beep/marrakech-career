alter table public.entreprises
  add column if not exists about_summary text,
  add column if not exists about_source_url text,
  add column if not exists about_updated_at timestamptz;
