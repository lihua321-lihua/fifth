import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aggregateWeakness } from "@/lib/weakness";

// 薄弱知识点分析（SPEC 11.3）：按 user_id + knowledge_point 聚合 upsert
export async function POST() {
  // 1. 鉴权
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 2. 聚合 + 建议 + upsert
  try {
    const rows = await aggregateWeakness(supabase, user.id);
    return NextResponse.json({ result: rows });
  } catch (e) {
    console.error("[weakness-analysis] 分析失败", e);
    return NextResponse.json(
      { error: "analysis_failed", message: "分析失败，请稍后重试" },
      { status: 500 },
    );
  }
}