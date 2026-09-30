-- 0005_public_bucket.sql
-- 阶段 6：错题本/辅导页图改为公共可读，避免列表页每张图一次 createSignedUrl 网络请求（去卡顿）
-- 说明：MVP 演示场景可接受题目图公开访问；若后续要求保密，可回滚为 private。
update storage.buckets
set public = true
where id = 'question-images';