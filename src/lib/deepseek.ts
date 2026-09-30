// DeepSeek 文本对话调用（辅导节点用），OpenAI 兼容格式

const DEEPSEEK_API_URL =
  process.env.DEEPSEEK_API_URL || "https://api.deepseek.com";
const DEEPSEEK_CHAT_MODEL =
  process.env.DEEPSEEK_CHAT_MODEL || "deepseek-chat";

export function hasDeepSeekKey(): boolean {
  const key = process.env.DEEPSEEK_API_KEY;
  return !!key && key !== "placeholder-deepseek-key";
}

export type ChatMessage = { role: "user" | "assistant"; content: string };

export async function callDeepSeekChat(
  system: string,
  messages: ChatMessage[],
  opts: { temperature?: number } = {},
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey || apiKey === "placeholder-deepseek-key") {
    throw new Error("AI_KEY_MISSING");
  }

  const res = await fetch(`${DEEPSEEK_API_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_CHAT_MODEL,
      temperature: opts.temperature ?? 0.4,
      messages: [
        { role: "system", content: system },
        ...messages,
      ],
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("[deepseek-chat] 调用失败", res.status, txt);
    throw new Error("AI_CALL_FAILED");
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

// 解析容错：去除 markdown 代码块包裹后提取 JSON
export function parseJsonLoose<T>(text: string): T | null {
  let t = text.trim();
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const m = t.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as T;
  } catch {
    return null;
  }
}