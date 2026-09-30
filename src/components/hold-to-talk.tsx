"use client";

import { useRef } from "react";
import { useSpeechRecognition } from "@/lib/use-speech";

type Props = {
  onResult: (text: string) => void;
  sizeClass?: string;
  idleClass?: string;
  iconClass?: string;
};

// 按住说话（麦克风）：按住开始录音、松开发送；按住时显示「松开停止」提示
export default function HoldToTalk({
  onResult,
  sizeClass = "h-9 w-9 rounded-lg",
  idleClass = "text-gray-500 hover:bg-gray-100",
  iconClass = "h-4 w-4",
}: Props) {
  const { listening, supported, error, start, stop } = useSpeechRecognition(onResult);
  const pressing = useRef(false);

  if (!supported) return null;

  function stopIfPressing() {
    if (pressing.current) {
      pressing.current = false;
      stop();
    }
  }

  return (
    <span className="relative flex-none">
      {(listening || error) && (
        <span className="pointer-events-none absolute -top-9 left-1/2 z-10 w-max max-w-[220px] -translate-x-1/2 whitespace-normal rounded-md bg-gray-800 px-2 py-1 text-center text-xs leading-snug text-white shadow">
          {error ?? "松开停止"}
        </span>
      )}
      <button
        onPointerDown={(e) => {
          e.preventDefault();
          pressing.current = true;
          start();
        }}
        onPointerUp={stopIfPressing}
        onPointerLeave={stopIfPressing}
        onPointerCancel={stopIfPressing}
        onContextMenu={(e) => e.preventDefault()}
        aria-label="按住说话，松开发送"
        className={`flex ${sizeClass} flex-none touch-none select-none items-center justify-center ${
          listening ? "bg-danger-50 text-danger-500" : idleClass
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          className={iconClass}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z" />
          <path d="M19 11a7 7 0 0 1-14 0" />
        </svg>
      </button>
    </span>
  );
}