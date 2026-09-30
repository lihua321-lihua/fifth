"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { AgentAction, PageContext } from "@/lib/agent-types";
import SpeakButton from "@/components/speak-button";
import HoldToTalk from "@/components/hold-to-talk";

type ChatMessage = { id: string; role: "user" | "assistant"; content: string };

type Props = {
  pageContext: PageContext;
  aboveTab?: boolean;
  quickActions?: string[];
};

export default function AgentDock({
  pageContext,
  aboveTab = false,
  quickActions = [],
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const idSeq = useRef(0);
  const nextId = () => (idSeq.current += 1);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, expanded]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput("");
    setLoading(true);
    setError(null);

    const userMsg: ChatMessage = {
      id: `u-${nextId()}`,
      role: "user",
      content,
    };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...pageContext,
          messages: nextMessages.map((m) => ({
            role: m.role === "user" ? "user" : "assistant",
            content: m.content,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { id: `a-${nextId()}`, role: "assistant", content: data?.reply ?? "请求失败，请重试" },
        ]);
        return;
      }

      const reply = data?.reply ?? "（无回复）";
      const actions: AgentAction[] = data?.actions ?? [];

      setMessages((prev) => [
        ...prev,
        { id: `a-${nextId()}`, role: "assistant", content: reply },
      ]);

      for (const action of actions) {
        const feedback = await executeAction(action);
        if (feedback) {
          setMessages((prev) => [
            ...prev,
            { id: `a-${nextId()}`, role: "assistant", content: feedback },
          ]);
        }
      }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }

  async function executeAction(action: AgentAction): Promise<string | null> {
    switch (action.type) {
      case "navigate":
        router.push(action.payload.path);
        return null;
      case "set_filter": {
        const s = action.payload.status;
        router.push(s === "全部" ? "/mistakes" : `/mistakes?status=${encodeURIComponent(s)}`);
        return null;
      }
      case "update_status": {
        const { mistakeId, status } = action.payload;
        if (!mistakeId || !status) return "缺少错题 ID 或状态。";
        const { error } = await supabase
          .from("mistakes")
          .update({ status, updated_at: new Date().toISOString() })
          .eq("id", mistakeId);
        if (error) return "状态更新失败，请重试。";
        router.refresh();
        return `已把错题标记为「${status}」。`;
      }
      case "save_mistake": {
        const { questionId, sessionId } = action.payload;
        if (!questionId || !sessionId) return "缺少题目信息，无法保存。";
        const res = await fetch("/api/mistakes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId, sessionId }),
        });
        if (!res.ok) return "保存错题失败，请重试。";
        return "已保存到错题本。";
      }
      case "run_weakness_analysis": {
        const res = await fetch("/api/weakness-analysis", { method: "POST" });
        if (!res.ok) return "薄弱知识点分析失败，请稍后重试。";
        router.refresh();
        return "薄弱知识点已重新分析。";
      }
      // MVP：以下 action 在前端点模式下无对应表单/模式，仅提示（SPEC 9.4 注）
      case "set_form":
      case "set_mode":
      default:
        return null;
    }
  }

  return (
    <div className={`fixed inset-x-0 z-40 ${aboveTab ? "bottom-16" : "bottom-0"}`}>
      <div className="mx-auto max-w-md">
        {/* 展开态：聊天历史 + 快捷指令 */}
        {expanded && (
          <div className="mx-3 mb-2 max-h-72 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
            <div className="max-h-56 overflow-y-auto p-3">
              {messages.length === 0 && (
                <p className="text-xs text-gray-400">
                  我是小步助手，可以帮你改状态、跳转页面、分析薄弱点等。
                </p>
              )}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`mt-2 flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-xs leading-relaxed ${
                      m.role === "user"
                        ? "bg-primary-600 text-white"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {m.content}
                    {m.role === "assistant" && <SpeakButton text={m.content} />}
                  </div>
                </div>
              ))}
              {loading && (
                <p className="mt-2 text-xs text-gray-400">思考中…</p>
              )}
              <div ref={bottomRef} />
            </div>
            {quickActions.length > 0 && (
              <div className="flex flex-wrap gap-2 border-t border-gray-100 p-2">
                {quickActions.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    disabled={loading}
                    className="rounded-full bg-primary-50 px-2.5 py-1 text-xs text-primary-700 hover:bg-primary-100 disabled:opacity-50"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 收起态：一行输入框 + 麦克风 + 发送 + 展开 */}
        <div className="border-t border-gray-200 bg-white px-3 py-2">
          {error && <p className="mb-1 text-xs text-danger-500">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setExpanded((e) => !e)}
              aria-label={expanded ? "收起" : "展开"}
              className="flex h-9 w-9 flex-none items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
            >
              <svg
                viewBox="0 0 24 24"
                className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            <HoldToTalk
              onResult={(text) => setInput((prev) => (prev ? prev + text : text))}
              sizeClass="h-9 w-9 rounded-lg"
              idleClass="text-gray-500 hover:bg-gray-100"
            />

            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="问小步助手…"
              className="h-9 min-w-0 flex-1 rounded-lg border border-gray-300 px-3 text-sm focus:border-primary-500 focus:outline-none"
            />

            <button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40"
              aria-label="发送"
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
                <path d="m22 2-7 20-4-9-9-4z" />
                <path d="M22 2 11 13" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}