import useSWR from "swr";
import { createClient } from "@/lib/supabase/client";
import { imagePublicUrl } from "@/lib/storage";
import type { MistakeFilter } from "@/lib/mistake-types";
import type { WeaknessRow } from "@/app/weakness/weakness-client";

// 浏览器端 Supabase 客户端单例：仅在 fetcher（客户端执行）时创建，避免 SSR 阶段实例化
let _client: ReturnType<typeof createClient> | null = null;
function client() {
  if (!_client) _client = createClient();
  return _client;
}

export type MistakeListItem = {
  id: string;
  status: string;
  stuck_reason: string | null;
  knowledge_points: string[];
  question_type: string;
  created_at: string;
  imageUrl: string | null;
};

type RawMistake = {
  id: string;
  status: string;
  stuck_reason: string | null;
  knowledge_points: string[] | null;
  image_url: string | null;
  created_at: string;
  questions:
    | { question_type: string | null }
    | { question_type: string | null }[]
    | null;
};

export function useMistakes(filter: MistakeFilter) {
  return useSWR<MistakeListItem[]>(`mistakes:${filter}`, async () => {
    const supabase = client();
    let q = supabase
      .from("mistakes")
      .select(
        "id,status,stuck_reason,knowledge_points,image_url,created_at,questions(question_type)",
      )
      .order("created_at", { ascending: false });
    if (filter !== "全部") q = q.eq("status", filter);

    const { data, error } = await q;
    if (error) throw error;

    return ((data ?? []) as unknown as RawMistake[]).map((m) => {
      const qq = m.questions;
      const qt = Array.isArray(qq) ? qq[0]?.question_type : qq?.question_type;
      return {
        id: m.id,
        status: m.status,
        stuck_reason: m.stuck_reason,
        knowledge_points: m.knowledge_points ?? [],
        question_type: qt ?? "",
        created_at: m.created_at,
        imageUrl: imagePublicUrl(supabase, m.image_url),
      };
    });
  });
}

export type MistakeDetailData = {
  id: string;
  question_id: string | null;
  text: string;
  question_type: string;
  knowledge_points: string[];
  stuck_reason: string;
  tutoring_summary: string;
  status: string;
  imageUrl: string | null;
};

type RawMistakeDetail = {
  id: string;
  question_id: string | null;
  text: string | null;
  status: string;
  stuck_reason: string | null;
  tutoring_summary: string | null;
  knowledge_points: string[] | null;
  image_url: string | null;
  questions:
    | { question_type: string | null }
    | { question_type: string | null }[]
    | null;
};

export function useMistakeDetail(id: string) {
  return useSWR<MistakeDetailData | null>(`mistake:${id}`, async () => {
    const supabase = client();
    const { data, error } = await supabase
      .from("mistakes")
      .select("*, questions(question_type)")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    const m = data as unknown as RawMistakeDetail;
    const qq = m.questions;
    const qt = Array.isArray(qq) ? qq[0]?.question_type : qq?.question_type;
    return {
      id: m.id,
      question_id: m.question_id,
      text: m.text ?? "",
      question_type: qt ?? "",
      knowledge_points: m.knowledge_points ?? [],
      stuck_reason: m.stuck_reason ?? "",
      tutoring_summary: m.tutoring_summary ?? "",
      status: m.status,
      imageUrl: imagePublicUrl(supabase, m.image_url),
    };
  });
}

export function useWeakness() {
  return useSWR<WeaknessRow[]>("weakness", async () => {
    const supabase = client();
    const { data, error } = await supabase
      .from("weakness_analysis")
      .select("*")
      .order("count", { ascending: false });
    if (error) throw error;
    return (data ?? []) as WeaknessRow[];
  });
}