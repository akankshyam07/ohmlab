-- Ohmlab cloud progress: one row per learner, the whole Progress object as JSON.
-- Run once in the Supabase SQL editor. Same SQL as docs/ARCHITECTURE.md ("Accounts and sync").

create table public.progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.progress enable row level security;

create policy "Learners read their own progress" on public.progress
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "Learners create their own progress" on public.progress
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "Learners update their own progress" on public.progress
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
