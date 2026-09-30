"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

// Web Speech API 能力封装（SPEC 第 10 节）

// ---- 轻量类型（避免依赖 DOM lib 里的 SpeechRecognition 定义缺失） ----

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type SpeechRecognitionErrorEventLike = {
  error?: string;
  message?: string;
};

type SpeechWin = {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
};

function win(): SpeechWin | null {
  if (typeof window === "undefined") return null;
  return window as unknown as SpeechWin;
}

export function speechRecognitionSupported(): boolean {
  const w = win();
  return !!(w?.SpeechRecognition || w?.webkitSpeechRecognition);
}

export function speechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

// 无订阅的空订阅函数（能力恒定 通过 useSyncExternalStore 避免 hydration 不一致）
const noopSubscribe = () => () => {};

// 浏览器能力探测 Hook：SSR/水合阶段返回 false，客户端水合后返回真实值
export function useSpeechRecognitionSupported(): boolean {
  return useSyncExternalStore(noopSubscribe, speechRecognitionSupported, () => false);
}

export function useSpeechSynthesisSupported(): boolean {
  return useSyncExternalStore(noopSubscribe, speechSynthesisSupported, () => false);
}

// ---- 语音音色（voice）选择 ----
const VOICE_KEY = "step-tutor:voice-uri";

let cachedVoices: SpeechSynthesisVoice[] = [];

function loadVoices(): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length) cachedVoices = voices;
}

if (typeof window !== "undefined" && window.speechSynthesis) {
  loadVoices();
  window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
}

export function getSpeechVoices(): SpeechSynthesisVoice[] {
  loadVoices();
  return cachedVoices;
}

export function getSelectedVoiceURI(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(VOICE_KEY) ?? "";
}

export function setSelectedVoiceURI(uri: string): void {
  if (typeof window === "undefined") return;
  if (uri) window.localStorage.setItem(VOICE_KEY, uri);
  else window.localStorage.removeItem(VOICE_KEY);
}

// 仅在用户显式选择音色时才使用；默认（uri 为空）返回 null，
// 由浏览器按 lang="zh-CN" 选普通话默认声；即使有历史选择，也仅允许普通话（zh-CN）。
export function resolveVoice(
  uri: string,
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | null {
  if (!uri || !voices.length) return null;
  const found = voices.find((v) => v.voiceURI === uri);
  return found && found.lang.toLowerCase().startsWith("zh-cn") ? found : null;
}

// 去掉 markdown 标记，供语音朗读使用
export function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, "（代码从略）")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/#{1,6}\s*/g, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/\|/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

// 语音播放（每句 AI 消息旁的小喇叭）
export function speak(text: string, onEnd?: () => void): void {
  if (typeof window === "undefined") return;
  const synth = window.speechSynthesis;
  // 必须用浏览器原生 SpeechSynthesisUtterance 实例，speak() 会做运行时类型校验
  if (!synth || !window.SpeechSynthesisUtterance) return;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(stripMarkdown(text));
  utterance.lang = "zh-CN";
  const voice = resolveVoice(getSelectedVoiceURI(), getSpeechVoices());
  if (voice) utterance.voice = voice;
  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onEnd?.();
  synth.speak(utterance);
}

// 停止当前播放
export function stopSpeaking(): void {
  if (typeof window === "undefined") return;
  window.speechSynthesis?.cancel();
}

// 语音识别错误码 → 可读中文提示（SPEC 10.3：权限被拒等异常要给提示）
function mapSpeechError(event: SpeechRecognitionErrorEventLike | null): string {
  switch (event?.error) {
    case "not-allowed":
    case "service-not-allowed":
      return "麦克风权限被拒绝，请在浏览器设置中允许麦克风后重试";
    case "no-speech":
      return "没有检测到语音，请靠近麦克风再试一次";
    case "audio-capture":
      return "无法访问麦克风，请检查设备或占用麦克风的应用";
    case "network":
      return "语音识别服务不可用（依赖浏览器在线语音服务），请改用文字输入";
    default:
      return "语音识别失败，请改用文字输入";
  }
}

// 语音输入 Hook：识别结果回填到输入框，可修改后发送
export function useSpeechRecognition(onResult: (text: string) => void) {
  const supported = useSpeechRecognitionSupported();
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const onResultRef = useRef(onResult);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    onResultRef.current = onResult;
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, [onResult]);

  const start = useCallback(() => {
    const w = win();
    const Ctor = w?.SpeechRecognition || w?.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "zh-CN";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (event) => {
      // 拼接所有识别结果，避免只读到第一段
      let text = "";
      const results = event.results;
      for (let i = 0; i < results.length; i++) {
        text += results[i]?.[0]?.transcript ?? "";
      }
      if (text) onResultRef.current(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = (event) => {
      setListening(false);
      setError(mapSpeechError(event));
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(() => setError(null), 5000);
    };
    recRef.current = rec;
    setError(null);
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
      setError("无法启动语音识别，请检查浏览器权限");
    }
  }, []);

  const stop = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  return { listening, supported, error, start, stop };
}