-- Align the legacy profiles table with the fields used by Marrakech Career.
-- This prevents the auth.users trigger from failing during sign-up.
alter table public.profiles
  add column if not exists full_name text,
  add column if not exists job_title text,
  add column if not exists phone text,
  add column if not exists linkedin text,
  add column if not exists address text,
  add column if not exists education text,
  add column if not exists experience text,
  add column if not exists projects text,
  add column if not exists languages text,
  add column if not exists skills text,
  add column if not exists updated_at timestamptz default now();

-- Preserve legacy profile information when it exists.
update public.profiles
set
  full_name = coalesce(nullif(full_name, ''), nom_complet),
  phone = coalesce(nullif(phone, ''), telephone),
  skills = coalesce(nullif(skills, ''), array_to_string(competences, ', ')),
  updated_at = coalesce(updated_at, now());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email
  )
  on conflict (id) do update
  set
    full_name = excluded.full_name,
    email = excluded.email,
    updated_at = now();
  return new;
end;
$$;
