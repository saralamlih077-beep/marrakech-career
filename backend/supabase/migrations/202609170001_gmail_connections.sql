create schema if not exists private;

create table if not exists private.gmail_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  encrypted_refresh_token text not null,
  scopes text[] not null default '{}',
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table private.gmail_connections enable row level security;

-- No browser role can select OAuth tokens. Edge Functions use the service-role key.
