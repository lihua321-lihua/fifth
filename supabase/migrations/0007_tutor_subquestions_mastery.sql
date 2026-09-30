-- 0007_tutor_subquestions_mastery.sql
-- 阶段：大题内小题进度 + 掌握度判定的持久化字段

-- 1. 小题进度：完形填空/阅读理解这类「一道大题内多道小题」需要知道
--    当前做到第几小题、一共有几小题，避免「答对一空就总结全题」提前泄底。
alter table public.tutoring_sessions
  add column if not exists sub_question_count int not null default 0,  -- 大题内小题总数（0 = 未识别/单题）
  add column if not exists sub_question_index int not null default 1;  -- 当前进行到第几小题（1 起始）

-- 2. 掌握度判定信号（跨小题累计，不随小题切换重置）
alter table public.tutoring_sessions
  add column if not exists wrong_count int not null default 0,          -- 全会话累计答错次数
  add column if not exists revealed_answer boolean not null default false; -- 是否看过完整答案（查答案/答到上限）