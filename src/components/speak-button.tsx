"use client";

import { useState } from "react";
import { speak, stopSpeaking, useSpeechSynthesisSupported } from "@/lib/use-speech";

// 每条 AI 消息旁的小喇叭：点击播放/停止（SPEC 10.1）
export default function SpeakButton({ text }: { text: string }) {
  // 用 useSyncExternalStore 探测，避免服务器无 speechSynthesis 导致 hydration 不一致
  const supported = useSpeechSynthesisSupported();
  const [playing, setPlaying] = useState(false);

  if (!supported) return null;

  function onToggle() {
    if (playing) {
      stopSpeaking();
      setPlaying(false);
      return;
    }
    setPlaying(true);
    speak(text, () => setPlaying(false));
  }

  return (
    <button
      onClick={onToggle}
      aria-label={playing ? "停止播放" : "播放语音"}
      title={playing ? "停止播放" : "播放语音"}
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
          playing
            ? "bg-primary-100 text-primary-600"
            : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        }`}
    >
      {playing ? (
        // 停止图标
        <svg
          viewBox="0 0 24 24"
          className="h-3 w-3"
          fill="currentColor"
        >
          <rect x="6" y="6" width="12" height="12" rx="1" />
        </svg>
      ) : (
        // 喇叭图标
        <svg
          viewBox="0 0 24 24"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M11 5 6 9H2v6h4l5 4z" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M18.5 5.5a9 9 0 0 1 0 13" />
        </svg>
      )}
    </button>
  );
}