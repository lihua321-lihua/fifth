"use client";

import { useState } from "react";
import Link from "next/link";
import {
  MISTAKE_FILTERS,
  type MistakeFilter,
  type MistakeStatus,
} from "@/lib/mistake-types";
import { useMistakes } from "@/lib/swr-fetchers";

const STATUS_BADGE: Record<MistakeStatus, string> = {
  未掌握: "bg-danger-100 text-danger-700",
  学习中: "bg-warning-100 text-warning-700",
  待复习: "bg-info-100 text-info-700",
  已掌握: "bg-success-100 text-success-700",
};

export default function MistakesList() {
  const [filter, setFilter] = useState<MistakeFilter>("全部");
  const { data, error, isLoading } = useMistakes(filter);
  const rows = data ?? [];

  return (
    <div>
      {/* 状态筛选 Tab（客户端切换，SWR key 变化自动重新拉取，不走 SSR） */}
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {MISTAKE_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${
              filter === f
                ? "bg-primary-600 text-white"
                : "bg-white text-gray-500 ring-1 ring-gray-200"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {error ? (
        <div className="mt-10 rounded-2xl bg-danger-50 p-8 text-center">
          <p className="text-sm text-danger-600">加载失败，请重试。</p>
        </div>
      ) : isLoading ? (
        <div className="mt-10 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-white shadow-sm" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-10 rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-gray-400">
            {filter === "全部" ? "还没有错题，去上传一道吧。" : `没有「${filter}」状态的错题。`}
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
          {rows.map((m) => (
            <Link
              key={m.id}
              href={`/mistakes/${m.id}`}
              className="block rounded-2xl bg-white p-4 shadow-sm hover:bg-gray-50"
            >
              <div className="flex gap-3">
                {m.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.imageUrl}
                    alt="题目缩略图"
                    className="h-20 w-16 flex-none rounded-lg border border-gray-100 object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-16 flex-none items-center justify-center rounded-lg bg-gray-100 text-[10px] text-gray-400">
                    原题文本
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      {m.question_type || "题型未识别"}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[m.status as MistakeStatus]}`}
                    >
                      {m.status}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm text-gray-700">
                    知识点：{m.knowledge_points.join("、") || "未识别"}
                  </p>
                  {m.stuck_reason && (
                    <p className="mt-1 line-clamp-2 text-xs text-gray-400">
                      卡点：{m.stuck_reason}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}