create table if not exists public.user_feedback (
  user_id uuid primary key references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_feedback enable row level security;
create policy "users manage their own feedback" on public.user_feedback
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
