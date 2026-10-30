-- One JSON snapshot per user, protected by row level security.
create table if not exists public.snapshots (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.snapshots enable row level security;

create policy "own snapshot read" on public.snapshots
  for select using (auth.uid() = user_id);
create policy "own snapshot insert" on public.snapshots
  for insert with check (auth.uid() = user_id);
create policy "own snapshot update" on public.snapshots
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own snapshot delete" on public.snapshots
  for delete using (auth.uid() = user_id);
