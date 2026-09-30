import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  callDeepSeekChat,
  hasDeepSeekKey,
  parseJsonLoose,
} from "@/lib/deepseek";
import type {
  AgentAction,
  AgentChatMessage,
  AgentResponse,
  PageContext,
} from "@/lib/agent-types";

// AgentDock 后端（SPEC 9）：根据页面上下文 + 用户消息，返回 reply + 结构化 actions
const SYSTEM = `你是「小步辅导」的页面助手 AgentDock。
你会收到当前页面上下文和用户消息，判断用户意图并返回结构化 JSON：
{"reply":"给用户的简短中文回复","actions":[{"type":"...","payload":{...}}]}

可用的 action type 与 payload：
- navigate：{"path":"/upload"}  跳转页面（合法路径：/upload /mistakes /weakness /profile /login）
- set_filter：{"status":"未掌握|学习中|待复习|已掌握|全部"}  错题本筛选（仅 /mistakes 页）
- update_status：{"mistakeId":"uuid","status":"未掌握|学习中|待复习|已掌握"}  改错题状态（仅错题详情页且用户明确指定）
- run_weakness_analysis：{}  触发薄弱知识点分析（仅 /weakness 页）
- set_form：{"target":"字段名","value":"值"}  设置当前页表单字段
- set_mode：{"mode":"..."}  设置辅导模式（仅辅导页，一般不用）

规则：
1. 若用户意图能用 action 表达，则在 actions 中返回对应 action。
2. 若缺少必要参数（如 mistakeId/status 未提供或无法确定），不要返回 action，改为在 reply 中向用户确认。
3. 只返回 JSON，不要输出其它文字或 markdown。`;

const ALLOWED_TYPES = new Set([
  "navigate",
  "set_filter",
  "update_status",
  "run_weakness_analysis",
  "set_form",
  "set_mode",
  "save_mistake",
]);

function sanitizeActions(actions: unknown): AgentAction[] {
  if (!Array.isArray(actions)) return [];
  return actions.filter(
    (a): a is AgentAction =>
      !!a &&
      typeof a === "object" &&
      typeof (a as AgentAction).type === "string" &&
      ALLOWED_TYPES.has((a as AgentAction).type) &&
      !!((a as AgentAction) as { payload?: unknown }).payload,
  );
}

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
  let body: PageContext & { messages?: AgentChatMessage[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const contextText = JSON.stringify({
    route: body?.route ?? "",
    page: body?.page ?? "",
    formValues: body?.formValues ?? {},
    selectedQuestion: body?.selectedQuestion ?? null,
    selectedMistake: body?.selectedMistake ?? null,
    filters: body?.filters ?? {},
    sessionState: body?.sessionState ?? null,
  });

  const messages: AgentChatMessage[] = (body?.messages ?? []).slice(-10);

  // 3. Mock：未配置 DeepSeek
  if (!hasDeepSeekKey()) {
    return NextResponse.json({
      reply: "（Mock）当前未配置 DeepSeek，暂无法理解自然语言指令，请使用页面按钮操作。",
      actions: [],
    });
  }

  // 4. 调用 DeepSeek 生成结构化回复
  let raw: string;
  try {
    raw = await callDeepSeekChat(
      SYSTEM,
      [
        { role: "user", content: `页面上下文：${contextText}` },
        ...messages,
      ],
    );
  } catch {
    return NextResponse.json({
      reply: "AI 服务暂时不可用，请稍后重试。",
      actions: [],
    });
  }

  const parsed = parseJsonLoose<AgentResponse>(raw);
  const reply = parsed?.reply ?? raw;
  const actions = sanitizeActions(parsed?.actions);

  return NextResponse.json({ reply, actions });
}