"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  HINT_LEVELS,
  type HintLevel,
  type TutorResponse,
} from "@/lib/tutor-types";
import SpeakButton from "@/components/speak-button";
import Markdown from "@/components/markdown";
import HoldToTalk from "@/components/hold-to-talk";

type MessageItem = {
  id: string;
  role: "user" | "ai";
  content: string;
  hint_level: HintLevel | null;
};

type Props = {
  sessionId: string;
  questionId: string;
  questionText: string;
  questionType: string;
  knowledgePoints: string[];
  initialMessages: MessageItem[];
  initialHintLevel: HintLevel;
  initialSummary: string | null;
  initialStatus: "进行中" | "已完成";
  initialSubQuestionCount: number;
  initialSubQuestionIndex: number;
};

// 模块级去重：避免 React Strict 模式双跑 useEffect 触发两次 start 请求
const autoStarted = new Set<string>();

export default function TutorChat({
  sessionId,
  questionId,
  questionText,
  questionType,
  knowledgePoints,
  initialMessages,
  initialHintLevel,
  initialSummary,
  initialStatus,
  initialSubQuestionCount,
  initialSubQuestionIndex,
}: Props) {
  const router = useRouter();
  const [messages, setMessages] = useState<MessageItem[]>(initialMessages);
  const [hintLevel, setHintLevel] = useState<HintLevel>(initialHintLevel);
  const [summary, setSummary] = useState<string | null>(initialSummary);
  const [status, setStatus] = useState<"进行中" | "已完成">(initialStatus);
  const [subQuestionCount, setSubQuestionCount] = useState<number>(initialSubQuestionCount);
  const [subQuestionIndex, setSubQuestionIndex] = useState<number>(initialSubQuestionIndex);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mock, setMock] = useState(false);
  const [unlockedAnswer, setUnlockedAnswer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(true);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 首次进入：若尚无对话，自动触发一次 start（analyze_question 节点）
  useEffect(() => {
    if (initialMessages.length === 0 && !autoStarted.has(sessionId)) {
      autoStarted.add(sessionId);
      request({ action: "start" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function request(body: {
    action: "start" | "hint" | "answer" | "view_answer";
    hintLevel?: HintLevel;
    content?: string;
  }) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, ...body }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? "请求失败，请重试");
        return;
      }

      const r: TutorResponse = data.result;
      applyResponse(r, body);
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }

  function applyResponse(r: TutorResponse, body: { content?: string }) {
    const next: MessageItem[] = [];
    if (body.content) {
      next.push({
        id: `u-${Date.now()}`,
        role: "user",
        content: body.content,
        hint_level: null,
      });
    }
    if (r.reply) {
      next.push({
        id: `a-${Date.now()}`,
        role: "ai",
        content: r.reply,
        hint_level: r.hintLevel,
      });
    }
    if (r.summary) {
      setSummary(r.summary);
      setStatus("已完成");
    }
    if (r.subQuestionCount > 0) setSubQuestionCount(r.subQuestionCount);
    setSubQuestionIndex(r.subQuestionIndex);
    setMessages((prev) => [...prev, ...next]);
    setHintLevel(r.hintLevel);
    setUnlockedAnswer(r.unlockedAnswer);
    setMock(r.mock);
  }

  function sendAnswer() {
    const content = input.trim();
    if (!content || loading) return;
    setInput("");
    request({ action: "answer", content });
  }

  function clickHint(h: HintLevel) {
    if (loading) return;
    if (h === "answer") {
      request({ action: "view_answer" });
    } else {
      request({ action: "hint", hintLevel: h });
    }
  }

  async function saveMistake() {
    setSaveState("saving");
    try {
      const res = await fetch("/api/mistakes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, sessionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveState("error");
        return;
      }
      void data;
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  return (
    <main className="mx-auto w-full max-w-md p-4 pb-40">
      {/* 返回按钮 */}
      <button
        onClick={() => router.push("/")}
        aria-label="返回首页"
        className="mb-3 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
        返回
      </button>

      {/* 题目卡片 */}
      <div className="rounded-2xl bg-white shadow-sm">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex w-full items-center justify-between px-4 py-3 text-left"
        >
          <div>
            <h1 className="text-base font-bold text-gray-900">题目</h1>
            <p className="mt-0.5 text-xs text-gray-500">
              {questionType || "题型未识别"} · {knowledgePoints.join("、") || "知识点未识别"}
            </p>
            {subQuestionCount > 1 && (
              <p className="mt-1 text-xs font-medium text-primary-600">
                第 {subQuestionIndex} / {subQuestionCount} 小题
              </p>
            )}
          </div>
          <span className="text-xs text-gray-400">
            {collapsed ? "展开" : "收起"}
          </span>
        </button>
        {!collapsed && (
          <pre className="whitespace-pre-wrap border-t border-gray-100 px-4 py-3 text-sm leading-relaxed text-gray-700">
            {questionText}
          </pre>
        )}
      </div>

      {/* Mock 提示 */}
      {mock && (
        <div className="mt-3 rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-500">
          当前为 Mock 模式：未配置 DEEPSEEK_API_KEY，AI 回复为演示文案。
        </div>
      )}

      {/* 连续答错/尝试上限提示 */}
      {unlockedAnswer && status === "进行中" && (
        <div className="mt-3 rounded-lg bg-warning-50 px-3 py-2 text-xs text-warning-700">
          已经尝试多次，可以直接点击「查看答案」查看解析。
        </div>
      )}

      {/* 对话区 */}
      <div className="mt-4 space-y-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex items-end gap-1.5 ${
              m.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-primary-600 text-white"
                  : "bg-white text-gray-800 shadow-sm"
              }`}
            >
              {m.role === "user" ? (
                <span className="whitespace-pre-wrap">{m.content}</span>
              ) : (
                <Markdown>{m.content}</Markdown>
              )}
            </div>
            {m.role === "ai" && <SpeakButton text={m.content} />}
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-white px-4 py-2 text-sm text-gray-400 shadow-sm">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-primary-500 border-t-transparent align-middle" />
              <span className="ml-2">老师思考中…</span>
            </div>
          </div>
        )}

        {/* 总结卡片（答对/查看答案/尝试上限后展示） */}
        {summary && (
          <div className="rounded-2xl border border-success-200 bg-success-50 p-4">
            <p className="text-xs font-semibold text-success-700">辅导总结</p>
            <div className="mt-2 text-sm leading-relaxed text-gray-700">
              <Markdown>{summary}</Markdown>
            </div>
            <div className="mt-3">
              {saveState === "saved" ? (
                <button
                  onClick={() => router.push("/mistakes")}
                  className="w-full rounded-lg bg-success-600 py-2 text-sm font-semibold text-white hover:bg-success-700"
                >
                  已保存到错题本，去查看
                </button>
              ) : (
                <button
                  onClick={saveMistake}
                  disabled={saveState === "saving"}
                  className="w-full rounded-lg bg-success-600 py-2 text-sm font-semibold text-white hover:bg-success-700 disabled:opacity-50"
                >
                  {saveState === "saving" ? "保存中…" : "保存到错题本"}
                </button>
              )}
              {saveState === "error" && (
                <p className="mt-1 text-xs text-danger-500">
                  保存失败，请重试。
                </p>
              )}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* 提示级别按钮组（固定在输入框上方） */}
      <div className="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-md px-4 pb-2 pt-2">
          <div className="grid grid-cols-4 gap-2">
            {HINT_LEVELS.map((h) => (
              <button
                key={h.value}
                onClick={() => clickHint(h.value)}
                disabled={loading}
                className={`rounded-lg px-1 py-1.5 text-xs font-medium disabled:opacity-50 ${
                  hintLevel === h.value
                    ? "bg-primary-600 text-white"
                    : "bg-primary-50 text-primary-700"
                }`}
              >
                {h.label}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-end gap-2">
            <HoldToTalk
              onResult={(text) => setInput((prev) => (prev ? prev + text : text))}
              sizeClass="h-10 w-10 rounded-xl"
              idleClass="bg-gray-100 text-gray-500 hover:bg-gray-200"
              iconClass="h-5 w-5"
            />
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendAnswer();
                }
              }}
              rows={1}
              placeholder={error ?? "输入你的回答，如「我选 A」"}
              className="max-h-24 flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
            />
            <button
              onClick={sendAnswer}
              disabled={loading || !input.trim()}
              className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
            >
              发送
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}