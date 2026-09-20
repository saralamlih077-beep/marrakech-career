-- A profile issue must never prevent Supabase Auth from creating a user.
-- The application will create or complete the profile after the user signs in.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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
  exception when others then
    raise warning 'Profile creation skipped for auth user %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;
