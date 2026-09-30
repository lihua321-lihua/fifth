"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { VisionResult } from "@/lib/vision";
import { compressImage } from "@/lib/compress-image";
import { SAMPLE_QUESTIONS } from "@/lib/sample-questions";
import BottomTab from "@/components/bottom-tab";
import AgentDock from "@/components/agent-dock";

type Status = "idle" | "loading" | "ready" | "not_readable" | "out_of_scope" | "error";

// 移动端用 capture 直接起系统相机；桌面端用 getUserMedia 实时拍照
const isMobileDevice =
  typeof navigator !== "undefined" &&
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );

export default function UploadPage() {
  const router = useRouter();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [status, setStatus] = useState<Status>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [vision, setVision] = useState<VisionResult | null>(null);
  const [editedText, setEditedText] = useState("");
  const [isSample, setIsSample] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const [showCamera, setShowCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // 摄像头开关：打开时启动 getUserMedia，关闭时释放
  useEffect(() => {
    if (!showCamera) return;

    let cancelled = false;
    setCameraError(null);
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => {
        if (!cancelled) setCameraError("无法打开摄像头，请检查权限或改用「从相册选择」");
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [showCamera]);

  function takePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], "camera.jpg", { type: "image/jpeg" });
        setShowCamera(false);
        handleFile(file);
      },
      "image/jpeg",
      0.9,
    );
  }

  function handleCameraClick() {
    if (isMobileDevice) {
      cameraInputRef.current?.click();
    } else {
      setShowCamera(true);
    }
  }

  async function handleFile(file: File) {
    setStatus("loading");
    setMessage(null);
    setIsSample(false);

    try {
      const compressed = await compressImage(file);
      setPreviewUrl(compressed.dataUrl);
      setImageBase64(compressed.base64);

      const res = await fetch("/api/vision-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64: compressed.base64 }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setMessage(data?.message ?? "识别失败，请重试");
        return;
      }

      const result: VisionResult = data.result;

      // 超出支持范围 → 阻止
      if (!result.is_in_scope) {
        setStatus("out_of_scope");
        setVision(result);
        setEditedText(result.ocr_text ?? "");
        setMessage(
          result.scope_reason || "当前仅支持初中英语完形填空和阅读理解选择题",
        );
        return;
      }

      // 模糊 / 信心不足 / 无文本 → 不进入辅导
      if (!result.is_readable || result.confidence < 0.6 || !result.ocr_text?.trim()) {
        setStatus("not_readable");
        setVision(result);
        setEditedText(result.ocr_text ?? "");
        setMessage("图片模糊或信息不足，请重拍或手动输入");
        return;
      }

      setVision(result);
      setEditedText(result.ocr_text);
      setStatus("ready");
    } catch {
      setStatus("error");
      setMessage("图片处理失败，请重试");
    }
  }

  function handleSample(id: string) {
    const sample = SAMPLE_QUESTIONS.find((q) => q.id === id);
    if (!sample) return;

    setStatus("ready");
    setIsSample(true);
    setPreviewUrl(null);
    setImageBase64(null);
    setMessage(null);
    setVision({
      is_readable: true,
      confidence: 1,
      ocr_text: sample.text,
      needs_more_info: false,
      missing_info: [],
      is_in_scope: true,
      scope_reason: "初中英语示例题，在支持范围内",
      subject: sample.subject,
      question_type: sample.question_type,
      grade_level: sample.grade_level,
      knowledge_points: sample.knowledge_points,
      brief_analysis: sample.brief_analysis,
    });
    setEditedText(sample.text);
  }

  async function handleConfirm() {
    if (vision && !vision.is_in_scope) {
      setMessage("当前仅支持初中英语完形填空和阅读理解选择题，无法进入辅导");
      return;
    }
    if (!editedText.trim()) {
      setMessage("题目文本为空，请填写后再确认");
      return;
    }

    setConfirming(true);
    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_base64: imageBase64,
          ocr_text: vision?.ocr_text ?? editedText,
          edited_text: editedText,
          subject: vision?.subject ?? "英语",
          question_type: vision?.question_type ?? "",
          grade_level: vision?.grade_level ?? "初中",
          is_in_scope: vision?.is_in_scope ?? true,
          knowledge_points: vision?.knowledge_points ?? [],
          brief_analysis: vision?.brief_analysis ?? "",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage(data?.message ?? "保存失败，请重试");
        setConfirming(false);
        return;
      }

      router.push(`/tutor/${data.sessionId}`);
    } catch {
      setMessage("保存失败，请重试");
      setConfirming(false);
    }
  }

  const canConfirm = status === "ready" && !confirming;

  return (
    <main className="mx-auto w-full max-w-md p-4 pb-44">
      <h1 className="text-xl font-bold text-gray-900">上传识别</h1>
      <p className="mt-1 text-sm text-gray-500">拍照或上传一道初中英语题目</p>

      {/* 图片预览区 */}
      <div className="mt-4">
        {previewUrl ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="题目预览"
              className="w-full rounded-2xl border border-gray-200 bg-white object-contain shadow-sm"
            />
            {status === "loading" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-black/50">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span className="mt-2 text-sm text-white">正在识别题目中…</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-44 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-white text-sm text-gray-400">
            {status === "loading" ? (
              <>
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
                <span className="mt-2">识别中…</span>
              </>
            ) : (
              <>
                <span>暂无图片</span>
                <span className="mt-1 text-xs">
                  {isSample ? "当前为示例题（文本渲染）" : "支持拍照或从相册选择"}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          onClick={handleCameraClick}
          disabled={status === "loading"}
          className="rounded-xl bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
        >
          拍照
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={status === "loading"}
          className="rounded-xl bg-white py-2.5 text-sm font-semibold text-primary-600 ring-1 ring-primary-200 hover:bg-primary-50 disabled:opacity-50"
        >
          从相册选择
        </button>
      </div>

      {/* 桌面端摄像头实时预览 */}
      {showCamera && (
        <div className="mt-3 overflow-hidden rounded-2xl bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full"
          />
          {cameraError && (
            <p className="p-3 text-center text-sm text-danger-400">{cameraError}</p>
          )}
          <div className="flex gap-3 p-3">
            <button
              onClick={takePhoto}
              disabled={!!cameraError}
              className="flex-1 rounded-xl bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
            >
              拍照
            </button>
            <button
              onClick={() => setShowCamera(false)}
              className="flex-1 rounded-xl bg-gray-700 py-2.5 text-sm font-semibold text-white hover:bg-gray-600"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 示例题 */}
      <div className="mt-3 rounded-xl bg-gray-50 p-3">
        <p className="text-xs font-medium text-gray-500">使用示例题（跳过识别）</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {SAMPLE_QUESTIONS.map((q) => (
            <button
              key={q.id}
              onClick={() => handleSample(q.id)}
              disabled={status === "loading"}
              className="rounded-lg bg-white px-3 py-2 text-xs font-medium text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100 disabled:opacity-50"
            >
              {q.question_type}
            </button>
          ))}
        </div>
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />

      {/* 状态提示 */}
      {message && (
        <div
          className={`mt-4 rounded-lg px-3 py-2 text-sm ${
            status === "ready"
              ? "bg-gray-50 text-gray-700"
              : status === "not_readable" || status === "out_of_scope"
                ? "bg-warning-50 text-warning-700"
                : "bg-danger-50 text-danger-600"
          }`}
        >
          {message}
        </div>
      )}

      {/* 缺失信息提示（黄色卡片） */}
      {vision && vision.needs_more_info && vision.missing_info.length > 0 && (
        <div className="mt-3 rounded-lg bg-warning-50 px-3 py-2 text-sm text-warning-700">
          <p className="font-medium">信息不足，请补充：</p>
          <ul className="mt-1 list-inside list-disc">
            {vision.missing_info.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 可编辑文本域 */}
      {status !== "idle" && status !== "loading" && (
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700">
            题目文本（可编辑）
          </label>
          <textarea
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            rows={9}
            placeholder="识别后的题目文字将显示在这里，可手动修改"
            className="mt-1 w-full resize-y rounded-xl border border-gray-300 px-3 py-2 text-sm leading-relaxed focus:border-primary-500 focus:outline-none"
          />
        </div>
      )}

      {/* 识别元信息 */}
      {status === "ready" && vision && (
        <div className="mt-3 rounded-xl bg-white p-3 text-xs text-gray-600 shadow-sm">
          <p>
            题型：{vision.question_type || "未识别"} · 年级：{vision.grade_level || "初中"}
          </p>
          {vision.knowledge_points.length > 0 && (
            <p className="mt-1">知识点：{vision.knowledge_points.join("、")}</p>
          )}
          {vision.brief_analysis && (
            <p className="mt-1 text-gray-500">{vision.brief_analysis}</p>
          )}
        </div>
      )}

      {/* 确认按钮 */}
      <button
        onClick={handleConfirm}
        disabled={!canConfirm}
        className="mt-5 w-full rounded-xl bg-primary-600 py-3 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-40"
      >
        {confirming ? "保存中…" : "确认并开始辅导"}
      </button>

      <p className="mt-3 text-center text-xs text-gray-400">
        已实现：拍照/上传、DeepSeek 读图、可编辑文本 · 已知限制见「我的」页
      </p>

      <BottomTab />
      <AgentDock
        aboveTab
        pageContext={{ route: "/upload", page: "上传识别" }}
        quickActions={["怎么使用", "支持什么题型", "去错题本"]}
      />
    </main>
  );
}