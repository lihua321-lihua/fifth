"use client";

import { useState } from "react";
import Link from "next/link";
import { useWeakness } from "@/lib/swr-fetchers";

export type WeaknessRow = {
  id: string;
  knowledge_point: string;
  count: number;
  evidence_mistake_ids: string[];
  suggestion: string | null;
  updated_at: string;
};

export default function WeaknessClient() {
  const { data, error: loadError, isLoading, mutate } = useWeakness();
  const rows = data ?? [];
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reanalyze() {
    setAnalyzing(true);
    setError(null);
    const res = await fetch("/api/weakness-analysis", { method: "POST" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d?.message ?? "分析失败，请重试");
      setAnalyzing(false);
      return;
    }
    setAnalyzing(false);
    mutate();
  }

  return (
    <div>
      {error && (
        <div className="mt-3 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-600">
          {error}
        </div>
      )}

      {loadError ? (
        <div className="mt-10 rounded-2xl bg-danger-50 p-8 text-center">
          <p className="text-sm text-danger-600">加载失败，请重试。</p>
        </div>
      ) : isLoading ? (
        <div className="mt-10 space-y-3">
          <div className="h-24 animate-pulse rounded-2xl bg-white shadow-sm" />
          <div className="h-24 animate-pulse rounded-2xl bg-white shadow-sm" />
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-10 rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-gray-400">
            暂无分析数据。保存错题后会自动生成薄弱知识点分析。
          </p>
          <Link
            href="/upload"
            className="mt-4 inline-block rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
          >
            去上传
          </Link>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900">
                  {row.knowledge_point}
                </h2>
                <span className="rounded-full bg-danger-50 px-2 py-0.5 text-xs font-medium text-danger-600">
                  考查 {row.count} 次
                </span>
              </div>

              {row.suggestion && (
                <p className="mt-2 text-sm leading-relaxed text-gray-700">
                  {row.suggestion}
                </p>
              )}

              {row.evidence_mistake_ids.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-gray-400">相关错题：</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {row.evidence_mistake_ids.map((mid) => (
                      <Link
                        key={mid}
                        href={`/mistakes/${mid}`}
                        className="rounded-lg bg-gray-100 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-200"
                      >
                        错题
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {rows.length > 0 && (
        <>
          <button
            onClick={reanalyze}
            disabled={analyzing}
            className="mt-5 w-full rounded-xl bg-primary-600 py-3 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {analyzing ? "分析中…" : "重新分析"}
          </button>
          <p className="mt-2 text-center text-xs text-gray-400">
            一道题可能涉及多个知识点，故“考查次数”为知识点在错题中的出现次数。
          </p>
        </>
      )}
    </div>
  );
}