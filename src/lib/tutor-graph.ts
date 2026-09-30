import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { callDeepSeekChat, hasDeepSeekKey, parseJsonLoose } from "@/lib/deepseek";
import {
  type HintLevel,
  type ConversationMessage,
  MAX_ATTEMPTS,
} from "@/lib/tutor-types";

// ---------- 状态定义（SPEC 8.1 TutorState） ----------

const TutorState = Annotation.Root({
  // 题目上下文（由 route 层从 questions 表重建）
  questionText: Annotation<string>,
  questionType: Annotation<string>,
  knowledgePoints: Annotation<string[]>,

  // 本次请求的动作（由 route 层注入）
  action: Annotation<"start" | "hint" | "answer" | "view_answer">,
  studentInput: Annotation<string>, // answer 动作时的学生回答
  requestedHintLevel: Annotation<HintLevel>, // hint 动作时的目标级别

  // 持久化状态（由 route 层从 tutoring_sessions 重建）
  currentHintLevel: Annotation<HintLevel>,
  attemptCount: Annotation<number>,
  consecutiveWrong: Annotation<number>,
  stuckReason: Annotation<string | null>,
  conversationHistory: Annotation<ConversationMessage[]>,
  // 大题内小题进度（完形/阅读等多小题题型）
  subQuestionCount: Annotation<number>,
  subQuestionIndex: Annotation<number>,
  // 掌握度信号（跨小题累计，不随小题切换重置）
  wrongCount: Annotation<number>,
  revealedAnswer: Annotation<boolean>,

  // 评估结果
  isCorrect: Annotation<boolean | null>,
  extractedAnswer: Annotation<string | null>,

  // 输出
  reply: Annotation<string>,
  finalSummary: Annotation<string | null>,
});

type TutorStateType = typeof TutorState.State;

// ---------- LLM 调用 + Mock fallback ----------

async function llm(
  system: string,
  user: string,
  mock: string,
): Promise<string> {
  if (!hasDeepSeekKey()) return mock;
  try {
    return await callDeepSeekChat(system, [{ role: "user", content: user }]);
  } catch {
    return mock; // 调用失败降级为 mock，保证流程不中断
  }
}

function buildContext(state: TutorStateType): string {
  return [
    `题型：${state.questionType || "未识别"}`,
    `知识点：${state.knowledgePoints.join("、") || "未识别"}`,
    `题目：\n${state.questionText}`,
  ].join("\n");
}

function buildHistory(state: TutorStateType): string {
  const lines = state.conversationHistory.map(
    (m) => `${m.role === "ai" ? "老师" : "学生"}：${m.content}`,
  );
  return lines.length ? lines.join("\n") : "（暂无对话历史）";
}

// 统计大题内的小题数量（完形填空的空数 / 阅读理解选择题的题数）。
// 依据：行首题号「1. / 1．/ 1、/ 1)」取最大号 + 正文空位标记「___1___」。
// 返回 0 表示无法识别，按单题（旧行为）处理。
function countSubQuestions(text: string): number {
  if (!text) return 0;
  const nums: number[] = [];
  const lineRe = /(?:^|\n)\s*(\d{1,2})\s*[.．、)]/g;
  const blankRe = /_{2,}\s*(\d{1,2})\s*_{2,}/g;
  let m: RegExpExecArray | null;
  while ((m = lineRe.exec(text)) !== null) nums.push(parseInt(m[1], 10));
  while ((m = blankRe.exec(text)) !== null) nums.push(parseInt(m[1], 10));
  if (nums.length === 0) return 0;
  const max = Math.max(...nums);
  return max >= 1 ? max : 0;
}

const SYS = `你是「小步辅导」的初中英语老师，采用分层启发式教学。
铁律：
1. 不默认直接给出答案，逐步引导。
2. 提示级别：小提示（只给方向）、分析思路（拆逻辑不给答案）、分步讲解（逐步引导并留问题）、查看答案（学生主动要求或多次尝试失败后才给出完整答案与解析）。
3. 语气亲切简短，中文讲解。
4. 不要编造题目内容，未提供的信息不要臆测。`;

const HINT_LEVEL_PROMPT: Record<HintLevel, string> = {
  none: "先请学生尝试回答，不提示。",
  small_hint: "给「小提示」：只给方向，如指出定位到哪一段/哪句/哪个词，不给答案。",
  analysis: "给「分析思路」：拆解题目逻辑（定位依据、排除思路），不给答案。",
  step_by_step: "给「分步讲解」：分步引导，每步留一个小问题让学生回答，不给答案。",
  answer: "给「查看答案」：给出正确答案与完整解析，标注每个选项为何对/错。",
};

const MOCK_REPLIES: Record<Exclude<HintLevel, "none">, string> = {
  small_hint: "（Mock 提示）注意找到题目中的关键词或关键句，再回看选项。",
  analysis: "（Mock 思路）先定位问题对应的原文位置，再看选项之间的区别，排除明显不符的。",
  step_by_step:
    "（Mock 分步）第一步先读懂题干问什么；第二步定位原文依据；第三步逐一比照选项。你试试第一步？",
  answer:
    "（Mock 答案）当前未配置 DeepSeek，无法生成真实答案与解析。配置 DEEPSEEK_API_KEY 后即可获得完整讲解。",
};

// ---------- 节点实现 ----------

// analyze_question：start 动作，生成开场白
async function analyzeQuestion(
  state: TutorStateType,
): Promise<Partial<TutorStateType>> {
  const count = countSubQuestions(state.questionText);
  const scope =
    count > 1
      ? `本篇共 ${count} 小题，按顺序逐小题引导，先做第 1 小题，不要一次性讲完所有小题的答案。`
      : "本题按单题引导。";
  const reply = await llm(
    `${SYS}\n现在开始辅导，做简短开场：说明考查什么，引导学生先自己读题并尝试回答，不要给答案。${scope}`,
    buildContext(state),
    count > 1
      ? `我们来看这道题（共 ${count} 小题）。先自己通读一遍，然后从第 1 小题开始试着做，把你的答案告诉我。`
      : "我们来看看这道题。先自己读一遍题目，想一想答案，把你的想法告诉我。不用怕错，我们一起分析。",
  );
  return { reply, subQuestionCount: count, subQuestionIndex: 1 };
}

// generate_hint：按 currentHintLevel 生成提示
async function generateHint(
  state: TutorStateType,
): Promise<Partial<TutorStateType>> {
  const level = state.currentHintLevel;
  const reply = await llm(
    `${SYS}\n${HINT_LEVEL_PROMPT[level]}`,
    `${buildContext(state)}\n\n对话历史：\n${buildHistory(state)}\n卡点：${state.stuckReason ?? "无"}`,
    level === "none"
      ? "先自己读一遍题目，把每个空或每道题的答案试着选出来，然后告诉我。"
      : MOCK_REPLIES[level],
  );
  return { reply };
}

// evaluate_answer：提取学生答案 + 评估对错（SPEC 8.2）
async function evaluateAnswer(
  state: TutorStateType,
): Promise<Partial<TutorStateType>> {
  const attemptCount = state.attemptCount + 1;

  if (!hasDeepSeekKey()) {
    // Mock：无法判断对错，保持继续引导
    return {
      attemptCount,
      isCorrect: null,
      extractedAnswer: state.studentInput,
      stuckReason: "Mock：未配置 DeepSeek，暂无法自动判对错",
      consecutiveWrong: state.consecutiveWrong,
      wrongCount: state.wrongCount,
    };
  }

  let isCorrect: boolean | null = null;
  let stuckReason: string | null = null;
  let extractedAnswer: string | null = state.studentInput;

  try {
    const subScope =
      state.subQuestionCount > 1
        ? `\n当前第 ${state.subQuestionIndex} 小题（共 ${state.subQuestionCount} 小题），只判断这一小题的对错。`
        : "";
    const raw = await callDeepSeekChat(
      `${SYS}\n学生给出了回答，请判断对错并定位卡点。只返回 JSON：
{"answer":"学生选的答案","is_correct":true/false,"stuck_reason":"卡点原因（词汇不足/逻辑混乱/未定位原文/粗心/无）"}`,
      [
        {
          role: "user",
          content: `${buildContext(state)}${subScope}\n\n学生回答：${state.studentInput}`,
        },
      ],
    );
    const parsed = parseJsonLoose<{
      answer?: string;
      is_correct?: boolean;
      stuck_reason?: string;
    }>(raw);
    isCorrect = typeof parsed?.is_correct === "boolean" ? parsed.is_correct : null;
    stuckReason = parsed?.stuck_reason ?? null;
    extractedAnswer = parsed?.answer ?? state.studentInput;
  } catch {
    // 评估失败：判为未知，继续引导
  }

  const consecutiveWrong = isCorrect === false ? state.consecutiveWrong + 1 : 0;
  const wrongCount = isCorrect === false ? state.wrongCount + 1 : state.wrongCount;

  return {
    attemptCount,
    isCorrect,
    extractedAnswer,
    stuckReason,
    consecutiveWrong,
    wrongCount,
  };
}

// adjust_hint_level：设置/升级提示级别（SPEC 8.2）
function adjustHintLevel(state: TutorStateType): Partial<TutorStateType> {
  if (state.action === "hint") {
    return { currentHintLevel: state.requestedHintLevel };
  }
  // answer 答错 → 提升一级
  const order: HintLevel[] = [
    "none",
    "small_hint",
    "analysis",
    "step_by_step",
    "answer",
  ];
  const idx = order.indexOf(state.currentHintLevel);
  const next = order[Math.min(idx + 1, order.length - 1)];
  return { currentHintLevel: next };
}

// reveal_answer：view_answer 动作，生成答案与解析
async function revealAnswer(
  state: TutorStateType,
): Promise<Partial<TutorStateType>> {
  const reply = await llm(
    `${SYS}\n${HINT_LEVEL_PROMPT.answer}`,
    `${buildContext(state)}\n\n对话历史：\n${buildHistory(state)}`,
    MOCK_REPLIES.answer,
  );
  return {
    currentHintLevel: "answer",
    stuckReason: state.stuckReason ?? "未尝试直接查看答案",
    revealedAnswer: true,
    reply,
  };
}

// advance_question：多小题题型中，当前小题答对后进入下一小题
async function advanceQuestion(
  state: TutorStateType,
): Promise<Partial<TutorStateType>> {
  const nextIndex = state.subQuestionIndex + 1;
  const reply = await llm(
    `${SYS}\n学生第 ${state.subQuestionIndex} 小题答对了（${state.extractedAnswer ?? ""}）。
请简短肯定这一小题，然后引导他做第 ${nextIndex} 小题。不要泄露第 ${nextIndex} 小题及之后任何小题的答案，也不要总结全文。`,
    `${buildContext(state)}\n\n对话历史：\n${buildHistory(state)}`,
    `第 ${state.subQuestionIndex} 小题答对了！很棒。我们继续看第 ${nextIndex} 小题，你先自己选一选，告诉我你的答案。`,
  );
  return {
    reply,
    subQuestionIndex: nextIndex,
    currentHintLevel: "none",
    attemptCount: 0,
    consecutiveWrong: 0,
    stuckReason: null,
    isCorrect: null,
  };
}

// summarize：总结方法、知识点、易错点（SPEC 8.5）
async function summarize(
  state: TutorStateType,
): Promise<Partial<TutorStateType>> {
  const summary = await llm(
    `${SYS}\n请对这道题做总结，格式：
本题考查：xxx。
解题步骤：1. ……
易错点：xxx。
复习建议：xxx。`,
    `${buildContext(state)}\n\n对话历史：\n${buildHistory(state)}\n卡点：${state.stuckReason ?? "无"}`,
    `本题考查：${state.knowledgePoints.join("、") || "相关知识点"}。
解题步骤：1. 先读题干明确问题；2. 定位原文依据；3. 逐一比照选项并排除干扰项。
易错点：忽略原文依据、凭语感猜测。
复习建议：回归文本定位关键词，梳理常见干扰项类型。（Mock 总结）`,
  );

  // answer 答对/超限路径：reply 为空，补充一句反馈
  let reply = state.reply;
  if (state.action === "answer") {
    reply =
      state.isCorrect === true
        ? "答对了！很棒，下面帮你总结一下。"
        : "我们先来看看总结与解析。";
  }

  // 非「答对完成」进入总结（查答案 / 答到上限）视为已看过完整答案
  const revealedAnswer = state.revealedAnswer || state.isCorrect !== true;

  return { finalSummary: summary, reply, revealedAnswer };
}

// ---------- 条件路由 ----------

function routeByAction(state: TutorStateType): string {
  return state.action;
}

function routeAfterEvaluate(state: TutorStateType): string {
  // 答对：多小题且未到最后一小题 → 进入下一小题；否则（单题/最后一小题）→ 总结
  if (state.isCorrect === true) {
    const hasNext =
      state.subQuestionCount > 1 && state.subQuestionIndex < state.subQuestionCount;
    return hasNext ? "advance_question" : "summarize";
  }
  // 答错/无法判定：达到尝试上限或已到「查看答案」级别 → 总结（透出答案）
  const reached =
    state.attemptCount >= MAX_ATTEMPTS || state.currentHintLevel === "answer";
  return reached ? "summarize" : "adjust_hint_level";
}

// ---------- 组装图 ----------

const graph = new StateGraph(TutorState)
  .addNode("analyze_question", analyzeQuestion)
  .addNode("generate_hint", generateHint)
  .addNode("evaluate_answer", evaluateAnswer)
  .addNode("adjust_hint_level", adjustHintLevel)
  .addNode("advance_question", advanceQuestion)
  .addNode("reveal_answer", revealAnswer)
  .addNode("summarize", summarize)

  .addConditionalEdges(START, routeByAction, {
    start: "analyze_question",
    hint: "adjust_hint_level",
    answer: "evaluate_answer",
    view_answer: "reveal_answer",
  })

  .addEdge("analyze_question", END)
  .addEdge("adjust_hint_level", "generate_hint")
  .addEdge("generate_hint", END)

  .addEdge("reveal_answer", "summarize")
  .addEdge("summarize", END)
  .addEdge("advance_question", END)

  .addConditionalEdges("evaluate_answer", routeAfterEvaluate, {
    summarize: "summarize",
    adjust_hint_level: "adjust_hint_level",
    advance_question: "advance_question",
  })

  .compile();

// ---------- 对外：执行一次辅导 ----------

export type TutorRunInput = {
  questionText: string;
  questionType: string;
  knowledgePoints: string[];
  currentHintLevel: HintLevel;
  attemptCount: number;
  consecutiveWrong: number;
  stuckReason: string | null;
  conversationHistory: ConversationMessage[];
  action: "start" | "hint" | "answer" | "view_answer";
  studentInput: string;
  requestedHintLevel: HintLevel;
  subQuestionCount: number;
  subQuestionIndex: number;
  wrongCount: number;
  revealedAnswer: boolean;
};

export type TutorRunResult = {
  reply: string;
  hintLevel: HintLevel;
  attemptCount: number;
  consecutiveWrong: number;
  isCorrect: boolean | null;
  stuckReason: string | null;
  finalSummary: string | null;
  subQuestionCount: number;
  subQuestionIndex: number;
  wrongCount: number;
  revealedAnswer: boolean;
};

export async function runTutor(input: TutorRunInput): Promise<TutorRunResult> {
  const state = await graph.invoke({
    questionText: input.questionText,
    questionType: input.questionType,
    knowledgePoints: input.knowledgePoints,
    action: input.action,
    studentInput: input.studentInput,
    requestedHintLevel: input.requestedHintLevel,
    currentHintLevel: input.currentHintLevel,
    attemptCount: input.attemptCount,
    consecutiveWrong: input.consecutiveWrong,
    stuckReason: input.stuckReason,
    conversationHistory: input.conversationHistory,
    subQuestionCount: input.subQuestionCount,
    subQuestionIndex: input.subQuestionIndex,
    wrongCount: input.wrongCount,
    revealedAnswer: input.revealedAnswer,
    isCorrect: null,
    extractedAnswer: null,
    reply: "",
    finalSummary: null,
  });

  return {
    reply: state.reply,
    hintLevel: state.currentHintLevel,
    attemptCount: state.attemptCount,
    consecutiveWrong: state.consecutiveWrong,
    isCorrect: state.isCorrect,
    stuckReason: state.stuckReason,
    finalSummary: state.finalSummary,
    subQuestionCount: state.subQuestionCount,
    subQuestionIndex: state.subQuestionIndex,
    wrongCount: state.wrongCount,
    revealedAnswer: state.revealedAnswer,
  };
}