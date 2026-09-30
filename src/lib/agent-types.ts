// AgentDock 相关共享类型（前后端共用）

// 页面上下文（SPEC 9.2）：前端每次请求 /api/agent 时传
export type PageContext = {
  route: string;
  page: string;
  formValues?: Record<string, unknown>;
  selectedQuestion?: unknown;
  selectedMistake?: { id: string; status?: string } | null;
  filters?: Record<string, string>;
  sessionState?: unknown;
};

export type AgentAction =
  | { type: "set_form"; payload: { target: string; value: unknown } }
  | { type: "navigate"; payload: { path: string } }
  | { type: "set_mode"; payload: { mode: string } }
  | { type: "save_mistake"; payload: { questionId: string; sessionId: string } }
  | { type: "update_status"; payload: { mistakeId: string; status: string } }
  | { type: "run_weakness_analysis"; payload: Record<string, never> }
  | { type: "set_filter"; payload: { status: string } };

export type AgentResponse = {
  reply: string;
  actions: AgentAction[];
};

export type AgentChatMessage = { role: "user" | "assistant"; content: string };