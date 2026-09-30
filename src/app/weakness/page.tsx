import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BottomTab from "@/components/bottom-tab";
import AgentDock from "@/components/agent-dock";
import WeaknessClient from "./weakness-client";

export default async function WeaknessPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto w-full max-w-md p-4 pb-40">
      <h1 className="text-xl font-bold text-gray-900">薄弱知识点</h1>
      <WeaknessClient />

      <BottomTab />
      <AgentDock
        aboveTab
        pageContext={{ route: "/weakness", page: "薄弱知识点" }}
        quickActions={["重新分析薄弱点", "去错题本"]}
      />
    </main>
  );
}