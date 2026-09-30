-- 0002_questions_sessions.sql
-- 阶段 2：questions + tutoring_sessions 表 + RLS + 私有图片 bucket

-- 1. questions 表
create table if not exists public.questions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  original_image_url text,
  cropped_image_url text,
  ocr_text text,
  edited_text text,
  subject text,
  question_type text,
  grade_level text,
  is_in_scope boolean not null default true,
  knowledge_points text[] not null default '{}',
  selected_question_index int,
  created_at timestamptz not null default now()
);

-- 2. tutoring_sessions 表
create table if not exists public.tutoring_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  status text not null default '进行中' check (status in ('进行中','已完成')),
  current_hint_level text not null default 'none' check (current_hint_level in ('none','small_hint','analysis','step_by_step','answer')),
  stuck_reason text,
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. RLS
alter table public.questions enable row level security;
alter table public.tutoring_sessions enable row level security;

drop policy if exists "questions select own" on public.questions;
create policy "questions select own"
  on public.questions for select
  using (auth.uid() = user_id);

drop policy if exists "questions insert own" on public.questions;
create policy "questions insert own"
  on public.questions for insert
  with check (auth.uid() = user_id);

drop policy if exists "questions update own" on public.questions;
create policy "questions update own"
  on public.questions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "sessions select own" on public.tutoring_sessions;
create policy "sessions select own"
  on public.tutoring_sessions for select
  using (auth.uid() = user_id);

drop policy if exists "sessions insert own" on public.tutoring_sessions;
create policy "sessions insert own"
  on public.tutoring_sessions for insert
  with check (auth.uid() = user_id);

drop policy if exists "sessions update own" on public.tutoring_sessions;
create policy "sessions update own"
  on public.tutoring_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 4. 私有图片 bucket（path 第一段为 user_id）
insert into storage.buckets (id, name, public)
values ('question-images', 'question-images', false)
on conflict (id) do nothing;

drop policy if exists "own images insert" on storage.objects;
create policy "own images insert" on storage.objects for insert
  with check (bucket_id = 'question-images' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "own images select" on storage.objects;
create policy "own images select" on storage.objects for select
  using (bucket_id = 'question-images' and auth.uid()::text = (storage.foldername(name))[1]);