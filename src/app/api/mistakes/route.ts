import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aggregateWeakness } from "@/lib/weakness";
import { callDeepSeekChat, hasDeepSeekKey } from "@/lib/deepseek";
import {
  inferMistakeStatus,
  type SaveMistakeInput,
} from "@/lib/mistake-types";

// 保存错题（SPEC 11.1）：读 session + question 组装错题字段，写入 mistakes 并自动触发薄弱点分析
export async function POST(req: Request) {
  // 1. 鉴权
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 2. 解析请求
  let body: SaveMistakeInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const { questionId, sessionId } = body ?? {};
  if (!questionId || !sessionId) {
    return NextResponse.json(
      { error: "missing_params", message: "缺少参数" },
      { status: 400 },
    );
  }

  // 3. 幂等：同一 session 已保存过则不重复
  const { data: existing } = await supabase
    .from("mistakes")
    .select("id")
    .eq("session_id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ mistakeId: existing.id, existed: true });
  }

  // 4. 读 session + question
  const { data: session } = await supabase
    .from("tutoring_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) {
    return NextResponse.json(
      { error: "session_not_found", message: "辅导会话不存在" },
      { status: 404 },
    );
  }
  const { data: question } = await supabase
    .from("questions")
    .select("*")
    .eq("id", questionId)
    .maybeSingle();
  if (!question) {
    return NextResponse.json(
      { error: "question_not_found", message: "题目不存在" },
      { status: 404 },
    );
  }

  // 5. 卡点原因：优先来自 LangGraph stuckReason，为空则 AI 生成
  let stuckReason = session.stuck_reason?.trim() ?? "";
  if (!stuckReason) {
    stuckReason = await genStuckReason(
      question.edited_text || question.ocr_text || "",
      session.summary ?? "",
    );
  }

  // 5.1 依据会话累积表现推断初始掌握度（替代默认「未掌握」）
  const initialStatus = inferMistakeStatus({
    wrongCount: session.wrong_count,
    revealedAnswer: session.revealed_answer,
  });

  // 6. 写入 mistakes
  const { data: mistake, error: insErr } = await supabase
    .from("mistakes")
    .insert({
      user_id: user.id,
      question_id: questionId,
      session_id: sessionId,
      image_url: question.original_image_url ?? null,
      text: question.edited_text || question.ocr_text || "",
      knowledge_points: question.knowledge_points ?? [],
      stuck_reason: stuckReason,
      tutoring_summary: session.summary ?? null,
      status: initialStatus,
    })
    .select("id")
    .single();

  if (insErr) {
    console.error("[mistakes] 保存失败", insErr);
    return NextResponse.json(
      { error: "db_error", message: "保存错题失败，请重试" },
      { status: 500 },
    );
  }

  // 7. 自动触发薄弱知识点分析（失败不阻塞保存，SPEC 11.3）
  try {
    await aggregateWeakness(supabase, user.id);
  } catch (e) {
    console.error("[mistakes] 薄弱分析失败", e);
  }

  return NextResponse.json({ mistakeId: mistake.id, existed: false });
}

async function genStuckReason(questionText: string, summary: string): Promise<string> {
  if (!hasDeepSeekKey()) {
    return "未记录卡点（Mock：未配置 DeepSeek）";
  }
  try {
    return await callDeepSeekChat(
      "你是英语老师，请用一句话概括学生在这道题上最可能的卡点原因（从：词汇不足 / 逻辑混乱 / 未定位原文 / 粗心 中选择或组合），只输出原因本身。",
      [
        {
          role: "user",
          content: `题目：\n${questionText.slice(0, 500)}\n\n辅导总结：${summary || "无"}`,
        },
      ],
    );
  } catch {
    return "未定位原文关键信息";
  }
}