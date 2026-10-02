-- Archive privée des pièces de candidature et suivi de l'envoi n8n.
alter table public.candidatures
  add column if not exists candidate_name text,
  add column if not exists candidate_email text,
  add column if not exists cv_bucket text,
  add column if not exists cv_path text,
  add column if not exists cv_file_name text,
  add column if not exists cv_content_type text,
  add column if not exists delivery_status text not null default 'draft',
  add column if not exists delivery_error text,
  add column if not exists sent_at timestamptz;

alter table public.candidatures
  drop constraint if exists candidatures_delivery_status_check;

alter table public.candidatures
  add constraint candidatures_delivery_status_check
  check (delivery_status in ('draft', 'queued', 'sent', 'failed'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'candidate-cvs',
  'candidate-cvs',
  false,
  10485760,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Un utilisateur peut voir et gérer uniquement les CV dans son propre dossier.
drop policy if exists "users upload their own candidate CVs" on storage.objects;
create policy "users upload their own candidate CVs"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'candidate-cvs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users read their own candidate CVs" on storage.objects;
create policy "users read their own candidate CVs"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'candidate-cvs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users delete their own candidate CVs" on storage.objects;
create policy "users delete their own candidate CVs"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'candidate-cvs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
