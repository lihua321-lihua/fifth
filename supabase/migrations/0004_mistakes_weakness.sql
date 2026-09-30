-- 0004_mistakes_weakness.sql
-- 阶段 4：mistakes（错题本）+ weakness_analysis（薄弱知识点）+ RLS

-- 1. mistakes 表
create table if not exists public.mistakes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid references public.questions(id) on delete set null,
  session_id uuid references public.tutoring_sessions(id) on delete set null,
  image_url text,
  text text,
  knowledge_points text[] not null default '{}',
  stuck_reason text,
  tutoring_summary text,
  status text not null default '未掌握' check (status in ('未掌握','学习中','待复习','已掌握')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. weakness_analysis 表（user_id + knowledge_point 唯一，upsert 覆盖）
create table if not exists public.weakness_analysis (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  knowledge_point text not null,
  count int not null default 0,
  evidence_mistake_ids uuid[] not null default '{}',
  suggestion text,
  updated_at timestamptz not null default now(),
  unique (user_id, knowledge_point)
);

-- 3. RLS
alter table public.mistakes enable row level security;
alter table public.weakness_analysis enable row level security;

drop policy if exists "mistakes select own" on public.mistakes;
create policy "mistakes select own"
  on public.mistakes for select
  using (auth.uid() = user_id);

drop policy if exists "mistakes insert own" on public.mistakes;
create policy "mistakes insert own"
  on public.mistakes for insert
  with check (auth.uid() = user_id);

drop policy if exists "mistakes update own" on public.mistakes;
create policy "mistakes update own"
  on public.mistakes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "mistakes delete own" on public.mistakes;
create policy "mistakes delete own"
  on public.mistakes for delete
  using (auth.uid() = user_id);

drop policy if exists "weakness select own" on public.weakness_analysis;
create policy "weakness select own"
  on public.weakness_analysis for select
  using (auth.uid() = user_id);

drop policy if exists "weakness insert own" on public.weakness_analysis;
create policy "weakness insert own"
  on public.weakness_analysis for insert
  with check (auth.uid() = user_id);

drop policy if exists "weakness update own" on public.weakness_analysis;
create policy "weakness update own"
  on public.weakness_analysis for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);