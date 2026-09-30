import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { VISION_SYSTEM_PROMPT, type VisionResult } from "@/lib/vision";

const DEEPSEEK_API_URL =
  process.env.DEEPSEEK_API_URL || "https://api.deepseek.com";
// DeepSeek「Flash Vision」实际模型名（官方 API 支持 deepseek-flash / deepseek-v4-pro）
const DEEPSEEK_VISION_MODEL =
  process.env.DEEPSEEK_VISION_MODEL || "deepseek-flash";

// JSON 解析容错：去除 markdown 代码块包裹（SPEC 7.5）
function stripMarkdownFence(text: string): string {
  let t = text.trim();
  // 去掉 ```json ... ``` 或 ``` ... ```
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  // 兜底：提取首个 { ... } 块
  const match = t.match(/\{[\s\S]*\}/);
  return match ? match[0] : t;
}

export async function POST(req: Request) {
  // 1. 鉴权（SPEC：所有 API Route 开头校验 JWT，未登录 401）
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 2. 解析请求
  let body: { image_base64?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const imageBase64 = body?.image_base64;
  if (!imageBase64) {
    return NextResponse.json(
      { error: "missing_image", message: "缺少图片" },
      { status: 400 },
    );
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey || apiKey === "placeholder-deepseek-key") {
    return NextResponse.json(
      {
        error: "missing_api_key",
        message: "DeepSeek API Key 未配置，请检查服务端环境变量 DEEPSEEK_API_KEY",
      },
      { status: 500 },
    );
  }

  // 3. 调用 DeepSeek V4 Flash Vision（OpenAI 兼容多模态格式）
  let raw: string;
  try {
    const res = await fetch(`${DEEPSEEK_API_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_VISION_MODEL,
        temperature: 0.1,
        messages: [
          { role: "system", content: VISION_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "请识别这张图片中的题目，严格按系统提示的 JSON 结构返回。",
              },
              {
                type: "image_url",
                image_url: {
                  url: imageBase64.startsWith("data:")
                    ? imageBase64
                    : `data:image/jpeg;base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[vision-analyze] DeepSeek 调用失败", res.status, errText);
      return NextResponse.json(
        { error: "ai_error", message: "AI 服务暂时不可用，请稍后重试" },
        { status: 502 },
      );
    }

    const data = await res.json();
    raw = data?.choices?.[0]?.message?.content ?? "";
  } catch (e) {
    console.error("[vision-analyze] 请求异常", e);
    return NextResponse.json(
      { error: "ai_error", message: "AI 服务暂时不可用，请重试" },
      { status: 502 },
    );
  }

  // 4. 解析 JSON（容错）
  let result: VisionResult;
  try {
    result = JSON.parse(stripMarkdownFence(raw)) as VisionResult;
  } catch {
    return NextResponse.json(
      { error: "parse_error", message: "识别结果解析失败，请重试" },
      { status: 502 },
    );
  }

  // 5. 字段兜底（防止模型漏字段导致前端崩溃）
  const normalized: VisionResult = {
    is_readable: result.is_readable !== false,
    confidence: typeof result.confidence === "number" ? result.confidence : 0,
    ocr_text: typeof result.ocr_text === "string" ? result.ocr_text : "",
    needs_more_info: result.needs_more_info === true,
    missing_info: Array.isArray(result.missing_info) ? result.missing_info : [],
    is_in_scope: result.is_in_scope !== false,
    scope_reason: typeof result.scope_reason === "string" ? result.scope_reason : "",
    subject: typeof result.subject === "string" ? result.subject : "英语",
    question_type:
      typeof result.question_type === "string" ? result.question_type : "",
    grade_level: typeof result.grade_level === "string" ? result.grade_level : "初中",
    knowledge_points: Array.isArray(result.knowledge_points)
      ? result.knowledge_points
      : [],
    brief_analysis:
      typeof result.brief_analysis === "string" ? result.brief_analysis : "",
  };

  return NextResponse.json({ result: normalized });
}