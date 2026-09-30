"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "register";

export default function LoginForm() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleEmailAuth() {
    setLoading(true);
    setError(null);
    setNotice(null);

    if (!email || !password) {
      setError("请输入邮箱和密码");
      setLoading(false);
      return;
    }

    const { error } =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    if (error) {
      setError(translateAuthError(error.message));
      setLoading(false);
      return;
    }

    if (mode === "register") {
      // 注册成功（若开启邮箱确认，则提示查收邮件；MVP 关闭确认，直接进入）
      setNotice("注册成功，正在进入…");
    }

    router.push("/upload");
    router.refresh();
    setLoading(false);
  }

  async function handleDemo() {
    setLoading(true);
    setError(null);
    setNotice(null);

    const { error } = await supabase.auth.signInAnonymously();
    if (error) {
      setError("Demo 登录失败：" + translateAuthError(error.message));
      setLoading(false);
      return;
    }

    router.push("/upload");
    router.refresh();
    setLoading(false);
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
  }

  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">小步辅导</h1>
          <p className="mt-1 text-sm text-gray-500">初中英语 AI 作业辅导 + 错题本</p>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-600">
              {error}
            </div>
          )}
          {notice && (
            <div className="rounded-lg bg-success-50 px-3 py-2 text-sm text-success-600">
              {notice}
            </div>
          )}

          <button
            onClick={handleEmailAuth}
            disabled={loading}
            className="w-full rounded-lg bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {loading ? "处理中…" : mode === "login" ? "登录" : "注册"}
          </button>

          <button
            onClick={handleDemo}
            disabled={loading}
            className="w-full rounded-lg bg-white py-2.5 text-sm font-semibold text-primary-600 ring-1 ring-primary-200 hover:bg-primary-50 disabled:opacity-50"
          >
            一键体验 Demo（匿名登录）
          </button>

          <button
            onClick={() => switchMode(mode === "login" ? "register" : "login")}
            disabled={loading}
            className="w-full text-center text-sm text-primary-600 hover:underline"
          >
            {mode === "login" ? "没有账号？去注册" : "已有账号？去登录"}
          </button>
        </div>
      </div>

      <div className="mt-4 text-center">
        <Link
          href="/about"
          className="text-sm text-gray-600 underline underline-offset-2 hover:text-primary-600"
        >
          产品说明
        </Link>
      </div>
    </div>
  );
}

function translateAuthError(message: string): string {
  if (message.includes("Invalid login credentials")) return "邮箱或密码错误";
  if (message.includes("already registered")) return "该邮箱已注册，请直接登录";
  if (message.includes("password")) return "密码不符合要求（至少 6 位）";
  if (message.includes("Email not confirmed")) return "邮箱未确认，请查收邮件";
  return message;
}