// 辅导相关共享类型（无 LangGraph 依赖，前后端共用）

export type HintLevel =
  | "none"
  | "small_hint"
  | "analysis"
  | "step_by_step"
  | "answer";

export type TutorActionType = "start" | "hint" | "answer" | "view_answer";

export type ConversationMessage = { role: "user" | "ai"; content: string };

// /api/tutor 请求体
export type TutorInput = {
  action: TutorActionType;
  // hint / view_answer 动作：目标提示级别
  hintLevel?: HintLevel;
  // answer 动作：学生回答文本
  content?: string;
};

// /api/tutor 响应体
export type TutorResponse = {
  reply: string;
  hintLevel: HintLevel;
  attemptCount: number;
  consecutiveWrong: number;
  isCorrect: boolean | null;
  stuckReason: string | null;
  summary: string | null;
  // 大题内小题进度：0 = 未识别/单题（旧行为），>1 表示多小题按顺序推进
  subQuestionCount: number;
  subQuestionIndex: number;
  // 连续错 3 次或达到尝试上限 → 前端强制露出「查看答案」
  unlockedAnswer: boolean;
  sessionStatus: "进行中" | "已完成";
  mock: boolean;
};

export const HINT_LEVELS: { value: HintLevel; label: string }[] = [
  { value: "small_hint", label: "小提示" },
  { value: "analysis", label: "分析思路" },
  { value: "step_by_step", label: "分步讲解" },
  { value: "answer", label: "查看答案" },
];

export const MAX_ATTEMPTS = 5;
export const UNLOCK_ANSWER_WRONG = 3;