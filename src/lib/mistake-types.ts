// 错题本相关共享类型（前后端共用，无 Supabase/LangGraph 依赖）

export const MISTAKE_STATUSES = ["未掌握", "学习中", "待复习", "已掌握"] as const;
export type MistakeStatus = (typeof MISTAKE_STATUSES)[number];

// 筛选 Tab：全部 + 四种状态
export const MISTAKE_FILTERS = ["全部", ...MISTAKE_STATUSES] as const;
export type MistakeFilter = (typeof MISTAKE_FILTERS)[number];

// 保存错题的请求体（POST /api/mistakes）
export type SaveMistakeInput = {
  questionId: string;
  sessionId: string;
  // 可选：前端补充的卡点/总结覆盖（MVP 一般由服务端从 session 读取）
  stuckReason?: string;
};

// 依据辅导会话的累积表现推断初始掌握度，替代默认「未掌握」。
// 优先级：看过完整答案 / 累计答错 >= 3 → 未掌握；答错 1~2 次 → 学习中；其余 → 待复习。
export const MASTERY_WRONG_THRESHOLD = 3;

export function inferMistakeStatus(args: {
  wrongCount?: number | null;
  revealedAnswer?: boolean | null;
}): MistakeStatus {
  const wrong = args.wrongCount ?? 0;
  if (args.revealedAnswer || wrong >= MASTERY_WRONG_THRESHOLD) {
    return "未掌握";
  }
  if (wrong >= 1) {
    return "学习中";
  }
  return "待复习";
}