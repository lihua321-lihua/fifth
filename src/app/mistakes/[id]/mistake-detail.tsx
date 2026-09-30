"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  MISTAKE_STATUSES,
  type MistakeStatus,
} from "@/lib/mistake-types";
import Markdown from "@/components/markdown";
import { useMistakeDetail } from "@/lib/swr-fetchers";

export default function MistakeDetail({ mistakeId }: { mistakeId: string }) {
  const router = useRouter();
  const supabase = createClient();

  const { data, error: loadError, isLoading } = useMistakeDetail(mistakeId);
  const [status, setStatus] = useState<MistakeStatus>("未掌握");
  const [saving, setSaving] = useState(false);
  const [retutoring, setRetutoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data?.status) setStatus(data.status as MistakeStatus);
  }, [data?.status]);

  // 状态流转（SPEC 11.2）：保存→未掌握；手动改为 学习中/待复习/已掌握
  async function changeStatus(next: MistakeStatus) {
    if (next === status) return;
    setSaving(true);
    setError(null);
    const { error } = await supabase
      .from("mistakes")
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq("id", mistakeId);
    if (error) {
      setError("状态更新失败，请重试");
      setSaving(false);
      return;
    }
    setStatus(next);
    setSaving(false);
    router.refresh();
  }

  // 重新辅导：新建 tutoring_session，关联同一 question
  async function retutor() {
    if (!data?.question_id) {
      setError("该错题缺少关联题目，无法重新辅导");
      return;
    }
    setRetutoring(true);
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const userId = user?.id;
    if (!userId) {
      setError("请先登录");
      setRetutoring(false);
      return;
    }
    const { data: session, error } = await supabase
      .from("tutoring_sessions")
      .insert({
        user_id: userId,
        question_id: data.question_id,
        status: "进行中",
        current_hint_level: "none",
      })
      .select("id")
      .single();
    if (error || !session) {
      setError("重新辅导失败，请重试");
      setRetutoring(false);
      return;
    }
    router.push(`/tutor/${session.id}`);
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-24 animate-pulse rounded-2xl bg-white shadow-sm" />
        <div className="h-24 animate-pulse rounded-2xl bg-white shadow-sm" />
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <div className="mt-10 rounded-2xl bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-gray-400">错题不存在或加载失败。</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">错题详情</h1>
        <button
          onClick={() => router.back()}
          className="text-sm text-primary-600 hover:underline"
        >
          返回
        </button>
      </div>

      {/* 状态下拉 */}
      <div className="mt-3 flex items-center gap-2 rounded-2xl bg-white p-3 shadow-sm">
        <label className="text-sm text-gray-500">状态</label>
        <select
          value={status}
          disabled={saving}
          onChange={(e) => changeStatus(e.target.value as MistakeStatus)}
          className="ml-auto rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none"
        >
          {MISTAKE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mt-3 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-600">
          {error}
        </div>
      )}

      {/* 题目图片 + 文本 */}
      <div className="mt-3 rounded-2xl bg-white p-4 shadow-sm">
        {data.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.imageUrl}
            alt="题目图片"
            className="mb-3 w-full rounded-xl border border-gray-100 object-contain"
          />
        )}
        <p className="text-xs text-gray-500">{data.question_type || "题型未识别"}</p>
        <pre className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
          {data.text || "（无题目文本）"}
        </pre>
      </div>

      {/* 知识点 */}
      <div className="mt-3 rounded-2xl bg-white p-4 shadow-sm">
        <p className="text-xs font-medium text-gray-500">知识点</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {data.knowledge_points.length === 0 ? (
            <span className="text-sm text-gray-400">未识别</span>
          ) : (
            data.knowledge_points.map((kp) => (
              <span
                key={kp}
                className="rounded-full bg-primary-50 px-2 py-0.5 text-xs text-primary-700"
              >
                {kp}
              </span>
            ))
          )}
        </div>
      </div>

      {/* 卡点原因 */}
      {data.stuck_reason && (
        <div className="mt-3 rounded-2xl bg-warning-50 p-4">
          <p className="text-xs font-medium text-warning-700">卡点原因</p>
          <p className="mt-1 text-sm text-warning-800">{data.stuck_reason}</p>
        </div>
      )}

      {/* 辅导总结 */}
      {data.tutoring_summary && (
        <div className="mt-3 rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500">辅导总结</p>
          <div className="mt-2 text-sm leading-relaxed text-gray-700">
            <Markdown>{data.tutoring_summary}</Markdown>
          </div>
        </div>
      )}

      {/* 重新辅导 */}
      <button
        onClick={retutor}
        disabled={retutoring}
        className="mt-5 w-full rounded-xl bg-primary-600 py-3 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
      >
        {retutoring ? "创建中…" : "重新辅导"}
      </button>
    </div>
  );
}