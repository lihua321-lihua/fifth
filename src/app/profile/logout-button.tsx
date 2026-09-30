"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="w-full rounded-lg bg-gray-200 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-300 disabled:opacity-50"
    >
      {loading ? "退出中…" : "退出登录"}
    </button>
  );
}