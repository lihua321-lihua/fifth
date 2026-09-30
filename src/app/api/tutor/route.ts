import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runTutor } from "@/lib/tutor-graph";
import { hasDeepSeekKey } from "@/lib/deepseek";
import {
  type HintLevel,
  type TutorInput,
  type TutorResponse,
  type ConversationMessage,
  MAX_ATTEMPTS,
  UNLOCK_ANSWER_WRONG,
} from "@/lib/tutor-types";

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
  let body: TutorInput & { sessionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const sessionId = body?.sessionId;
  const action = body?.action ?? "start";
  if (!sessionId) {
    return NextResponse.json({ error: "missing_session" }, { status: 400 });
  }

  // 3. 读 session（RLS 保证仅本人）
  const { data: session, error: sessionErr } = await supabase
    .from("tutoring_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionErr || !session) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // 4. 读 question
  const { data: question, error: questionErr } = await supabase
    .from("questions")
    .select("*")
    .eq("id", session.question_id)
    .maybeSingle();
  if (questionErr || !question) {
    return NextResponse.json({ error: "question_not_found" }, { status: 404 });
  }

  // 5. 读历史消息，重建对话
  const { data: messages } = await supabase
    .from("messages")
    .select("role,content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  const history: ConversationMessage[] = (messages ?? []).map((m) => ({
    role: m.role as "user" | "ai",
    content: m.content,
  }));

  // 6. 动作映射
  const currentHintLevel = (session.current_hint_level ?? "none") as HintLevel;
  const subQuestionCount = (session.sub_question_count ?? 0) as number;
  const subQuestionIndex = (session.sub_question_index ?? 1) as number;
  const wrongCount = (session.wrong_count ?? 0) as number;
  const revealedAnswer = (session.revealed_answer ?? false) as boolean;
  const studentInput = action === "answer" ? (body.content ?? "").trim() : "";
  const requestedHintLevel: HintLevel =
    action === "hint"
      ? (body.hintLevel ?? "small_hint")
      : action === "view_answer"
        ? "answer"
        : currentHintLevel;

  if (action === "answer" && !studentInput) {
    return NextResponse.json(
      { error: "empty_answer", message: "回答内容为空" },
      { status: 400 },
    );
  }

  // 7. 执行 LangGraph（SPEC 8.6：每次请求从 DB 重建状态）
  const result = await runTutor({
    questionText: question.edited_text || question.ocr_text || "",
    questionType: question.question_type || "",
    knowledgePoints: question.knowledge_points ?? [],
    currentHintLevel,
    attemptCount: session.attempt_count ?? 0,
    consecutiveWrong: session.consecutive_wrong ?? 0,
    stuckReason: session.stuck_reason ?? null,
    conversationHistory: history,
    action,
    studentInput,
    requestedHintLevel,
    subQuestionCount,
    subQuestionIndex,
    wrongCount,
    revealedAnswer,
  });

  const now = new Date().toISOString();

  // 8. 写回 messages：学生回答（仅 answer 动作）
  const inserts: { session_id: string; user_id: string; role: "user" | "ai"; content: string; hint_level: HintLevel | null; created_at: string }[] = [];

  if (action === "answer") {
    inserts.push({
      session_id: sessionId,
      user_id: user.id,
      role: "user",
      content: studentInput,
      hint_level: null,
      created_at: now,
    });
  }

  // AI 回复（总结单独存 session.summary，不作为对话气泡）
  if (result.reply) {
    inserts.push({
      session_id: sessionId,
      user_id: user.id,
      role: "ai",
      content: result.reply,
      hint_level: result.hintLevel,
      created_at: now,
    });
  }

  if (inserts.length > 0) {
    const { error: insertErr } = await supabase.from("messages").insert(inserts);
    if (insertErr) {
      console.error("[tutor] 写 messages 失败", insertErr);
      return NextResponse.json(
        { error: "db_error", message: "保存对话失败，请重试" },
        { status: 500 },
      );
    }
  }

  // 9. 更新 session 状态
  const { error: updateErr } = await supabase
    .from("tutoring_sessions")
    .update({
      current_hint_level: result.hintLevel,
      attempt_count: result.attemptCount,
      consecutive_wrong: result.consecutiveWrong,
      stuck_reason: result.stuckReason,
      summary: result.finalSummary ?? session.summary,
      status: result.finalSummary ? "已完成" : "进行中",
      sub_question_count: result.subQuestionCount,
      sub_question_index: result.subQuestionIndex,
      wrong_count: result.wrongCount,
      revealed_answer: result.revealedAnswer,
      updated_at: now,
    })
    .eq("id", sessionId);
  if (updateErr) {
    console.error("[tutor] 更新 session 失败", updateErr);
  }

  // 10. 组装响应
  const unlockedAnswer =
    result.consecutiveWrong >= UNLOCK_ANSWER_WRONG ||
    result.attemptCount >= MAX_ATTEMPTS;

  const resp: TutorResponse = {
    reply: result.reply,
    hintLevel: result.hintLevel,
    attemptCount: result.attemptCount,
    consecutiveWrong: result.consecutiveWrong,
    isCorrect: result.isCorrect,
    stuckReason: result.stuckReason,
    summary: result.finalSummary,
    subQuestionCount: result.subQuestionCount,
    subQuestionIndex: result.subQuestionIndex,
    unlockedAnswer,
    sessionStatus: result.finalSummary ? "已完成" : "进行中",
    mock: !hasDeepSeekKey(),
  };

  return NextResponse.json({ result: resp });
}