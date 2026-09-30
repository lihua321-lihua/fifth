import { createClient } from "@/lib/supabase/server";
import LogoutButton from "./logout-button";
import BottomTab from "@/components/bottom-tab";
import AgentDock from "@/components/agent-dock";
import ImplNotes from "@/components/impl-notes";
import VoiceSettings from "@/components/voice-settings";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = user?.email ?? "匿名用户";
  const isAnonymous = user?.is_anonymous ?? false;

  return (
    <main className="mx-auto w-full max-w-md p-4 pb-40">
      <h1 className="text-xl font-bold text-gray-900">我的</h1>

      <div className="mt-4 rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-gray-500">当前账号</p>
        <p className="mt-1 text-base font-medium text-gray-900">{email}</p>
        {isAnonymous && (
          <span className="mt-2 inline-block rounded-full bg-success-100 px-2 py-0.5 text-xs text-success-700">
            Demo 匿名账号
          </span>
        )}

        <div className="mt-6">
          <LogoutButton />
        </div>
      </div>

      <ImplNotes />

      <VoiceSettings />

      <BottomTab />
      <AgentDock
        aboveTab
        pageContext={{ route: "/profile", page: "我的" }}
        quickActions={["去上传", "去错题本", "去薄弱点"]}
      />
    </main>
  );
}