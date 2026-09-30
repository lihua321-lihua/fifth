import type { SupabaseClient } from "@supabase/supabase-js";
import { callDeepSeekChat, hasDeepSeekKey } from "@/lib/deepseek";

// 薄弱知识点聚合（SPEC 11.3）：按 knowledge_point 分组统计 status != '已掌握' 的错题，
// 生成复习建议并按 (user_id, knowledge_point) upsert，覆盖旧记录避免膨胀。

export type WeaknessRow = {
  knowledge_point: string;
  count: number;
  evidence_mistake_ids: string[];
  suggestion: string;
};

export async function aggregateWeakness(
  supabase: SupabaseClient,
  userId: string,
): Promise<WeaknessRow[]> {
  // 1. 取所有「未掌握方向」错题（已掌握的不计入）
  const { data: mistakes, error } = await supabase
    .from("mistakes")
    .select("id,text,knowledge_points")
    .eq("user_id", userId)
    .neq("status", "已掌握");
  if (error) {
    console.error("[weakness] 查询错题失败", error);
    throw error;
  }

  // 2. 聚合知识点（一道题可能涉及多个知识点）
  const map = new Map<string, { count: number; ids: string[]; texts: string[] }>();
  for (const m of mistakes ?? []) {
    const pts: string[] = Array.isArray(m.knowledge_points)
      ? m.knowledge_points
      : [];
    for (const raw of pts) {
      const key = (raw ?? "").trim();
      if (!key) continue;
      const entry = map.get(key) ?? { count: 0, ids: [], texts: [] };
      entry.count += 1;
      if (m.id) entry.ids.push(m.id);
      if (m.text) entry.texts.push(m.text.slice(0, 300));
      map.set(key, entry);
    }
  }

  const entries = [...map.entries()].sort((a, b) => b[1].count - a[1].count);

  // 3. 逐知识点生成复习建议（并行）
  const withSuggestions = await Promise.all(
    entries.map(async ([kp, e]) => ({
      kp,
      e,
      suggestion: await genSuggestion(kp, e.count, e.texts),
    })),
  );

  // 4. upsert 覆盖
  const rows: WeaknessRow[] = [];
  for (const { kp, e, suggestion } of withSuggestions) {
    const { error: upErr } = await supabase.from("weakness_analysis").upsert(
      {
        user_id: userId,
        knowledge_point: kp,
        count: e.count,
        evidence_mistake_ids: e.ids,
        suggestion,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,knowledge_point" },
    );
    if (upErr) {
      console.error("[weakness] upsert 失败", kp, upErr);
    }
    rows.push({
      knowledge_point: kp,
      count: e.count,
      evidence_mistake_ids: e.ids,
      suggestion,
    });
  }

  return rows;
}

async function genSuggestion(
  kp: string,
  count: number,
  texts: string[],
): Promise<string> {
  if (!hasDeepSeekKey()) {
    return `近 ${count} 道错题涉及「${kp}」。建议回归课本梳理该知识点的概念与易错点，并重做相关错题巩固。（Mock 建议，未配置 DeepSeek）`;
  }
  try {
    const sample = texts.slice(0, 3).join("\n---\n");
    return await callDeepSeekChat(
      "你是初中英语老师，请针对薄弱知识点给出简短复习建议（中文，不超过 100 字），只输出建议正文。",
      [
        {
          role: "user",
          content: `薄弱知识点：${kp}\n涉及错题数：${count}\n相关错题文本（节选）：\n${sample || "无"}`,
        },
      ],
    );
  } catch {
    return `围绕「${kp}」集中复习：先梳理概念与用法，再在原文中定位依据，重做相关错题并总结易错点。`;
  }
}