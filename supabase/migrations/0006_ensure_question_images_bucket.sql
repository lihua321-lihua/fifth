-- 0006_ensure_question_images_bucket.sql
-- 修复：远程实例缺失 question-images 存储桶（0002 的建桶语句未在远端生效）
-- 幂等：桶已存在时仅更新 public 属性，策略先删后建
-- 最终态与 0005 一致：桶公共可读，写路径按 user_id 前缀 RLS 隔离
-- 注意：PostgreSQL 数组下标从 1 开始，foldername(name) 返回 {userId, 子路径...}，故取 [1]

insert into storage.buckets (id, name, public)
values ('question-images', 'question-images', true)
on conflict (id) do update set public = true;

drop policy if exists "own images insert" on storage.objects;
create policy "own images insert" on storage.objects for insert
  with check (bucket_id = 'question-images' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "own images select" on storage.objects;
create policy "own images select" on storage.objects for select
  using (bucket_id = 'question-images' and auth.uid()::text = (storage.foldername(name))[1]);
