-- 0003_messages.sql
-- 阶段 3：messages 表 + 辅导状态持久化字段 + RLS

-- 1. messages 表
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.tutoring_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','ai')),
  content text not null,
  hint_level text check (hint_level in ('none','small_hint','analysis','step_by_step','answer')),
  created_at timestamptz not null default now()
);

-- 2. tutoring_sessions 补充辅导状态字段（无状态 Serverless 需持久化尝试计数）
alter table public.tutoring_sessions
  add column if not exists attempt_count int not null default 0,
  add column if not exists consecutive_wrong int not null default 0;

-- 3. RLS
alter table public.messages enable row level security;

drop policy if exists "messages select own" on public.messages;
create policy "messages select own"
  on public.messages for select
  using (auth.uid() = user_id);

drop policy if exists "messages insert own" on public.messages;
create policy "messages insert own"
  on public.messages for insert
  with check (auth.uid() = user_id);