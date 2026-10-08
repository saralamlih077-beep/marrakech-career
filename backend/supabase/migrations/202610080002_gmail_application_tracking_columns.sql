-- Fields used by the personal Gmail submission and delivery workers.
-- Keep the historical email_genere/date_envoi fields and all existing records.
alter table public.candidatures
  add column if not exists poste text,
  add column if not exists contact_email text,
  add column if not exists date_postulee timestamptz,
  add column if not exists notes text;

-- An offer may provide a contact address without being linked to our company catalog.
alter table public.candidatures alter column entreprise_id drop not null;
