import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BottomTab from "@/components/bottom-tab";
import AgentDock from "@/components/agent-dock";
import MistakesList from "./mistakes-list";

export default async function MistakesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto w-full max-w-md p-4 pb-40">
      <h1 className="text-xl font-bold text-gray-900">错题本</h1>
      <MistakesList />

      <BottomTab />
      <AgentDock
        aboveTab
        pageContext={{ route: "/mistakes", page: "错题本" }}
        quickActions={["筛选未掌握", "筛选待复习", "去上传"]}
      />
    </main>
  );
}