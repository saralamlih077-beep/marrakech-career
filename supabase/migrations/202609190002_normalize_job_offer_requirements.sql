-- Older databases may have stored requirements as text[].
-- Preserve all values while normalizing to the text format used by the app.
alter table public.job_offers
  alter column requirements type text
  using case
    when requirements is null then ''
    else array_to_string(requirements, ' ')
  end;

alter table public.job_offers
  alter column requirements set default '';
