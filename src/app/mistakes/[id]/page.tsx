import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BottomTab from "@/components/bottom-tab";
import AgentDock from "@/components/agent-dock";
import MistakeDetail from "./mistake-detail";

export default async function MistakeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto w-full max-w-md p-4 pb-32">
      <MistakeDetail mistakeId={id} />

      <BottomTab />
      <AgentDock
        aboveTab
        pageContext={{
          route: "/mistakes/[id]",
          page: "错题详情",
          selectedMistake: { id },
        }}
        quickActions={[
          "改成学习中",
          "改成待复习",
          "改成已掌握",
          "重新辅导",
        ]}
      />
    </main>
  );
}