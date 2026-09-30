"use client";

import { useEffect, useState } from "react";
import {
  getSpeechVoices,
  getSelectedVoiceURI,
  setSelectedVoiceURI,
  speak,
  stopSpeaking,
  useSpeechSynthesisSupported,
} from "@/lib/use-speech";

// 语音音色设置（SPEC 10）：可选人声，选择即时试听，持久化到 localStorage
export default function VoiceSettings() {
  const supported = useSpeechSynthesisSupported();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selected, setSelected] = useState<string>("");

  useEffect(() => {
    if (!supported) return;
    const refresh = () => {
      setVoices(getSpeechVoices());
      setSelected(getSelectedVoiceURI());
    };
    refresh();
    window.speechSynthesis?.addEventListener("voiceschanged", refresh);
    return () =>
      window.speechSynthesis?.removeEventListener("voiceschanged", refresh);
  }, [supported]);

  if (!supported) return null;

  // 仅列出简体普通话（zh-CN）音色，避免粤语/台湾腔等非普通话
  const zhCN = voices.filter((v) => v.lang.toLowerCase().startsWith("zh-cn"));
  const sorted = [...zhCN].sort((a, b) => a.name.localeCompare(b.name, "zh-cn"));

  function onSelect(uri: string) {
    setSelected(uri);
    setSelectedVoiceURI(uri);
    stopSpeaking();
    speak(uri ? "你好，这是当前音色的试听。" : "你好，这是默认普通话的试听。");
  }

  return (
    <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-gray-900">语音音色</p>
      <p className="mt-0.5 text-xs text-gray-400">
        可选音色由浏览器 / 系统 TTS 引擎提供，选择后立即试听并自动保存。
      </p>
      <select
        value={selected}
        onChange={(e) => onSelect(e.target.value)}
        className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
      >
        <option value="">自动（默认普通话）</option>
        {sorted.map((v) => (
          <option key={v.voiceURI} value={v.voiceURI}>
            {v.name}（{v.lang}）
          </option>
        ))}
      </select>
    </div>
  );
}