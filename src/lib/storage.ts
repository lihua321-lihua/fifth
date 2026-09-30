import type { SupabaseClient } from "@supabase/supabase-js";

// bucket 已改为 public（0005），前端用公共 URL 免签名请求，且可被浏览器 HTTP 缓存（SPEC 6.3：DB 存 path）
export function imagePublicUrl(
  supabase: SupabaseClient,
  path: string | null | undefined,
): string | null {
  if (!path) return null;
  const { data } = supabase.storage.from("question-images").getPublicUrl(path);
  return data?.publicUrl ?? null;
}